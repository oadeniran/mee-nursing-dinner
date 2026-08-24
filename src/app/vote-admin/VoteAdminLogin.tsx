"use client";
import { useState } from "react";

export default function VoteAdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/vote-admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error();
      window.location.reload();
    } catch { setError("Wrong password"); setBusy(false); }
  }
  return (
    <main className="pay-main">
      <div className="pay-wrap" style={{ maxWidth: 400 }}>
        <div className="pay-head"><h1>Vote Admin</h1></div>
        <div className="field">
          <label>Vote-admin password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()} placeholder="Password" />
        </div>
        <button className="pay-submit" disabled={busy || !password} onClick={login} type="button">
          {busy ? "Checking…" : "Enter"}
        </button>
        {error && <p className="pay-error">{error}</p>}
      </div>
    </main>
  );
}