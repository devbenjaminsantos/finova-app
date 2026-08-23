import {
  clearStoredSession,
  rememberPostLoginRedirect,
  touchSessionActivity,
} from "./auth";
import i18n from "../../i18n/i18n";

const API_URL = resolveApiUrl();
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
let csrfToken = null;

const ERROR_CODE_TRANSLATIONS = {
  EMAIL_ALREADY_REGISTERED: "auth:emailAlreadyRegisteredError",
  EMAIL_NOT_CONFIRMED: "auth:emailNotConfirmedError",
  INVALID_CREDENTIALS: "auth:invalidCredentialsError",
  INVALID_RESET_TOKEN: "auth:invalidResetTokenError",
  INVALID_VERIFICATION_TOKEN: "auth:invalidVerificationTokenError",
  LOGIN_LOCKED: "auth:loginLockedError",
  PASSWORD_POLICY: "passwordPolicy:message",
};

const STATUS_TRANSLATIONS = {
  400: "common:requestInvalid",
  401: "common:requestUnauthorized",
  403: "common:requestForbidden",
  404: "common:requestNotFound",
  409: "common:requestConflict",
  429: "common:requestRateLimited",
};

export class ApiError extends Error {
  constructor(message, status, code = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const hadSession = localStorage.getItem("user") !== null;
  const hasBody = options.body != null;
  const requestCsrfToken = SAFE_METHODS.has(method)
    ? null
    : await getCsrfToken();

  const headers = {
    ...(hasBody && { "Content-Type": "application/json" }),
    ...options.headers,
    ...(requestCsrfToken && { "X-CSRF-TOKEN": requestCsrfToken }),
  };

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(i18n.t("common:networkError"), 0);
  }

  if (response.status === 401 && hadSession) {
    rememberPostLoginRedirect(window.location.pathname);
    clearStoredSession("expired");
    window.location.href = "/login";
    throw new ApiError(i18n.t("common:sessionExpired"), response.status);
  }

  if (!response.ok) {
    let errorPayload = null;

    try {
      const contentType = response.headers.get("content-type") || "";

      if (
        contentType.includes("application/json") ||
        contentType.includes("application/problem+json") ||
        contentType.includes("+json")
      ) {
        errorPayload = await response.json();
      }
    } catch {
      // A interface usa uma mensagem localizada mesmo se a resposta for inválida.
    }

    const code = typeof errorPayload?.code === "string" ? errorPayload.code : null;
    const translationKey = ERROR_CODE_TRANSLATIONS[code] ||
      STATUS_TRANSLATIONS[response.status] ||
      "common:requestFailed";

    throw new ApiError(i18n.t(translationKey), response.status, code);
  }

  if (response.status === 204) {
    touchSessionActivity();
    return null;
  }

  const data = await response.json();
  touchSessionActivity();
  return data;
}

export function resetCsrfToken() {
  csrfToken = null;
}

async function getCsrfToken() {
  if (csrfToken) {
    return csrfToken;
  }

  let response;

  try {
    response = await fetch(`${API_URL}/auth/csrf-token`, {
      credentials: "include",
    });
  } catch {
    throw new ApiError(i18n.t("common:networkError"), 0);
  }

  if (!response.ok) {
    throw new ApiError(i18n.t("common:requestFailed"), response.status);
  }

  const data = await response.json();

  if (typeof data?.token !== "string" || !data.token) {
    throw new ApiError(i18n.t("common:requestFailed"), response.status);
  }

  csrfToken = data.token;
  return csrfToken;
}

function resolveApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return "http://localhost:5278/api";
  }

  return "/api";
}
