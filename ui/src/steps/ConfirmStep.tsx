"use client";

// Confirm step (was a fullscreen PrimeNG dialog): final look at the print,
// name collection when we don't have one, then off to the printing step.
import { useState } from "react";
import { useFlow } from "@/print-flow/flow-state";
import { Preview } from "@/print-flow/Preview";
import { Printer } from "./icons";
import "./confirm-step.scss";

export function ConfirmStep() {
  const state = useFlow();
  // capture once so the input doesn't vanish mid-typing after 3 chars
  const [needsName] = useState(() => state.clientId.trim().length < 3);

  function confirm() {
    state.rememberClientId();
    state.next();
  }

  return (
    <div className="snk-confirm-step">
    <section className="confirm">
      <h2>Ready to print?</h2>
      <Preview />

      {needsName && (
        <input
          className="name-input"
          type="text"
          value={state.clientId}
          onChange={(e) => state.setClientId(e.target.value)}
          placeholder="Your name or email"
          autoComplete="name"
        />
      )}

      <div className="buttons">
        <button className="btn-cta" disabled={state.clientId.trim().length < 3} onClick={confirm}>
          <Printer />
          Yes, Print It
        </button>
        <button className="btn-ghost" onClick={state.back}>
          Go back
        </button>
      </div>
    </section>
    </div>
  );
}
