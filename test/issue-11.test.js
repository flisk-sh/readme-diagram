import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const request = (path, init) => worker.fetch(new Request('https://diagram.flisk.si' + path, init), {});

test('HEAD on public routes returns GET headers and no response body', async () => {
  for (const path of ['/', '/ready', '/robots.txt', '/sitemap.xml', '/og.png', '/icon.svg', '/favicon.ico', '/apple-touch-icon.png', '/invalid%20owner/project.svg']) {
    const get = await request(path);
    const head = await request(path, { method: 'HEAD' });
    assert.equal(head.status, get.status, path);
    assert.deepEqual([...head.headers], [...get.headers], path);
    assert.equal(await head.text(), '', path);
  }
});

test('HEAD does not begin the OAuth flow', async () => {
  assert.equal((await request('/auth/start', { method: 'HEAD' })).status, 404);
});

test('HEAD on other /auth/ paths routes like GET', async () => {
  const get = await request('/auth/example.svg');
  const head = await request('/auth/example.svg', { method: 'HEAD' });
  assert.equal(head.status, get.status);
  assert.equal(await head.text(), '');
});
