import * as React from "react";
import { cn } from "./utils";

/**
 * Progress bar component for showing completion status
 * Supports indeterminate and determinate states
 */

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, indeterminate, ...props }, ref) => {
    const percentage = Math.min(Math.max(value / max * 100, 0), 100);

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-secondary h-2",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full bg-primary transition-all",
            indeterminate && "animate-pulse",
          )}
          style={{ width: indeterminate ? "100%" : `${percentage}%` }}
        />
      </div>
    );
  },
);

Progress.displayName = "Progress";
