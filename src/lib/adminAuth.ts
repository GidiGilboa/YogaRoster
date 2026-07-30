import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth";

const ADMIN_SESSION_COOKIE_NAME = "yr_admin_session";
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — shorter-lived than a teacher session
const ADMIN_MARKER = "admin";

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

function encodeToken(expiresAt: number): string {
  const payload = `${ADMIN_MARKER}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function decodeToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [marker, expiresAtRaw, signature] = parts;
  if (marker !== ADMIN_MARKER) return false;

  const payload = `${marker}.${expiresAtRaw}`;
  const expectedSignature = sign(payload);

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  return Number.isFinite(expiresAt) && expiresAt >= Date.now();
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUsername || !expectedHash) {
    throw new Error("ADMIN_USERNAME / ADMIN_PASSWORD_HASH environment variables are not set");
  }

  const usernameBuffer = Buffer.from(username);
  const expectedUsernameBuffer = Buffer.from(expectedUsername);
  const usernameMatches =
    usernameBuffer.length === expectedUsernameBuffer.length &&
    timingSafeEqual(usernameBuffer, expectedUsernameBuffer);

  const passwordMatches = await verifyPassword(password, expectedHash);

  return usernameMatches && passwordMatches;
}

export async function createAdminSession(): Promise<void> {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  const token = encodeToken(expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function isAdminSessionActive(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  return decodeToken(token);
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
}

export async function requireAdmin(): Promise<void> {
  const active = await isAdminSessionActive();
  if (!active) {
    redirect("/admin/login");
  }
}

export { ADMIN_SESSION_COOKIE_NAME };
