---
title: Mobile & touch
description: Container-first layout, finger-sized targets, and menus that stay clear of the on-screen keyboard.
icon: phone
---

Verbal is built for fingers as well as mice.

- **Container-first.** The editor lays itself out by its own width, not the window's: columns stack below 640 px of editor, so an editor in a narrow side panel on a desktop behaves like one on a phone.
- **Finger-sized targets.** On touch screens every control — the drag handle, to-do boxes, table and code-block controls, suggestion buttons, toolbar buttons — has at least a 44 × 44 px target, without changing how it looks.
- **Nothing behind hover.** Controls that appear on hover with a mouse are always visible on touch.
- **No zoom on focus.** Every field Verbal renders uses at least 16 px text on touch, so iOS never zooms the page.
- **Moving blocks.** Tap a block to show its handle; drag the handle to move it (or the whole selection); tap the handle to select the block.
- **The on-screen keyboard.** The slash menu, emoji picker, selection toolbar and equation editor stay inside the visible part of the screen; the menus and the toolbar flip above the caret when the keyboard leaves no room below, and follow it as it opens and closes.
- **The native callout.** On touch the selection toolbar opens below the selection, clear of the system's copy and paste menu.

## In your app

```html index.html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

`interactive-widget=resizes-content` makes Chrome on Android shrink the page when the keyboard opens, so a full-height layout keeps the caret visible. If your layout reaches the screen edges, pad it with `env(safe-area-inset-*)` so nothing sits under a notch.

```css layout.css
.page {
  padding: 16px max(16px, env(safe-area-inset-right)) 16px max(16px, env(safe-area-inset-left));
}
```

> [!NOTE]
> Every release is tested on a touch Pixel 7 (Chromium) and iPhone 13 (WebKit) profile.
