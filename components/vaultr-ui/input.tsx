import * as React from "react";
import { cn } from "./utils";

/**
 * Input component for text, email, password, etc.
 * Provides consistent focus, disabled, and error states
 */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", disabled, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-base",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 focus:border-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
