---
title: Config file
description: verbal.config.js names the modules your app enables and the size it may weigh; Joi checks it at build time.
icon: settings
---

A config file is optional. It gives one place to name the modules your app uses, feeds [server validation](#/docs/server-validation) the same list, and lets [`verbal doctor`](#/docs/cli) hold the editor to a size budget in CI.

```js verbal.config.js
import { defineConfig } from '@verbal/editor/config';

export default defineConfig({
  blocks: ['heading', 'list', 'todo', 'table', 'code'],
  marks: ['bold', 'italic', 'link'],
  ui: ['slash', 'toolbar', 'dnd'],
  ai: false,
  budget: 30,
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `blocks` | `string[]` | `[]` | block modules by name — the same names as `@verbal/editor/blocks/<name>` |
| `marks` | `string[]` | `[]` | mark modules by name |
| `ui` | `string[]` | `[]` | UI modules by name |
| `ai` | `boolean` | `false` | whether the app uses AI review |
| `budget` | `number` | `30` | KB of gzipped JavaScript the configured editor may weigh |

The names come from the package itself — the config accepts exactly the modules it ships:

```js names.js
import { available } from '@verbal/editor/config';

console.log(available.blocks, available.marks, available.ui);
```

## Errors

`defineConfig` validates with Joi and throws with the exact path and reason, so the build that loads the config fails. These are its real messages for `blocks: ['heading', 'tables']` and for `blocks: ['chart']` — a chart draws from a table:

{{config-errors}}

> [!WARNING]
> The config imports Joi. Load it in build scripts and on your server — never from browser code.
