"use client";

import { remainingTimeLabel } from "@/lib/task2earn/display";
import { useEffect, useState } from "react";

type CampaignCountdownProps = {
  endsAt: string;
};

export default function CampaignCountdown({ endsAt }: CampaignCountdownProps) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setLabel(remainingTimeLabel(endsAt));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return (
    <span className="tabular-nums text-[0.7rem] font-medium text-cyan-100/80">
      {label ?? "—"}
    </span>
  );
}
