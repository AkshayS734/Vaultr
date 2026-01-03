import * as React from "react";
import { cn } from "./utils";

/**
 * Dropdown Menu component
 * Simple implementation without external dependencies
 */

interface DropdownContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownContext = React.createContext<DropdownContextType | undefined>(undefined);

interface DropdownProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export const Dropdown: React.FC<DropdownProps> = ({
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
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
};

Dropdown.displayName = "Dropdown";

function useDropdown() {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error("Dropdown components must be used within Dropdown");
  }
  return context;
}

export const DropdownTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = useDropdown();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(true);
      onClick?.(e);
    };

    return <button ref={ref} onClick={handleClick} {...props} />;
  },
);

DropdownTrigger.displayName = "DropdownTrigger";

export const DropdownContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, setOpen } = useDropdown();

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

    return (
      <div
        ref={ref}
        className={cn(
          "absolute top-full left-0 mt-2 min-w-48 rounded-md border bg-background py-1 shadow-lg z-50",
          className,
        )}
        {...props}
      />
    );
  },
);

DropdownContent.displayName = "DropdownContent";

interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ className, icon, onClick, ...props }, ref) => {
    const { setOpen } = useDropdown();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(false);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2 text-left text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:bg-accent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {icon && <span className="size-4">{icon}</span>}
        <span className="flex-1">{props.children}</span>
      </button>
    );
  },
);

DropdownItem.displayName = "DropdownItem";

export const DropdownSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  ),
);

DropdownSeparator.displayName = "DropdownSeparator";
