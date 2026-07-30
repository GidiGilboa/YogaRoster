"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone, isValidIsraeliMobile } from "@/lib/phone";

export type SettingsActionState = {
  error?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function saveBackgroundImage(teacherId: string, file: File): Promise<string | { error: string }> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "התמונה גדולה מדי (מקסימום 5MB)." };
  }
  const extension = IMAGE_EXTENSION_BY_MIME[file.type];
  if (!extension) {
    return { error: "יש להעלות קובץ תמונה (JPEG, PNG, WEBP או GIF)." };
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `teacher-${teacherId}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/${filename}?v=${Date.now()}`;
}

export async function updateSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const teacher = await requireTeacher();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const appName = String(formData.get("appName") ?? "").trim();
  const capacityRaw = String(formData.get("defaultLessonCapacity") ?? "");
  const durationRaw = String(formData.get("defaultLessonDuration") ?? "");
  const backgroundImage = formData.get("backgroundImage");
  const removeBackgroundImage = formData.get("removeBackgroundImage") === "on";

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

  const existing = await db.teacher.findUnique({ where: { email } });
  if (existing && existing.id !== teacher.id) {
    return { error: "כבר קיים חשבון עם כתובת האימייל הזו." };
  }

  let backgroundImageUrl: string | undefined;
  if (backgroundImage instanceof File && backgroundImage.size > 0) {
    const result = await saveBackgroundImage(teacher.id, backgroundImage);
    if (typeof result === "object") {
      return result;
    }
    backgroundImageUrl = result;
  }

  await db.teacher.update({
    where: { id: teacher.id },
    data: {
      name,
      email,
      phone: phone || null,
      appName,
      defaultLessonCapacity: capacity,
      defaultLessonDuration: duration,
      ...(removeBackgroundImage ? { backgroundImageUrl: null } : {}),
      ...(backgroundImageUrl ? { backgroundImageUrl } : {}),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lessons");
  revalidatePath(`/plan/${teacher.id}`);
  return {};
}
