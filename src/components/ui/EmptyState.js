import { cn } from "@/lib/utils";
import Button from "./Button";

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-disabled">{icon}</div>
      )}
      {title && <h3 className="text-h3 text-heading!">{title}</h3>}
      {description && (
        <p className="text-body-sm text-muted! mt-2 max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <Button {...action} />
        </div>
      )}
    </div>
  );
}
