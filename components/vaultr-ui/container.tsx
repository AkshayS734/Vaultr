import * as React from "react";
import { cn } from "./utils";

/**
 * Container component for common layout patterns
 */

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "full";
}

const sizeStyles: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-6xl",
  full: "w-full",
};

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = "lg", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mx-auto w-full px-4",
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  ),
);

Container.displayName = "Container";
