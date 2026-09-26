---
title: Tokens
description: Every custom property in tokens.css with its light and dark value, read from the file itself.
icon: palette
---

Override any of these after importing `tokens.css`. Values written as `light-dark()` switch with the colour scheme; the rest are the same in both. See [Theming](#/docs/theming) for how to apply a brand.

{{tokens}}

```css override.css
:root {
  --v-accent: #0f766e;
  --v-radius-lg: 14px;
}
```
