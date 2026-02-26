"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = "image/*,.pdf,.doc,.docx,.txt,.csv,.json,.md";

export default function ChatInput({ onSend, isStreaming, disabled }) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSend = useCallback(() => {
    if ((!value.trim() && files.length === 0) || isStreaming || disabled) return;
    onSend(value, files);
    setValue("");
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, files, isStreaming, disabled, onSend]);

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

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend = (value.trim() || files.length > 0) && !isStreaming && !disabled;

  const isImage = (file) => file.type.startsWith("image/");

  return (
    <div className="border-t border-border p-4 shrink-0">
      <div className="max-w-3xl mx-auto">
        {/* File previews */}
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {files.map((file, i) => (
              <div
                key={i}
                className="relative group rounded-lg border border-border bg-neutral-800/50 overflow-hidden"
              >
                {isImage(file) ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="h-16 px-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-xs text-body truncate max-w-[120px]">{file.name}</span>
                  </div>
                )}
                {/* Remove button */}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-neutral-900/80 text-neutral-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || disabled}
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer",
              isStreaming || disabled
                ? "text-neutral-600 cursor-not-allowed"
                : "text-muted hover:text-body hover:bg-surface-tertiary"
            )}
            title="Attach file"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

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

          {/* Send button */}
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
    </div>
  );
}
