/** TypeScript tokens: JavaScript plus type syntax. */
import js from './js.js';

export default [
  ...js.slice(0, 2),
  ['keyword', /\b(?:abstract|as|declare|enum|implements|interface|is|keyof|namespace|private|protected|public|readonly|satisfies|type)\b/],
  ['type', /\b(?:any|bigint|boolean|never|number|object|string|symbol|unknown|void)\b/],
  ...js.slice(2),
];
