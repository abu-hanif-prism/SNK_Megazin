// Admin REST client + auth token handling. Every call attaches the console JWT.
import { ADMIN_TOKEN_KEY } from "@/core/api";
import { api } from "@/core/config";
import { request } from "@/core/http";
import { Frame, PrintInfo, SessionInfo } from "@/core/models";

export interface AdminSession extends SessionInfo {
  printCount: number;
  bannedNames: string[];
}

export interface SessionStats {
  byClient: { name: string; prints: number }[];
  byStatus: { status: string; n: number }[];
  ratings: { rating: number; n: number }[];
}

export interface Health {
  ok: boolean;
  printer: string;
  mock: boolean;
}

// --- auth -------------------------------------------------------------------
export const getToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);

export async function login(password: string) {
  const { token } = await request<{ token: string }>("POST", api("/auth/login"), { body: { password } });
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export const logout = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

const authed = () => ({ headers: { Authorization: `Bearer ${getToken() ?? ""}` } });

/** Fire-and-forget actions: log failures instead of leaving rejections unhandled. */
export const fire = (call: Promise<unknown>) => call.catch((err) => console.error(err));

// --- sessions ---------------------------------------------------------------
export const getSessions = () =>
  request<{ activeSessionId: number | null; sessions: AdminSession[] }>(
    "GET",
    api("/admin/sessions"),
    authed()
  );
export const createSession = (body: object) =>
  request<SessionInfo>("POST", api("/admin/sessions"), { body, ...authed() });
export const updateSession = (id: number, body: object) =>
  request<SessionInfo>("PUT", api(`/admin/sessions/${id}`), { body, ...authed() });
export const deleteSession = (id: number) =>
  request<unknown>("DELETE", api(`/admin/sessions/${id}`), authed());
export const activateSession = (id: number) =>
  request<unknown>("POST", api(`/admin/sessions/${id}/activate`), { body: {}, ...authed() });
export const uploadFrame = (sessionId: number, form: FormData) =>
  request<Frame>("POST", api(`/admin/sessions/${sessionId}/frames`), { body: form, ...authed() });
export const deleteFrame = (sessionId: number, frameId: number) =>
  request<unknown>("DELETE", api(`/admin/sessions/${sessionId}/frames/${frameId}`), authed());
export const ban = (sessionId: number, name: string) =>
  request<unknown>("POST", api(`/admin/sessions/${sessionId}/bans`), { body: { name }, ...authed() });
export const unban = (sessionId: number, name: string) =>
  request<unknown>(
    "DELETE",
    api(`/admin/sessions/${sessionId}/bans/${encodeURIComponent(name)}`),
    authed()
  );

// --- prints / queue ---------------------------------------------------------
export const getPrints = (sessionId: number) =>
  request<{ prints: PrintInfo[] }>("GET", api(`/admin/prints/session/${sessionId}`), authed());
export const getStats = (sessionId: number) =>
  request<SessionStats>("GET", api(`/admin/prints/session/${sessionId}/stats`), authed());
export const reorderQueue = (orderedIds: number[]) =>
  request<unknown>("POST", api("/admin/prints/queue/reorder"), { body: { orderedIds }, ...authed() });
export const cancelPrint = (id: number) =>
  request<unknown>("POST", api(`/admin/prints/${id}/cancel`), { body: {}, ...authed() });
export const reprint = (id: number) =>
  request<unknown>("POST", api(`/admin/prints/${id}/reprint`), { body: {}, ...authed() });
export const resolvePrint = (id: number, action: "reprint" | "done") =>
  request<unknown>("POST", api(`/admin/prints/${id}/resolve`), { body: { action }, ...authed() });
export const deletePrint = (id: number) =>
  request<unknown>("DELETE", api(`/admin/prints/${id}`), authed());

// --- settings ---------------------------------------------------------------
export const changePassword = (currentPassword: string, newPassword: string) =>
  request<unknown>("POST", api("/auth/password"), {
    body: { currentPassword, newPassword },
    ...authed(),
  });
export const health = () => request<Health>("GET", api("/health"));
