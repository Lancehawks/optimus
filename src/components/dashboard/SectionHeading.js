import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({ title, count, href, actionLabel = "View all", children }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold text-heading">
        {title}
        {count !== null && count !== undefined && (
          <span className="font-mono text-xs font-normal tabular-nums text-muted">{count}</span>
        )}
      </h2>
      {children}
      {href && (
        <Link href={href} className="group inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-heading">
          {actionLabel}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
