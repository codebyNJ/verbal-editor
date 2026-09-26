/** Go tokens. */
export default [
  ['comment', /\/\/.*|\/\*[\s\S]*?\*\//],
  ['string', /`[^`]*`|"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])+'/],
  ['keyword', /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|false|for|func|go|goto|if|import|interface|iota|map|nil|package|range|return|select|struct|switch|true|type|var)\b/],
  ['type', /\b(?:any|bool|byte|error|float\d+|int\d*|rune|string|uint\d*)\b|\b[A-Z]\w*/],
  ['number', /\b\d[\d_]*(?:\.\d+)?\b/],
  ['function', /\b\w+(?=\()/],
];
