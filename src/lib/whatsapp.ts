import path from "node:path";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { db } from "@/lib/db";
import { fromWhatsappJid, toWhatsappInternational } from "@/lib/phone";

const SESSIONS_DIR = path.join(process.cwd(), ".whatsapp-sessions");
const logger = pino({ level: "silent" });

export type Session = {
  sock: WASocket;
  qr?: string;
};

// Baileys sessions are long-lived sockets held in process memory - they must
// survive Next.js dev-mode module reloads, so this is stashed on globalThis
// the same way src/lib/db.ts holds its Prisma client singleton.
const globalForWhatsapp = globalThis as unknown as {
  whatsappSessions: Map<string, Session> | undefined;
};

const sessions = globalForWhatsapp.whatsappSessions ?? new Map<string, Session>();
globalForWhatsapp.whatsappSessions = sessions;

// Ensures a WhatsApp session exists for this teacher, creating one (and
// starting the QR-linking handshake) if it doesn't. Safe to call on every
// status poll - an existing session is returned immediately, no new socket
// is created.
export async function getWhatsappSession(teacherId: string): Promise<Session> {
  const existing = sessions.get(teacherId);
  if (existing) return existing;

  const { state, saveCreds } = await useMultiFileAuthState(path.join(SESSIONS_DIR, teacherId));

  // The library bundles a WhatsApp Web protocol version at release time;
  // WhatsApp's backend moves faster than that, and a stale version is a
  // common cause of the socket getting closed immediately on connect.
  // Fetching the current one at runtime avoids that - falling back to the
  // bundled default only if the version-check request itself can't be made.
  const version = await fetchLatestBaileysVersion()
    .then((result) => result.version)
    .catch((error) => {
      console.error("Failed to fetch latest WhatsApp protocol version, using the bundled default", error);
      return undefined;
    });

  const sock = makeWASocket({ auth: state, logger, version });
  const session: Session = { sock };
  sessions.set(teacherId, session);

  sock.ev.on("creds.update", () => {
    saveCreds().catch((error) => console.error(`Failed to save WhatsApp creds for teacher ${teacherId}`, error));
  });

  sock.ev.on("connection.update", async (update) => {
    // Baileys' EventEmitter doesn't await or catch listener promises, so an
    // uncaught throw in here becomes an unhandled rejection - and Node kills
    // the whole process on those by default. Nothing in this handler may be
    // allowed to escape uncaught.
    try {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qr = qr;
      }

      if (connection === "open") {
        session.qr = undefined;
        const phone = sock.user?.id ? fromWhatsappJid(sock.user.id) : null;
        await db.teacher.update({
          where: { id: teacherId },
          data: {
            whatsappConnected: true,
            whatsappConnectedAt: new Date(),
            ...(phone ? { whatsappPhone: phone } : {}),
          },
        });
      } else if (connection === "close") {
        sessions.delete(teacherId);
        // A DB hiccup here must not skip the reconnect attempt below it - if
        // it did, a teacher could end up stuck with the DB still saying
        // "connected" while no live session exists at all.
        try {
          await db.teacher.update({ where: { id: teacherId }, data: { whatsappConnected: false } });
        } catch (dbError) {
          console.error(`Failed to mark teacher ${teacherId} as disconnected`, dbError);
        }

        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        // A drop that isn't an explicit logout (network blip, server restart,
        // or an unscanned QR simply expiring) is recoverable - reconnect
        // using the same persisted session, which starts a fresh QR
        // handshake if one hadn't completed yet. No backoff/retry cap here:
        // if the drop keeps recurring, the indicator just keeps flipping to
        // "not connected", which is visible and safe rather than silently
        // giving up.
        if (!loggedOut) {
          await getWhatsappSession(teacherId);
        }
      }
    } catch (error) {
      console.error(`Error handling WhatsApp connection update for teacher ${teacherId}`, error);
    }
  });

  return session;
}

// Resolves once the socket reaches "open", or rejects on timeout/close.
// sock.user is only populated once "open" has fired at least once, so an
// already-live session resolves immediately without waiting on anything.
function waitForOpenConnection(sock: WASocket, timeoutMs: number): Promise<void> {
  if (sock.user) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.ev.off("connection.update", onUpdate);
      reject(new Error("Timed out waiting for WhatsApp to reconnect."));
    }, timeoutMs);

    function onUpdate(update: { connection?: string }) {
      if (update.connection === "open") {
        clearTimeout(timer);
        sock.ev.off("connection.update", onUpdate);
        resolve();
      } else if (update.connection === "close") {
        clearTimeout(timer);
        sock.ev.off("connection.update", onUpdate);
        reject(new Error("WhatsApp connection closed while reconnecting."));
      }
    }

    sock.ev.on("connection.update", onUpdate);
  });
}

// Sends a text message to a student's phone from the teacher's linked
// session. The caller (sendLessonReminderAction) already checked the DB's
// whatsappConnected flag before calling this, so getting/creating the
// session here is safe - it won't kick off an unwanted QR/link attempt for
// someone who was never connected. What actually determines readiness to
// send is whether the live socket has reached "open", NOT the persisted
// creds.registered flag: that flag reflects whether pairing has EVER fully
// completed (tied to background history-sync, observed to lag behind by
// more than a few seconds) rather than whether THIS socket is connected
// right now, so gating sends on it produces false "not connected" failures
// even on a socket that's been open and working the whole time.
export async function sendWhatsappMessage(teacherId: string, localPhoneDigits: string, text: string): Promise<void> {
  const session = await getWhatsappSession(teacherId);

  try {
    await waitForOpenConnection(session.sock, 15000);
  } catch {
    throw new Error("וואטסאפ לא מחובר.");
  }

  const jid = `${toWhatsappInternational(localPhoneDigits)}@s.whatsapp.net`;
  await session.sock.sendMessage(jid, { text });
}

// Called once on server boot (see src/instrumentation.ts) so a restart
// doesn't strand previously-linked teachers on a dead in-memory session -
// the persisted auth state lets Baileys resume without a new QR scan.
export async function restoreWhatsappSessions(): Promise<void> {
  const connectedTeachers = await db.teacher.findMany({
    where: { whatsappConnected: true },
    select: { id: true },
  });
  await Promise.all(
    connectedTeachers.map((teacher) =>
      getWhatsappSession(teacher.id).catch((error) => {
        console.error(`Failed to restore WhatsApp session for teacher ${teacher.id}`, error);
      })
    )
  );
}
