import { api } from "./config";
import { request } from "./http";
import { PrintInfo, SessionInfo } from "./models";

export const ADMIN_TOKEN_KEY = "snk.adminToken";

export const getSession = () => request<SessionInfo>("GET", api("/session"));

// If this device is also logged into the admin console (staff testing a
// print from the guest flow), attach that token so limits/bans don't apply.
export function createPrint(form: FormData) {
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  const headers = adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined;
  return request<PrintInfo>("POST", api("/prints"), { body: form, headers });
}

export const getPrint = (id: number) => request<PrintInfo>("GET", api(`/prints/${id}`));

export const ratePrint = (id: number, rating: number) =>
  request<unknown>("PUT", api(`/prints/${id}/rating`), { body: { rating } });
