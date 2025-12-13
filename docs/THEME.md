# Theme System

void-server uses a theme system with CSS variables that plugins must follow for visual consistency.

## Available Themes

| Theme | Description | Primary Color |
|-------|-------------|---------------|
| `clawed` | Default. Neon green primary, magenta secondary, white text | `#00db38` |
| `green` | Classic terminal green with green text | `#33ff33` |
| `gray` | Monochrome grayscale | `#a0a0a0` |

## CSS Variables

All UI components should use these CSS variables, never hardcoded colors:

```css
/* Backgrounds */
var(--color-background)           /* Page background (#0a0a0a) */
var(--color-background-translucent) /* Semi-transparent bg */
var(--color-surface)              /* Card/panel background */
var(--color-surface-solid)        /* Solid surface (sidebar) */

/* Borders */
var(--color-border)               /* Standard borders */

/* Primary colors (theme accent) */
var(--color-primary)              /* Main accent color */
var(--color-primary-dark)         /* Darker variant */
var(--color-primary-light)        /* Lighter variant */

/* Secondary colors */
var(--color-secondary)            /* Secondary accent */
var(--color-secondary-dark)
var(--color-secondary-light)

/* Text */
var(--color-text-primary)         /* Main text color */
var(--color-text-secondary)       /* Muted text */
var(--color-text-disabled)        /* Disabled state */

/* Semantic colors (consistent across themes) */
var(--color-success)              /* #4caf50 - green */
var(--color-warning)              /* #ff9800 - orange */
var(--color-error)                /* #f44336 - red */
var(--color-info)                 /* #2196f3 - blue */
```

## Tailwind Theme Classes

Use these Tailwind classes that map to CSS variables:

```jsx
// Text colors
className="text-primary"        // var(--color-primary)
className="text-text-primary"   // var(--color-text-primary)
className="text-text-secondary" // var(--color-text-secondary)
className="text-secondary"      // var(--color-text-secondary)

// Backgrounds
className="bg-surface"          // var(--color-surface)
className="bg-background"       // var(--color-background)

// Borders
className="border-border"       // var(--color-border)
className="border-primary"      // var(--color-primary)
```

## Utility Classes

Pre-built utility classes in `client/src/index.css`:

```jsx
// Buttons
className="btn btn-primary"     // Primary action (filled)
className="btn btn-secondary"   // Secondary action (outline)
className="btn btn-danger"      // Destructive action
className="btn btn-warning"     // Warning action
className="btn btn-success-outline" // Success outline

// Badges
className="badge badge-success" // Green status
className="badge badge-warning" // Yellow status
className="badge badge-danger"  // Red status
className="badge badge-info"    // Blue status

// Cards
className="card"                // Standard card container

// Forms
className="form-input"          // Input fields
className="form-label"          // Form labels
```

## Theme Compliance Rules

**NEVER hardcode colors.** Always use CSS variables or Tailwind theme classes.

```jsx
// BAD - hardcoded colors
style={{ backgroundColor: 'rgba(0, 50, 30, 0.3)' }}
style={{ color: '#33ff33' }}
className="text-green-400"

// GOOD - theme-aware
style={{ backgroundColor: 'var(--color-surface)' }}
style={{ color: 'var(--color-primary)' }}
className="text-primary"
```

**For semantic states, use semantic colors:**

```jsx
// Success/error states
style={{ color: result === 'valid' ? 'var(--color-success)' : 'var(--color-error)' }}
style={{ backgroundColor: 'rgba(76, 175, 80, 0.15)' }} // success tint
style={{ backgroundColor: 'rgba(244, 67, 54, 0.15)' }} // error tint
```

## Implementation

Theme variables are defined in:
- `client/src/index.css` - CSS variables and utility classes
- `client/src/contexts/ThemeContext.jsx` - React context for theme switching
