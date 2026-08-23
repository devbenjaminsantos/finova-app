import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/i18n";
import { apiRequest } from "./http";

describe("apiRequest errors", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en-US");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("localizes a known API error code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
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
