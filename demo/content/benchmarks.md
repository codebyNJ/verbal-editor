---
title: Benchmarks
description: What Verbal and six other editors download, how fast they mount 1,000 blocks, and what a keystroke costs.
icon: gauge
---

Every number on this page comes from `bench/results.json`, written by the benchmark in this repository on {{bench-date}}. The charts are Verbal's own table and chart blocks — edit a number in a table and its chart redraws, without a single React render.

## Download size

JavaScript and CSS each editor needs before it can edit, gzipped the way this repository's size check measures the package. The minimal setup is the smallest editor that edits paragraphs; the full setup adds the editor's own packages for headings, lists and to-dos, quotes, code, tables, links and images.

{{bench-table total KB}}

::: chart bar :::

## Mount time for 1,000 blocks

Milliseconds from creating the editor with 1,000 paragraphs to the first paint that shows the last one; the median of {{bench-method mountRuns}} cold page loads.

{{bench-table mountMs ms}}

::: chart bar :::

## Keystroke handling

The main-thread time one keystroke costs, 95th percentile over {{bench-method typingRuns}} runs of {{bench-method keystrokes}} keys typed into the first of 1,000 paragraphs: from the moment each key event reaches the page until it and everything it set off (`keypress`, `beforeinput`, `input` and their microtasks) has finished.

{{bench-table inputP95Ms ms}}

::: chart bar :::

Time to the next paint after a keystroke was {{bench-paint}} at the 95th percentile across every editor — about one 60 Hz frame for all of them, set by when the next frame comes rather than by the editor — so it cannot tell them apart. The handling time above can.

## Verbal against each editor

Verbal's full setup compared with each editor's full setup.

{{bench-reduction}}

{{bench-slower}} Typing does not pay for that: {{renders}} React renders per keystroke. Try it in a [400-block page](#/examples/bench) and watch the render counter.

## Notion

{{notion}}

## Every measurement

{{bench-all}}

## Method

::: steps
### Build every setup the same way
Each setup in `bench/setups/` is one entry of a single Vite build. React is a shared chunk left out of every size, as it is out of Verbal's own numbers; fonts and images are not counted. Verbal is measured from this repository's `dist/`.

### Mount in a cold page
A fresh Chromium page loads the setup, then creates the editor with {{bench-method blocks}} paragraphs and waits for the frame that paints the last one.

### Type into the first paragraph
The caret goes to the end of the first paragraph; Playwright types {{bench-method keystrokes}} characters, {{bench-method keyDelayMs}} ms apart, while the page records each keystroke's handling time and its time to the next paint.
:::

Measured on {{bench-environment}}. Versions:

{{bench-versions}}

## Run it yourself

```bash
npm run build
cd bench && npm ci && npm run bench
```

The run rewrites `bench/results.json`; rebuild the site to see the new numbers here.
