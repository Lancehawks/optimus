import { cn } from "@/lib/utils";

// The Optimus mark: an open ring and a full stop. The ring follows the current
// text colour; the stop is the single accent.
export default function OptimusLogo({ size = 24, className = "" }) {
  return (
    <svg
      className={cn("shrink-0", className)}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="14" cy="15.5" r="10.25" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="27.25" cy="26.25" r="2.75" fill="var(--brand-500)" />
    </svg>
  );
}

export function OptimusWordmark({ size = 22, className = "" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-heading", className)}>
      <OptimusLogo size={size} />
      <span
        className="font-serif leading-none tracking-[-0.01em]"
        style={{ fontSize: Math.round(size * 1.05) }}
      >
        Optimus
      </span>
    </span>
  );
}
