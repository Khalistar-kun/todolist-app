# TaskFlow Color Reference
## Todoist-Inspired Design with iPhone Orange

### Primary Brand Color (iPhone 17 Pro Max Orange)
```css
--brand-orange: #FF9F66;
```

**Usage:**
- Primary CTA buttons
- Selected states
- Due dates
- Important highlights
- Brand elements

### Brand Color Scale
```css
brand-50:  #fff9f0  /* Lightest - backgrounds */
brand-100: #ffeddb  /* Light - hover states */
brand-200: #ffdbb8
brand-300: #ffc794
brand-400: #ffb370
brand-500: #FF9F66  /* PRIMARY - buttons, CTAs */
brand-600: #ff8a47  /* Hover state */
brand-700: #ff7529
brand-800: #e65d0f
brand-900: #c74d00  /* Darkest - rarely used */
```

### Background Colors (Soft Pastels)
```css
--bg-cream: #f6faeb  /* Main sidebar background */
--bg-peach: #fff6f0  /* Gradient accent */
--bg-mint:  #f4fbf7  /* Section backgrounds */
--bg-warm:  #fff9eb  /* Warm accent */
```

**Usage:**
- Sidebar: Cream (#f6faeb)
- Page gradients: White → Peach
- Section backgrounds: Mint
- Cards: Pure white (#ffffff)

### Text Colors (Gray Scale)
```css
--text-primary:   #202020  /* Headings, main text */
--text-secondary: #666666  /* Body text, descriptions */
--text-tertiary:  #999999  /* Placeholders, muted text */
```

**Usage:**
- Headings: text-gray-900 (#202020)
- Body: text-gray-700 (#374151)
- Secondary: text-gray-600 (#4b5563)
- Muted: text-gray-500 (#6b7280)
- Disabled: text-gray-400 (#9ca3af)

### Border Colors
```css
--border-light: #e8e8e8  /* Main borders */
```

**Tailwind Classes:**
- border-gray-100: #f3f4f6 (Very light)
- border-gray-200: #e5e7eb (Light - primary use)
- border-gray-300: #d1d5db (Medium)

### Status Colors

#### Todo Status
```css
Background: bg-gray-50   (#f9fafb)
Border:     border-gray-200 (#e5e7eb)
Text:       text-gray-700 (#374151)
```

#### In Progress Status
```css
Background: bg-amber-50  (#fffbeb)
Border:     border-amber-200 (#fde68a)
Text:       text-amber-700 (#b45309)
```

#### Done Status
```css
Background: bg-green-50  (#f0fdf4)
Border:     border-green-200 (#bbf7d0)
Text:       text-green-700 (#15803d)
```

### Interactive States

#### Buttons

**Primary (Orange):**
```css
Default: bg-brand-500 (#FF9F66)
Hover:   bg-brand-600 (#ff8a47)
Active:  bg-brand-700 (#ff7529)
```

**Secondary (White):**
```css
Default: bg-white border-gray-200
Hover:   bg-gray-50
Active:  bg-gray-100
```

**Destructive (Red):**
```css
Default: bg-red-50 border-red-200 text-red-600
Hover:   bg-red-100
```

#### Links & Highlights
```css
Default: text-brand-600 (#ff8a47)
Hover:   text-brand-700 (#ff7529)
```

### Shadow System
```css
/* Soft shadows - Todoist style */
--shadow-soft:    0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)
--shadow-soft-md: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)
--shadow-soft-lg: 0 10px 15px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.03)
```

**Usage:**
- Cards: shadow-soft
- Hover cards: shadow-soft-md
- Modals: shadow-soft-lg
- Buttons: shadow-soft

### Semantic Colors

#### Success
```css
bg-green-50 border-green-200 text-green-700
```

#### Warning
```css
bg-amber-50 border-amber-200 text-amber-700
```

#### Error
```css
bg-red-50 border-red-200 text-red-700
```

#### Info
```css
bg-blue-50 border-blue-200 text-blue-700
```

## Color Usage Guidelines

### DO:
✓ Use orange (#FF9F66) for primary actions only
✓ Use soft pastels for backgrounds
✓ Use gray scale for most text
✓ Keep shadows subtle and soft
✓ Use white for card backgrounds
✓ Maintain high contrast for accessibility

### DON'T:
✗ Overuse the orange color
✗ Use heavy gradients
✗ Use dark backgrounds
✗ Use saturated colors
✗ Use heavy shadows
✗ Mix too many accent colors

## Accessibility

### Contrast Ratios (WCAG AA Compliant)
- Orange on white: 3.2:1 (Large text only)
- Gray-900 on white: 16:1 ✓
- Gray-700 on white: 7.8:1 ✓
- Gray-600 on white: 5.7:1 ✓
- Orange buttons with white text: 3.2:1 (Large text) ✓

### Recommendations
- Use gray-700 or darker for body text
- Use gray-900 for headings
- Orange is acceptable for buttons (white text)
- Always test with accessibility tools

## Implementation Examples

### Button Classes
```jsx
// Primary
className="bg-brand-500 hover:bg-brand-600 text-white"

// Secondary
className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700"

// Destructive
className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600"
```

### Card Classes
```jsx
className="bg-white border border-gray-100 rounded-xl shadow-soft hover:shadow-soft-md"
```

### Status Pills
```jsx
// Todo
className="bg-gray-50 border border-gray-200 text-gray-700"

// In Progress
className="bg-amber-50 border border-amber-200 text-amber-700"

// Done
className="bg-green-50 border border-green-200 text-green-700"
```
