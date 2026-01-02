import * as React from "react";
import { cn } from "./utils";

/**
 * Popover component for floating content
 * Simple implementation for tooltips, menus, etc.
 */

interface PopoverContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextType | undefined>(undefined);

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export const Popover: React.FC<PopoverProps> = ({
  open: controlledOpen,
  onOpenChange,
  children,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
};

Popover.displayName = "Popover";

function usePopover() {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within Popover");
  }
  return context;
}

export const PopoverTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = usePopover();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(true);
      onClick?.(e);
    };

    return <button ref={ref} onClick={handleClick} {...props} />;
  },
);

PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left";
}

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, side = "bottom", ...props }, ref) => {
    const { open, setOpen } = usePopover();

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (ref && "current" in ref && ref.current) {
          if (!ref.current.contains(e.target as Node)) {
            setOpen(false);
          }
        }
      };

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
        }
      };

      if (open) {
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
          document.removeEventListener("click", handleClickOutside);
          document.removeEventListener("keydown", handleEscape);
        };
      }
    }, [open, setOpen, ref]);

    if (!open) return null;

    const positionClasses = {
      top: "bottom-full mb-2",
      right: "left-full ml-2",
      bottom: "top-full mt-2",
      left: "right-full mr-2",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "absolute min-w-48 rounded-md border bg-background p-4 shadow-lg z-50",
          positionClasses[side],
          className,
        )}
        {...props}
      />
    );
  },
);

PopoverContent.displayName = "PopoverContent";
