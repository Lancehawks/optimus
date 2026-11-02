import { cn } from "@/lib/utils";

const paddingClasses = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  none: "p-0",
};

export default function Card({ children, padding = "md", hoverable = false, onClick, className }) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "card",
        paddingClasses[padding],
        (hoverable || onClick) && "card-hover cursor-pointer",
        onClick && "w-full text-left",
        className
      )}
    >
      {children}
    </Component>
  );
}
