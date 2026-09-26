/**
 * Language recognition (F-32): counts the distinct signature tokens each language shows. Needs three
 * lines and a clear winner — two or more signatures and two ahead of the runner-up — or answers null
 * (plain text), so an unsure guess is never a wrong one. TypeScript counts JavaScript's signatures too.
 */
const sigs = {
  js: /\b(const|let) |=>|console\.|===/g,
  ts: /: (string|number)|\binterface |<\w+>/g,
  python: /\bdef |\bself\b|\bNone\b|:$/gm,
  html: /<\/\w+>|<!DOCTYPE|="/gi,
  css: /^[.#]?[\w-]+.*\{$|^\s+[\w-]+: .+;$/gm,
  json: /^\s*"[\w-]+": /gm,
  bash: /^#!|\$\{?\w|^(npm|git|cd|echo) /gm,
  sql: /\b(select|from|where|join|group by)\b/gi,
  go: /^package |\bfunc |:=|fmt\./gm,
  rust: /\bfn |let mut|\w!\(|-> |::/g,
};

/** The best language id for `src`, or null when unsure. */
export default function detect(src) {
  if (src.trim().split('\n').length < 3) return null;
  const score = Object.fromEntries(Object.entries(sigs).map(([lang, re]) => [lang, new Set(src.match(re)?.map((m) => m.toLowerCase())).size]));
  if (score.ts) score.ts += score.js;
  const [[best, a], [, b]] = Object.entries(score).sort((x, y) => y[1] - x[1]);
  return a >= 2 && a - b >= 2 ? best : null;
}
