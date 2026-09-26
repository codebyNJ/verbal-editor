/** HTML tokens: tags, attribute names and values, comments, entities. */
export default [
  ['comment', /<!--[\s\S]*?-->/],
  ['keyword', /<![A-Za-z][^>]*>|&#?\w+;/],
  ['tag', /<\/?[A-Za-z][\w-]*|\/?>/],
  ['attr', /[\w:-]+(?==)/],
  ['string', /"[^"]*"|'[^']*'/],
];
