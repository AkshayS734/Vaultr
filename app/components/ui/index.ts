/**
 * Vaultr UI Component Library
 * 
 * A lightweight, dependency-free collection of reusable UI components
 * inspired by modern design patterns and built with React + Tailwind CSS.
 * 
 * All components are:
 * - Framework-safe (no Radix, cmdk, sonner, etc.)
 * - Fully typed with TypeScript
 * - Accessible and keyboard-navigable
 * - Composable and flexible
 * - Zero external dependencies
 */

// Utilities
export { cn } from "./utils";

// Core Components
export { Button } from "./button";
export type { } from "./button";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";

export { Input } from "./input";
export { Label } from "./label";
export { Textarea } from "./textarea";

// Feedback Components
export { Badge } from "./badge";
export { Alert, AlertTitle, AlertDescription } from "./alert";
export { Progress } from "./progress";
export { Skeleton } from "./skeleton";

// Form Components
export { Form, FormField, FormError, FormHint } from "./form";
export { Checkbox } from "./checkbox";
export { RadioGroup, Radio } from "./radio";
export { Switch } from "./switch";
export { Select, SelectOption, SelectOptgroup } from "./select";

// Dialog & Overlay Components
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";

// Menu & Navigation Components
export {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "./dropdown";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./popover";

// Layout Components
export { Container } from "./container";
export { HStack, VStack } from "./stack";
export { Separator } from "./separator";

// Notification Components
export { ToastProvider, useToast } from "./toast";
export type { Toast, ToastType } from "./toast";
