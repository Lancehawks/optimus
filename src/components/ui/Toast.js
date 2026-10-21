"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastContext = createContext(null);

const typeConfig = {
  success: { icon: CheckCircle2, tone: "text-[#6fd6a0]" },
  error: { icon: AlertCircle, tone: "text-[#ff9a8e]" },
  warning: { icon: AlertTriangle, tone: "text-[#f3c26c]" },
  info: { icon: Info, tone: "text-[#a9b3ff]" },
};

function ToastItem({ id, message, type = "info", onClose }) {
  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full animate-slide-up items-center gap-2.5 rounded-xl bg-[#1f1e1c] py-2.5 pl-3.5 pr-2 text-[#f2f1ee] shadow-lg ring-1 ring-white/10"
    >
      <Icon className={cn("h-4 w-4 shrink-0", config.tone)} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={() => onClose(id)}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
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
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] mx-auto flex w-full max-w-sm flex-col gap-2 px-4">
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
