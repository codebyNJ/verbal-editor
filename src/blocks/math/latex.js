/**
 * LaTeX subset → MathML (F-34). The browser renders MathML Core natively, so this is a compiler, not a
 * renderer, and ships no fonts. Anything outside the subset becomes a visible <merror> and is reported
 * in `errors` — never silently mis-rendered.
 */

const map = (s) => Object.fromEntries(s.split(' ').map((p) => [p.slice(0, -1), p.at(-1)]));
const greek = map(
  'alphaα betaβ gammaγ deltaδ epsilonϵ varepsilonε zetaζ etaη thetaθ varthetaϑ iotaι kappaκ lambdaλ muμ nuν xiξ piπ varpiϖ rhoρ varrhoϱ sigmaσ varsigmaς tauτ upsilonυ phiϕ varphiφ chiχ psiψ omegaω ellℓ hbarℏ imathı jmathȷ alephℵ wp℘ Reℜ Imℑ infty∞ emptyset∅ varnothing∅ nabla∇ partial∂',
);
const upper = map('GammaΓ DeltaΔ ThetaΘ LambdaΛ XiΞ PiΠ SigmaΣ UpsilonΥ PhiΦ PsiΨ OmegaΩ');
const ops = map(
  'times× div÷ pm± mp∓ cdot⋅ ast∗ star⋆ circ∘ bullet• oplus⊕ ominus⊖ otimes⊗ odot⊙ setminus∖ wedge∧ land∧ vee∨ lor∨ neg¬ lnot¬ cap∩ cup∪ leq≤ le≤ geq≥ ge≥ neq≠ ne≠ ll≪ gg≫ approx≈ equiv≡ sim∼ simeq≃ cong≅ propto∝ in∈ notin∉ ni∋ subset⊂ supset⊃ subseteq⊆ supseteq⊇ mid∣ parallel∥ perp⊥ forall∀ exists∃ nexists∄ to→ rightarrow→ leftarrow← gets← Rightarrow⇒ implies⇒ Leftarrow⇐ leftrightarrow\u2194 Leftrightarrow⇔ iff⇔ mapsto↦ uparrow↑ downarrow↓ longrightarrow⟶ ldots… cdots⋯ vdots⋮ ddots⋱ dots… prime′ angle∠ triangle△ degree° vert| Vert‖ langle⟨ rangle⟩ lceil⌈ rceil⌉ lfloor⌊ rfloor⌋ lvert| rvert| colon: therefore∴ because∵',
);
const big = map('sum∑ prod∏ coprod∐ int∫ iint∬ iiint∭ oint∮ bigcup⋃ bigcap⋂ bigoplus⨁ bigotimes⨂ bigvee⋁ bigwedge⋀');
const fns = 'sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln lg exp min max sup inf lim liminf limsup det dim gcd deg arg ker hom Pr'.split(' ');
const accents = map('hat^ widehat^ bar¯ overline‾ vec→ dot˙ ddot¨ tilde~ widetilde~ checkˇ breve˘');
const fonts = { mathbb: 'double-struck', mathcal: 'script', mathbf: 'bold', mathit: 'italic', mathrm: 'normal', mathsf: 'sans-serif', mathtt: 'monospace', mathfrak: 'fraktur', boldsymbol: 'bold-italic' };
const spaces = { ',': '0.1667em', ':': '0.2222em', ';': '0.2778em', '!': '-0.1667em', ' ': '0.25em', quad: '1em', qquad: '2em' };
const envs = { matrix: ['', ''], pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', ''], aligned: ['', ''], smallmatrix: ['', ''] };
const structures = 'frac dfrac tfrac binom sqrt text operatorname left right middle begin end overset underset stackrel not pmod bmod'.split(' ');

/** Every supported command name, for documentation. */
export const commands = [greek, upper, ops, big, accents, fonts, spaces].flatMap(Object.keys).concat(fns, structures, '{ } | # % & _ $'.split(' ')).filter((c) => !/^[,:;! ]$/.test(c)).sort();

const esc = (t) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const row = (items) => (items.length === 1 ? items[0] : `<mrow>${items.join('')}</mrow>`);
const mo = (c, attrs = '') => `<mo${attrs}>${esc(c)}</mo>`;

/**
 * Compiles LaTeX to MathML.
 * @param {string} src LaTeX source
 * @param {boolean} [display] block (display) rather than inline math
 * @returns {{ mathml: string, errors: string[] }}
 */
export function latex(src, display) {
  const errors = [];
  let i = 0;
  const fail = (msg, shown) => (errors.push(msg), `<merror><mtext>${esc(shown)}</mtext></merror>`);
  const space = () => {
    while (/\s/.test(src[i] ?? '')) i++;
  };
  const name = () => {
    const m = /^\\([a-zA-Z]+|.)/.exec(src.slice(i));
    return m ? ((i += m[0].length), m[1]) : null;
  };
  /** Text inside braces, taken verbatim. */
  const raw = () => {
    space();
    if (src[i] !== '{') return src[i++] ?? '';
    const start = ++i;
    for (let depth = 1; i < src.length && depth; i++) depth += src[i] === '{' ? 1 : src[i] === '}' ? -1 : 0;
    return src.slice(start, i - 1);
  };
  /** One delimiter after \left, \right or \middle. */
  const delim = () => {
    space();
    if (src[i] === '\\') {
      const n = name();
      return n === '{' || n === '}' ? n : ops[n] ?? (n === '|' ? '‖' : '');
    }
    return src[i++] === '.' ? '' : src[i - 1];
  };

  function atom() {
    space();
    const c = src[i];
    if (c === '{') {
      i++;
      const g = seq((k) => src[k] === '}');
      if (src[i] === '}') i++;
      else errors.push('Missing }');
      return g;
    }
    if (c === '\\') return command(name());
    if (/[0-9.]/.test(c)) {
      const n = /^[0-9]*\.?[0-9]+|^[0-9]+/.exec(src.slice(i))[0];
      i += n.length;
      return `<mn>${n}</mn>`;
    }
    i++;
    if (/[a-zA-Z]/.test(c)) return `<mi>${c}</mi>`;
    if (c === "'") return mo('′');
    if (c === '}') return fail('Unexpected }', '}');
    if (c === '&' || c === '#' || c === '%') return fail(`Unexpected ${c}`, c);
    return c === '-' ? mo('−') : mo(c, /[()[\]|]/.test(c) ? ' stretchy="false"' : '');
  }

  function command(n) {
    if (n == null) return fail('Trailing \\', '\\');
    if (greek[n]) return `<mi>${greek[n]}</mi>`;
    if (upper[n]) return `<mi mathvariant="normal">${upper[n]}</mi>`;
    if (ops[n]) return mo(ops[n]);
    if (big[n]) return mo(big[n], ' largeop="true" movablelimits="true"');
    if (fns.includes(n)) return `<mi>${n}</mi><mo>&#8289;</mo>`;
    if (spaces[n]) return `<mspace width="${spaces[n]}"/>`;
    if ('{}|#%&_$'.includes(n)) return mo(n === '|' ? '‖' : n);
    if (accents[n]) return `<mover accent="true">${atom()}${mo(accents[n], ' stretchy="true"')}</mover>`;
    if (n === 'underline') return `<munder>${atom()}${mo('_', ' stretchy="true"')}</munder>`;
    if (fonts[n]) return `<mstyle mathvariant="${fonts[n]}">${atom()}</mstyle>`;
    if (/^[dt]?frac$/.test(n)) {
      const f = `<mfrac>${atom()}${atom()}</mfrac>`;
      return n === 'frac' ? f : `<mstyle displaystyle="${n === 'dfrac'}">${f}</mstyle>`;
    }
    if (n === 'binom') return `<mrow>${mo('(')}<mfrac linethickness="0">${atom()}${atom()}</mfrac>${mo(')')}</mrow>`;
    if (n === 'sqrt') {
      space();
      if (src[i] !== '[') return `<msqrt>${atom()}</msqrt>`;
      i++;
      const index = seq((k) => src[k] === ']');
      i++;
      return `<mroot>${atom()}${index}</mroot>`;
    }
    if (n === 'text') return `<mtext>${esc(raw())}</mtext>`;
    if (n === 'operatorname') return `<mi mathvariant="normal">${esc(raw())}</mi><mo>&#8289;</mo>`;
    if (n === 'overset' || n === 'stackrel') return ((top) => `<mover>${atom()}${top}</mover>`)(atom());
    if (n === 'underset') return ((bottom) => `<munder>${atom()}${bottom}</munder>`)(atom());
    if (n === 'not') return `<mrow>${atom()}${mo('̸')}</mrow>`;
    if (n === 'pmod') return `<mrow>${mo('(')}<mi>mod</mi>${atom()}${mo(')')}</mrow>`;
    if (n === 'bmod') return mo('mod');
    if (n === 'left') {
      const open = delim();
      const inner = seq((k) => src.startsWith('\\right', k));
      if (!src.startsWith('\\right', i)) return fail('\\left without \\right', '\\left');
      i += 6;
      return `<mrow>${mo(open, ' fence="true" stretchy="true"')}${inner}${mo(delim(), ' fence="true" stretchy="true"')}</mrow>`;
    }
    if (n === 'middle') return mo(delim(), ' stretchy="true"');
    if (n === 'begin') {
      const env = raw();
      if (!envs[env]) {
        const end = src.indexOf(`\\end{${env}}`, i);
        i = end < 0 ? src.length : end + env.length + 6;
        return fail(`Unsupported environment ${env}`, `\\begin{${env}}`);
      }
      const rows = [[]];
      const stop = (k) => src[k] === '&' || src.startsWith('\\\\', k) || src.startsWith('\\end', k);
      while (i < src.length && !src.startsWith('\\end', i)) {
        rows.at(-1).push(seq(stop));
        if (src[i] === '&') i++;
        else if (src.startsWith('\\\\', i)) (i += 2), rows.push([]);
      }
      if (src.startsWith('\\end', i)) (i += 4), raw();
      else errors.push(`Missing \\end{${env}}`);
      const [l, r] = envs[env];
      const table = `<mtable${env === 'cases' || env === 'aligned' ? ' columnalign="left"' : ''}>${rows.filter((x) => x.length).map((x) => `<mtr>${x.map((c) => `<mtd>${c}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
      return l || r ? `<mrow>${l ? mo(l, ' stretchy="true"') : ''}${table}${r ? mo(r, ' stretchy="true"') : ''}</mrow>` : table;
    }
    if (n === 'right' || n === 'end') return fail(`Unexpected \\${n}`, `\\${n}`);
    return fail(`Unsupported command \\${n}`, `\\${n}`);
  }

  /** A run of atoms with their sub- and superscripts, until `stop` or the end. */
  function seq(stop) {
    const out = [];
    for (space(); i < src.length && !stop(i); space()) {
      const at = i;
      let base = atom();
      const limits = /movablelimits|<mi>lim/.test(base) && display;
      let sub;
      let sup;
      for (space(); src[i] === '_' || src[i] === '^'; space()) {
        const kind = src[i++];
        if (kind === '_') sub = atom();
        else sup = atom();
      }
      if (sub && sup) base = limits ? `<munderover>${base}${sub}${sup}</munderover>` : `<msubsup>${base}${sub}${sup}</msubsup>`;
      else if (sub) base = limits ? `<munder>${base}${sub}</munder>` : `<msub>${base}${sub}</msub>`;
      else if (sup) base = limits ? `<mover>${base}${sup}</mover>` : `<msup>${base}${sup}</msup>`;
      out.push(base);
      if (i === at) i++;
    }
    return row(out.length ? out : ['<mrow/>']);
  }

  const body = seq(() => false);
  return { mathml: `<math${display ? ' display="block"' : ''}>${body}</math>`, errors };
}
