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
