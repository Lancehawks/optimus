import { cn } from "@/lib/utils";

const paddingClasses = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
  none: "p-0",
};

export default function Card({
  children,
  padding = "md",
  hoverable = false,
  onClick,
  className,
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "card",
        paddingClasses[padding],
        hoverable && "card-hover cursor-pointer",
        onClick && "card-hover cursor-pointer text-left w-full",
        className
      )}
    >
      {children}
    </Component>
  );
}
