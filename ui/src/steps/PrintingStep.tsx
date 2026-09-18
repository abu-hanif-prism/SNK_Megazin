"use client";

// Printing step: composes the print client-side, uploads it, then shows live
// progress (queue position → printing → done) instead of the legacy blind
// "success" message. Rating + download + print-another once accepted.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPrint, getPrint, ratePrint } from "@/core/api";
import { HttpError } from "@/core/http";
import { ApiError, PrintInfo } from "@/core/models";
import { useToast } from "@/core/toast";
import { compose } from "@/print-flow/compositor";
import { useFlow } from "@/print-flow/flow-state";
import { Preview } from "@/print-flow/Preview";
import "./printing-step.scss";

type Phase = "rendering" | "uploading" | "accepted" | "error";

function statusTextFor(print: PrintInfo): string {
  switch (print.status) {
    case "queued": {
      const ahead = (print.queuePosition ?? 1) - 1;
      return ahead <= 0 ? "You're next — printing soon!" : `${ahead} print${ahead > 1 ? "s" : ""} ahead of you`;
    }
    case "submitted":
      return "Printing your photo now…";
    case "completed":
      return "Printed! Collect it at the printer 🎉";
    case "failed":
    case "needs_attention":
      return "A staff member will assist with your print shortly.";
    default:
      return "";
  }
}

export function PrintingStep() {
  const state = useFlow();
  const toast = useToast();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("rendering");
  const [statusText, setStatusText] = useState("Preparing your print…");
  const [rating, setRating] = useState(0);

  const printBlobUrl = useRef("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // dev StrictMode mounts effects twice — never submit the same print twice
    if (!started.current) {
      started.current = true;
      submit();
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (printBlobUrl.current) URL.revokeObjectURL(printBlobUrl.current);
    };
  }, []);

  function fail(message: string) {
    setPhase("error");
    setStatusText(message);
    toast.show("error", message);
  }

  async function submit() {
    const { photo, currentFrame: frame } = state;
    if (!photo || !frame) {
      fail("Something went wrong — please start over.");
      return;
    }

    setPhase("rendering");
    setStatusText("Preparing your print…");
    let blob: Blob;
    try {
      blob = await compose({
        photo: photo.canvas,
        frameUrl: frame.url,
        orientation: state.orientation,
        transform: state.transform,
        effect: state.effect,
        previewWidth: state.previewWidth.current,
      });
    } catch {
      fail("Could not prepare the print on this device. Please try again.");
      return;
    }
    printBlobUrl.current = URL.createObjectURL(blob);

    setPhase("uploading");
    setStatusText("Sending to the printer…");
    const form = new FormData();
    form.append("image", blob, "print.jpg");
    form.append("clientId", state.clientId.trim());
    form.append("layout", state.orientation);
    form.append("effect", state.effect);
    form.append("frameId", String(frame.id));

    try {
      const print = await createPrint(form);
      state.setPrint(print);
      setPhase("accepted");
      toast.show("success", "Your image is in the print queue and will be printed shortly.", 6500);
      setStatusText(statusTextFor(print));
      startPolling(print.id);
    } catch (err) {
      handleSubmitError(err);
    }
  }

  function handleSubmitError(err: unknown) {
    const code = err instanceof HttpError ? (err.body as ApiError | null)?.code : undefined;
    if (code === "USER_LIMIT" || code === "BANNED" || code === "SESSION_LIMIT") {
      router.push("/limit");
      return;
    }
    if (code === "BREAK_MODE") {
      router.push("/break");
      return;
    }
    fail("An error has occurred! Please try again.");
  }

  function startPolling(id: number) {
    pollTimer.current = setInterval(async () => {
      try {
        const updated = await getPrint(id);
        state.setPrint(updated);
        setStatusText(statusTextFor(updated));
        if (["completed", "failed", "needs_attention", "canceled"].includes(updated.status)) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      } catch {
        // transient network hiccup — keep polling
      }
    }, 2500);
  }

  function rate(star: number) {
    setRating(star);
    if (state.print) ratePrint(state.print.id, star).catch(() => {});
  }

  function download() {
    if (!printBlobUrl.current) return;
    const a = document.createElement("a");
    a.href = printBlobUrl.current;
    a.download = "snapnkeep.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="snk-printing-step">
      <section className="printing">
        <Preview>
          {phase !== "error" && (
            <img className="overlay-gif" src="/assets/gifs/SNK_LoadingScreenGif.gif" alt="printing" />
          )}
          {phase === "accepted" && (
            <button className="downloadBtn" onClick={download} aria-label="download">
              <img src="/assets/images/download2.png" alt="download" />
            </button>
          )}
        </Preview>

        <p className="status">{statusText}</p>

        {phase === "accepted" && (
          <div className="after">
            <div className="rating-card">
              <h3>Did you like it?</h3>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={`star${star <= rating ? " active" : ""}`}
                    onClick={() => rate(star)}
                    aria-label={`rate ${star}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <a className="btn-cta" href="/">
              Print Another Photo
            </a>
          </div>
        )}

        {phase === "error" && (
          <div className="after">
            <button className="btn-cta" onClick={submit}>
              Try Again
            </button>
            <a className="btn-ghost" href="/">
              Start Over
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
