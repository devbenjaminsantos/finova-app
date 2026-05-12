import { apiRequest } from "./http";

const TOKEN_KEY = "token";
const USER_KEY = "user";
const LAST_ACTIVITY_KEY = "finova:last-activity-at";
const LOGOUT_REASON_KEY = "finova:logout-reason";
const POST_LOGIN_REDIRECT_KEY = "finova:post-login-redirect";
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export async function loginRequest(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  persistSession(data.token, data.user ?? null);
  return data;
}

export async function demoLoginRequest() {
  const data = await apiRequest("/auth/demo-login", {
    method: "POST",
  });

  persistSession(data.token, data.user ?? null);
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
  const hadToken = localStorage.getItem(TOKEN_KEY) !== null;
  const hadUser = localStorage.getItem(USER_KEY) !== null;
  const hadActivity = localStorage.getItem(LAST_ACTIVITY_KEY) !== null;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);

  if (reason) {
    localStorage.setItem(LOGOUT_REASON_KEY, reason);
  }

  if (hadToken || hadUser || hadActivity || reason) {
    dispatchSessionChange();
  }
}

export function logout() {
  clearStoredSession("manual");
}

export function persistSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
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

export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  return typeof token === "string" && token.trim() ? token : null;
}

export function isTokenExpired(token) {
  try {
    const payloadBase64 = token.split(".")[1];

    if (!payloadBase64) {
      return true;
    }

    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized));

    return !payload?.exp || payload.exp * 1000 < Date.now();
  } catch {
    return true;
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
  if (!getStoredToken()) {
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

export function getLogoutMessage(reason) {
  switch (reason) {
    case "expired":
      return "Sua sessão expirou. Faça login novamente.";
    case "idle":
      return "Sua sessão foi encerrada por inatividade. Faça login novamente.";
    default:
      return "";
  }
}

export function hasValidSession() {
  const token = getStoredToken();

  if (!token) {
    const user = localStorage.getItem(USER_KEY);

    if (user !== null) {
      clearStoredSession();
    }

    return false;
  }

  if (isTokenExpired(token)) {
    clearStoredSession("expired");
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
    event.key === TOKEN_KEY ||
    event.key === USER_KEY ||
    event.key === LAST_ACTIVITY_KEY ||
    event.key === LOGOUT_REASON_KEY
  ) {
    dispatchSessionChange();
  }
}

function clearStoredLogoutReason() {
  localStorage.removeItem(LOGOUT_REASON_KEY);
}

function dispatchSessionChange() {
  window.dispatchEvent(new Event("finova-session-change"));
}
