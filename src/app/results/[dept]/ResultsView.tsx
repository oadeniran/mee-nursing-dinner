"use client";

import { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ResultsView({ data }: { data: any }) {
  const [view, setView] = useState<"results" | "ballots">("results");

  return (
    <main className="admin-main">
      <div className="admin-wrap">
        <div className="pay-head" style={{ textAlign: "center" }}>
          <p className="awards-brand">APOTHEOSIS de Me🅒anicos</p>
          <h1>Award <span className="gold-text">Results</span></h1>
          <p className="muted">{data.ballotCount} ballots cast</p>
        </div>

        <div className="admin-tabs" style={{ justifyContent: "center" }}>
          <button className={view === "results" ? "active" : ""} onClick={() => setView("results")}>Results</button>
          <button className={view === "ballots" ? "active" : ""} onClick={() => setView("ballots")}>How votes were cast</button>
        </div>

        {view === "results" && data.tallies.map((cat: any) => (
          <div className="tally-cat" key={cat.id}>
            <h3>{cat.title} <span className="admin-sub">({cat.total} votes)</span></h3>
            {cat.rows.map((r: any, i: number) => {
              const pct = cat.total ? Math.round((r.votes / cat.total) * 100) : 0;
              return (
                <div className="tally-row" key={r.name}>
                  <div className="tally-label">
                    <span>{i === 0 && r.votes > 0 ? "🏆 " : ""}{r.name}</span>
                    <span>{r.votes} · {pct}%</span>
                  </div>
                  <div className="tally-bar"><div className="tally-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        ))}

        {view === "ballots" && (
          <>
            <p className="muted" style={{ marginBottom: "1.5rem" }}>
              {data.revealNames
                ? "Each voter's choices, as decided by the class."
                : "Each ballot is shown anonymously — voters are numbered, not named."}
            </p>
            {data.perBallot.map((b: any, i: number) => (
              <div className="admin-card" key={i} style={{ marginBottom: "1rem" }}>
                <h3>{b.label}</h3>
                {b.choices.map((c: any) => (
                  <div className="admin-row" key={c.category}><span>{c.category}</span><span>{c.pick}</span></div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}