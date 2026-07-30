"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export type AuthActionState = {
  error?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const ip = await getClientIp();
  if (!checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: "יותר מדי ניסיונות. נסי שוב מאוחר יותר." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) {
    return { error: "יש להזין שם." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { error: "יש להזין כתובת אימייל תקינה." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `הסיסמה חייבת לכלול לפחות ${MIN_PASSWORD_LENGTH} תווים.` };
  }

  const existing = await db.teacher.findUnique({ where: { email } });
  if (existing) {
    return { error: "כבר קיים חשבון עם כתובת האימייל הזו." };
  }

  const passwordHash = await hashPassword(password);
  const teacher = await db.teacher.create({
    data: { name, email, passwordHash },
  });

  await createSession(teacher.id);
  redirect("/dashboard");
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const ip = await getClientIp();
  const ipOk = checkRateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000);
  const emailOk = checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
  if (!ipOk || !emailOk) {
    return { error: "יותר מדי ניסיונות התחברות. נסי שוב בעוד כמה דקות." };
  }

  const teacher = await db.teacher.findUnique({ where: { email } });
  const isValid = teacher ? await verifyPassword(password, teacher.passwordHash) : false;

  if (!teacher || !isValid) {
    return { error: "אימייל או סיסמה שגויים." };
  }
  if (teacher.isDisabled) {
    return { error: "חשבון זה הושבת. יש לפנות למנהל המערכת." };
  }

  await createSession(teacher.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
