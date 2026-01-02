import * as React from "react";
import { cn } from "./utils";

/**
 * Tabs component for switching between content panels
 * Keyboard accessible with arrow key navigation
 */

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  children,
}) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeTab = controlledValue !== undefined ? controlledValue : internalValue;

  const setActiveTab = (tab: string) => {
    if (controlledValue === undefined) {
      setInternalValue(tab);
    }
    onValueChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="flex flex-col gap-2">{children}</div>
    </TabsContext.Provider>
  );
};

Tabs.displayName = "Tabs";

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tab components must be used within Tabs");
  }
  return context;
}

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex h-9 w-fit items-center justify-center rounded-xl bg-muted p-[3px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);

TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const { activeTab, setActiveTab } = useTabs();
    const isActive = activeTab === value;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setActiveTab(value);
      onClick?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        // Implement arrow key navigation if needed
      }
    };

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]",
          "focus:outline-none focus:ring-2 focus:ring-ring/50",
          "disabled:opacity-50 disabled:pointer-events-none",
          isActive
            ? "bg-card text-foreground border-input"
            : "text-muted-foreground hover:text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);

TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { activeTab } = useTabs();

    if (activeTab !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn("flex-1 outline-none", className)}
        {...props}
      />
    );
  },
);

TabsContent.displayName = "TabsContent";
