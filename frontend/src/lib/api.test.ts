import { afterEach, describe, expect, it, vi } from "vitest";
import { getValidStoredToken, TOKEN_STORAGE_KEY } from "./api";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function tokenExpiringAt(expiresAt: number) {
  const payload = btoa(JSON.stringify({ exp: Math.floor(expiresAt / 1000) }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

describe("session token storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses a valid token from the current browser session", () => {
    const token = tokenExpiringAt(Date.now() + 60_000);
    const session = createStorage({ [TOKEN_STORAGE_KEY]: token });
    const persistent = createStorage({ [TOKEN_STORAGE_KEY]: "legacy-token" });
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("localStorage", persistent);

    expect(getValidStoredToken()).toBe(token);
    expect(persistent.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("discards expired session tokens", () => {
    const session = createStorage({
      [TOKEN_STORAGE_KEY]: tokenExpiringAt(Date.now() - 60_000),
    });
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("localStorage", createStorage());

    expect(getValidStoredToken()).toBeNull();
    expect(session.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
