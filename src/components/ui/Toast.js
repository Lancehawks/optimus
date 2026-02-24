"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const ToastContext = createContext(null);

const typeConfig = {
  success: {
    bg: "bg-surface-raised/95 backdrop-blur-lg border-success/25 shadow-[0_8px_32px_-4px_rgb(52_211_153/0.15)]",
    icon: (
      <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    bg: "bg-surface-raised/95 backdrop-blur-lg border-danger/25 shadow-[0_8px_32px_-4px_rgb(248_113_113/0.15)]",
    icon: (
      <svg className="h-5 w-5 text-danger" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  warning: {
    bg: "bg-surface-raised/95 backdrop-blur-lg border-warning/25 shadow-[0_8px_32px_-4px_rgb(251_191_36/0.15)]",
    icon: (
      <svg className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  info: {
    bg: "bg-surface-raised/95 backdrop-blur-lg border-info/25 shadow-[0_8px_32px_-4px_rgb(96_165_250/0.15)]",
    icon: (
      <svg className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
};

function ToastItem({ id, message, type = "info", onClose }) {
  const config = typeConfig[type];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-slide-up",
        config.bg
      )}
    >
      {config.icon}
      <p className="text-body-sm text-heading! flex-1">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-muted hover:text-heading transition-colors shrink-0 cursor-pointer"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type = "info", duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-full max-w-sm">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} {...toast} onClose={removeToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
