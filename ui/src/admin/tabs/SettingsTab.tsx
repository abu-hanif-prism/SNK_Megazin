"use client";

// Settings: printer health + password change (no more hardcoded credentials).
import { FormEvent, useEffect, useState } from "react";
import { HttpError } from "@/core/http";
import { useToast } from "@/core/toast";
import { changePassword, fire, Health, health } from "../api";
import "./settings-tab.scss";

export function SettingsTab() {
  const toast = useToast();
  const [status, setStatus] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  useEffect(() => {
    fire(health().then(setStatus));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      toast.show("success", "Password changed");
    } catch (err) {
      const body = err instanceof HttpError ? (err.body as { error?: string } | null) : null;
      toast.show("error", body?.error ?? "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="snk-settings-tab">
      <div className="card block">
        <h3>Printer</h3>
        {status ? (
          <p className="health">
            <span className={`badge ${status.printer === "ready" ? "completed" : "attention"}`}>
              {status.printer}
            </span>
            {status.mock && <span className="badge">mock mode (no real printer)</span>}
          </p>
        ) : (
          <p className="muted">Checking…</p>
        )}
      </div>

      <div className="card block">
        <h3>Change console password</h3>
        <form onSubmit={submit}>
          <label htmlFor="cur">Current password</label>
          <input
            id="cur"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            name="current"
            autoComplete="current-password"
          />
          <label htmlFor="new">New password (min 8 characters)</label>
          <input
            id="new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            name="next"
            autoComplete="new-password"
          />
          <button className="btn primary" type="submit" disabled={busy || next.length < 8}>
            Change password
          </button>
        </form>
      </div>
    </div>
  );
}
