"use client";

import GlassPanel from "@/components/GlassPanel";
import { useId, useState, type ReactNode } from "react";

export type FaqItem = {
  question: string;
  answer: ReactNode;
};

type FaqAccordionProps = {
  items: FaqItem[];
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`size-4 shrink-0 text-cyan-100/70 transition-transform duration-300 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Collapsible FAQ accordion using BaseQuest glass surfaces.
 */
export default function FaqAccordion({ items }: FaqAccordionProps) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5">
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <GlassPanel
            key={item.question}
            as="div"
            className="p-0"
          >
            <h2 className="m-0">
              <button
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() =>
                  setOpenIndex((current) => (current === index ? null : index))
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] sm:gap-4 sm:px-5 sm:py-5"
              >
                <span className="font-sans text-sm font-semibold leading-snug text-white sm:text-base">
                  {item.question}
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <ChevronIcon open={open} />
                </span>
              </button>
            </h2>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!open}
              className={
                open
                  ? "border-t border-white/10 px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-3.5"
                  : undefined
              }
            >
              {open ? (
                <div className="space-y-3 text-sm leading-relaxed text-white/65 sm:text-base sm:leading-7">
                  {item.answer}
                </div>
              ) : null}
            </div>
          </GlassPanel>
        );
      })}
    </div>
  );
}
