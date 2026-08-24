export default function UnfundedNotice() {
  return (
    <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[0.72rem] leading-relaxed text-amber-100/90 sm:text-xs">
      Configured pool amounts only. Rewards are not funded or claimable yet —
      no escrow, transfers, or payouts in this phase.
    </p>
  );
}
