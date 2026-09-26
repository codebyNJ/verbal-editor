/** Shell tokens; the first word of a command takes the function colour. */
export default [
  ['comment', /(?<!\S)#.*/],
  ['string', /"(?:\\.|[^\\"])*"|'[^']*'/],
  ['type', /\$\{[^}]*\}|\$[\w?@#$!*-]/],
  ['keyword', /\b(?:case|do|done|elif|else|esac|exit|export|fi|for|function|if|in|local|return|set|source|then|until|while)\b/],
  ['function', /^\s*[\w./-]+(?=\s|$)|(?<=[|&;]\s*)[\w./-]+/],
  ['number', /\b\d+\b/],
];
