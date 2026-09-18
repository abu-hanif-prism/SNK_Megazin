"use client";

import { ReactNode } from "react";
import { useToast } from "@/core/toast";
import { useFlow } from "@/print-flow/flow-state";
import "./app-shell.scss";

export function AppShell({ children }: { children: ReactNode }) {
  const flow = useFlow();
  const toast = useToast();

  return (
    <>
      {/* wordmark header (hidden while the welcome splash covers the screen) */}
      {flow.step !== "welcome" && (
        <nav className="header">
          <a className="wordmark" href="/">
            <img src="/assets/images/headerWordMark.png" alt="snapNkeep" />
          </a>
        </nav>
      )}

      {children}

      {/* toasts */}
      <div className="toasts">
        {toast.toasts.map((t) => (
          <div
            key={t.id}
            className={`toast${t.severity === "error" ? " error" : ""}`}
            onClick={() => toast.dismiss(t.id)}
          >
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
