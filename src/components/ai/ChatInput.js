"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export default function ChatInput({ onSend, isStreaming, disabled }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  const handleSend = useCallback(() => {
    if (!value.trim() || isStreaming || disabled) return;
    onSend(value);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  };

  const canSend = value.trim() && !isStreaming && !disabled;

  return (
    <div className="border-t border-border p-4 shrink-0">
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={disabled ? "Waiting for AI engine to load..." : "Message the AI assistant..."}
          rows={1}
          className="input-base focus:input-focus resize-none flex-1 max-h-[200px]"
          disabled={isStreaming || disabled}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer",
            canSend
              ? "bg-brand-500 hover:bg-brand-600 text-white"
              : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
          )}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
