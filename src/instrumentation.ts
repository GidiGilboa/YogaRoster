export async function register() {
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
