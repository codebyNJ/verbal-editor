/** CSS tokens: selectors, properties, values, at-rules. */
export default [
  ['comment', /\/\*[\s\S]*?\*\//],
  ['string', /"(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*'/],
  ['keyword', /@[\w-]+|!important/],
  ['attr', /--[\w-]+|[a-z-]+(?=\s*:[^{};]*[;}])/],
  ['number', /#[\da-fA-F]{3,8}\b|-?(?:\d*\.)?\d+(?:px|rem|em|vh|vw|vmin|vmax|ch|%|s|ms|deg|fr)?\b/],
  ['function', /[\w-]+(?=\()/],
  ['tag', /[.#]?[\w-]+(?=[^{};]*\{)|::?[\w-]+/],
];
