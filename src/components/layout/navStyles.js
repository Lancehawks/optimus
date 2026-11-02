import { cn } from "@/lib/utils";

export function navItemClass({ active = false, collapsed = false, nested = false } = {}) {
  return cn(
    "group relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md text-left text-sm font-medium transition-colors",
    "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
    collapsed ? "justify-center px-0 lg:w-9 lg:mx-auto" : nested ? "pl-8 pr-2" : "px-2",
    active
      ? "bg-surface text-heading shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] [&_svg]:text-heading"
      : "text-body hover:bg-black/[0.035] hover:text-heading dark:hover:bg-white/[0.05] [&_svg]:text-muted hover:[&_svg]:text-heading"
  );
}
