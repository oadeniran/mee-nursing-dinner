"use client";

import { useState } from "react";

const naira = (n: number) => "₦" + n.toLocaleString();

// Build and trigger a CSV download from rows of objects.
  function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const all = headers.length ? [headers, ...rows] : rows;
    const csv = all.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

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

    // Paid, non-test orders only.
  const paidOrders = stats.orders.filter((o: any) => o.status === "successful");

  function exportSouvenirs() {
    const rows = paidOrders
      .filter((o: any) => o.deptKey === "mee" && o.souvenir !== false) // MEE, opted in
      .map((o: any) => [o.name, o.matricNo, o.email]);
    downloadCsv("souvenir-recipients.csv", ["Name", "Matric No", "Email"], rows);
  }

  function exportAttendees(deptKey?: "mee" | "nursing") {
    const rows = paidOrders
      .filter((o: any) => !deptKey || o.deptKey === deptKey)
      .map((o: any) => [
        o.name,
        o.matricNo,
        o.dept,
        o.ticketType === "plusOne" ? "Plus One" : "Solo",
        o.plusOneName ?? "",
        o.email,
      ]);
    const label = deptKey === "mee" ? "mee" : deptKey === "nursing" ? "nursing" : "all";
    downloadCsv(
      `paid-attendees-${label}.csv`,
      ["Name", "Matric No", "Department", "Ticket", "Plus One Name", "Email"],
      rows
    );
  }

  function exportFoodCsv() {
    const n = stats.food.nursing, m = stats.food.mee;
    const rows: (string | number)[][] = [];
    const maxLen = Math.max(n.length, m.length);

    rows.push(["NURSING", "", "", "", "", "", "", "", "", "", "MEE"]);
    rows.push([
      "Name", "Matric", "Ticket", "Main", "Main ₦", "Small chops ₦", "Chapman ₦", "Cake ₦", "Total ₦", "",
      "Name", "Matric", "Ticket", "Main", "Main ₦", "Small chops ₦", "Chapman ₦", "Cake ₦", "Total ₦",
    ]);

    const cell = (r: any, key: string) => (r ? r[key] : "");
    for (let i = 0; i < maxLen; i++) {
      const a = n[i], b = m[i];
      rows.push([
        a ? a.name + (a.partial ? " (PART-PAID)" : "") : "", cell(a, "matric"), cell(a, "ticket"), cell(a, "main"),
        cell(a, "mainCost"), cell(a, "smallChops"), cell(a, "chapman"), cell(a, "cakeSlice"), cell(a, "total"),
        "",
        b ? b.name + (b.partial ? " (PART-PAID)" : "") : "", cell(b, "matric"), cell(b, "ticket"), cell(b, "main"),
        cell(b, "mainCost"), cell(b, "smallChops"), cell(b, "chapman"), cell(b, "cakeSlice"), cell(b, "total"),
      ]);
    }

    const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + (r[key] || 0), 0);
    rows.push([]);
    rows.push([
      "TOTAL", `${n.length} people`, "", "",
      sum(n, "mainCost"), sum(n, "smallChops"), sum(n, "chapman"), sum(n, "cakeSlice"), sum(n, "total"),
      "",
      "TOTAL", `${m.length} people`, "", "",
      sum(m, "mainCost"), sum(m, "smallChops"), sum(m, "chapman"), sum(m, "cakeSlice"), sum(m, "total"),
    ]);
    
    // --- NEW SUMMARY SECTION ---
    rows.push([]); 
    rows.push([]); 
    
    // Calculate partial counts
    const nPartial = n.filter((x: any) => x.partial).length;
    const mPartial = m.filter((x: any) => x.partial).length;

    // Format the text so it only shows "(X partial)" if there actually are partials
    const nHeadcountStr = `${n.length} people` + (nPartial > 0 ? ` (${nPartial} partial)` : "");
    const mHeadcountStr = `${m.length} people` + (mPartial > 0 ? ` (${mPartial} partial)` : "");

    rows.push(["","SUMMARY", "NURSING", "MEE"]);
    rows.push(["","Headcount", nHeadcountStr, mHeadcountStr]);
    rows.push(["","Main", sum(n, "mainCost"), sum(m, "mainCost")]);
    rows.push(["","Small chops", sum(n, "smallChops"), sum(m, "smallChops")]);
    rows.push(["","Chapman", sum(n, "chapman"), sum(m, "chapman")]);
    rows.push(["","Cake", sum(n, "cakeSlice"), sum(m, "cakeSlice")]);
    rows.push(["","Total Overall", sum(n, "total"), sum(m, "total")]);

    // --- GRANULAR SELECTION COUNTS ---
    rows.push([]);
    rows.push([]);

    // Tally any field across a person list into { value: count }.
    const tally = (arr: any[], key: string) => {
      const counts: Record<string, number> = {};
      for (const r of arr) {
        const v = (r[key] || "").trim();
        if (!v) continue;
        counts[v] = (counts[v] || 0) + 1;
      }
      return counts;
    };

    // Union of all values seen in either department, for aligned rows.
    const allKeys = (nCounts: Record<string, number>, mCounts: Record<string, number>) =>
      Array.from(new Set([...Object.keys(nCounts), ...Object.keys(mCounts)])).sort();

    // Main course breakdown
    const nMain = tally(n, "main"), mMain = tally(m, "main");
    rows.push(["", "MAIN COURSE COUNTS", "NURSING", "MEE"]);
    for (const k of allKeys(nMain, mMain)) {
      rows.push(["", k, nMain[k] || 0, mMain[k] || 0]);
    }

    // Dessert breakdown (captures cake variants like Chocolate / Red Velvet)
    const nDes = tally(n, "dessert"), mDes = tally(m, "dessert");
    rows.push([]);
    rows.push(["", "DESSERT COUNTS", "NURSING", "MEE"]);
    for (const k of allKeys(nDes, mDes)) {
      rows.push(["", k, nDes[k] || 0, mDes[k] || 0]);
    }


    downloadCsv("food-costing.csv", [], rows);
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
          <Stat label="Confirmed guests" value={h.confirmedGuests} />
          <Stat label="Guests expected" value={h.guestsExpected} />
          <Stat label="Total Guest Number (Partial Incl.)" value={h.allGuests} />
          <Stat label="Checked in" value={`${h.checkedIn} / ${h.guestsExpected}`} />
          <Stat label="Collected" value={naira(h.revenueCollected)} />
          <Stat label="Expected (paid+partial)" value={naira(h.revenueExpected)} />
          <Stat label="Souvenirs needed" value={h.souvenirsNeeded ?? 0} />
        </div>

        {/* ---- Data exports ---- */}
        <h2 className="admin-h2">Export Data</h2>
        <div className="export-grid">
          <div className="export-card">
            <h3>Souvenir recipients</h3>
            <p className="admin-sub">MEE attendees who opted in — one per ticket.</p>
            <button className="pay-submit ghost" onClick={exportSouvenirs} type="button">
              Download CSV
            </button>
          </div>
          <div className="export-card">
            <h3>Paid attendees</h3>
            <p className="admin-sub">Everyone who paid, with department column.</p>
            <div className="export-btns">
              <button className="pay-submit ghost" onClick={() => exportAttendees()} type="button">All</button>
              <button className="pay-submit ghost" onClick={() => exportAttendees("mee")} type="button">MEE only</button>
              <button className="pay-submit ghost" onClick={() => exportAttendees("nursing")} type="button">Nursing only</button>
            </div>
          </div>

          <div className="export-card">
            <h3>Food costing</h3>
            <p className="admin-sub">Per-department food sheet, side by side, with totals. Includes part-paid.</p>
            <FoodPriceEditor prices={stats.food.prices} />
            <button className="pay-submit ghost" onClick={exportFoodCsv} type="button" style={{ marginTop: ".75rem" }}>
              Download food CSV
          </button>
        </div>
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

        {/* ---- Costs & Settle-up (unified) ---- */}
        <h2 className="admin-h2">Costs &amp; Settle-up</h2>

        <div className="stat-grid">
          <Stat label="Total cost" value={naira(stats.expenseSum.totalCost)} />
          <Stat label="Nursing left (settled)" value={naira(stats.expenseSum.nursing.leftAfterOwed)} />
          <Stat label="MEE left (settled)" value={naira(stats.expenseSum.mee.leftAfterOwed)} />
        </div>

        <div className="admin-cards" style={{ marginTop: "1rem" }}>
          {(["nursing", "mee"] as const).map((k) => {
            const d = stats.expenseSum[k];
            return (
              <div className="admin-card" key={k}>
                <h3>{k === "nursing" ? "Nursing" : "MEE"}</h3>
                <Row l="Ticket revenue" v={naira(d.revenue)} />
                <Row l="Total owed (share)" v={naira(d.owed)} />
                <Row l="Paid out so far" v={naira(d.paid)} />
                <Row l="Balance owing" v={naira(d.balance)} />
                <Row l="Left after paid" v={naira(d.leftAfterPaid)} strong />
                <Row l="Left if all settled" v={naira(d.leftAfterOwed)} />
              </div>
            );
          })}
        </div>

        <div className="admin-table-scroll" style={{ marginTop: "1.5rem" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th><th>Cost</th>
                <th>Nursing share</th><th>Nursing paid</th>
                <th>MEE share</th><th>MEE paid</th>
                <th>Fully paid</th><th></th>
              </tr>
            </thead>
            <tbody>
              {stats.expenses.map((e: any) => <ExpenseRow key={e.id} entry={e} />)}
            </tbody>
          </table>
        </div>

        {/* Variable / paused */}
        <h2 className="admin-h2">Variable Costs <span className="admin-sub">(split by headcount, once finalised)</span></h2>
        <div className="admin-cards">
          {stats.expenseSum.totalCost >= 0 && [
            { id: "food", name: "Food (3-course, drinks, water)", estimate: 1200000, note: "Use the food CSV totals once sales close" },
            { id: "afterparty", name: "After-party props", estimate: 100000, note: "Awaiting price per person" },
          ].map((it) => (
            <div className="admin-card" key={it.id}>
              <h3>{it.name}</h3>
              <Row l="Estimate" v={naira(it.estimate)} />
              <p className="fee-note">{it.note}</p>
            </div>
          ))}
        </div>

        {/* Variable / paused */}
        <h2 className="admin-h2">Variable Costs <span className="admin-sub">(split by headcount, once finalised)</span></h2>
        <div className="admin-cards">
          {stats.budget.variableItems.map((it: any) => (
            <div className="admin-card" key={it.id}>
              <h3>{it.name}</h3>
              <Row l="Estimate" v={naira(it.estimate)} />
              <p className="fee-note">{it.note}</p>
            </div>
          ))}
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

function BudgetRow({ item }: { item: { id: string; name: string; cost: number; note: string; catered: boolean } }) {
  const [checked, setChecked] = useState(item.catered);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !checked;
    setBusy(true); setChecked(next); // optimistic
    try {
      const res = await fetch("/api/admin/budget", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, catered: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChecked(!next); // revert on failure
    } finally { setBusy(false); }
  }

  return (
    <tr className={checked ? "row-catered" : ""}>
      <td>{item.name}</td>
      <td>{naira(item.cost)}</td>
      <td className="cell-sub">{naira(item.cost / 2)} each</td>
      <td className="cell-sub">{item.note}</td>
      <td>
        <label className="catered-toggle">
          <input type="checkbox" checked={checked} disabled={busy} onChange={toggle} />
          <span>{checked ? "Paid" : "—"}</span>
        </label>
      </td>
    </tr>
  );
}

function FoodPriceEditor({ prices }: { prices: Record<string, number> }) {
  const [p, setP] = useState(prices);
  const [saved, setSaved] = useState(false);
    const labels: Record<string, string> = {
    ofada: "Ofada", jollof: "Jollof", poundedYam: "Pounded Yam (Iyan)",
    smallChops: "Small chops", chapman: "Chapman",
    cakeSlice: "Cake slice (MEE)", parfait: "Parfait",
  };

  async function save() {
    const res = await fetch("/api/admin/food-prices", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prices: p }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <div className="food-prices">
      {Object.keys(labels).map((k) => (
        <div className="food-price-row" key={k}>
          <label>{labels[k]}</label>
          <input type="number" value={p[k] ?? 0} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} />
        </div>
      ))}
      <button className="link-btn" onClick={save} type="button">{saved ? "Saved ✓" : "Save prices"}</button>
    </div>
  );
}

function ExpenseRow({ entry }: { entry: any }) {
  const [e, setE] = useState(entry);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const field = (k: string) => (
    <input type="number" value={e[k]} className="exp-input"
      onChange={(ev) => setE({ ...e, [k]: num(ev.target.value) })} />
  );

  async function save() {
    setBusy(true); setSaved(false);
    const res = await fetch("/api/admin/expense", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id, fields: {
        cost: e.cost, nursingShare: e.nursingShare, meeShare: e.meeShare,
        nursingPaid: e.nursingPaid, meePaid: e.meePaid,
      } }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    }
  }

  // Mark fully paid: fills paid = share for both, via the server, then reflects locally.
  async function toggleFullyPaid(paid: boolean) {
    setBusy(true);
    const res = await fetch("/api/admin/expense", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id, markPaid: paid }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.expenses) {
      const fresh = data.expenses.find((x: any) => x.id === e.id);
      if (fresh) setE(fresh);
    }
  }

  const fullyPaid = e.nursingPaid >= e.nursingShare && e.meePaid >= e.meeShare
    && (e.nursingShare > 0 || e.meeShare > 0);
  const overpaid = e.nursingPaid > e.nursingShare || e.meePaid > e.meeShare;
  const sharesMismatch = e.nursingShare + e.meeShare !== e.cost;

  return (
    <tr className={fullyPaid ? "row-catered" : ""}>
      <td>{e.name}{sharesMismatch && <div className="cell-sub" style={{ color: "#e6c34d" }}>shares ≠ cost</div>}</td>
      <td>{field("cost")}</td>
      <td>{field("nursingShare")}</td>
      <td>{field("nursingPaid")}</td>
      <td>{field("meeShare")}</td>
      <td>{field("meePaid")}</td>
      <td>
        <label className="catered-toggle">
          <input type="checkbox" checked={fullyPaid} disabled={busy}
            onChange={(ev) => toggleFullyPaid(ev.target.checked)} />
          <span>{fullyPaid ? "Paid" : "—"}</span>
        </label>
      </td>
      <td><button className="link-btn" disabled={busy} onClick={save} type="button">{saved ? "✓" : "Save"}</button></td>
    </tr>
  );
}