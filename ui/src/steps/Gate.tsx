// Break + print-limit informational pages (same copy as legacy).
import "./gate.scss";

export function Gate({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="snk-gate">
    <section className="gate">
      <div className="messages">
        <h3>{title}</h3>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
    </div>
  );
}
