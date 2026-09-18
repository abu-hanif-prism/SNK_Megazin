"use client";

// Console shell: header + tabs. Live data flows in via the authed socket.
// Without a token (the old adminGuard) we bounce to the login page.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminProvider, useAdmin } from "./AdminProvider";
import { getToken, logout } from "./api";
import { QueueTab } from "./tabs/QueueTab";
import { PrintsTab } from "./tabs/PrintsTab";
import { SessionsTab } from "./tabs/SessionsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import "./console.scss";

const TABS = ["Queue", "Prints", "Sessions", "Settings"] as const;
type Tab = (typeof TABS)[number];

export function Console() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (getToken()) setAuthed(true);
    else router.replace("/admin/login");
  }, [router]);

  if (!authed) return null;
  return (
    <AdminProvider>
      <ConsoleShell
        onLogout={() => {
          logout();
          router.push("/admin/login");
        }}
      />
    </AdminProvider>
  );
}

function ConsoleShell({ onLogout }: { onLogout: () => void }) {
  const state = useAdmin();
  const [tab, setTab] = useState<Tab>("Queue");
  const s = state.activeSession;

  return (
    <div className="snk-console snk-admin-console">
      <header className="bar">
        <img className="wordmark" src="/assets/images/headerWordMark.png" alt="snapNkeep" />
        <div className="session-label">
          {s ? (
            <>
              <span className="name">{s.clientName}</span>
              <span className={`dot${state.connected ? " live" : ""}`}></span>
            </>
          ) : (
            <span className="name muted">No active session</span>
          )}
        </div>
        <button className="logout" onClick={onLogout}>
          Log out
        </button>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "Queue" && <QueueTab />}
        {tab === "Prints" && <PrintsTab />}
        {tab === "Sessions" && <SessionsTab />}
        {tab === "Settings" && <SettingsTab />}
      </main>
    </div>
  );
}
