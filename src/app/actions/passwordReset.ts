"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone, isValidIsraeliMobile } from "@/lib/phone";
import { sendWhatsappMessage } from "@/lib/whatsapp";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_CODE_TTL_MS = 10 * 60 * 1000;

export type RequestResetState = {
  error?: string;
  status?: "sent" | "contact_admin";
  teacherId?: string;
};

// Same "contact system admin" outcome whether the email/phone pair doesn't
// match any teacher, or it does but WhatsApp isn't connected - collapsing
// both into one status (and message) avoids revealing which one it was,
// same as loginAction's identical error for a wrong email vs wrong password.
export async function requestPasswordResetAction(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  if (!EMAIL_REGEX.test(email)) {
    return { error: "יש להזין כתובת אימייל תקינה." };
  }
  const phone = normalizePhone(phoneRaw);
  if (!isValidIsraeliMobile(phone)) {
    return { error: "מספר הטלפון חייב להתחיל ב-05 ולכלול 10 ספרות." };
  }

  const ip = await getClientIp();
  const ipOk = checkRateLimit(`pwreset:ip:${ip}`, 5, 15 * 60 * 1000);
  const emailOk = checkRateLimit(`pwreset:email:${email}`, 5, 15 * 60 * 1000);
  if (!ipOk || !emailOk) {
    return { error: "יותר מדי ניסיונות. נסי שוב מאוחר יותר." };
  }

  const teacher = await db.teacher.findUnique({ where: { email } });
  if (!teacher || teacher.isDisabled || teacher.phone !== phone || !teacher.whatsappConnected) {
    return { status: "contact_admin" };
  }

  // 1000-9999: a plain 4-digit code, no leading-zero padding needed.
  const code = randomInt(1000, 10000).toString();
  const codeHash = await hashPassword(code);
  await db.teacher.update({
    where: { id: teacher.id },
    data: {
      passwordResetCodeHash: codeHash,
      passwordResetCodeExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
    },
  });

  try {
    await sendWhatsappMessage(teacher.id, teacher.phone, `קוד לאיפוס הסיסמה שלך: ${code}`);
  } catch (error) {
    console.error(`Failed to send password reset WhatsApp code to teacher ${teacher.id}`, error);
    return { status: "contact_admin" };
  }

  return { status: "sent", teacherId: teacher.id };
}

export type VerifyResetState = {
  error?: string;
};

export async function verifyPasswordResetCodeAction(
  _prevState: VerifyResetState,
  formData: FormData
): Promise<VerifyResetState> {
  const teacherId = String(formData.get("teacherId") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!teacherId || !/^\d{4}$/.test(code)) {
    return { error: "קוד שגוי." };
  }

  // Caps brute-forcing a 4-digit code (10,000 possibilities) at 5 guesses
  // per 10-minute window; a new code (and window) requires starting over.
  if (!checkRateLimit(`pwreset:verify:${teacherId}`, 5, 10 * 60 * 1000)) {
    return { error: "יותר מדי ניסיונות. יש לבקש קוד חדש." };
  }

  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (
    !teacher ||
    teacher.isDisabled ||
    !teacher.passwordResetCodeHash ||
    !teacher.passwordResetCodeExpiresAt ||
    teacher.passwordResetCodeExpiresAt < new Date()
  ) {
    return { error: "הקוד פג תוקף. יש לבקש קוד חדש." };
  }

  const isValid = await verifyPassword(code, teacher.passwordResetCodeHash);
  if (!isValid) {
    return { error: "קוד שגוי." };
  }

  await db.teacher.update({
    where: { id: teacher.id },
    data: { passwordResetCodeHash: null, passwordResetCodeExpiresAt: null },
  });

  await createSession(teacher.id);
  redirect("/dashboard");
}
