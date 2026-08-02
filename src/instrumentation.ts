export async function register() {
  // The e2e suite never exercises real WhatsApp connectivity, and this
  // pulls in Baileys' full (crypto-heavy) dependency graph synchronously
  // at boot - real cost, zero benefit there, and this project's own
  // playwright.config.ts already notes route-compile latency is tight
  // enough under CI parallelism to matter.
  if (process.env.DISABLE_WHATSAPP_RESTORE === "1") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // A failure here (DB hiccup, stale Prisma client, etc.) must not take
    // down the whole server at boot - worst case, previously-linked
    // teachers just stay disconnected until the next restart or until they
    // re-link, instead of the app failing to start at all.
    try {
      const { restoreWhatsappSessions } = await import("@/lib/whatsapp");
      await restoreWhatsappSessions();
    } catch (error) {
      console.error("Failed to restore WhatsApp sessions on boot", error);
    }
  }
}
