# Style Guide

Code conventions and standards for void-server development.

## General Rules

- **No hardcoded colors** - use CSS variables (`var(--color-primary)`) or Tailwind theme classes (`text-primary`)
- **No `window.alert`** - use `toast` from react-hot-toast
- **No `window.confirm`** - use inline confirmation modals
- **No try/catch** where avoidable - let errors propagate naturally
- **Functional components** - prefer functions over classes
- **Responsive design** - use Tailwind responsive prefixes (sm:, md:, lg:)
- **Test IDs** - add `data-testid` attributes to interactive elements (see below)

## Test IDs (data-testid)

All interactive elements should have unique `data-testid` attributes for e2e testing. This enables reliable test automation without depending on CSS classes or text content that may change.

### When to Add data-testid

**Required for:**
- Buttons and clickable elements
- Form inputs (text, checkbox, select, etc.)
- Toggle switches
- Navigation items
- List containers and list items
- Tabs and tab panels
- Modal dialogs
- Cards that are clickable or contain interactive content

**Not required for:**
- Static text content
- Decorative elements
- Icons (unless clickable)
- Layout containers (unless they're test boundaries)

### Naming Convention

Use kebab-case with descriptive, unique names:

```jsx
// Pattern: [component]-[element]-[qualifier]
data-testid="settings-theme-select"
data-testid="template-list"
data-testid="template-item-{id}"
data-testid="memory-content-input"
data-testid="plugin-toggle-{name}"
```

### Standard Test IDs by Component Type

| Component | Pattern | Example |
|-----------|---------|---------|
| Page container | `{page}-page` | `settings-page` |
| List container | `{item}-list` | `template-list` |
| List item | `{item}-item` or `{item}-item-{id}` | `template-item` |
| Form input | `{field}-input` | `memory-content-input` |
| Toggle/Switch | `{feature}-toggle` | `auto-collapse-toggle` |
| Button | `{action}-button` or `btn-{action}` | `save-button` |
| Tab | `tab-{name}` | `tab-graph` |
| Modal | `modal-{name}` | `modal-confirm-delete` |
| Card | `card-{name}` | `card-provider-openai` |

### Examples

```jsx
// List with items
<div data-testid="template-list">
  {templates.map(t => (
    <div key={t.id} data-testid={`template-item-${t.id}`}>
      {t.name}
    </div>
  ))}
</div>

// Form inputs
<input
  data-testid="template-name-input"
  name="name"
  value={name}
  onChange={...}
/>

// Toggle switch
<label data-testid="auto-collapse-toggle">
  <input type="checkbox" checked={enabled} onChange={...} />
  <span>Auto-collapse navigation</span>
</label>

// Tabs
<div role="tablist">
  <button data-testid="tab-list" role="tab">List</button>
  <button data-testid="tab-graph" role="tab">Graph</button>
</div>

// Clickable card
<div
  data-testid={`provider-card-${provider.id}`}
  onClick={() => selectProvider(provider)}
>
  {provider.name}
</div>
```

### Uniqueness Requirements

- Test IDs must be unique within the page
- For lists, include the item's ID: `data-testid={`item-${id}`}`
- For nested components, use hierarchical names: `modal-delete-confirm-button`

## Theme System

See [THEME.md](THEME.md) for complete theme documentation including CSS variables, Tailwind classes, and utility classes.

## Server Logging Format

All server logs use a single-line interpolated format with emoji icons:

```javascript
// Format: emoji + context info on single line
console.log(`📋 GET /api/endpoint param=${value}`);
console.log(`✅ Success message with ${count} items`);
console.log(`❌ Error: ${error.message}`);
```

### Emoji Conventions

| Emoji | Usage |
|-------|-------|
| `📋` | List/fetch operations |
| `👛` | Wallet operations |
| `🪙` | Token operations |
| `🔑` | Key/derivation operations |
| `🔐` | Seed/secret operations |
| `➕` | Create operations |
| `📥` | Import operations |
| `🗑️` | Delete operations |
| `✏️` | Update/edit operations |
| `💸` | Transaction/send operations |
| `✍️` | Sign operations |
| `🔄` | Refresh/sync operations |
| `✅` | Success result |
| `❌` | Error result |
| `⚠️` | Warning |
| `🚀` | Startup/init |
| `🔌` | Plugin/connection |

## Available Icons

Icons from `lucide-react`. Import as needed:

```jsx
import { Home, Box, Settings, Check, X } from 'lucide-react';
```

### Common Icons

| Category | Icons |
|----------|-------|
| Navigation | `Home`, `Box`, `FileText`, `Settings` |
| Actions | `Copy`, `Download`, `RefreshCw`, `Trash2`, `Edit` |
| Status | `Check`, `X`, `AlertTriangle`, `Info` |
| Media | `Play`, `Pause`, `Volume2`, `Music` |

## Component Patterns

### Page Header
```jsx
<div className="flex items-center gap-3">
  <Icon className="w-8 h-8 text-primary" />
  <div>
    <h1 className="text-2xl font-bold text-text-primary">Page Title</h1>
    <p className="text-secondary text-sm">Page description</p>
  </div>
</div>
```

### Card
```jsx
<div className="card space-y-4">
  <h2 className="text-lg font-semibold text-text-primary">Section</h2>
  {/* content */}
</div>
```

### Form Elements
```jsx
<input className="form-input w-full" placeholder="Input..." />
<button className="btn btn-primary">Action</button>
```

### Toast Notifications
```jsx
import toast from 'react-hot-toast';

toast.success('Operation completed');
toast.error('Something went wrong');
toast.loading('Processing...', { id: 'unique-id' });
toast.dismiss('unique-id');
```
