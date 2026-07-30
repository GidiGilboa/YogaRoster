"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createAdminSession, destroyAdminSession, requireAdmin, verifyAdminCredentials } from "@/lib/adminAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone, isValidIsraeliMobile } from "@/lib/phone";

export type AdminAuthActionState = {
  error?: string;
};

export async function adminLoginAction(
  _prevState: AdminAuthActionState,
  formData: FormData
): Promise<AdminAuthActionState> {
  const ip = await getClientIp();
  if (!checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000)) {
    return { error: "יותר מדי ניסיונות התחברות. נסי שוב בעוד כמה דקות." };
  }

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const isValid = await verifyAdminCredentials(username, password);
  if (!isValid) {
    return { error: "שם משתמש או סיסמה שגויים." };
  }

  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

export type AdminTeacherActionState = {
  error?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function adminUpdateTeacherAction(
  teacherId: string,
  _prevState: AdminTeacherActionState,
  formData: FormData
): Promise<AdminTeacherActionState> {
  await requireAdmin();

  const existing = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!existing) {
    return { error: "המורה לא נמצאה." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const appName = String(formData.get("appName") ?? "").trim();
  const capacityRaw = String(formData.get("defaultLessonCapacity") ?? "");
  const durationRaw = String(formData.get("defaultLessonDuration") ?? "");

  if (!name) {
    return { error: "יש להזין שם." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { error: "יש להזין כתובת אימייל תקינה." };
  }
  if (!appName) {
    return { error: "יש להזין שם אפליקציה." };
  }

  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  if (phoneRaw && !isValidIsraeliMobile(phone)) {
    return { error: "מספר הטלפון חייב להתחיל ב-05 ולכלול 10 ספרות." };
  }

  const capacity = Number(capacityRaw);
  if (!Number.isInteger(capacity) || capacity <= 0) {
    return { error: "יש להזין מספר מקומות ברירת מחדל תקין." };
  }

  const duration = Number(durationRaw);
  if (!Number.isInteger(duration) || duration <= 0) {
    return { error: "יש להזין משך שיעור ברירת מחדל תקין." };
  }

  const emailOwner = await db.teacher.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== teacherId) {
    return { error: "כבר קיים חשבון עם כתובת האימייל הזו." };
  }

  await db.teacher.update({
    where: { id: teacherId },
    data: {
      name,
      email,
      phone: phone || null,
      appName,
      defaultLessonCapacity: capacity,
      defaultLessonDuration: duration,
    },
  });

  revalidatePath("/admin");
  return {};
}

export async function adminSetTeacherDisabledAction(
  teacherId: string,
  isDisabled: boolean
): Promise<AdminTeacherActionState> {
  await requireAdmin();

  const existing = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!existing) {
    return { error: "המורה לא נמצאה." };
  }

  await db.teacher.update({ where: { id: teacherId }, data: { isDisabled } });

  revalidatePath("/admin");
  return {};
}
