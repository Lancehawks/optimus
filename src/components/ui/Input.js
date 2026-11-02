"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { FieldLabel, FieldMessage } from "./Field";

const sizeClasses = {
  sm: "min-h-7! py-1! text-xs!",
  md: "",
  lg: "min-h-10! py-2! text-sm!",
};

const Input = forwardRef(function Input(
  { label, error, hint, leftIcon, rightIcon, size = "md", className, id, ...props },
  ref
) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 flex -translate-y-1/2 text-placeholder [&_svg]:h-4 [&_svg]:w-4">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            "input-base focus:input-focus",
            sizeClasses[size],
            leftIcon && "pl-8!",
            rightIcon && "pr-8!",
            error && "border-danger! focus:shadow-[0_0_0_3px_var(--red-50)]!",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 text-placeholder [&_svg]:h-4 [&_svg]:w-4">
            {rightIcon}
          </span>
        )}
      </div>
      <FieldMessage error={error} hint={hint} />
    </div>
  );
});

export default Input;
