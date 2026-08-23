import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./http", () => ({
  apiRequest: vi.fn(),
  resetCsrfToken: vi.fn(),
}));

import { apiRequest } from "./http";
import {
  clearStoredSession,
  consumePostLoginRedirect,
  consumeStoredLogoutReason,
  getLogoutMessageKey,
  getStoredUser,
  hasValidSession,
  isSessionIdle,
  loginRequest,
  persistSession,
  rememberPostLoginRedirect,
  setStoredUser,
  touchSessionActivity,
  updateOnboardingPreferenceRequest,
} from "./auth";

describe("auth storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("persists only non-sensitive user state", () => {
    localStorage.setItem("token", "legacy-token");
    persistSession({ id: 1, name: "Finova" });

    expect(localStorage.getItem("token")).toBeNull();
    expect(getStoredUser()).toEqual({ id: 1, name: "Finova" });
  });

  it("does not create a client session without a user payload", () => {
    persistSession(null);

    expect(getStoredUser()).toBeNull();
    expect(hasValidSession()).toBe(false);
  });

  it("clears corrupted stored user", () => {
    localStorage.setItem("user", "{");

    expect(getStoredUser()).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("expires idle sessions and stores a logout reason", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));

    persistSession({
      id: 1,
      name: "Finova",
    });

    expect(isSessionIdle()).toBe(false);

    vi.setSystemTime(new Date("2026-04-14T12:31:00.000Z"));

    expect(hasValidSession()).toBe(false);
    expect(getLogoutMessageKey(consumeStoredLogoutReason())).toBe("common.sessionIdle");
  });

  it("refreshes the activity timestamp when requested", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));

    persistSession({
      id: 1,
      name: "Finova",
    });

    vi.setSystemTime(new Date("2026-04-14T12:20:00.000Z"));
    touchSessionActivity();

    vi.setSystemTime(new Date("2026-04-14T12:45:00.000Z"));
    expect(hasValidSession()).toBe(true);
  });

  it("returns false for invalid sessions and clears stale user-only storage", () => {
    localStorage.setItem("user", "null");

    expect(hasValidSession()).toBe(false);
  });

  it("creates a session from the login user without storing the JWT", async () => {
    apiRequest.mockResolvedValue({ user: { id: 7, name: "Finova User" } });

    await loginRequest("user@finova.app", "SenhaSegura123!");

    expect(localStorage.getItem("token")).toBeNull();
    expect(getStoredUser()).toEqual({ id: 7, name: "Finova User" });
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
    expect(localStorage.getItem("token")).toBeNull();
  });
});
