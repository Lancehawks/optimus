"use client";

import { forwardRef, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const Textarea = forwardRef(function Textarea(
  { label, error, hint, autoResize = false, rows = 3, className, id, ...props },
  ref
) {
  const internalRef = useRef(null);
  const textareaRef = ref || internalRef;
  const inputId = id || props.name;

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
      {label && (
        <label
          htmlFor={inputId}
          className="text-body-sm text-heading! font-medium block mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        ref={textareaRef}
        id={inputId}
        rows={rows}
        className={cn(
          "input-base placeholder:text-placeholder focus:input-focus resize-y",
          autoResize && "resize-none overflow-hidden",
          error && "border-danger! focus:border-danger! focus:shadow-[0_0_0_3px_rgb(239_68_68/0.15)]!",
          className
        )}
        {...props}
      />
      {error && <p className="text-caption text-danger! mt-1.5">{error}</p>}
      {hint && !error && <p className="text-caption mt-1.5">{hint}</p>}
    </div>
  );
});

export default Textarea;
