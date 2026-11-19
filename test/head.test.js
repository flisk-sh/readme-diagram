import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const ENV = { PUBLIC_ORIGIN: 'https://diagram.flisk.si' };
const routes = ['/', '/robots.txt', '/sitemap.xml', '/icon.svg', '/og.png', '/flisk-sh/flisk.svg', '/nope'];

test('HEAD answers the same status and headers as GET on every public route, with no body', async () => {
  for (const path of routes) {
    const get = await worker.fetch(new Request(`https://diagram.flisk.si${path}`), ENV);
    const head = await worker.fetch(new Request(`https://diagram.flisk.si${path}`, { method: 'HEAD' }), ENV);
    assert.equal(head.status, get.status, `${path}: status`);
    for (const name of ['content-type', 'cache-control', 'content-length', 'strict-transport-security', 'x-content-type-options']) {
      assert.equal(head.headers.get(name), get.headers.get(name), `${path}: ${name}`);
    }
    assert.equal(await head.text(), '', `${path}: body`);
  }
});

test('HEAD on the home page is 200, not the 404 the old router returned', async () => {
  const res = await worker.fetch(new Request('https://diagram.flisk.si/', { method: 'HEAD' }), ENV);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
});

test('HEAD does not change GET behaviour', async () => {
  const res = await worker.fetch(new Request('https://diagram.flisk.si/robots.txt'), ENV);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Sitemap: https:\/\/diagram\.flisk\.si\/sitemap\.xml/);
});
