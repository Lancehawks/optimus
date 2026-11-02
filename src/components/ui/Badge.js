import { cn } from "@/lib/utils";

const variantClasses = {
  default: "bg-brand-50 text-brand-600",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
  neutral: "bg-surface-tertiary text-body",
  outline: "border border-border text-body",
};

const dotClasses = {
  default: "bg-brand-500",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted",
  outline: "bg-muted",
};

const sizeClasses = {
  sm: "px-1.5! py-0! text-2xs!",
  md: "",
};

export default function Badge({ variant = "default", size = "md", dot = false, children, className }) {
  return (
    <span className={cn("badge", variantClasses[variant] || variantClasses.default, sizeClasses[size], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[variant] || dotClasses.default)} />}
      {children}
    </span>
  );
}
