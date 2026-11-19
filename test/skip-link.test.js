import assert from 'node:assert/strict';
import { test } from 'node:test';
import { donePage, page, resultPage } from '../src/page.js';

const skip = '<a class="skip-link" href="#main">Skip to content</a>';
const pages = [
  page('https://diagram.flisk.si'),
  resultPage('https://diagram.flisk.si', 'owner/repo', 'https://github.com/owner/repo/edit/main/README.md'),
  donePage('https://diagram.flisk.si', { repo: 'owner/repo', url: 'https://example.com/diagram.svg', forked: false, error: '' }),
];

test('the skip link is the first focusable element in the body', () => {
  for (const html of pages) {
    assert.ok(html.includes(`<body>${skip}`));
    assert.ok(html.indexOf(skip) < html.indexOf('<header class="top stage">'));
  }
});

test('every page has a main target for the skip link', () => {
  for (const html of pages) {
    assert.ok(html.includes(skip));
    assert.ok(html.includes('<main id="main">'));
  }
});

test('the skip link is hidden until focused', () => {
  const html = pages[0];
  assert.ok(html.includes('.skip-link{position:absolute;left:-9999px'));
  assert.ok(html.includes('.skip-link:focus{left:12px;top:12px'));
});
