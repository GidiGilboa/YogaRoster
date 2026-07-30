"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createStudentSession } from "@/lib/studentAuth";
import { isValidIsraeliMobile, normalizePhone } from "@/lib/phone";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export type IdentifyActionState = {
  error?: string;
};

export async function identifyStudentAction(
  teacherId: string,
  returnTo: string,
  _prevState: IdentifyActionState,
  formData: FormData
): Promise<IdentifyActionState> {
  const ip = await getClientIp();
  if (!checkRateLimit(`identify:${ip}`, 10, 5 * 60 * 1000)) {
    return { error: "יותר מדי ניסיונות. נסי שוב בעוד כמה דקות." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  if (!name) {
    return { error: "יש להזין שם." };
  }
  if (!isValidIsraeliMobile(phone)) {
    return { error: "מספר הטלפון חייב להתחיל ב-05 ולכלול 10 ספרות." };
  }

  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) {
    return { error: "המורה לא נמצאה." };
  }

  let student = await db.student.findUnique({
    where: { teacherId_phone: { teacherId, phone } },
  });

  if (!student) {
    const spaceIndex = name.indexOf(" ");
    const firstName = spaceIndex === -1 ? name : name.slice(0, spaceIndex);
    const lastName = spaceIndex === -1 ? "" : name.slice(spaceIndex + 1).trim();

    student = await db.student.create({
      data: { teacherId, firstName, lastName, phone },
    });
  }

  await createStudentSession(teacherId, student.id);

  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : `/plan/${teacherId}`;
  redirect(safeReturnTo);
}
