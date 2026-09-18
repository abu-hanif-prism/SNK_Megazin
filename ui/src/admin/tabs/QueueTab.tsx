"use client";

// The live queue — the tab staff live in during an event.
// Needs-attention triage on top, the job in the printer, then the deli-ticket
// stack of queued prints with move controls, then recent completions.
import { asset } from "@/core/config";
import { useToast } from "@/core/toast";
import { QueuePrint, useAdmin } from "../AdminProvider";
import { cancelPrint, deletePrint, fire, reorderQueue, reprint, resolvePrint, updateSession } from "../api";
import "./queue-tab.scss";

/** SQLite stores UTC ("YYYY-MM-DD HH:MM:SS") — show local wall-clock time. */
const time = (utc: string) =>
  new Date(utc.replace(" ", "T") + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function QueueTab() {
  const state = useAdmin();
  const toast = useToast();
  const session = state.activeSession;

  const attention = state.prints.filter((p) => p.status === "needs_attention");
  const inPrinter = state.prints.filter((p) => p.status === "submitted");
  const queued = state.prints
    .filter((p) => p.status === "queued")
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0) || a.id - b.id);
  const recentDone = state.prints
    .filter((p) => p.status === "completed")
    .slice(-12)
    .reverse();

  function move(print: QueuePrint, delta: number | "front") {
    const ids = queued.map((p) => p.id);
    const from = ids.indexOf(print.id);
    if (from < 0) return;
    ids.splice(from, 1);
    const to = delta === "front" ? 0 : Math.max(0, Math.min(ids.length, from + delta));
    ids.splice(to, 0, print.id);
    fire(reorderQueue(ids));
  }

  function doReprint(print: QueuePrint) {
    fire(reprint(print.id).then(() => toast.show("success", `Print #${print.id} queued again`)));
  }

  function doDelete(print: QueuePrint) {
    if (!confirm(`Delete print #${print.id} (${print.clientId})? This removes the file too.`)) return;
    fire(deletePrint(print.id));
  }

  function toggle(field: "queuePaused" | "breakMode") {
    if (!session) return;
    fire(updateSession(session.id, { [field]: !session[field] }).then(state.refresh));
  }

  if (!session) {
    return (
      <div className="snk-queue-tab">
        <div className="card empty">
          No active session. Activate one from the Sessions tab to start printing.
        </div>
      </div>
    );
  }

  return (
    <div className="snk-queue-tab">
      <div className="toolbar">
        <button className={`btn${session.queuePaused ? " attention" : ""}`} onClick={() => toggle("queuePaused")}>
          {session.queuePaused ? "Resume queue" : "Pause queue"}
        </button>
        <button className={`btn${session.breakMode ? " attention" : ""}`} onClick={() => toggle("breakMode")}>
          {session.breakMode ? "End break" : "Start break"}
        </button>
        <span className="depth">
          {queued.length} waiting · {inPrinter.length} in printer
        </span>
      </div>

      {attention.length > 0 && (
        <section className="attention-zone">
          <h3>Needs attention</h3>
          {attention.map((p) => (
            <div key={p.id} className="card job attention-job">
              <img className="thumb" src={asset(p.url)} alt="" loading="lazy" />
              <div className="meta">
                <strong>{p.clientId}</strong>
                <p className="why">Was in the printer during a restart — check if the sheet printed.</p>
              </div>
              <div className="actions">
                <button className="btn attention" onClick={() => fire(resolvePrint(p.id, "reprint"))}>
                  Print again
                </button>
                <button className="btn" onClick={() => fire(resolvePrint(p.id, "done"))}>
                  Mark as printed
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {inPrinter.map((p) => (
        <div key={p.id} className="card job printing-job">
          <img className="thumb" src={asset(p.url)} alt="" loading="lazy" />
          <div className="meta">
            <strong>{p.clientId}</strong>
            <span className="badge printing">In printer</span>
            <div className="feed"></div>
          </div>
          <div className="actions">
            <button className="btn danger" onClick={() => fire(cancelPrint(p.id))}>
              Cancel
            </button>
          </div>
        </div>
      ))}

      <section className="queue">
        {queued.length === 0 && inPrinter.length === 0 && (
          <div className="card empty">Queue is clear — new prints will appear here as guests send them.</div>
        )}
        {queued.map((p, i) => (
          <div key={p.id} className="card job">
            <span className="ticket">{i + 1}</span>
            <img className="thumb" src={asset(p.url)} alt="" loading="lazy" />
            <div className="meta">
              <strong>{p.clientId}</strong>
              <span className="time">sent {time(p.createdAt)}</span>
            </div>
            <div className="actions">
              <button className="icon-btn" title="Move to front" disabled={i === 0} onClick={() => move(p, "front")}>
                ⤒
              </button>
              <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(p, -1)}>
                ↑
              </button>
              <button
                className="icon-btn"
                title="Move down"
                disabled={i === queued.length - 1}
                onClick={() => move(p, 1)}
              >
                ↓
              </button>
              <button className="btn danger" onClick={() => fire(cancelPrint(p.id))}>
                Cancel
              </button>
            </div>
          </div>
        ))}
      </section>

      {recentDone.length > 0 && (
        <section className="done">
          <h3>Recently printed</h3>
          <div className="done-row">
            {recentDone.map((p) => (
              <div key={p.id} className="done-card">
                <img src={asset(p.url)} alt="" loading="lazy" />
                <span className="who">{p.clientId}</span>
                <div className="done-actions">
                  <button className="btn ghost" onClick={() => doReprint(p)}>
                    Print again
                  </button>
                  <button className="btn ghost danger" onClick={() => doDelete(p)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
