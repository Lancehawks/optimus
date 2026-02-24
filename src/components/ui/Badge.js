import { cn } from "@/lib/utils";

const variantClasses = {
  default: "bg-brand-50 text-brand-700",
  success: "bg-success-light text-green-600",
  warning: "bg-warning-light text-amber-600",
  danger: "bg-danger-light text-red-600",
  info: "bg-info-light text-blue-600",
  neutral: "bg-neutral-100 text-neutral-600",
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
