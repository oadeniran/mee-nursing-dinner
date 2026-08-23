"use client";

import { useState } from "react";

const naira = (n: number) => "₦" + n.toLocaleString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AdminDashboard({ stats }: { stats: any }) {
  const [q, setQ] = useState("");
  const h = stats.headline;

  const orders = stats.orders.filter((o: any) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return o.name.toLowerCase().includes(s) || o.email.toLowerCase().includes(s) ||
      o.matricNo.toLowerCase().includes(s) || (o.plusOneName ?? "").toLowerCase().includes(s);
  });

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <main className="admin-main">
      <div className="admin-wrap">
        <div className="admin-top">
          <h1>Dinner Admin</h1>
          <button className="link-btn" onClick={logout} type="button">Log out</button>
        </div>

        {/* Headline */}
        <div className="stat-grid">
          <Stat label="Tickets paid" value={h.paidTickets} />
          <Stat label="Part-paid" value={h.partialTickets} />
          <Stat label="Guests expected" value={h.guestsExpected} />
          <Stat label="Checked in" value={`${h.checkedIn} / ${h.guestsExpected}`} />
          <Stat label="Collected" value={naira(h.revenueCollected)} />
          <Stat label="Expected (paid+partial)" value={naira(h.revenueExpected)} />
          <Stat label="Souvenirs needed" value={h.souvenirsNeeded ?? 0} />
        </div>

        {/* Departments */}
        <h2 className="admin-h2">By Department</h2>
        <div className="admin-cards">
          {(["nursing", "mee"] as const).map((k) => {
            const d = stats.depts[k];
            return (
              <div className="admin-card" key={k}>
                <h3>{k === "nursing" ? "Nursing" : "MEE"}</h3>
                <Row l="Tickets" v={d.count} />
                <Row l="Solo" v={d.solo} />
                <Row l="Plus one" v={d.plusOne} />
                <Row l="Guests" v={d.guests} />
                <Row l="Revenue" v={naira(d.revenue)} strong />
              </div>
            );
          })}
        </div>

        {/* Menu — catering counts */}
        <h2 className="admin-h2">Menu Totals <span className="admin-sub">(paid guests, for catering)</span></h2>
        <div className="admin-cards">
          <div className="admin-card">
            <h3>Main Course</h3>
            {Object.entries(stats.menu.mains).map(([k, v]) => <Row key={k} l={k} v={v as number} />)}
          </div>
          <div className="admin-card">
            <h3>Dessert</h3>
            {Object.entries(stats.menu.desserts).map(([k, v]) => <Row key={k} l={k} v={v as number} />)}
          </div>
          <div className="admin-card">
            <h3>Payment Status</h3>
            <Row l="Successful" v={stats.statusCounts.successful} />
            <Row l="Partial" v={stats.statusCounts.partial} />
            <Row l="Pending" v={stats.statusCounts.pending} />
            <Row l="Failed" v={stats.statusCounts.failed} />
          </div>
        </div>

        {/* Orders */}
        <h2 className="admin-h2">Orders <span className="admin-sub">({orders.length})</span></h2>
        <input className="admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, matric…" />
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Dept</th><th>Type</th><th>Menu</th><th>Paid</th><th>Status</th><th>Table</th><th>In?</th></tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td>{o.name}{o.plusOneName ? ` +${o.plusOneName}` : ""}<div className="cell-sub">{o.email}</div></td>
                  <td>{o.dept}</td>
                  <td>{o.ticketType === "plusOne" ? "+1" : "Solo"}</td>
                  <td className="cell-sub">{o.main}<br />{o.dessert}</td>
                  <td>{naira(o.totalPaid)}<div className="cell-sub">of {naira(o.amountDue)}</div></td>
                  <td><span className={`status-pill status-${o.status}`}>{o.status}</span></td>
                  <td>{o.tableNumber ?? "—"}</td>
                  <td>{o.checkedIn ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="stat-box"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}
function Row({ l, v, strong }: { l: string; v: string | number; strong?: boolean }) {
  return <div className={`admin-row ${strong ? "strong" : ""}`}><span>{l}</span><span>{v}</span></div>;
}