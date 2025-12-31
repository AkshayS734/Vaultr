import * as React from "react";
import { cn } from "./utils";

/**
 * Switch component for boolean toggles
 * Accessible with keyboard support and screen reader labels
 */

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, disabled, checked, ...props }, ref) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        checked={checked}
        className={cn(
          "peer sr-only",
          className,
        )}
        {...props}
      />
      <div
        className={cn(
          "relative inline-flex h-5 w-9 rounded-full transition-colors",
          "peer-checked:bg-primary peer-unchecked:bg-secondary",
          "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
          "peer-focus:ring-2 peer-focus:ring-ring/50 peer-focus:ring-offset-2",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 transform rounded-full bg-white transition-transform",
            "peer-checked:translate-x-4 peer-unchecked:translate-x-0.5",
            "absolute top-0.5",
          )}
        />
      </div>
      {label && (
        <span className={cn("text-sm font-medium", disabled && "opacity-50")}>
          {label}
        </span>
      )}
    </label>
  ),
);

Switch.displayName = "Switch";
