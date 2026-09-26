---
title: CLI
description: verbal init writes a config and prints its imports; verbal doctor checks it and reports each module's cost.
icon: terminal
---

The `verbal` command ships with the package and runs at build time; it needs Joi as a dev dependency.

::: code-group
```bash [npm]
npm install -D joi
npx verbal init
```
```bash [pnpm]
pnpm add -D joi
pnpm exec verbal init
```
```bash [yarn]
yarn add -D joi
yarn verbal init
```
```bash [bun]
bun add -d joi
bunx verbal init
```
:::

## verbal init

Asks which blocks, marks and UI modules to enable (Enter takes them all) and whether you use AI review, writes `verbal.config.js`, and prints the imports and the `new Editor(...)` call for exactly that set.

| Flag | Does |
| --- | --- |
| `--yes` | takes every module without asking |
| `--force` | replaces an existing config |
| `[file]` | writes somewhere other than `verbal.config.js` |

## verbal doctor

Validates the config and reports what each enabled module weighs, measured from the installed package. It exits non-zero when the config is invalid or the editor is over its `budget`, so it can gate CI.

This is its real output for the config on the [Config file](#/docs/config-file) page, produced when this site was built:

{{doctor}}

> [!TIP]
> Run `verbal doctor` in CI after your build: a module added without thought shows up as a failed check with its cost next to it.
