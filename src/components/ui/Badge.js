import { cn } from "@/lib/utils";

const variantClasses = {
  default: "bg-brand-500/12 text-brand-700",
  success: "bg-success-light text-green-500",
  warning: "bg-warning-light text-amber-500",
  danger: "bg-danger-light text-red-500",
  info: "bg-info-light text-blue-500",
  neutral: "bg-neutral-600 text-neutral-200",
};

const sizeClasses = {
  sm: "text-[0.6875rem] px-2 py-px",
  md: "",
};

export default function Badge({
  variant = "default",
  size = "md",
  dot = false,
  children,
  className,
}) {
  return (
    <span
      className={cn(
        "badge",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full mr-1.5",
            variant === "default" && "bg-brand-500",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-danger",
            variant === "info" && "bg-info",
            variant === "neutral" && "bg-neutral-500"
          )}
        />
      )}
      {children}
    </span>
  );
}
