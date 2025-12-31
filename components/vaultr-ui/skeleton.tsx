import * as React from "react";
import { cn } from "./utils";

/**
 * Skeleton/Loading placeholder component
 * Provides visual feedback while content loads
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circle" | "rect";
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "rect", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-muted animate-pulse",
        variant === "circle" && "rounded-full",
        variant === "rect" && "rounded-md",
        className,
      )}
      {...props}
    />
  ),
);

Skeleton.displayName = "Skeleton";
