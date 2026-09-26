---
title: Suggestions, not replacements
description: An AI edit should arrive the way a colleague's would — as a proposal you can read, weigh and refuse.
date: 2026-09-26
icon: sparkle
---

When a model rewrites your paragraph, two things can happen. The text can change in place, and you are left comparing what you remember with what you now see. Or the change can arrive as a proposal: the old words still there, the new ones beside them, and nothing committed until you say so. The second is how people have always edited each other's work. It should be how software edits ours.

## Ownership lives in the undo stack

An editor earns trust by making every change reversible. If an AI edit is applied the moment it arrives, it takes a special path: it did not come from your keyboard, so it is tempting to treat it differently — to batch it, to skip history, to let it overwrite what you typed while it was thinking. Every special case is a place where your document can change without you.

In Verbal, a proposal is a transaction that has not been dispatched. The document does not change while you read it. Accepting dispatches that transaction through the same path as a keystroke, so it is one ordinary undo step. Rejecting throws it away, and the document is byte-for-byte what it was before you asked. There is no AI mode in the undo stack because there is no AI path into the document.

## Show the change, not the result

A rewritten paragraph is hard to review because the eye has nothing to hold on to. A word diff gives it something: what went, what came, and — just as important — everything that stayed. Verbal paints deletions over the real text with the CSS Custom Highlight API instead of inserting markup into it, so the text you are reviewing is still your text: selectable, copyable, and editable while the proposal waits.

That last part matters more than it seems. A suggestion is a conversation. If you fix a word while it is on screen, the proposal is diffed again against your new text rather than thrown out.

## Hunks are decisions

A model that tightens a paragraph usually makes several independent choices. Accepting all or none forces you to trade the good ones against the bad. Splitting the diff into hunks lets you take the sharper verb and keep your own ending — each decision small enough to make in a second.

## What this asks of the model

Very little. The model returns text for a block; the editor does the rest. That boundary keeps the model's key on your server, keeps the editor free of any provider's SDK, and means the review works the same whether the suggestion came from a model, a colleague or a script.

Try it on the [AI review example](#/examples/ai), and read how it is wired in [AI review](#/docs/ai-review).
