"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Wrong password");
      window.location.reload();
    } catch {
      setError("Wrong password"); setBusy(false);
    }
  }

  return (
    <main className="pay-main">
      <div className="pay-wrap" style={{ maxWidth: 400 }}>
        <div className="pay-head"><h1>Admin</h1></div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Organizer password" />
        </div>
        <button className="pay-submit" disabled={busy || !password} onClick={login} type="button">
          {busy ? "Checking…" : "Enter"}
        </button>
        {error && <p className="pay-error">{error}</p>}
      </div>
    </main>
  );
}