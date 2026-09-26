/** Rust tokens; macros take the function colour. */
export default [
  ['comment', /\/\/.*|\/\*[\s\S]*?\*\//],
  ['string', /b?"(?:\\.|[^\\"])*"|r#*"[\s\S]*?"#*|'(?:\\.|[^\\'])'/],
  ['keyword', /\b(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while)\b/],
  ['type', /\b(?:[iu](?:8|16|32|64|128|size)|f32|f64|bool|char|str)\b|\b[A-Z]\w*/],
  ['function', /\b\w+!|\b\w+(?=\s*\()/],
  ['number', /\b\d[\d_]*(?:\.\d+)?(?:[iuf]\d+)?\b/],
];
