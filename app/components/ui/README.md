# Vaultr UI Component Library

A lightweight, dependency-free collection of reusable UI components for the Vaultr application. Built with React and Tailwind CSS, featuring a clean API inspired by modern design patterns.

## Features

✅ **Zero External Dependencies** - No Radix UI, cmdk, sonner, or other library bloat  
✅ **Framework-Safe** - Pure React components with TypeScript  
✅ **Accessible** - Keyboard navigation and screen reader support  
✅ **Composable** - Flexible, nestable component patterns  
✅ **Tailwind CSS** - Uses the same styling approach as the project  
✅ **Forwardable** - Full `ref` support for all components  

## Installation

The library is pre-installed. Import components from `app/components/ui`:

```tsx
import { Button, Card, CardHeader, CardTitle } from '@/app/components/ui';
```

## Core Components

### Button
```tsx
<Button variant="default" size="md">
  Click me
</Button>
```

**Variants:** `default` | `destructive` | `outline` | `secondary` | `ghost` | `link`  
**Sizes:** `default` | `sm` | `lg` | `icon`

### Card
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>Content goes here</CardContent>
  <CardFooter>Footer actions</CardFooter>
</Card>
```

Subcomponents: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

### Input & Textarea
```tsx
<Input type="email" placeholder="Enter email..." />
<Textarea placeholder="Type message..." />
```

### Label
```tsx
<Label>
  <Checkbox id="terms" />
  I agree to terms
</Label>
```

## Form Components

### Checkbox
```tsx
<Checkbox id="agree" checked={agreed} onChange={setAgreed} />
```

### Radio & RadioGroup
```tsx
<RadioGroup value={selected} onValueChange={setSelected}>
  <Radio value="option1" label="Option 1" />
  <Radio value="option2" label="Option 2" />
</RadioGroup>
```

### Switch
```tsx
<Switch label="Enable notifications" checked={enabled} onChange={setEnabled} />
```

### Select
```tsx
<Select value={selected} onChange={(e) => setSelected(e.target.value)}>
  <SelectOption value="">Choose...</SelectOption>
  <SelectOption value="opt1">Option 1</SelectOption>
</Select>
```

### Form
```tsx
<Form onSubmit={handleSubmit}>
  <FormField error={errors.email}>
    <Label htmlFor="email">Email</Label>
    <Input id="email" {...register('email')} />
    {errors.email && <FormError>{errors.email}</FormError>}
    <FormHint>We'll never share your email.</FormHint>
  </FormField>
  <Button type="submit">Submit</Button>
</Form>
```

## Feedback Components

### Badge
```tsx
<Badge variant="default">New</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Info</Badge>
```

### Alert
```tsx
<Alert variant="default">
  <AlertTitle>Notice</AlertTitle>
  <AlertDescription>Something important.</AlertDescription>
</Alert>
```

### Progress
```tsx
<Progress value={65} max={100} />
<Progress indeterminate />
```

### Skeleton
```tsx
<Skeleton variant="text" className="h-4 w-full" />
<Skeleton variant="circle" className="size-12" />
```

## Dialog & Overlays

### Dialog
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description</DialogDescription>
    </DialogHeader>
    {/* content */}
    <DialogFooter>
      <Button>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Popover
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost">Info</Button>
  </PopoverTrigger>
  <PopoverContent side="top">
    Popover content
  </PopoverContent>
</Popover>
```

## Navigation & Menus

### Tabs
```tsx
<Tabs defaultValue="tab1" onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

### Dropdown Menu
```tsx
<Dropdown>
  <DropdownTrigger asChild>
    <Button variant="ghost">Menu</Button>
  </DropdownTrigger>
  <DropdownContent>
    <DropdownItem>Option 1</DropdownItem>
    <DropdownItem>Option 2</DropdownItem>
    <DropdownSeparator />
    <DropdownItem>Option 3</DropdownItem>
  </DropdownContent>
</Dropdown>
```

## Layout Components

### Container
```tsx
<Container size="lg">
  <h1>Page title</h1>
  <p>Content</p>
</Container>
```

**Sizes:** `sm` | `md` | `lg` | `full`

### HStack (Horizontal Layout)
```tsx
<HStack gap="md" align="center" justify="between">
  <span>Left</span>
  <span>Right</span>
</HStack>
```

### VStack (Vertical Layout)
```tsx
<VStack gap="lg" align="stretch">
  <Button>Button 1</Button>
  <Button>Button 2</Button>
</VStack>
```

### Separator
```tsx
<Separator orientation="horizontal" />
<div className="flex">
  <div>Left</div>
  <Separator orientation="vertical" />
  <div>Right</div>
</div>
```

## Notifications

### Toast
```tsx
import { ToastProvider, useToast } from '@app/components/ui';

function App() {
  return (
    <ToastProvider>
      <YourContent />
    </ToastProvider>
  );
}

function MyComponent() {
  const { addToast } = useToast();

  const notify = () => {
    addToast({
      message: 'Success!',
      type: 'success',
      duration: 3000,
    });
  };

  return <Button onClick={notify}>Notify</Button>;
}
```

**Toast Types:** `default` | `success` | `error` | `warning`

## Design Principles

### Spacing
- `sm`: 0.5rem (8px)
- `md`: 1rem (16px)
- `lg`: 1.5rem (24px)
- `xl`: 2rem (32px)

### Colors
Components inherit from Tailwind CSS theme:
- `primary` / `primary-foreground`
- `secondary` / `secondary-foreground`
- `destructive`
- `accent` / `accent-foreground`
- `muted-foreground`
- `background` / `foreground`
- `card` / `card-foreground`

### Focus & Accessibility
All interactive components feature:
- Keyboard navigation support
- ARIA labels where appropriate
- Focus rings (2px, semi-transparent)
- Disabled state styling

## Common Patterns

### Controlled Components
```tsx
const [value, setValue] = useState('');

<Input
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### Composition
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Content</p>
  </CardContent>
</Card>
```

### Forwarding Refs
All components support `ref` forwarding:
```tsx
const inputRef = useRef(null);

<Input ref={inputRef} />
```

## Styling Customization

Override default styles with `className`:

```tsx
<Button className="w-full">Full Width Button</Button>

<Card className="shadow-xl">
  {/* card content */}
</Card>
```

## Migration from components/ui

If migrating from Figma-generated `components/ui`:

1. **Import from new location:**
   ```tsx
   // Before
   import { Button } from '@/app/components/ui';
   
   // After
   import { Button } from '@app/components/ui';
   ```

2. **API is compatible** - Most props work the same way
3. **Variants** - Use the same variant/size patterns
4. **No breaking changes** - Original UI lib remains untouched

## Best Practices

✅ Use composition over modification  
✅ Leverage `className` for custom styling  
✅ Keep components focused and single-purpose  
✅ Use ref forwarding for DOM access  
✅ Prefer controlled components in forms  
✅ Use semantic HTML where possible  

## Browser Support

Modern browsers with ES2020+ support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Part of Vaultr. See project LICENSE.
