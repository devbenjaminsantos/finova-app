import { apiRequest } from "./http";

export function getFinancialAccounts() {
  return apiRequest("/financialaccounts");
}

export function createFinancialAccount(payload) {
  return apiRequest("/financialaccounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateFinancialAccount(id, payload) {
  return apiRequest(`/financialaccounts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteFinancialAccount(id) {
  return apiRequest(`/financialaccounts/${id}`, {
    method: "DELETE",
  });
}
