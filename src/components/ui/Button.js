"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import Spinner from "./Spinner";

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs",
  md: "",
  lg: "px-5 py-3 text-base",
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
        "optimus-button btn-base",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {showLoading ? (
        <Spinner size="sm" className="text-current" aria-hidden="true" />
      ) : (
        leftIcon
      )}
      {children}
      {!showLoading && rightIcon}
    </button>
  );
});

export default Button;
