import { cn } from "@/lib/utils";
import Button from "./Button";

export default function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {icon && (
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-secondary text-muted [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      {title && <h3 className="font-serif text-[1.5rem] leading-7 text-heading">{title}</h3>}
      {description && <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>}
      {action && (
        <div className="mt-6">
          <Button size="md" {...action} />
        </div>
      )}
    </div>
  );
}
