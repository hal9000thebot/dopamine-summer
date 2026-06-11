import { CHANGELOG } from "@/lib/release";

export default function ChangelogPage() {
  return (
    <section className="panel changelog-page">
      <p className="eyebrow">Product updates</p>
      <h1>Change log</h1>
      <p className="muted">Short notes for each version pushed to production.</p>
      <div className="changelog-list">
        {CHANGELOG.map((entry, index) => (
          <article className="changelog-entry" key={entry.version}>
            <div className="card-header">
              <div>
                <p className="eyebrow">{index === 0 ? "Current release" : "Release"}</p>
                <h3>v{entry.version}</h3>
              </div>
              <span className="pill">{entry.date}</span>
            </div>
            <ul className="rule-list">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
