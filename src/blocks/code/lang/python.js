/** Python tokens; decorators take the type colour. */
export default [
  ['comment', /#.*/],
  ['string', /(?:\b[rbfuRBFU]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*')/],
  ['keyword', /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|self|True|try|while|with|yield)\b/],
  ['number', /\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?j?\b/],
  ['function', /\b[A-Za-z_]\w*(?=\s*\()/],
  ['type', /@[\w.]+|\b[A-Z]\w*/],
];
