import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const request = (path, init) => worker.fetch(new Request('https://diagram.flisk.si' + path, init), {});

test('llms.txt describes the site and can be cached', async () => {
  const response = await request('/llms.txt');
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/plain/);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
  assert.ok(body.startsWith('# README Diagram'));
});
