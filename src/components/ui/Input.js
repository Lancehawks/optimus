"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "py-1.5 text-xs",
  md: "",
  lg: "py-3 text-base",
};

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    size = "md",
    className,
    id,
    ...props
  },
  ref
) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-body-sm text-heading! font-medium block mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-placeholder">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "input-base placeholder:text-placeholder focus:input-focus",
            sizeClasses[size],
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            error && "border-danger! focus:border-danger! focus:shadow-[0_0_0_3px_rgb(239_68_68/0.15)]!",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-placeholder">
            {rightIcon}
          </span>
        )}
      </div>
      {error && <p className="text-caption text-danger! mt-1.5">{error}</p>}
      {hint && !error && (
        <p className="text-caption mt-1.5">{hint}</p>
      )}
    </div>
  );
});

export default Input;
