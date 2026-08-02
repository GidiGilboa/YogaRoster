export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidIsraeliMobile(digits: string): boolean {
  return digits.startsWith("05") && digits.length === 10;
}

export function formatIsraeliPhone(digits: string): string {
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// The reverse of fromWhatsappJid below: local "0501112222" -> international
// "972501112222", the form Baileys needs to address an outbound message.
export function toWhatsappInternational(digits: string): string {
  return `972${digits.slice(1)}`;
}

// Baileys reports the linked account as a JID like "972501112222:12@s.whatsapp.net"
// once a QR scan connects - this pulls out the Israeli local-format number
// ("0501112222") for display, matching how phone numbers are shown everywhere
// else in the app. Returns null if the JID isn't a recognizable Israeli number.
export function fromWhatsappJid(jid: string): string | null {
  const match = /^972(\d{9})/.exec(jid);
  return match ? `0${match[1]}` : null;
}
