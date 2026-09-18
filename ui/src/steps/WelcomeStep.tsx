"use client";

// Welcome/splash step — a real flow step, fully decoupled from the header.
import { ChangeEvent, useRef } from "react";
import { useToast } from "@/core/toast";
import { useFlow } from "@/print-flow/flow-state";
import { processPhoto } from "@/print-flow/photo";
import { Camera } from "./icons";
import "./welcome-step.scss";

export function WelcomeStep() {
  const state = useFlow();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    try {
      state.setPhoto(await processPhoto(file));
      state.next();
    } catch {
      toast.show("error", "Could not read that image. Please try another one.");
    } finally {
      input.value = "";
    }
  }

  return (
    <div className="snk-welcome-step">
      <section className="welcome">
        <div className="actions">
          <p className="tagline">Pick a photo, tap through frames, print it.</p>
          <button className="upload" onClick={() => fileInput.current?.click()}>
            <Camera />
            Choose a Photo
          </button>
        </div>
        <input type="file" accept="image/*" ref={fileInput} onChange={onFile} style={{ display: "none" }} />
      </section>
    </div>
  );
}
