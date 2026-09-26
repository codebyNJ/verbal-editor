/**
 * Word-level Myers diff (F-51): text is split into words, whitespace runs and punctuation, and the
 * shortest edit script between the two token lists is found in O(ND).
 */

/** @typedef {{ op: '=' | '-' | '+', text: string, hunk?: number }} Part */

const tokens = (s) => s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];

/** Shortest edit script from `a` to `b`; changes separated only by whitespace form one hunk. */
export function diffWords(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  const off = x.length + y.length;
  const v = { [off + 1]: 0 };
  const trace = [];
  let found = false;
  for (let d = 0; d <= off && !found; d++) {
    trace.push({ ...v });
    for (let k = -d; k <= d; k += 2) {
      let i = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let j = i - k;
      while (i < x.length && j < y.length && x[i] === y[j]) i++, j++;
      v[off + k] = i;
      if (i >= x.length && j >= y.length) {
        found = true;
        break;
      }
    }
  }
  const out = [];
  let [i, j] = [x.length, y.length];
  for (let d = trace.length - 1; d >= 0; d--) {
    const t = trace[d];
    const k = i - j;
    const pk = k === -d || (k !== d && t[off + k - 1] < t[off + k + 1]) ? k + 1 : k - 1;
    const px = t[off + pk];
    while (i > px && j > px - pk) out.push(['=', x[--i]]), j--;
    if (d) out.push(i === px ? ['+', y[--j]] : ['-', x[--i]]);
  }
  const parts = [];
  let [del, ins, held, hunk] = ['', '', '', 0];
  const equal = (t) => (parts.at(-1)?.op === '=' ? (parts.at(-1).text += t) : parts.push({ op: '=', text: t }));
  const flush = () => {
    if (del) parts.push({ op: '-', text: del, hunk });
    if (ins) parts.push({ op: '+', text: ins, hunk });
    if (del || ins) hunk++;
    del = ins = '';
  };
  for (const [op, t] of out.reverse()) {
    if (op === '=' && (del || ins) && !t.trim()) held += t;
    else if (op === '=') flush(), equal(held + t), (held = '');
    else (del += held), (ins += held), (held = ''), op === '-' ? (del += t) : (ins += t);
  }
  flush();
  if (held) equal(held);
  return parts;
}

/** Hunks of a diff: where each starts in the old text, what it removes and what it inserts. */
export function hunks(parts) {
  const out = [];
  let at = 0;
  for (const p of parts) {
    if (p.op !== '=') out[p.hunk] ??= { at, del: '', ins: '' };
    if (p.op === '-') out[p.hunk].del += p.text;
    if (p.op === '+') out[p.hunk].ins += p.text;
    if (p.op !== '+') at += p.text.length;
  }
  return out;
}
