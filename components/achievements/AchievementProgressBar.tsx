type AchievementProgressBarProps = {
  percent: number;
  label?: string;
  size?: "sm" | "md";
};

export default function AchievementProgressBar({
  percent,
  label = "Achievement progress",
  size = "sm",
}: AchievementProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const height = size === "md" ? "h-2.5" : "h-1.5";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-white/[0.08] ${height}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-base-blue via-cyan-400 to-indigo-400 transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
