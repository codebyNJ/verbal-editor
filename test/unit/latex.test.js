import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commands, latex } from '../../src/blocks/math/latex.js';

const ml = (src, display) => latex(src, display).mathml;

test('scripts, fractions and roots compile to MathML elements', () => {
  assert.equal(ml('x^2'), '<math><msup><mi>x</mi><mn>2</mn></msup></math>');
  assert.equal(ml('a_i^2'), '<math><msubsup><mi>a</mi><mi>i</mi><mn>2</mn></msubsup></math>');
  assert.equal(ml('\\frac{a+1}{b}'), '<math><mfrac><mrow><mi>a</mi><mo>+</mo><mn>1</mn></mrow><mi>b</mi></mfrac></math>');
  assert.equal(ml('\\sqrt{x}'), '<math><msqrt><mi>x</mi></msqrt></math>');
  assert.equal(ml('\\sqrt[3]{x}'), '<math><mroot><mi>x</mi><mn>3</mn></mroot></math>');
  assert.equal(ml('3.14'), '<math><mn>3.14</mn></math>');
  assert.equal(ml('-f(x)'), '<math><mrow><mo>−</mo><mi>f</mi><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo></mrow></math>');
});

test('symbols, functions and fonts', () => {
  assert.equal(ml('\\alpha \\leq \\Gamma'), '<math><mrow><mi>α</mi><mo>≤</mo><mi mathvariant="normal">Γ</mi></mrow></math>');
  assert.equal(ml('\\sin x'), '<math><mrow><mi>sin</mi><mo>&#8289;</mo><mi>x</mi></mrow></math>');
  assert.equal(ml('\\mathbb{R}'), '<math><mstyle mathvariant="double-struck"><mi>R</mi></mstyle></math>');
  assert.equal(ml('\\vec{v}'), '<math><mover accent="true"><mi>v</mi><mo stretchy="true">→</mo></mover></math>');
  assert.equal(ml('\\text{if } x < 1'), '<math><mrow><mtext>if </mtext><mi>x</mi><mo>&#60;</mo><mn>1</mn></mrow></math>');
});

test('big operators take limits above and below in display mode only', () => {
  assert.match(ml('\\sum_{i=1}^{n} i', true), /^<math display="block"><mrow><munderover><mo largeop="true" movablelimits="true">∑<\/mo>/);
  assert.match(ml('\\sum_{i=1}^{n} i'), /<msubsup><mo largeop/);
  assert.match(ml('\\lim_{x \\to 0} f', true), /<munder><mi>lim<\/mi><mo>&#8289;<\/mo>/);
});

test('delimiters and environments', () => {
  assert.equal(
    ml('\\left( x \\right)'),
    '<math><mrow><mo fence="true" stretchy="true">(</mo><mi>x</mi><mo fence="true" stretchy="true">)</mo></mrow></math>',
  );
  const m = ml('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}');
  assert.equal((m.match(/<mtr>/g) ?? []).length, 2);
  assert.equal((m.match(/<mtd>/g) ?? []).length, 4);
  assert.match(m, /^<math><mrow><mo stretchy="true">\(<\/mo><mtable>/);
  assert.match(ml('f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}'), /<mtable columnalign="left">/);
});

test('unsupported commands raise a visible, explicit error', () => {
  const r = latex('x + \\foo{y}');
  assert.deepEqual(r.errors, ['Unsupported command \\foo']);
  assert.match(r.mathml, /<merror><mtext>\\foo<\/mtext><\/merror>/);
  assert.deepEqual(latex('{x').errors, ['Missing }']);
  assert.deepEqual(latex('\\begin{tabular}x\\end{tabular}').errors, ['Unsupported environment tabular']);
  assert.deepEqual(latex('\\left( x').errors, ['\\left without \\right']);
  assert.deepEqual(latex('a}').errors, ['Unexpected }']);
});

test('user text is escaped, never injected', () => {
  assert.equal(ml('\\text{<img onerror=x>}'), '<math><mtext>&#60;img onerror=x&#62;</mtext></math>');
});

test('about 150 commands are supported and documented', () => {
  assert.ok(commands.length >= 150, `${commands.length} commands`);
  for (const c of ['frac', 'sqrt', 'sum', 'int', 'alpha', 'Omega', 'leq', 'rightarrow', 'mathbb', 'begin', 'left', 'text', 'sin', 'hat']) assert.ok(commands.includes(c), c);
});
