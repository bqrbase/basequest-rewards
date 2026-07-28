"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

type CountUpProps = {
  value: number;
  durationMs?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  /** Accessible label for the final value */
  "aria-label"?: string;
};

/**
 * Lightweight count-up that respects reduced-motion preferences.
 */
export function CountUp({
  value,
  durationMs = 900,
  className,
  prefix = "",
  suffix = "",
  "aria-label": ariaLabel,
}: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    if (!inView) {
      return;
    }

    let frame = 0;
    const start = performance.now();
    const from = 0;
    const to = value;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, inView, reduceMotion, value]);

  return (
    <span
      ref={ref}
      className={className}
      aria-label={ariaLabel ?? `${prefix}${value.toLocaleString()}${suffix}`}
    >
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
