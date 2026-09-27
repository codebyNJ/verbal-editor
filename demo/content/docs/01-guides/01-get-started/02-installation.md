---
title: Installation
description: Add the package and its stylesheet; nothing else is installed with it.
icon: package
---

::: code-group
```bash [npm]
npm install verbal-editor
```
```bash [pnpm]
pnpm add verbal-editor
```
```bash [yarn]
yarn add verbal-editor
```
```bash [bun]
bun add verbal-editor
```
:::

The package has no dependencies. Two optional peers cover the parts that need them:

| Peer | Needed for | Where it runs |
| --- | --- | --- |
| `react` 18 or later | the `<Blocks>` binding from `verbal-editor/react` | the browser |
| `joi` 17 or later | `verbal.config.js`, the CLI and `verbal-editor/server` | build time and your server |

Without React, render with the DOM binding from `verbal-editor/dom` instead. Joi never reaches the browser: the size check in this repository fails the build if a browser entry can reach it.

## The stylesheet

Import the tokens once, anywhere in your app. Every module brings its own CSS with its JavaScript, so this is the only stylesheet you add by hand:

```js main.js
import 'verbal-editor/tokens.css';
```

`tokens.css` is also the whole theming API — see [Theming](#/docs/theming).

## TypeScript

Types ship with the package: every entry has declarations generated from the JSDoc in its source, so editors and `tsc` see the same contract the docs describe. There is nothing extra to install.

## Browsers

Verbal needs the CSS Custom Highlight API, which sets the floor at Chrome 105, Safari 17.2 and Firefox 140. The full list is on [Browser support](#/docs/browser-support).

> [!TIP]
> The package is `verbal-editor` on npm once it is published; until then, install it from a local build with `npm pack` in this repository.
