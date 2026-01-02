import * as React from "react";
import { cn } from "./utils";

/**
 * Toast/Notification container
 * Lightweight notification system without external dependencies
 */

export type ToastType = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now().toString();
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    if (toast.duration !== 0) {
      const timer = setTimeout(() => removeToast(id), toast.duration || 3000);
      return () => clearTimeout(timer);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

ToastProvider.displayName = "ToastProvider";

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

const variantStyles: Record<ToastType, string> = {
  default: "bg-card text-card-foreground",
  success: "bg-green-500/10 text-green-700 dark:text-green-400",
  error: "bg-destructive/10 text-destructive",
  warning: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  return (
    <div
      className={cn(
        "min-w-64 rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-5 fade-in-0",
        variantStyles[toast.type],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm">{toast.message}</p>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-xs hover:opacity-70 focus:outline-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none z-50">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
};
