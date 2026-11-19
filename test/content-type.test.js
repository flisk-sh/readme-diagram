import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const render = (headers, body) => worker.fetch(new Request('https://x/render', { method: 'POST', headers, body }), {});

test('worker: POST /render accepts application/json with a markdown field', async () => {
  const res = await render(
    { 'content-type': 'application/json' },
    JSON.stringify({ markdown: '# slugkit\n\nTurn titles into slugs.\n' }),
  );
  assert.equal(res.status, 200);
  const svg = await res.text();
  assert.match(svg, /<title id="t">slugkit<\/title>/);
  assert.doesNotMatch(svg, /<title id="t">Project<\/title>/);
});

test('worker: POST /render rejects malformed JSON and a missing markdown field', async () => {
  assert.equal((await render({ 'content-type': 'application/json' }, '{')).status, 400);
  assert.equal((await render({ 'content-type': 'application/json' }, JSON.stringify({ text: '# Nope' }))).status, 400);
});

test('worker: POST /render rejects unsupported content types', async () => {
  const res = await render({ 'content-type': 'application/x-www-form-urlencoded' }, 'markdown=%23+Nope');
  assert.equal(res.status, 415);
  assert.match(res.headers.get('content-type'), /text\/plain/);
});

test('worker: POST /render still accepts raw Markdown without a content type', async () => {
  const res = await render({}, '# slugkit\n\nTurn titles into slugs.\n');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /slugkit/);
});
