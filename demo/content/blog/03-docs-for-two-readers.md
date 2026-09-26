---
title: Docs for two readers
description: Documentation is now read by people and by models. Plain Markdown, one page per address, serves both.
date: 2026-09-26
icon: book
---

A developer adding an editor to an app today often has a second reader over their shoulder: a coding assistant that has never seen the library and will happily invent an API that looks plausible. The cheapest way to help both readers is the same: say exactly what exists, in plain text, at a stable address.

## Every page is a Markdown file

Each page of these docs is written in Markdown and published as its own `.md` file next to the site. The page you read and the file a model reads are the same text, including every generated table — so a question answered from the file is answered from the docs, not from a scrape of their HTML. Each page has a Copy page action for exactly that, and an index for tools that want the whole set.

That index follows the [llms.txt proposal](https://llmstxt.org): a short Markdown file at the site's root that names every page with one line about it. Next to it, `llms-full.txt` carries every page inline. Both cost nothing to produce when the docs are already Markdown.

## Instructions for agents, shipped with the code

Some guidance is not documentation at all but rules: never mutate the document directly, keep build-time code out of the browser, import modules explicitly. Those belong where an agent working in your repository will find them. Verbal ships an `AGENTS.md` in its npm package, following the [AGENTS.md format](https://agents.md) for instructions addressed to coding agents.

## Drift is the real enemy

Docs written by hand drift from the code they describe; docs read by a model amplify the drift into confident mistakes. So the reference pages here are generated: module pages from each module's own JSDoc and contract, the Editor API from its source, the tables of shortcuts from the modules that register them, and every size and benchmark figure from the build that produced it. Every code sample is type-checked against the published types when the site is tested.

The docs are read-only for a reason: they are the version of the truth that cannot be edited by accident. The landing is where you type.

Start at the [Introduction](#/docs/introduction), or open the [Imports](#/docs/imports) reference to see what the package exports today.
