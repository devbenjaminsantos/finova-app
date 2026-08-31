export const VISIBLE_AUDIT_ACTIONS = new Set([
  "auth.registered",
  "auth.login-succeeded",
  "auth.login-blocked-unconfirmed-email",
  "auth.login-locked-out",
  "auth.login-blocked-locked-out",
  "auth.email-confirmed",
  "auth.password-reset-requested",
  "auth.password-reset-completed",
  "auth.demo-login",
  "transaction.created",
  "transaction.updated",
  "transaction.deleted",
  "budget-goal.created",
  "budget-goal.updated",
  "budget-goal.deleted",
  "profile.updated",
  "profile.updated-with-password",
]);

export function formatAuditDate(value, formatDateTime) {
  if (!value) {
    return "-";
  }

  if (typeof formatDateTime === "function") {
    return formatDateTime(value);
  }

  return value;
}

export function formatActionLabel(action, t) {
  const labels = {
    "auth.registered": "history.actionRegistered",
    "auth.login-succeeded": "history.actionLoginSucceeded",
    "auth.login-blocked-unconfirmed-email": "history.actionLoginBlockedUnconfirmedEmail",
    "auth.login-locked-out": "history.actionLoginLockedOut",
    "auth.login-blocked-locked-out": "history.actionLoginBlockedLockedOut",
    "auth.demo-login": "history.actionDemoLogin",
    "auth.email-confirmed": "history.actionEmailConfirmed",
    "auth.password-reset-requested": "history.actionPasswordResetRequested",
    "auth.password-reset-completed": "history.actionPasswordResetCompleted",
    "transaction.created": "history.actionTransactionCreated",
    "transaction.updated": "history.actionTransactionUpdated",
    "transaction.deleted": "history.actionTransactionDeleted",
    "budget-goal.created": "history.actionBudgetGoalCreated",
    "budget-goal.updated": "history.actionBudgetGoalUpdated",
    "budget-goal.deleted": "history.actionBudgetGoalDeleted",
    "profile.updated": "history.actionProfileUpdated",
    "profile.updated-with-password": "history.actionProfileUpdatedWithPassword",
  };

  return t ? t(labels[action] || "history.actionFallback") : labels[action] || action;
}

export function getActionGroup(action, t) {
  if (action.startsWith("transaction.")) {
    return t ? t("history.groupTransactions") : "Transactions";
  }

  if (action.startsWith("budget-goal.")) {
    return t ? t("history.groupGoals") : "Goals";
  }

  if (action.startsWith("profile.")) {
    return t ? t("history.groupProfile") : "Profile";
  }

  return t ? t("history.groupAccessSecurity") : "Access and security";
}

export function getActionToneClass(action) {
  if (action?.includes("deleted") || action?.includes("locked-out")) {
    return "hestia-badge-danger";
  }

  if (action?.includes("updated") || action?.includes("changed")) {
    return "hestia-badge-warning";
  }

  if (action?.includes("password-reset") || action?.includes("confirmed")) {
    return "hestia-badge-income";
  }

  return "hestia-badge-primary";
}
