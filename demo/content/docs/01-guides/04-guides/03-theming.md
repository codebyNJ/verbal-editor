---
title: Theming
description: tokens.css is the whole theming API — custom properties with a light and a dark value each.
icon: palette
---

`tokens.css` is a set of CSS custom properties, each with a light and a dark value. The dark values apply by themselves when the system prefers dark; set `data-theme="light"` or `data-theme="dark"` on `<html>` to force one.

```css theme.css
:root {
  --v-accent: #7c3aed;
  --v-font: "Inter", system-ui, sans-serif;
  --v-radius: 10px;
}
```

Override any token after importing `tokens.css` — nothing is rebuilt and no script restyles anything. Durations drop to zero when the system asks for reduced motion. Every token is listed on [Tokens](#/docs/tokens), and shown live, in the current theme, on the [Theming example](#/examples/theming).

## A brand in a few lines

This site is themed exactly this way: a palette sampled from its night scene, layered over the package's tokens, dark by default.

```css brand.css
:root,
:root[data-theme="dark"] {
  color-scheme: dark;
  --v-bg: #0f1014;
  --v-fg: #e8eaf0;
  --v-accent: #fca942;
  --v-accent-fg: #0f1014;
}
:root[data-theme="light"] {
  color-scheme: light;
  --v-bg: #fbfaf7;
  --v-fg: #16171d;
  --v-accent: #a35500;
}
```

## Styling one block type

Every block's host carries `data-type`, plus the attributes its module adds (a table's `data-header`, a callout's `data-tone`), so you can style a type without touching its module:

```css blocks.css
[data-verbal] [data-type="quote"] { border-left-color: var(--v-accent); }
[data-verbal] [data-type="heading"] h1 { letter-spacing: -0.03em; }
[data-verbal][data-readonly] [data-type="code"] { box-shadow: none; }
```

`[data-readonly]` is set on the editor when it is created with `editable: false`.

> [!TIP]
> Keep contrast at 4.5:1 or better for text: `--v-fg-muted` and `--v-fg-faint` are used for secondary text, so check them against `--v-bg` and `--v-bg-soft`.
