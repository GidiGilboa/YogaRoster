import { vi } from "vitest";

/**
 * Import this module for its side effects at the top of any test file that
 * (transitively) exercises a Server Action. It stubs the Next.js request-scoped
 * APIs (cookies, redirect, notFound, revalidatePath) that only work inside a
 * real Next.js request lifecycle, so actions can be called directly as plain
 * async functions from Node/vitest — no HTTP server, no browser.
 */

export class NextRedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.name = "NextRedirectSignal";
  }
}

export class NextNotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NextNotFoundSignal";
  }
}

type StoredCookie = { value: string; options?: Record<string, unknown> };

export class FakeCookieStore {
  private store = new Map<string, StoredCookie>();

  get(name: string): { name: string; value: string } | undefined {
    const entry = this.store.get(name);
    return entry ? { name, value: entry.value } : undefined;
  }

  set(name: string, value: string, options?: Record<string, unknown>): void {
    this.store.set(name, { value, options });
  }

  delete(name: string): void {
    this.store.delete(name);
  }

  clear(): void {
    this.store.clear();
  }
}

export const fakeCookies = new FakeCookieStore();

vi.mock("next/headers", () => ({
  cookies: async () => fakeCookies,
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new NextRedirectSignal(url);
  },
  notFound: () => {
    throw new NextNotFoundSignal();
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
