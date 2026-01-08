# UI/UX Design Patterns

Analysis of 5 pages across different page types.

## Page Types Analyzed

### Templates Pages (1)
- **Templates**: https://www.todoist.com/templates
### Pricing Pages (1)
- **Pricing**: https://www.todoist.com/pricing
### Integrations Pages (1)
- **Integrations**: https://www.todoist.com/integrations
### Feature Pages (1)
- **Task Management**: https://www.todoist.com/task-management
### Downloads Pages (1)
- **Downloads**: https://www.todoist.com/downloads

## Component Inventory

### Buttons
- **Total instances**: 372
- **Found on**: Templates, Pricing, Integrations, Task Management, Downloads

### Cards
- **Total instances**: 170
- **Found on**: Templates, Integrations, Task Management

### Navigation
- **Total instances**: 34
- **Found on**: Templates, Pricing, Integrations, Task Management, Downloads

### Forms
- **Total instances**: 5
- **Found on**: Templates, Pricing, Integrations, Task Management, Downloads

### Images
- **Total instances**: 119
- **Found on**: Templates, Pricing, Integrations, Task Management, Downloads

## Layout Patterns

### Templates
- Grid layout: ✅
- Flexbox: ❌
- Container: ✅

### Pricing
- Grid layout: ❌
- Flexbox: ❌
- Container: ✅

### Integrations
- Grid layout: ✅
- Flexbox: ❌
- Container: ✅

### Task Management
- Grid layout: ✅
- Flexbox: ❌
- Container: ✅

### Downloads
- Grid layout: ❌
- Flexbox: ❌
- Container: ✅

## Responsive Design Recommendations

Based on analyzed patterns, implement these breakpoints:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    }
  }
}
```

## Implementation Guidelines

### For Next.js + React + Tailwind

1. **Component Structure**
   - Use functional components with TypeScript
   - Implement proper prop types
   - Follow atomic design principles

2. **Styling Approach**
   - Use Tailwind utility classes primarily
   - Create custom components for repeated patterns
   - Use CSS modules for complex animations

3. **Accessibility**
   - Ensure proper semantic HTML
   - Add ARIA labels where needed
   - Maintain keyboard navigation

4. **Performance**
   - Lazy load images
   - Code split large components
   - Optimize font loading
