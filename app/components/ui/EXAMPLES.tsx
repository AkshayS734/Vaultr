/**
 * VAULTR UI - USAGE EXAMPLES
 * 
 * This file demonstrates common patterns and use cases
 * for the vaultr-ui component library.
 */

// ============================================================================
// BASIC FORM EXAMPLE
// ============================================================================

import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Form,
  FormField,
  FormError,
  FormHint,
  Input,
  Label,
  Textarea,
  Checkbox,
  RadioGroup,
  Radio,
  Switch,
} from '@/app/components/ui';

export function FormExample() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    subscribe: false,
    priority: 'normal',
    notifications: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.message.trim()) newErrors.message = 'Message is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    console.log('Form data:', formData);
    // Submit form...
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Contact Us</CardTitle>
      </CardHeader>
      <Form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <FormField error={errors.name}>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your name"
            />
            {errors.name && <FormError>{errors.name}</FormError>}
          </FormField>

          <FormField error={errors.email}>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
            />
            {errors.email && <FormError>{errors.email}</FormError>}
            <FormHint>We&apos;ll never share your email.</FormHint>
          </FormField>

          <FormField error={errors.message}>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Your message..."
            />
            {errors.message && <FormError>{errors.message}</FormError>}
          </FormField>

          <div>
            <Label>
              <Checkbox
                name="subscribe"
                checked={formData.subscribe}
                onChange={handleChange}
              />
              Subscribe to updates
            </Label>
          </div>

          <RadioGroup value={formData.priority}>
            <Label>Priority</Label>
            <Radio
              name="priority"
              value="low"
              label="Low"
              onChange={handleChange}
            />
            <Radio
              name="priority"
              value="normal"
              label="Normal"
              onChange={handleChange}
            />
            <Radio
              name="priority"
              value="high"
              label="High"
              onChange={handleChange}
            />
          </RadioGroup>

          <div className="flex items-center justify-between">
            <Label>Enable Notifications</Label>
            <Switch
              name="notifications"
              checked={formData.notifications}
              onChange={handleChange}
            />
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button variant="outline" type="reset">
            Clear
          </Button>
          <Button type="submit">Submit</Button>
        </CardFooter>
      </Form>
    </Card>
  );
}

// ============================================================================
// DIALOG/MODAL EXAMPLE
// ============================================================================

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui';

export function DialogExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogDescription>
            Are you sure you want to proceed? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => setIsOpen(false)}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TABS EXAMPLE
// ============================================================================

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui';

export function TabsExample() {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Email: user@example.com</p>
            <p>Joined: January 2024</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Switch label="Dark mode" />
            <Switch label="Email notifications" />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="security">
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent>
            <Button>Change password</Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// ============================================================================
// DROPDOWN MENU EXAMPLE
// ============================================================================

import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '@/app/components/ui';

export function DropdownExample() {
  return (
    <Dropdown>
      <DropdownTrigger>⋮ Menu</DropdownTrigger>
      <DropdownContent>
        <DropdownItem>Edit Profile</DropdownItem>
        <DropdownItem>View Settings</DropdownItem>
        <DropdownSeparator />
        <DropdownItem>Help & Support</DropdownItem>
        <DropdownItem>Sign Out</DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

// ============================================================================
// TOAST NOTIFICATIONS EXAMPLE
// ============================================================================

import { ToastProvider, useToast } from '@/app/components/ui';

export function ToastExample() {
  return (
    <ToastProvider>
      <ToastContent />
    </ToastProvider>
  );
}

function ToastContent() {
  const { addToast } = useToast();

  const showSuccess = () => {
    addToast({
      message: 'Operation completed successfully!',
      type: 'success',
      duration: 3000,
    });
  };

  const showError = () => {
    addToast({
      message: 'An error occurred. Please try again.',
      type: 'error',
      duration: 5000,
    });
  };

  const showWarning = () => {
    addToast({
      message: 'This action cannot be undone.',
      type: 'warning',
      duration: 4000,
    });
  };

  return (
    <div className="flex gap-2">
      <Button onClick={showSuccess} variant="outline">
        Success
      </Button>
      <Button onClick={showError} variant="outline">
        Error
      </Button>
      <Button onClick={showWarning} variant="outline">
        Warning
      </Button>
    </div>
  );
}

// ============================================================================
// LAYOUT EXAMPLE (HStack, VStack, Container)
// ============================================================================

import {
  Container,
  HStack,
  VStack,
  Separator,
  Badge,
} from '@/app/components/ui';

export function LayoutExample() {
  return (
    <Container size="md" className="py-8">
      <VStack gap="lg">
        {/* Header */}
        <HStack justify="between" align="center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <HStack gap="sm">
            <Badge variant="outline">v1.0</Badge>
            <Badge variant="default">Active</Badge>
          </HStack>
        </HStack>

        <Separator />

        {/* Content */}
        <VStack gap="md">
          <Card>
            <CardHeader>
              <CardTitle>Section 1</CardTitle>
            </CardHeader>
            <CardContent>Content here</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 2</CardTitle>
            </CardHeader>
            <CardContent>More content</CardContent>
          </Card>
        </VStack>

        <Separator />

        {/* Footer */}
        <HStack gap="md" justify="end">
          <Button variant="outline">Cancel</Button>
          <Button>Save</Button>
        </HStack>
      </VStack>
    </Container>
  );
}

// ============================================================================
// ALERT & PROGRESS EXAMPLE
// ============================================================================

import { Alert, AlertTitle, AlertDescription, Progress } from '@/app/components/ui';

export function AlertProgressExample() {
  const [progress] = useState(33);

  return (
    <VStack gap="lg" className="max-w-md">
      <Alert variant="default">
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>
          This is an informational message.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          An error occurred. Please try again.
        </AlertDescription>
      </Alert>

      <div>
        <Label className="mb-2">Progress</Label>
        <Progress value={progress} max={100} />
        <FormHint className="mt-1">{progress}% complete</FormHint>
      </div>
    </VStack>
  );
}

// ============================================================================
// POPOVER EXAMPLE
// ============================================================================

import { Popover, PopoverTrigger, PopoverContent } from '@/app/components/ui';

export function PopoverExample() {
  return (
    <Popover>
      <PopoverTrigger>More info</PopoverTrigger>
      <PopoverContent side="top">
        <p className="text-sm">
          This is a popover with additional information. Click outside to close.
        </p>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// COMPLETE PAGE EXAMPLE
// ============================================================================

export function CompletePage() {
  return (
    <Container>
      <VStack gap="xl" className="py-8">
        <HStack justify="between" align="center">
          <h1 className="text-3xl font-bold">Welcome</h1>
          <DropdownExample />
        </HStack>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="form">Form</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          {/* <TabsContent value="overview">
            <VStack gap="md">
              <FormExample />
              <AlertProgressExample />
            </VStack>
          </TabsContent> */}

          {/* Form Tab */}
          {/* <TabsContent value="form">
            <FormExample />
          </TabsContent> */}
        </Tabs>
      </VStack>
    </Container>
  );
}

/**
 * KEY PATTERNS
 * 
 * 1. Use composition to build complex UIs
 * 2. Leverage props for customization (className, variants)
 * 3. Use Context-based components for state management (Dialog, Tabs, Dropdown)
 * 4. Keep components simple and focused
 * 5. Use ref forwarding for DOM access when needed
 * 6. Combine with Tailwind CSS for unlimited styling
 */
