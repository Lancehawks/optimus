"use client";

import { forwardRef, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { FieldLabel, FieldMessage } from "./Field";

const Textarea = forwardRef(function Textarea(
  { label, error, hint, autoResize = false, rows = 3, className, id, ...props },
  ref
) {
  const internalRef = useRef(null);
  const generatedId = useId();
  const textareaRef = ref || internalRef;
  const inputId = id || props.name || generatedId;

  useEffect(() => {
    if (!autoResize || !textareaRef.current) return;

    const el = textareaRef.current;
    const resize = () => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    };

    el.addEventListener("input", resize);
    resize();

    return () => el.removeEventListener("input", resize);
  }, [autoResize, textareaRef]);

  return (
    <div className="w-full">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <textarea
        ref={textareaRef}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          "input-base focus:input-focus resize-y leading-5!",
          autoResize && "resize-none overflow-hidden",
          error && "border-danger!",
          className
        )}
        {...props}
      />
      <FieldMessage error={error} hint={hint} />
    </div>
  );
});

export default Textarea;
