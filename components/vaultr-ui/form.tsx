import * as React from "react";
import { cn } from "./utils";

/**
 * Form-related components for building accessible forms
 */

export const Form = React.forwardRef<HTMLFormElement, React.FormHTMLAttributes<HTMLFormElement>>(
  ({ className, ...props }, ref) => (
    <form ref={ref} className={cn("w-full space-y-4", className)} {...props} />
  ),
);

Form.displayName = "Form";

export const FormField = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  error?: string;
}>(
  ({ className, error, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5", error && "gap-2", className)}
      {...props}
    />
  ),
);

FormField.displayName = "FormField";

export const FormError = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-xs text-destructive font-medium", className)}
      {...props}
    />
  ),
);

FormError.displayName = "FormError";

export const FormHint = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  ),
);

FormHint.displayName = "FormHint";
