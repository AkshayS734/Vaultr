import * as React from "react";
import { cn } from "./utils";

/**
 * Select component for dropdown selections
 * Built from HTML select for accessibility
 */

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, disabled, ...props }, ref) => (
    <select
      ref={ref}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-base",
        "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 focus:border-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = "Select";

export const SelectOption = React.forwardRef<HTMLOptionElement, React.OptionHTMLAttributes<HTMLOptionElement>>(
  (props, ref) => (
    <option ref={ref} {...props} />
  ),
);

SelectOption.displayName = "SelectOption";

export const SelectOptgroup = React.forwardRef<HTMLOptGroupElement, React.OptgroupHTMLAttributes<HTMLOptGroupElement>>(
  (props, ref) => (
    <optgroup ref={ref} {...props} />
  ),
);

SelectOptgroup.displayName = "SelectOptgroup";
