import { getActiveAudienceFilters } from "@/lib/task2earn/display";
import type { AudienceRules } from "@/lib/task2earn/types";

type AudienceBadgeProps = {
  rules: AudienceRules;
  compact?: boolean;
  emptyLabel?: string;
};

export default function AudienceBadge({
  rules,
  compact = false,
  emptyLabel = "Open to everyone",
}: AudienceBadgeProps) {
  const filters = getActiveAudienceFilters(rules);

  if (filters.length === 0) {
    return (
      <p className="text-[0.7rem] text-white/45">{emptyLabel}</p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {filters.map((filter) => (
        <li
          key={filter.key}
          className="inline-flex rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[0.62rem] font-medium text-violet-100"
        >
          {compact ? filter.label : `${filter.label}: ${filter.value}`}
        </li>
      ))}
    </ul>
  );
}
