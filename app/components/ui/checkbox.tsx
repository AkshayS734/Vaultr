import * as React from "react";
import { cn } from "./utils";

/**
 * Checkbox component with accessible state management
 * Supports checked, indeterminate, and disabled states
 */

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, disabled, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate || false;
      }
    }, [indeterminate]);

    return (
      <input
        ref={ref || inputRef}
        type="checkbox"
        disabled={disabled}
        className={cn(
          "peer size-4 shrink-0 rounded-[4px] border border-input bg-input-background",
          "checked:bg-primary checked:border-primary checked:text-primary-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "cursor-pointer",
          className,
        )}
        {...props}
      />
    );
  },
);

Checkbox.displayName = "Checkbox";
