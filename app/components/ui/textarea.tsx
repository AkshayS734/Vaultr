import * as React from "react";
import { cn } from "./utils";

/**
 * Textarea component for multi-line text input
 * Provides consistent styling with Input component
 */

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, disabled, ...props }, ref) => (
    <textarea
      ref={ref}
      disabled={disabled}
      className={cn(
        "flex min-h-16 w-full rounded-md border border-input bg-input-background px-3 py-2 text-base",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 focus:border-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "resize-none",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
