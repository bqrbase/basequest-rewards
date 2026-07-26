"use client";

import { useId, type ReactNode } from "react";

type ScoreRingProps = {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  center: ReactNode;
  className?: string;
};

/**
 * Circular progress ring for dashboard score / XP visuals.
 */
export default function ScoreRing({
  value,
  size = 132,
  strokeWidth = 10,
  label,
  center,
  className = "",
}: ScoreRingProps) {
  const gradientId = useId().replace(/:/g, "");
  const safe = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Progress ${Math.round(safe)} percent`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0052FF" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {center}
      </div>
    </div>
  );
}
