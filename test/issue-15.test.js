import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const request = (path, init) => worker.fetch(new Request('https://diagram.flisk.si' + path, init), {});

test('the first body link targets the focusable main landmark', async () => {
  const body = await (await request('/')).text();
  assert.match(body, /<body>\s*<a class="skip-link" href="#main-content">Skip to content<\/a>/);
  assert.ok(body.includes('<main id="main-content" tabindex="-1">'));
  assert.ok(body.includes('.skip-link:focus{transform:none}'));
});
