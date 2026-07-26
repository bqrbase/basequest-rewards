"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedCounterProps = {
  value: number;
  durationMs?: number;
  className?: string;
  /** Optional formatter, e.g. XP suffix. */
  format?: (value: number) => string;
};

/**
 * Presentation-only animated number counter.
 */
export default function AnimatedCounter({
  value,
  durationMs = 900,
  className,
  format = (n) => n.toLocaleString(),
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (reducedMotion.current || from === value) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return (
    <span className={className} aria-label={format(value)}>
      {format(display)}
    </span>
  );
}
