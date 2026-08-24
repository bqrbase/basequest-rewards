const STEPS = [
  "Type",
  "Cast / Mini App",
  "Audience",
  "Reward",
  "Details",
  "Review",
] as const;

type CreateTaskStepperProps = {
  step: number;
  labels?: readonly string[];
};

export default function CreateTaskStepper({
  step,
  labels = STEPS,
}: CreateTaskStepperProps) {
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {labels.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li
            key={label}
            className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[0.62rem] font-semibold ${
              current
                ? "border-cyan-300/40 bg-gradient-to-r from-violet-600/80 to-cyan-600/70 text-white"
                : done
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-white/[0.04] text-white/45"
            }`}
          >
            <span aria-hidden>{done ? "✓" : current ? "→" : index + 1}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export { STEPS as CREATE_TASK_STEPS };
