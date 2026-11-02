import { cn } from "@/lib/utils";

export function FieldLabel({ htmlFor, children, className }) {
  if (!children) return null;
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-xs font-medium text-heading", className)}>
      {children}
    </label>
  );
}

export function FieldMessage({ error, hint }) {
  if (error) return <p className="mt-1.5 text-xs text-danger">{error}</p>;
  if (hint) return <p className="mt-1.5 text-xs text-muted">{hint}</p>;
  return null;
}
