/** JSON tokens; keys take the attribute colour. */
export default [
  ['attr', /"(?:\\.|[^\\"])*"(?=\s*:)/],
  ['string', /"(?:\\.|[^\\"])*"/],
  ['number', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
  ['keyword', /\b(?:true|false|null)\b/],
];
