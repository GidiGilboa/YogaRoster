"use server";

import QRCode from "qrcode";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWhatsappSession } from "@/lib/whatsapp";

export type WhatsappQrStatus = {
  connected: boolean;
  phone: string | null;
  connectedAt: Date | null;
  qrDataUrl: string | null;
  error?: string;
};

// Called both when the teacher clicks "connect" and on every poll while
// waiting for a scan - ensures a session/QR handshake is running and
// reports its current state. No form input needed: unlike the old
// pairing-code flow, QR linking doesn't ask for a phone number up front -
// whichever phone scans the code determines the linked number.
export async function getWhatsappQrStatusAction(): Promise<WhatsappQrStatus> {
  const teacher = await requireTeacher();

  let qr: string | null = null;
  try {
    const session = await getWhatsappSession(teacher.id);
    qr = session.qr ?? null;
  } catch (error) {
    console.error(`Failed to start/check WhatsApp session for teacher ${teacher.id}`, error);
    return {
      connected: false,
      phone: null,
      connectedAt: null,
      qrDataUrl: null,
      error: "לא הצלחנו להתחבר לוואטסאפ כרגע. נסי שוב בעוד רגע.",
    };
  }

  const current = await db.teacher.findUniqueOrThrow({
    where: { id: teacher.id },
    select: { whatsappConnected: true, whatsappPhone: true, whatsappConnectedAt: true },
  });

  const qrDataUrl = !current.whatsappConnected && qr ? await QRCode.toDataURL(qr) : null;

  return {
    connected: current.whatsappConnected,
    phone: current.whatsappPhone,
    connectedAt: current.whatsappConnectedAt,
    qrDataUrl,
  };
}
