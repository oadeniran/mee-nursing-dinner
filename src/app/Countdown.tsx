"use client";

import { useState, useEffect } from "react";

// Event start — red carpet, 8:00 PM WAT on Sept 18, 2026.
// The +01:00 is West Africa Time so it counts down correctly regardless of the viewer's timezone.
const EVENT_TIME = new Date("2026-09-18T20:00:00+01:00").getTime();

function parts(ms: number) {
  const clamp = Math.max(0, ms);
  return {
    days: Math.floor(clamp / 86400000),
    hours: Math.floor((clamp / 3600000) % 24),
    minutes: Math.floor((clamp / 60000) % 60),
    seconds: Math.floor((clamp / 1000) % 60),
  };
}

export default function Countdown() {
  // null until mounted, so server and client render the same thing first (no hydration mismatch).
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(EVENT_TIME - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (remaining === null) {
    return <div className="countdown" aria-hidden="true" style={{ minHeight: 90 }} />;
  }

  if (remaining <= 0) {
    return <div className="countdown countdown-live">✨ It&apos;s owambe time — see you there! ✨</div>;
  }

  const t = parts(remaining);
  const units: [string, number][] = [
    ["Days", t.days],
    ["Hours", t.hours],
    ["Mins", t.minutes],
    ["Secs", t.seconds],
  ];

  return (
    <div className="countdown">
      {units.map(([label, value]) => (
        <div className="cd-unit" key={label}>
          <span className="cd-value">{String(value).padStart(2, "0")}</span>
          <span className="cd-label">{label}</span>
        </div>
      ))}
    </div>
  );
}