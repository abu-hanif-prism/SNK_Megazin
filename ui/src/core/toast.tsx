"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

export interface Toast {
  id: number;
  severity: "success" | "error";
  text: string;
}

interface ToastApi {
  toasts: Toast[];
  show: (severity: Toast["severity"], text: string, lifeMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (severity: Toast["severity"], text: string, lifeMs = 5000) => {
      const toast: Toast = { id: nextId++, severity, text };
      setToasts((list) => [...list, toast]);
      setTimeout(() => dismiss(toast.id), lifeMs);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
