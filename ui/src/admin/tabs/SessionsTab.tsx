"use client";

// Sessions tab: CRUD + frame management. Frame previews are generated in
// this browser at upload time (canvas → webp), so the server stays image-free.
import { ChangeEvent, useState } from "react";
import { asset } from "@/core/config";
import { Orientation } from "@/core/models";
import { useToast } from "@/core/toast";
import { useAdmin } from "../AdminProvider";
import {
  activateSession,
  AdminSession,
  createSession,
  deleteFrame,
  deleteSession,
  fire,
  updateSession,
  uploadFrame,
} from "../api";
import { makeFramePreview } from "../frame-preview";
import "./sessions-tab.scss";

interface SessionForm {
  clientName: string;
  eventDate: string;
  userMaxPrintCount: number;
  sessionPrintThreshold: number;
}

const EMPTY_FORM: SessionForm = {
  clientName: "",
  eventDate: "",
  userMaxPrintCount: 5,
  sessionPrintThreshold: 200,
};

const ORIENTATIONS: Orientation[] = ["vertical", "horizontal"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "d MMM y" of the calendar date (no timezone shifting). */
function formatEventDate(eventDate: string) {
  const [y, m, d] = eventDate.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function SessionsTab() {
  const state = useAdmin();
  const toast = useToast();

  const [editingId, setEditingId] = useState<number | null>(null); // null = closed, 0 = new
  const [uploadBusy, setUploadBusy] = useState(false);
  const [form, setForm] = useState<SessionForm>({ ...EMPTY_FORM });

  const patch = (changes: Partial<SessionForm>) => setForm((f) => ({ ...f, ...changes }));

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditingId(0);
  }

  function openEdit(session: AdminSession) {
    setForm({
      clientName: session.clientName,
      eventDate: session.eventDate?.slice(0, 10) ?? "",
      userMaxPrintCount: session.userMaxPrintCount,
      sessionPrintThreshold: session.sessionPrintThreshold,
    });
    setEditingId(session.id);
  }

  function save() {
    if (!form.clientName.trim()) {
      toast.show("error", "Session needs a client name");
      return;
    }
    const id = editingId;
    const done = () => {
      setEditingId(null);
      state.refresh();
      toast.show("success", id === 0 ? "Session created" : "Session updated");
    };
    if (id === 0) fire(createSession(form).then(done));
    else if (id) fire(updateSession(id, form).then(done));
  }

  function remove(session: AdminSession) {
    if (!confirm(`Delete "${session.clientName}" with all its frames and prints? This cannot be undone.`)) return;
    fire(deleteSession(session.id).then(state.refresh));
  }

  async function addFrames(session: AdminSession, orientation: Orientation, event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length === 0) return;

    setUploadBusy(true);
    try {
      for (const file of files) {
        const preview = await makeFramePreview(file);
        const body = new FormData();
        body.append("file", file);
        body.append("preview", preview, "preview");
        body.append("orientation", orientation);
        await uploadFrame(session.id, body);
      }
      toast.show("success", `${files.length} frame${files.length > 1 ? "s" : ""} added`);
    } catch {
      toast.show("error", "A frame failed to upload — check it is a PNG and try again.");
    } finally {
      setUploadBusy(false);
      state.refresh();
    }
  }

  return (
    <div className="snk-sessions-tab">
      <div className="head">
        <button className="btn primary" onClick={openCreate}>
          New session
        </button>
      </div>

      {editingId !== null && (
        <div className="card form-card">
          <h3>{editingId === 0 ? "New session" : "Edit session"}</h3>
          <div className="grid">
            <div>
              <label htmlFor="cn">Client name</label>
              <input
                id="cn"
                type="text"
                value={form.clientName}
                onChange={(e) => patch({ clientName: e.target.value })}
                placeholder="e.g. Rahim & Karima Wedding"
              />
            </div>
            <div>
              <label htmlFor="ed">Event date</label>
              <input
                id="ed"
                type="date"
                value={form.eventDate}
                onChange={(e) => patch({ eventDate: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="mp">Prints per guest (0 = unlimited)</label>
              <input
                id="mp"
                type="number"
                min="0"
                value={form.userMaxPrintCount}
                onChange={(e) => patch({ userMaxPrintCount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="th">Total prints for the event (0 = unlimited)</label>
              <input
                id="th"
                type="number"
                min="0"
                value={form.sessionPrintThreshold}
                onChange={(e) => patch({ sessionPrintThreshold: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn primary" onClick={save}>
              Save session
            </button>
            <button className="btn" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.sessions.map((s) => (
        <div key={s.id} className={`card session${s.id === state.activeSessionId ? " active" : ""}`}>
          <div className="row">
            <div className="info">
              <strong>{s.clientName}</strong>
              <span className="sub">
                {s.eventDate ? formatEventDate(s.eventDate) : "no date"}
                {" · "}
                {s.printCount} prints
                {" · "}
                {s.userMaxPrintCount || "∞"}/guest
                {" · "}
                {s.sessionPrintThreshold || "∞"} total
              </span>
            </div>
            <div className="row-actions">
              {s.id === state.activeSessionId ? (
                <span className="badge completed">Active</span>
              ) : (
                <button className="btn" onClick={() => fire(activateSession(s.id).then(state.refresh))}>
                  Activate
                </button>
              )}
              <button className="btn ghost" onClick={() => openEdit(s)}>
                Edit
              </button>
              <button className="btn danger" onClick={() => remove(s)}>
                Delete
              </button>
            </div>
          </div>

          <div className="frames">
            {ORIENTATIONS.map((orientation) => (
              <div key={orientation} className="frame-group">
                <label>{orientation} frames</label>
                <div className="frame-row">
                  {s.frames[orientation].map((f) => (
                    <div key={f.id} className={`frame-thumb${orientation === "horizontal" ? " horizontal" : ""}`}>
                      <img src={asset(f.previewUrl)} alt="" loading="lazy" />
                      <button
                        className="x"
                        onClick={() => fire(deleteFrame(s.id, f.id).then(state.refresh))}
                        aria-label="delete frame"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <label
                    className={`add-frame${orientation === "horizontal" ? " horizontal" : ""}${
                      uploadBusy ? " busy" : ""
                    }`}
                  >
                    +
                    <input
                      type="file"
                      accept="image/png"
                      multiple
                      disabled={uploadBusy}
                      onChange={(e) => addFrames(s, orientation, e)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
