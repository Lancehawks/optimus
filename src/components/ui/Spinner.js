import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-3.5 gap-0.5",
  md: "h-5 gap-1",
  lg: "h-7 gap-1.5",
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
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-brand-500",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className={cn("signal-loader-dot rounded-full bg-current", dotClasses[size])}
          style={{ animationDelay: `${dot * 140}ms` }}
        />
      ))}
    </span>
  );
}
