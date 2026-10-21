import { Bell, X } from "lucide-react";

export function BellIcon({ className = "h-4 w-4 shrink-0" }) {
  return <Bell className={className} strokeWidth={1.75} aria-hidden="true" />;
}

export function HistoryIcon({ className = "h-4 w-4" }) {
  return <Bell className={className} strokeWidth={1.75} aria-hidden="true" />;
}

export function CloseIcon({ className = "h-4 w-4" }) {
  return <X className={className} aria-hidden="true" />;
}
