"use client";

import { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function VoteAdminDashboard({ stats, manage }: { stats: any; manage: any[] }) {
  const [open, setOpen] = useState(stats.open);
  const [lookup, setLookup] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [voter, setVoter] = useState<any>(null);
  const [lookupErr, setLookupErr] = useState("");
  const [tab, setTab] = useState<"results" | "voters" | "candidates">("results");

  async function act(body: Record<string, unknown>) {
    const res = await fetch("/api/vote-admin/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dept: stats.dept, ...body }),
    });
    return res.json();
  }

  async function toggleVoting() {
    const next = !open;
    const r = await act({ action: "toggleVoting", open: next });
    if (r.ok) setOpen(r.open);
  }

  async function doLookup() {
    setLookupErr(""); setVoter(null);
    const r = await act({ action: "lookupVoter", matric: lookup.trim() });
    if (r.error) setLookupErr(r.error); else setVoter(r);
  }

  async function logout() {
    await fetch("/api/vote-admin/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <main className="admin-main">
      <div className="admin-wrap">
        <div className="admin-top">
          <h1>Vote Admin <span className="admin-sub">({stats.dept.toUpperCase()})</span></h1>
          <button className="link-btn" onClick={logout} type="button">Log out</button>
        </div>

        {/* Voting toggle */}
        <div className={`voting-toggle ${open ? "is-open" : ""}`}>
          <div>
            <strong>Voting is {open ? "OPEN" : "CLOSED"}</strong>
            <p className="muted">{open ? "Members can cast and change votes." : "Ballots are locked. No changes accepted."}</p>
          </div>
          <button className="pay-submit" style={{ width: "auto", margin: 0 }} onClick={toggleVoting} type="button">
            {open ? "Close voting" : "Open voting"}
          </button>
        </div>

        <div className="stat-grid" style={{ marginTop: "1.5rem" }}>
          <Stat label="Ballots cast" value={`${stats.ballotsCast} / ${stats.voterCount}`} />
          <Stat label="Turnout" value={stats.voterCount ? Math.round((stats.ballotsCast / stats.voterCount) * 100) + "%" : "—"} />
        </div>

        <div className="admin-tabs">
          <button className={tab === "results" ? "active" : ""} onClick={() => setTab("results")}>Results</button>
          <button className={tab === "voters" ? "active" : ""} onClick={() => setTab("voters")}>Voter lookup</button>
          <button className={tab === "candidates" ? "active" : ""} onClick={() => setTab("candidates")}>Candidates</button>
        </div>

        {/* RESULTS */}
        {tab === "results" && stats.tallies.map((cat: any) => (
          <div className="tally-cat" key={cat.id}>
            <h3>{cat.title} <span className="admin-sub">({cat.total} votes)</span></h3>
            {cat.rows.map((r: any) => {
              const pct = cat.total ? Math.round((r.votes / cat.total) * 100) : 0;
              return (
                <div className="tally-row" key={r.id}>
                  <div className="tally-label"><span>{r.name}</span><span>{r.votes} · {pct}%</span></div>
                  <div className="tally-bar"><div className="tally-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        ))}

        {/* VOTER LOOKUP */}
        {tab === "voters" && (
          <div className="admin-card" style={{ marginTop: "1rem" }}>
            <h3>Look up a voter&apos;s code</h3>
            <div className="seat-row">
              <input className="admin-search" style={{ margin: 0 }} value={lookup}
                onChange={(e) => setLookup(e.target.value)} placeholder="Matric number" />
              <button className="pay-submit" style={{ width: "auto", margin: 0 }} onClick={doLookup} type="button">Look up</button>
            </div>
            {lookupErr && <p className="pay-error">{lookupErr}</p>}
            {voter && (
              <div className="voter-result">
                <Row l="Name" v={voter.name} />
                <Row l="Email" v={voter.email} />
                <Row l="Code" v={voter.code ?? "— not generated yet —"} strong />
                <Row l="Voted?" v={voter.hasVoted ? "Yes" : "No"} />
                <Row l="Locked?" v={voter.locked ? "Yes" : "No"} />
                <div className="voter-actions">
                  <button className="pay-submit ghost" style={{ width: "auto" }}
                    onClick={async () => { const r = await act({ action: "resetVoterCode", matric: lookup.trim() }); if (r.code) setVoter({ ...voter, code: r.code, locked: false }); }}
                    type="button">Reset code &amp; email</button>
                  {voter.locked && (
                    <button className="pay-submit ghost" style={{ width: "auto" }}
                      onClick={async () => { await act({ action: "unlockVoter", matric: lookup.trim() }); setVoter({ ...voter, locked: false }); }}
                      type="button">Unlock</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CANDIDATE MANAGEMENT */}
        {tab === "candidates" && manage.map((cat) => <CandidateManager key={cat.id} cat={cat} dept={stats.dept} act={act} />)}
      </div>
    </main>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandidateManager({ cat, dept, act }: { cat: any; dept: string; act: (b: Record<string, unknown>) => Promise<any> }) {
  const [list, setList] = useState<string[]>(cat.candidates);
  const [enabled, setEnabled] = useState<boolean>(cat.enabled);
  const [name, setName] = useState("");

  return (
    <div className="admin-card" style={{ marginBottom: "1rem" }}>
      <div className="ticket-head">
        <h3>{cat.title}</h3>
        <label className="catered-toggle">
          <input type="checkbox" checked={enabled}
            onChange={async (e) => { setEnabled(e.target.checked); await act({ action: "toggleCategory", catId: cat.id, enabled: e.target.checked }); }} />
          <span>{enabled ? "Enabled" : "Hidden"}</span>
        </label>
      </div>
      <div className="cand-list">
        {list.map((n) => (
          <span className="cand-chip" key={n}>
            {n}
            <button onClick={async () => { const r = await act({ action: "removeCandidate", catId: cat.id, name: n }); if (r.candidates) setList(r.candidates); }} type="button">×</button>
          </span>
        ))}
      </div>
      <div className="seat-row" style={{ marginTop: ".75rem" }}>
        <input className="admin-search" style={{ margin: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a candidate…" />
        <button className="pay-submit ghost" style={{ width: "auto", margin: 0 }}
          onClick={async () => { if (!name.trim()) return; const r = await act({ action: "addCandidate", catId: cat.id, name: name.trim() }); if (r.candidates) { setList(r.candidates); setName(""); } }}
          type="button">Add</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="stat-box"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}
function Row({ l, v, strong }: { l: string; v: string | number; strong?: boolean }) {
  return <div className={`admin-row ${strong ? "strong" : ""}`}><span>{l}</span><span>{v}</span></div>;
}