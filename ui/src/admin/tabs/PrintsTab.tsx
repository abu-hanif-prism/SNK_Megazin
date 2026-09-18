"use client";

// Prints tab: who printed how much (with ban control), ratings, full history.
import { asset } from "@/core/config";
import { useAdmin } from "../AdminProvider";
import { ban, fire, unban } from "../api";
import "./prints-tab.scss";

const statusLabel = (status: string) =>
  ({ needs_attention: "attention", submitted: "printing" } as Record<string, string>)[status] ?? status;

export function PrintsTab() {
  const state = useAdmin();
  const session = state.activeSession;

  if (!session) {
    return (
      <div className="snk-prints-tab">
        <div className="card">No active session.</div>
      </div>
    );
  }

  const allPrints = [...state.prints].reverse();

  const counts = new Map<string, number>();
  for (const p of state.prints) {
    if (p.status === "canceled") continue;
    counts.set(p.clientId, (counts.get(p.clientId) ?? 0) + p.copies);
  }
  const byClient = [...counts.entries()]
    .map(([name, prints]) => ({ name, prints }))
    .sort((a, b) => b.prints - a.prints);

  const totalPrints = byClient.reduce((sum, r) => sum + r.prints, 0);
  const rated = state.prints.filter((p) => p.rating > 0);
  const avgRating = rated.length === 0 ? "" : (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1);

  const isBanned = (name: string) => session.bannedNames?.some((b) => b.toLowerCase() === name.toLowerCase());

  return (
    <div className="snk-prints-tab">
      <div className="stat-row">
        <div className="card stat">
          <span className="n">{totalPrints}</span>
          <span className="l">prints this session</span>
        </div>
        <div className="card stat">
          <span className="n">{byClient.length}</span>
          <span className="l">guests</span>
        </div>
        <div className="card stat">
          <span className="n">{avgRating || "–"}</span>
          <span className="l">avg rating ({rated.length})</span>
        </div>
      </div>

      <div className="card table-card">
        <h3>Prints per guest</h3>
        <table>
          <thead>
            <tr>
              <th>Guest</th>
              <th className="num">Prints</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {byClient.map((row) => (
              <tr key={row.name}>
                <td className="name">{row.name}</td>
                <td className="num">{row.prints}</td>
                <td className="act">
                  {isBanned(row.name) ? (
                    <button className="btn" onClick={() => fire(unban(session.id, row.name).then(state.refresh))}>
                      Allow printing
                    </button>
                  ) : (
                    <button
                      className="btn danger"
                      onClick={() => fire(ban(session.id, row.name).then(state.refresh))}
                    >
                      Block printing
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-card">
        <h3>All prints</h3>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Guest</th>
              <th>Status</th>
              <th className="num">Copies</th>
              <th className="num">Rating</th>
            </tr>
          </thead>
          <tbody>
            {allPrints.map((p) => (
              <tr key={p.id}>
                <td>
                  <img className="mini" src={asset(p.url)} alt="" loading="lazy" />
                </td>
                <td className="name">{p.clientId}</td>
                <td>
                  <span className={`badge ${p.status}`}>{statusLabel(p.status)}</span>
                </td>
                <td className="num">{p.copies}</td>
                <td className="num">{p.rating || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
