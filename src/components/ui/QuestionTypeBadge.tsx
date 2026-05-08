import type { ReactNode } from "react";

export type QuestionType = "single" | "multi" | "binary";

interface BadgeMeta {
  label: string;
  hint: string;
  className: string;
  icon: ReactNode;
}

const META: Record<QuestionType, BadgeMeta> = {
  single: {
    label: "Single answer",
    hint: "Choose one",
    className: "bg-surface-muted text-ink ring-1 ring-line",
    icon: (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="3" fill="currentColor" />
      </svg>
    ),
  },
  multi: {
    label: "Multiple answers",
    hint: "Select all that apply",
    className: "bg-warning-soft text-warning ring-1 ring-warning/30",
    icon: (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
        <rect
          x="1.5"
          y="1.5"
          width="8"
          height="8"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="6.5"
          y="6.5"
          width="8"
          height="8"
          rx="1.5"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <polyline
          points="8.5,10.5 10,12 12.5,9"
          fill="none"
          stroke="var(--color-warning-soft)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  binary: {
    label: "Yes / No",
    hint: "Pick one",
    className: "bg-surface-muted text-ink ring-1 ring-line",
    icon: (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
        <polyline
          points="2,8.5 5.5,12 9,5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="11"
          y1="5"
          x2="14.5"
          y2="11"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="14.5"
          y1="5"
          x2="11"
          y2="11"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
};

export function QuestionTypeBadge({
  type,
  size = "md",
  showHint = false,
}: {
  type: string;
  size?: "sm" | "md";
  showHint?: boolean;
}) {
  const meta = META[(type as QuestionType) in META ? (type as QuestionType) : "single"];
  const sizeClass = size === "sm" ? "text-[11px] px-2 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wider whitespace-nowrap ${sizeClass} ${meta.className}`}
    >
      {meta.icon}
      <span>{showHint ? meta.hint : meta.label}</span>
    </span>
  );
}

export function ChoiceMarker({
  type,
  selected,
  className = "",
}: {
  type: string;
  selected?: boolean;
  className?: string;
}) {
  const isMulti = type === "multi";
  const shape = isMulti ? "rounded-[5px]" : "rounded-full";
  const base = "shrink-0 w-5 h-5 inline-block border-2 transition-colors";
  const state = selected ? "border-current bg-current" : "border-current/50";
  return <span aria-hidden="true" className={`${base} ${shape} ${state} ${className}`} />;
}
