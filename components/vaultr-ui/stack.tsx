import * as React from "react";
import { cn } from "./utils";

/**
 * Stack components for common layout patterns
 */

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  gap?: "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

const gapStyles = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

const alignStyles = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const justifyStyles = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

export const HStack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = "md", align = "center", justify = "start", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-row",
        gapStyles[gap],
        alignStyles[align],
        justifyStyles[justify],
        className,
      )}
      {...props}
    />
  ),
);

HStack.displayName = "HStack";

export const VStack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = "md", align = "stretch", justify = "start", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col",
        gapStyles[gap],
        alignStyles[align],
        justifyStyles[justify],
        className,
      )}
      {...props}
    />
  ),
);

VStack.displayName = "VStack";
