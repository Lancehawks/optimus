import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

const dotClasses = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
  lg: "h-2 w-2",
};

export default function Spinner({ size = "md", className, label = "Loading", ...props }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex shrink-0 items-center justify-center text-muted", sizeClasses[size], className)}
      {...props}
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className={cn("loader-dot rounded-full bg-current", dotClasses[size])}
          style={{ animationDelay: `${dot * 160}ms` }}
        />
      ))}
    </span>
  );
}
