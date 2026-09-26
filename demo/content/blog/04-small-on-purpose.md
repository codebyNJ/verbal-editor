---
title: Small on purpose
description: A size budget is a design tool. What an editor weighs is a decision made one module at a time.
date: 2026-09-26
icon: box
---

Nobody decides to ship a heavy editor. It happens one reasonable dependency at a time: a highlighter here, a math renderer there, a drag library because the platform's drag and drop is awkward. Each is small next to the app; together they are most of it.

## Budgets, checked in CI

Verbal sets a budget for its core, its full preset, every module and its CSS, and CI checks them after every build: a change that makes the package heavier than its budget fails the check instead of shipping. Today the core — the editor, the React binding and the paragraph block — is {{kb core}} of JavaScript, gzipped, and every module together is {{kb preset}}. The numbers on this page are read from that build, not typed in.

A budget changes the question you ask. Not "is this library good?" but "is this worth its weight here, and is there a way to get it from the platform instead?"

## The platform does more than it used to

Most of what editors once shipped as libraries now lives in the browser:

- **Syntax colours** are painted with the CSS Custom Highlight API, so no tokens are inserted into the text and no highlighter runtime ships. Each language's tokenizer loads the first time a code block shows it.
- **Equations** compile from LaTeX to MathML, which browsers render natively — no renderer and no fonts.
- **Menus and toolbars** use the Popover API; **dragging** uses Pointer Events, so it works with touch without a library.

## You pay for what you list

Each module is its own import and brings its own CSS; importing one registers nothing until you pass it to the editor. An app that needs headings and lists never downloads the table, the chart or the equation compiler. The [Choosing modules](#/docs/choosing-modules) page lists what each one weighs, measured the same way as the budget.

The benchmark compares the result with other editors' minimal and full setups, measured the same way for every editor: the full preset is {{lighter}} times lighter than the lightest other full setup measured ({{lighter-than}}). See [Benchmarks](#/benchmarks) for every editor, every setup and how to run it yourself.
