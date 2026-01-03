import * as React from "react";
import { cn } from "./utils";

/**
 * Input component
 * - Normal inputs unchanged
 * - Range input with white filled track (left side)
 */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", disabled, ...props }, ref) => {
  const isRange = type === "range";
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  React.useEffect(() => {
    if (!isRange || !inputRef.current) return;

    const el = inputRef.current;

    const update = () => {
      const min = Number(el.min) || 0;
      const max = Number(el.max) || 100;
      const value = Number(el.value) || min;
      const percent = ((value - min) / (max - min)) * 100;

      // WHITE LEFT, GRAY RIGHT (FORCED)
      el.style.background = `
        linear-gradient(
          to right,
          #ffffff 0%,
          #ffffff ${percent}%,
          #3f3f46 ${percent}%,
          #3f3f46 100%
        )
      `;
    };

    update();
    el.addEventListener("input", update);
    return () => el.removeEventListener("input", update);
  }, [isRange, props.value]);

  return (
    <input
      ref={inputRef}
      type={type}
      disabled={disabled}
      className={cn(
        isRange
          ? `
            w-full h-2 rounded-lg appearance-none cursor-pointer
            bg-transparent

            /* --- TRACK (FORCE TRANSPARENT) --- */
            [&::-webkit-slider-runnable-track]:h-2
            [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-webkit-slider-runnable-track]:rounded-lg

            [&::-moz-range-track]:h-2
            [&::-moz-range-track]:bg-transparent
            [&::-moz-range-track]:rounded-lg

            /* --- FIREFOX FILLED PART (OVERRIDE) --- */
            [&::-moz-range-progress]:h-2
            [&::-moz-range-progress]:bg-white
            [&::-moz-range-progress]:rounded-lg

            /* --- THUMB --- */
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border
            [&::-webkit-slider-thumb]:border-zinc-400
            [&::-webkit-slider-thumb]:mt-[-4px]

            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border
            [&::-moz-range-thumb]:border-zinc-400
          `
          : `
            flex h-9 w-full rounded-md border border-input
            bg-input-background px-3 py-1 text-base
            placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-ring/50
            focus:ring-offset-2 focus:border-ring
            disabled:opacity-50 disabled:cursor-not-allowed
          `,
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";