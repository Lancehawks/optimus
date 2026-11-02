import { cn } from "@/lib/utils";
import Button from "./Button";

export default function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {icon && (
        <div className="empty-art mb-6" aria-hidden="true">
          <span className="empty-art-back" />
          <span className="empty-art-back" />
          <span className="empty-art-front">{icon}</span>
        </div>
      )}
      <div className="stagger flex flex-col items-center">
        {title && <h3 className="font-serif text-[1.625rem] leading-8 text-heading">{title}</h3>}
        {description && <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>}
        {action && (
          <div className="mt-6">
            <Button size="md" {...action} />
          </div>
        )}
      </div>
    </div>
  );
}
