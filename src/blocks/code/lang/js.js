/** JavaScript tokens. Regex literals are not recognized. */
export default [
  ['comment', /\/\/.*|\/\*[\s\S]*?\*\//],
  ['string', /`(?:\\[\s\S]|[^\\`])*`|"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*'/],
  ['keyword', /\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b/],
  ['number', /\b(?:0[xob][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b/],
  ['function', /[A-Za-z_$][\w$]*(?=\s*\()/],
  ['type', /\b[A-Z][\w$]*/],
];
