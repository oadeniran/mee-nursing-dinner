"use client";

import { useState, useEffect, useCallback } from "react";

// Edit this list anytime — the carousel adapts automatically.
const HIGHLIGHTS = [
  { title: "Award Presentation", blurb: "Recognising the standouts — the moments worth dressing up for." },
  { title: "Souvenir Presentation", blurb: "Everyone leaves with a little something to remember the night by." },
  { title: "Mixed Seating", blurb: "Seating arranged to spark new conversations across both departments." },
];

const INTERVAL = 4000;

export default function HighlightsCarousel() {
  const [index, setIndex] = useState(0);
  const count = HIGHLIGHTS.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  // Auto-advance; resets whenever index changes (so manual taps restart the timer).
  useEffect(() => {
    const t = setTimeout(() => go(index + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, go]);

  return (
    <div className="carousel">
      <div className="carousel-stage">
        {HIGHLIGHTS.map((item, i) => (
          <div key={i} className={`carousel-item ${i === index ? "is-active" : ""}`} aria-hidden={i !== index}>
            <h3>{item.title}</h3>
            <p>{item.blurb}</p>
          </div>
        ))}
      </div>

      <div className="carousel-dots">
        {HIGHLIGHTS.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === index ? "active" : ""}`}
            onClick={() => go(i)}
            aria-label={`Show highlight ${i + 1}`}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}