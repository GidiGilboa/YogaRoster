import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function cookieName(teacherId: string): string {
  return `yr_student_${teacherId}`;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function encodeToken(studentId: string, expiresAt: number): string {
  const payload = `${studentId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function decodeToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [studentId, expiresAtRaw, signature] = parts;
  const payload = `${studentId}.${expiresAtRaw}`;
  const expectedSignature = sign(payload);

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return studentId;
}

export async function createStudentSession(teacherId: string, studentId: string): Promise<void> {
  const expiresAt = Date.now() + COOKIE_TTL_MS;
  const token = encodeToken(studentId, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(cookieName(teacherId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getIdentifiedStudent(teacherId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName(teacherId))?.value;
  if (!token) return null;

  const studentId = decodeToken(token);
  if (!studentId) return null;

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student || student.teacherId !== teacherId) return null;

  return student;
}
