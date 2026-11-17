import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('README links to the MIT license', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const license = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
  assert.match(readme, /(?:^|\n)## License\n\n\[MIT\]\(LICENSE\)\s*$/);
  assert.match(license, /MIT License/);
});
