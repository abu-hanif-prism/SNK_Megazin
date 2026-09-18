"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "./api";
import "./login.scss";

export function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(password);
      router.push("/admin");
    } catch {
      setBusy(false);
      setError("Invalid password");
      setPassword("");
    }
  }

  return (
    <div className="snk-console snk-admin-login">
      <section className="login">
        <img className="logo" src="/assets/images/headerWordMark.png" alt="snapNkeep" />
        <h2>Console Login</h2>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            placeholder="Password"
            autoComplete="current-password"
          />
          <button className="pill-btn solid" type="submit" disabled={busy}>
            Log In
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
