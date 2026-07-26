import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "yr_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

function encodeToken(teacherId: string, expiresAt: number): string {
  const payload = `${teacherId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function decodeToken(token: string): { teacherId: string; expiresAt: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [teacherId, expiresAtRaw, signature] = parts;
  const payload = `${teacherId}.${expiresAtRaw}`;
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
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  return { teacherId, expiresAt };
}

export async function createSession(teacherId: string): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = encodeToken(teacherId, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getSessionTeacherId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const decoded = decodeToken(token);
  return decoded?.teacherId ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };
