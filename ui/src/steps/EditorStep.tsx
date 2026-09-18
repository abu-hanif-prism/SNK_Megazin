"use client";

// Editor step: drag/pinch the photo, tap the arrows to try other frames
// (layout follows the frame), then print. No pickers — the arrows are the UI.
import { ChangeEvent, useRef, useState } from "react";
import { useToast } from "@/core/toast";
import { useFlow } from "@/print-flow/flow-state";
import { processPhoto } from "@/print-flow/photo";
import { Preview } from "@/print-flow/Preview";
import { ChevronLeft, ChevronRight, Printer } from "./icons";
import "./editor-step.scss";

export function EditorStep() {
  const state = useFlow();
  const toast = useToast();

  const [showHint, setShowHint] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const total = state.frames.length;

  function print() {
    // remember the on-screen preview width so the compositor can scale 1:1
    state.previewWidth.current = sheetRef.current?.offsetWidth ?? 320;
    state.next();
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    try {
      state.setPhoto(await processPhoto(file));
    } catch {
      toast.show("error", "Could not read that image. Please try another one.");
    } finally {
      input.value = "";
    }
  }

  return (
    <div className="snk-editor-step">
      <section className="editor">
        <div className="stage" onPointerDown={() => setShowHint(false)}>
          <Preview interactive showHint={showHint} sheetRef={sheetRef} />
        </div>

        {total > 1 && (
          <div className="controls">
            <button className="nav" onClick={() => state.cycleFrame(-1)} aria-label="previous frame">
              <ChevronLeft />
            </button>
            <div className="progress" aria-live="polite">
              {total <= 8 ? (
                Array.from({ length: total }, (_, i) => (
                  <span key={i} className={`dot${i === state.frameIndex ? " on" : ""}`} />
                ))
              ) : (
                <span className="count">
                  {state.frameIndex + 1} / {total}
                </span>
              )}
            </div>
            <button className="nav" onClick={() => state.cycleFrame(1)} aria-label="next frame">
              <ChevronRight />
            </button>
          </div>
        )}

        <p className="tip">Drag to move · Pinch to zoom</p>

        <button className="btn-cta" onClick={print}>
          <Printer />
          Print My Photo
        </button>
        <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
          Choose a different photo
        </button>
        <input type="file" accept="image/*" ref={fileInput} onChange={onFile} style={{ display: "none" }} />
      </section>
    </div>
  );
}
