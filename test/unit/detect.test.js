import { test } from 'node:test';
import assert from 'node:assert/strict';
import detect from '../../src/blocks/code/detect.js';

const samples = {
  js: `import { readFile } from 'node:fs/promises';\nconst load = async (path) => {\n  const text = await readFile(path, 'utf8');\n  console.log(text.length === 0 ? 'empty' : 'ok');\n};`,
  ts: `interface User {\n  id: number;\n  name: string;\n}\nconst users: Array<User> = [];\nexport function find(id: number): User | undefined {\n  return users.find((u) => u.id === id);\n}`,
  python: `import os\n\ndef walk(path):\n    for name in os.listdir(path):\n        if name.startswith('.'):\n            continue\n        print(name)\n    return None`,
  html: `<!DOCTYPE html>\n<html>\n  <body>\n    <div class="card"><a href="/docs">Docs</a></div>\n  </body>\n</html>`,
  css: `.card {\n  padding: 12px;\n  border-radius: 8px;\n}\n@media (max-width: 600px) {\n  .card { padding: 8px; }\n}`,
  json: `{\n  "name": "@verbal/editor",\n  "private": false,\n  "version": 1\n}`,
  bash: `#!/bin/bash\nset -e\ncd "$HOME/project"\nnpm ci && npm test\necho "done: \${PWD}" | grep done`,
  sql: `SELECT u.id, u.name, COUNT(o.id)\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE u.active = 1\nGROUP BY u.id;`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    total := 0\n    fmt.Println(total)\n}`,
  rust: `use std::collections::HashMap;\n\nfn count(words: &[&str]) -> HashMap<&str, usize> {\n    let mut map = HashMap::new();\n    for w in words { *map.entry(w).or_insert(0) += 1; }\n    println!("{}", map.len());\n    map\n}`,
};

for (const [lang, src] of Object.entries(samples)) test(`recognizes ${lang}`, () => assert.equal(detect(src), lang));

test('falls back to plain text rather than guessing', () => {
  assert.equal(detect('Dear team,\nthe release went out today.\nThanks for all the help!'), null);
  assert.equal(detect('const x = 1;'), null, 'fewer than three lines');
  assert.equal(detect('a = 1\nb = 2\nc = a + b'), null, 'too little signal');
});
