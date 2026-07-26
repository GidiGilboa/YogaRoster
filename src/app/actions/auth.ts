"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";

export type AuthActionState = {
  error?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
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
    data: {
      name,
      email,
      passwordHash,
      students: {
        create: { firstName: "Student A", lastName: email },
      },
    },
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

  const teacher = await db.teacher.findUnique({ where: { email } });
  const isValid = teacher ? await verifyPassword(password, teacher.passwordHash) : false;

  if (!teacher || !isValid) {
    return { error: "אימייל או סיסמה שגויים." };
  }

  await createSession(teacher.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
