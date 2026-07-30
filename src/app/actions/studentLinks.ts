"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

export type StudentLinkActionState = {
  error?: string;
};

export async function addStudentLinkAction(
  registrarStudentId: string,
  dependentStudentId: string
): Promise<StudentLinkActionState> {
  const teacher = await requireTeacher();

  if (registrarStudentId === dependentStudentId) {
    return { error: "לא ניתן לרשום תלמידה עבור עצמה." };
  }

  const [registrar, dependent] = await Promise.all([
    db.student.findUnique({ where: { id: registrarStudentId } }),
    db.student.findUnique({ where: { id: dependentStudentId } }),
  ]);
  if (!registrar || registrar.teacherId !== teacher.id || !dependent || dependent.teacherId !== teacher.id) {
    return { error: "התלמידה לא נמצאה." };
  }

  const existing = await db.studentLink.findUnique({
    where: { registrarId_dependentId: { registrarId: registrarStudentId, dependentId: dependentStudentId } },
  });
  if (existing) {
    return { error: "התלמידה כבר נמצאת ברשימה." };
  }

  await db.studentLink.create({
    data: { registrarId: registrarStudentId, dependentId: dependentStudentId },
  });

  revalidatePath("/dashboard/students");
  return {};
}

export async function removeStudentLinkAction(linkId: string): Promise<StudentLinkActionState> {
  const teacher = await requireTeacher();

  const link = await db.studentLink.findUnique({ where: { id: linkId }, include: { registrar: true } });
  if (!link || link.registrar.teacherId !== teacher.id) {
    return { error: "הקישור לא נמצא." };
  }

  await db.studentLink.delete({ where: { id: linkId } });

  revalidatePath("/dashboard/students");
  return {};
}
