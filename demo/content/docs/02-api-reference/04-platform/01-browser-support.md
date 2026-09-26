---
title: Browser support
description: The platform features Verbal relies on instead of shipping replacements, and where they exist.
icon: globe
---

Verbal relies on the platform instead of shipping replacements for it:

| Platform feature | Used for | Available in |
| --- | --- | --- |
| CSS Custom Highlight API | code colours, AI diff highlights | Chrome 105, Safari 17.2, Firefox 140 |
| MathML Core | equations | Chrome 109, Safari and Firefox earlier |
| `beforeinput` with target ranges | reading every edit | all current engines |
| Popover API | menus and toolbars | all current engines |
| Pointer Events | drag and drop, touch | all current engines |
| CSS container queries | layout by the editor's own width | all current engines |
| `useSyncExternalStore` | the React binding | React 18 and later |

The CSS Custom Highlight API sets the floor: Chrome 105, Safari 17.2 and Firefox 140. View Transitions and scroll-driven animations are used only where they exist.

Every release is tested in Chromium, Firefox and WebKit on desktop, and on a touch Pixel 7 (Chromium) and iPhone 13 (WebKit) profile.

## Detecting support

```js support.js
const supported = typeof CSS !== 'undefined' && 'highlights' in CSS;
if (!supported) console.warn('This browser cannot paint code colours or AI diffs.');
```
