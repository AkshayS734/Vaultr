import * as React from "react";
import { cn } from "./utils";

/**
 * Radio Group component for single-selection options
 * Accessible with keyboard navigation
 */

interface RadioGroupContextType {
  value?: string;
  onChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextType>({});

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onValueChange, className, ...props }, ref) => (
    <RadioGroupContext.Provider value={{ value, onChange: onValueChange }}>
      <div
        ref={ref}
        role="radiogroup"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  ),
);

RadioGroup.displayName = "RadioGroup";

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, value, onChange, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        context.onChange?.(e.target.value);
      }
      onChange?.(e);
    };

    const isChecked = context.value === value;

    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          ref={ref}
          type="radio"
          value={value}
          checked={isChecked}
          onChange={handleChange}
          className={cn(
            "peer size-4 cursor-pointer rounded-full border-2 border-input bg-input-background",
            "checked:bg-primary checked:border-primary",
            "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />
        {label && <span className="text-sm font-medium">{label}</span>}
      </label>
    );
  },
);

Radio.displayName = "Radio";
