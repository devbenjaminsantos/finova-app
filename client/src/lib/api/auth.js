import { apiRequest, resetCsrfToken } from "./http";

const LEGACY_TOKEN_KEY = "token";
const USER_KEY = "user";
const LAST_ACTIVITY_KEY = "hestia:last-activity-at";
const LOGOUT_REASON_KEY = "hestia:logout-reason";
const POST_LOGIN_REDIRECT_KEY = "hestia:post-login-redirect";
const LEGACY_STORAGE_KEYS = new Map([
  [LAST_ACTIVITY_KEY, "finova:last-activity-at"],
  [LOGOUT_REASON_KEY, "finova:logout-reason"],
  [POST_LOGIN_REDIRECT_KEY, "finova:post-login-redirect"],
]);
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

migrateLegacyStorage();

export async function loginRequest(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  resetCsrfToken();
  persistSession(data.user ?? null);
  return data;
}

export async function demoLoginRequest() {
  const data = await apiRequest("/auth/demo-login", {
    method: "POST",
  });

  resetCsrfToken();
  persistSession(data.user ?? null);
  return data;
}

export async function registerRequest(name, email, password) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function verifyEmailRequest(token) {
  return apiRequest("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendEmailVerificationRequest(email) {
  return apiRequest("/auth/resend-email-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function forgotPasswordRequest(email) {
  return apiRequest("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordRequest(token, newPassword) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export function clearStoredSession(reason = "") {
  const hadLegacyToken = localStorage.getItem(LEGACY_TOKEN_KEY) !== null;
  const hadUser = localStorage.getItem(USER_KEY) !== null;
  const hadActivity = localStorage.getItem(LAST_ACTIVITY_KEY) !== null;

  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEYS.get(LAST_ACTIVITY_KEY));

  if (reason) {
    localStorage.setItem(LOGOUT_REASON_KEY, reason);
  }

  if (hadLegacyToken || hadUser || hadActivity || reason) {
    dispatchSessionChange();
  }
}

export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    // O estado local deve ser encerrado mesmo se a API estiver indisponível.
  } finally {
    resetCsrfToken();
    clearStoredSession("manual");
  }
}

export function persistSession(user) {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.setItem(USER_KEY, JSON.stringify(user ?? null));
  touchSessionActivity();
  clearStoredLogoutReason();
  dispatchSessionChange();
}

export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user ?? null));
  dispatchSessionChange();
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (parsed === null) {
      return null;
    }

    if (typeof parsed !== "object") {
      clearStoredSession();
      return null;
    }

    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function isSessionIdle() {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);

  if (!raw) {
    return false;
  }

  const timestamp = Number(raw);

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return Date.now() - timestamp > SESSION_IDLE_TIMEOUT_MS;
}

export function touchSessionActivity() {
  if (!getStoredUser()) {
    return;
  }

  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function rememberPostLoginRedirect(pathname) {
  if (!pathname || pathname === "/login") {
    return;
  }

  localStorage.setItem(POST_LOGIN_REDIRECT_KEY, pathname);
}

export function consumePostLoginRedirect() {
  const path = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return path || "/";
}

export function getStoredLogoutReason() {
  return localStorage.getItem(LOGOUT_REASON_KEY) || "";
}

export function consumeStoredLogoutReason() {
  const reason = getStoredLogoutReason();
  clearStoredLogoutReason();
  return reason;
}

export function getLogoutMessageKey(reason) {
  switch (reason) {
    case "expired":
      return "common.sessionExpired";
    case "idle":
      return "common.sessionIdle";
    default:
      return "";
  }
}

export function hasValidSession() {
  if (!getStoredUser()) {
    return false;
  }

  if (isSessionIdle()) {
    clearStoredSession("idle");
    return false;
  }

  return true;
}

export function getProfile() {
  return apiRequest("/profile");
}

export function getNotificationDeliveries() {
  return apiRequest("/profile/notification-deliveries");
}

export async function updateProfileRequest(payload) {
  const user = await apiRequest("/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  setStoredUser(user);
  return user;
}

export async function updateOnboardingPreferenceRequest(onboardingOptIn) {
  const user = await apiRequest("/profile/onboarding-preference", {
    method: "PUT",
    body: JSON.stringify({ onboardingOptIn }),
  });

  setStoredUser(user);
  return user;
}

export function syncSessionFromStorageEvent(event) {
  if (
    event.key === LEGACY_TOKEN_KEY ||
    event.key === USER_KEY ||
    event.key === LAST_ACTIVITY_KEY ||
    event.key === LOGOUT_REASON_KEY ||
    [...LEGACY_STORAGE_KEYS.values()].includes(event.key)
  ) {
    dispatchSessionChange();
  }
}

function migrateLegacyStorage() {
  if (typeof localStorage === "undefined") {
    return;
  }

  LEGACY_STORAGE_KEYS.forEach((legacyKey, currentKey) => {
    const legacyValue = localStorage.getItem(legacyKey);

    if (localStorage.getItem(currentKey) === null && legacyValue !== null) {
      localStorage.setItem(currentKey, legacyValue);
    }

    localStorage.removeItem(legacyKey);
  });
}

function clearStoredLogoutReason() {
  localStorage.removeItem(LOGOUT_REASON_KEY);
}

function dispatchSessionChange() {
  window.dispatchEvent(new Event("hestia-session-change"));
}
