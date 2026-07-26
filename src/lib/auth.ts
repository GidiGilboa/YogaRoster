import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionTeacherId } from "@/lib/session";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getCurrentTeacher() {
  const teacherId = await getSessionTeacherId();
  if (!teacherId) return null;
  return db.teacher.findUnique({ where: { id: teacherId } });
}

export async function requireTeacher() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect("/login");
  }
  return teacher;
}
