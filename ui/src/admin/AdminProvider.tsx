"use client";

// Shared console state: session list + active session (refreshed after any
// mutation) and the authenticated live queue feed. The server pushes
// `queue:update` only when something changes (no polling loop, no broadcast
// to guests). Tabs read this context instead of re-fetching individually.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "@/core/config";
import { AdminSession, fire, getSessions, getToken } from "./api";

export interface QueuePrint {
  id: number;
  clientId: string;
  url: string;
  status: string;
  copies: number;
  rating: number;
  queuePosition: number | null;
  error: string | null;
  createdAt: string;
  printedAt: string | null;
}

interface AdminState {
  sessions: AdminSession[];
  activeSessionId: number | null;
  activeSession: AdminSession | null;
  refresh: () => void;
  connected: boolean;
  prints: QueuePrint[];
}

const AdminContext = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [prints, setPrints] = useState<QueuePrint[]>([]);

  const refresh = useCallback(() => {
    fire(
      getSessions().then(({ activeSessionId, sessions }) => {
        setActiveSessionId(activeSessionId);
        setSessions(sessions);
      })
    );
  }, []);

  useEffect(() => {
    refresh();

    const socket = io(API_BASE || undefined, { auth: { token: getToken() } });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("queue:update", (data: { sessionId: number | null; prints: QueuePrint[] }) =>
      setPrints(data.prints)
    );
    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [refresh]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  const value = useMemo(
    () => ({ sessions, activeSessionId, activeSession, refresh, connected, prints }),
    [sessions, activeSessionId, activeSession, refresh, connected, prints]
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin outside AdminProvider");
  return ctx;
}
