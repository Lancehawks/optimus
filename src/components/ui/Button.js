"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import Spinner from "./Spinner";

const sizeClasses = {
  xs: "min-h-6! px-2! py-0.5! text-xs! gap-1!",
  sm: "min-h-7! px-2.5! py-1! text-xs!",
  md: "",
  lg: "min-h-9! px-4! text-sm!",
  icon: "min-h-8! w-8 px-0!",
};

const variantClasses = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled = false,
    children,
    className,
    ...props
  },
  ref
) {
  const showLoading = isLoading || loading;

  return (
    <button
      ref={ref}
      disabled={disabled || showLoading}
      aria-busy={showLoading || undefined}
      className={cn(
        "btn-base",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {showLoading ? <Spinner size="sm" className="text-current" aria-hidden="true" /> : leftIcon}
      {children}
      {!showLoading && rightIcon}
    </button>
  );
});

export default Button;
