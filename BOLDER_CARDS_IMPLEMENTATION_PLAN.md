# Implementation Plan - Bolder Card Colors

This plan outlines the changes required to make the summary cards on the Dashboard and Reports pages more visually prominent by using bolder colors.

## 1. Dashboard Page (`src/pages/Dashboard.jsx`)

### Current State
- Cards use very light background colors (`-light` variants with `~50%` opacity).
- Text uses standard `text-text-primary` and `text-text-secondary`.
- Icons use white background with colored icons.

### Proposed Changes
- Switch to solid background colors using the base brand colors.
- Change text color to white for better contrast against solid backgrounds.
- Update icons to use semi-transparent white backgrounds.

#### Update `statTones` object:
```javascript
const statTones = {
  blue: {
    card: 'bg-brand-blue border-brand-blue shadow-lg shadow-brand-blue/20',
    icon: 'bg-white/20 text-white',
    label: 'text-white/80',
    value: 'text-white',
  },
  amber: {
    card: 'bg-warning border-warning shadow-lg shadow-warning/20',
    icon: 'bg-white/20 text-white',
    label: 'text-white/80',
    value: 'text-white',
  },
  green: {
    card: 'bg-success border-success shadow-lg shadow-success/20',
    icon: 'bg-white/20 text-white',
    label: 'text-white/80',
    value: 'text-white',
  },
  red: {
    card: 'bg-danger border-danger shadow-lg shadow-danger/20',
    icon: 'bg-white/20 text-white',
    label: 'text-white/80',
    value: 'text-white',
  },
}
```

#### Update `StatCard` component:
Modify the `StatCard` to use the new `label` and `value` color classes from `statTones`.

## 2. Reports Page (`src/pages/Reports.jsx`)

### Current State
- Three summary cards at the top use `-light` backgrounds and colored text.
- They have a left border in the base color.

### Proposed Changes
- Switch to solid background colors.
- Change text to white/off-white.
- Maintain the bold "pop" of the summary stats.

#### Update Summary Cards:
- **Total Transactions:** Change `bg-brand-blue-light border-brand-blue` to `bg-brand-blue text-white shadow-lg shadow-brand-blue/20`.
- **Total Revenue:** Change `bg-success-light border-success` to `bg-success text-white shadow-lg shadow-success/20`.
- **Average Sale:** Change `bg-info-light border-info` to `bg-info text-white shadow-lg shadow-info/20`.

## 3. Verification
- Verify Dashboard cards look vibrant and text is readable on mobile and desktop.
- Verify Reports summary cards are consistent with the Dashboard style.
- Check hover states on Dashboard cards (links).
