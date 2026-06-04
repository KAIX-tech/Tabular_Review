---
title: Preserve State/DOM for Show/Hide
impact: MEDIUM
impactDescription: preserves state/DOM
tags: rendering, activity, visibility, state-preservation
---

## Preserve State/DOM for Show/Hide

Expensive components that frequently toggle visibility should preserve their DOM/state to avoid re-mount costs.

**Pattern: CSS display toggle (stable)**

```tsx
function Dropdown({ isOpen }: Props) {
  return (
    <div style={{ display: isOpen ? 'block' : 'none' }}>
      <ExpensiveMenu />
    </div>
  )
}
```

Component stays mounted — state and DOM are preserved. `display: none` removes it from layout without unmounting.
