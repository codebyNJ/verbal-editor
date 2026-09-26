/** SQL tokens, case-insensitive. */
export default Object.assign(
  [
    ['comment', /--.*|\/\*[\s\S]*?\*\//],
    ['string', /'(?:''|[^'])*'/],
    ['keyword', /\b(?:add|all|alter|and|as|asc|between|by|case|create|default|delete|desc|distinct|drop|else|end|exists|foreign|from|group|having|in|index|inner|insert|into|is|join|key|left|like|limit|not|null|offset|on|or|order|outer|primary|references|right|select|set|table|then|union|update|values|when|where)\b/],
    ['type', /\b(?:bigint|boolean|char|date|decimal|int|integer|json|numeric|serial|text|timestamp|uuid|varchar)\b/],
    ['function', /\b\w+(?=\()/],
    ['number', /\b\d+(?:\.\d+)?\b/],
  ],
  { flags: 'i' },
);
