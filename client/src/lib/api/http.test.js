import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/i18n";
import { apiRequest, resetCsrfToken } from "./http";

describe("apiRequest errors", () => {
  beforeEach(async () => {
    localStorage.clear();
    resetCsrfToken();
    await i18n.changeLanguage("en-US");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("localizes a known API error code", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "csrf-token" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: () => "application/problem+json" },
        json: async () => ({
          code: "EMAIL_NOT_CONFIRMED",
          title: "Confirme seu e-mail antes de entrar."
        })
      }));

    const request = apiRequest("/auth/login", { method: "POST" });

    await expect(request).rejects.toMatchObject({
      name: "ApiError",
      code: "EMAIL_NOT_CONFIRMED",
      message: "Confirm your email before signing in."
    });
  });

  it("uses credentialed cookies and antiforgery without an Authorization header", async () => {
    localStorage.setItem("token", "legacy-jwt");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "csrf-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => "" },
      });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/auth/logout", { method: "POST" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/auth/csrf-token"), {
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }),
      }),
    );
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it("refreshes antiforgery once when a token became invalid", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "stale-csrf-token" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => "application/problem+json" },
        json: async () => ({ code: "INVALID_CSRF_TOKEN" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "fresh-csrf-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ verificationEmailSent: true }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({}),
    })).resolves.toEqual({ verificationEmailSent: true });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][1].headers["X-CSRF-TOKEN"]).toBe("stale-csrf-token");
    expect(fetchMock.mock.calls[3][1].headers["X-CSRF-TOKEN"]).toBe("fresh-csrf-token");
  });

  it("does not expose an unknown server message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => "application/problem+json" },
      json: async () => ({ title: "Detalhe interno inesperado" })
    }));

    await expect(apiRequest("/profile")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      code: null,
      message: "Unable to complete the request."
    });
  });
});
