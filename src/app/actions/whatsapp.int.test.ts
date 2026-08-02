import { beforeAll, describe, expect, it, vi } from "vitest";
import "@/test/nextMocks";
import { NextRedirectSignal } from "@/test/nextMocks";
import { setupActionTestDb } from "@/test/actionTestContext";
import { createTestTeacher } from "@/test/factories";

// The real lib talks to Baileys/WhatsApp over the network via a persistent
// socket - none of that belongs in a test. Only the action layer (DB reads,
// QR-image rendering, error mapping) is under test here. `qrcode` itself is
// a pure offline encoder, so it's exercised for real rather than mocked.
const getWhatsappSessionMock = vi.fn();
vi.mock("@/lib/whatsapp", () => ({
  getWhatsappSession: (...args: unknown[]) => getWhatsappSessionMock(...args),
}));

const ctx = setupActionTestDb();
let whatsapp: typeof import("./whatsapp");
let session: typeof import("@/lib/session");

beforeAll(async () => {
  whatsapp = await import("./whatsapp");
  session = await import("@/lib/session");
});

async function loginAs(teacherId: string) {
  await session.createSession(teacherId);
}

describe("getWhatsappQrStatusAction", () => {
  it("requires an active teacher session", async () => {
    await expect(whatsapp.getWhatsappQrStatusAction()).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("returns a generic Hebrew error instead of leaking a raw exception when the session can't be started", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    getWhatsappSessionMock.mockRejectedValueOnce(new Error("ECONNRESET"));

    const status = await whatsapp.getWhatsappQrStatusAction();

    expect(status.error).toBeTruthy();
    expect(status.error).not.toMatch(/ECONNRESET/);
    expect(status.connected).toBe(false);
    expect(status.qrDataUrl).toBeNull();
  });

  it("renders a QR data URL when a session is running and not yet connected", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    getWhatsappSessionMock.mockResolvedValueOnce({ sock: {}, qr: "2@raw-baileys-qr-payload" });

    const status = await whatsapp.getWhatsappQrStatusAction();

    expect(status.connected).toBe(false);
    expect(status.error).toBeUndefined();
    expect(status.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("returns no QR when a session exists but hasn't produced one yet", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    getWhatsappSessionMock.mockResolvedValueOnce({ sock: {}, qr: undefined });

    const status = await whatsapp.getWhatsappQrStatusAction();

    expect(status.connected).toBe(false);
    expect(status.qrDataUrl).toBeNull();
  });

  it("returns the connected teacher's status and suppresses the QR even if the session still has a stale one", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const connectedAt = new Date();
    await ctx.db.teacher.update({
      where: { id: teacher.id },
      data: { whatsappConnected: true, whatsappPhone: "0501112222", whatsappConnectedAt: connectedAt },
    });
    await loginAs(teacher.id);
    getWhatsappSessionMock.mockResolvedValueOnce({ sock: {}, qr: "stale-qr-should-be-ignored" });

    const status = await whatsapp.getWhatsappQrStatusAction();

    expect(status.connected).toBe(true);
    expect(status.phone).toBe("0501112222");
    expect(status.connectedAt).toBeInstanceOf(Date);
    expect(status.qrDataUrl).toBeNull();
  });

  it("returns a not-connected status with no QR for a teacher who hasn't started linking", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    getWhatsappSessionMock.mockResolvedValueOnce({ sock: {}, qr: undefined });

    const status = await whatsapp.getWhatsappQrStatusAction();

    expect(status.connected).toBe(false);
    expect(status.phone).toBeNull();
    expect(status.connectedAt).toBeNull();
  });
});
