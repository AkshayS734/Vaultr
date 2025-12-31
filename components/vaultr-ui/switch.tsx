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
      <div className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors">
        <input
          ref={ref}
          type="checkbox"
          disabled={disabled}
          checked={checked}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-colors",
            checked ? "bg-primary" : "bg-secondary",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
        <span
          className={cn(
            "relative inline-block size-4 rounded-full bg-white transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0.5",
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
