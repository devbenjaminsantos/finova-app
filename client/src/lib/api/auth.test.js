import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./http", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "./http";
import {
  clearStoredSession,
  consumePostLoginRedirect,
  consumeStoredLogoutReason,
  getLogoutMessage,
  getStoredToken,
  getStoredUser,
  hasValidSession,
  isSessionIdle,
  isTokenExpired,
  persistSession,
  rememberPostLoginRedirect,
  setStoredUser,
  touchSessionActivity,
  updateOnboardingPreferenceRequest,
} from "./auth";

function buildToken(payload) {
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `header.${encodedPayload}.signature`;
}

describe("auth storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("persists token and user together", () => {
    persistSession("token-123", { id: 1, name: "Finova" });

    expect(getStoredToken()).toBe("token-123");
    expect(getStoredUser()).toEqual({ id: 1, name: "Finova" });
  });

  it("keeps the session when the login response has no user payload", () => {
    const token = buildToken({ exp: Math.floor(Date.now() / 1000) + 3600 });

    persistSession(token, null);

    expect(getStoredToken()).toBe(token);
    expect(getStoredUser()).toBeNull();
    expect(hasValidSession()).toBe(true);
  });

  it("clears corrupted stored user", () => {
    localStorage.setItem("user", "{");

    expect(getStoredUser()).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("detects expired token from JWT payload", () => {
    const expiredToken = buildToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    const validToken = buildToken({ exp: Math.floor(Date.now() / 1000) + 3600 });

    expect(isTokenExpired(expiredToken)).toBe(true);
    expect(isTokenExpired(validToken)).toBe(false);
  });

  it("expires idle sessions and stores a logout reason", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));

    persistSession(buildToken({ exp: Math.floor(Date.now() / 1000) + 3600 }), {
      id: 1,
      name: "Finova",
    });

    expect(isSessionIdle()).toBe(false);

    vi.setSystemTime(new Date("2026-04-14T12:31:00.000Z"));

    expect(hasValidSession()).toBe(false);
    expect(getLogoutMessage(consumeStoredLogoutReason())).toContain("inatividade");
  });

  it("refreshes the activity timestamp when requested", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));

    persistSession(buildToken({ exp: Math.floor(Date.now() / 1000) + 3600 }), {
      id: 1,
      name: "Finova",
    });

    vi.setSystemTime(new Date("2026-04-14T12:20:00.000Z"));
    touchSessionActivity();

    vi.setSystemTime(new Date("2026-04-14T12:45:00.000Z"));
    expect(hasValidSession()).toBe(true);
  });

  it("returns false for invalid sessions and clears stale user-only storage", () => {
    localStorage.setItem("user", JSON.stringify({ id: 1 }));

    expect(hasValidSession()).toBe(false);
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("remembers and consumes a protected route redirect", () => {
    rememberPostLoginRedirect("/auditoria");

    expect(consumePostLoginRedirect()).toBe("/auditoria");
    expect(consumePostLoginRedirect()).toBe("/");
  });

  it("updates onboarding preference and refreshes stored user", async () => {
    apiRequest.mockResolvedValue({
      id: 7,
      name: "Finova User",
      email: "user@finova.app",
      onboardingOptIn: true,
    });

    const user = await updateOnboardingPreferenceRequest(true);

    expect(apiRequest).toHaveBeenCalledWith("/profile/onboarding-preference", {
      method: "PUT",
      body: JSON.stringify({ onboardingOptIn: true }),
    });
    expect(user.onboardingOptIn).toBe(true);
    expect(getStoredUser()).toEqual(user);
  });

  it("allows updating stored user directly", () => {
    setStoredUser({ id: 2, name: "Outro" });

    expect(getStoredUser()).toEqual({ id: 2, name: "Outro" });

    clearStoredSession();
    expect(getStoredUser()).toBeNull();
    expect(getStoredToken()).toBeNull();
  });
});
