import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import worker from '../src/index.js';
import { detect } from '../src/detect.js';
import { buildModel } from '../src/model.js';
import { parseReadme } from '../src/parse.js';
import { renderSvg } from '../src/render.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}.md`, import.meta.url), 'utf8');

test('parse: title, tagline, sections, shell commands', () => {
  const p = parseReadme(fx('fullstack'));
  assert.equal(p.title, 'Shop');
  assert.match(p.tagline, /online shop/);
  assert.deepEqual(p.sections.map((s) => s.title), ['Quick start', 'Stack']);
  assert.deepEqual(p.commands, ['docker compose up', 'npm install']);
});

test('parse: ignores headings inside code fences and handles CRLF', () => {
  const p = parseReadme('# A\r\n\r\n```bash\r\n# comment\r\nnpm test\r\n```\r\n## B\r\n');
  assert.deepEqual(p.sections.map((s) => s.title), ['B']);
  assert.deepEqual(p.commands, ['npm test']);
});

test('parse: empty and non-string input do not throw', () => {
  for (const v of ['', null, undefined]) assert.equal(parseReadme(v).sections.length, 0);
});

test('detect: finds languages, frameworks, services and files', () => {
  const d = detect(parseReadme(fx('fullstack')));
  assert.ok(d.languages.includes('TypeScript') && d.languages.includes('Python'));
  assert.ok(d.frameworks.includes('React') && d.frameworks.includes('FastAPI'));
  assert.ok(d.services.includes('Postgres') && d.services.includes('Redis') && d.services.includes('Docker'));
  assert.ok(d.files.includes('docker-compose.yml') && d.files.includes('Dockerfile'));
});

test('detect: repo file names add signals', () => {
  const d = detect(parseReadme('# x'), ['Cargo.toml', 'wrangler.toml']);
  assert.ok(d.languages.includes('Rust'));
  assert.ok(d.files.includes('wrangler.toml'));
});

test('model: deterministic', () => {
  assert.deepEqual(buildModel(fx('fullstack')), buildModel(fx('fullstack')));
});

test('render: valid-looking, animated, bounded size', () => {
  const svg = renderSvg(buildModel(fx('fullstack')));
  assert.match(svg, /^<svg [^>]*viewBox="0 0 1080 400"/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.match(svg, /@keyframes m0/);
  assert.equal((svg.match(/<rect class="card"/g) ?? []).length, 3, 'three plain cards plus the hero');
  assert.match(svg, /class="arm"/);
  assert.match(svg, /prefers-color-scheme: dark/);
  assert.ok(svg.length < 60_000, `svg is ${svg.length} bytes`);
  assert.equal((svg.match(/<svg /g) ?? []).length, 1);
});

test('render: minimal README still produces a complete diagram', () => {
  const svg = renderSvg(buildModel(fx('minimal')));
  assert.match(svg, /<\/svg>\s*$/);
  assert.match(svg, /RADAR/);
});

test('render: hostile README text is escaped', () => {
  const svg = renderSvg(buildModel(fx('hostile')));
  assert.ok(!/<script/i.test(svg), 'no script tag');
  assert.ok(!/onerror=/i.test(svg.replace(/&lt;[^&]*&gt;/g, '')) || !/<img/i.test(svg));
  assert.match(svg, /&amp;|&quot;/);
});

test('render: golden snapshot of fullstack', () => {
  const svg = renderSvg(buildModel(fx('fullstack')));
  const golden = new URL('./fixtures/fullstack.svg', import.meta.url);
  if (process.env.UPDATE_GOLDEN) return void import('node:fs').then((f) => f.writeFileSync(golden, svg));
  assert.equal(svg, readFileSync(golden, 'utf8'));
});

test('worker: POST /render returns an svg', async () => {
  const res = await worker.fetch(new Request('https://x/render', { method: 'POST', body: fx('fullstack') }), {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await res.text(), /^<svg /);
});

test('worker: bad repo names are rejected before any fetch', async () => {
  const res = await worker.fetch(new Request('https://x/..%2Fevil/repo.svg'), {});
  assert.ok([400, 404].includes(res.status));
});

test('worker: landing page and /ready', async () => {
  const home = await worker.fetch(new Request('https://x/'), { PUBLIC_ORIGIN: 'https://diagram.flisk.si' });
  assert.match(await home.text(), /diagram\.flisk\.si/);
  assert.equal((await worker.fetch(new Request('https://x/ready'), {})).status, 200);
  assert.equal((await worker.fetch(new Request('https://x/nope'), {})).status, 404);
});

test('render: long tagline is clipped to fit the hero card', () => {
  const svg = renderSvg(buildModel(`# T\n\n${'word '.repeat(40)}\n`));
  const head = svg.match(/class="head" x="266" y="53">([^<]*)</)[1];
  assert.ok(head.length <= 40, head);
});

test('github: falls back to raw.githubusercontent when the API is rate-limited', async () => {
  const { loadRepo } = await import('../src/github.js');
  const calls = [];
  const fetchImpl = async (u) => {
    calls.push(u);
    if (u.startsWith('https://api.github.com')) return new Response('limit', { status: 403 });
    return new Response('# Hi\n', { status: 200 });
  };
  const r = await loadRepo('a', 'b', { fetchImpl });
  assert.equal(r.readme, '# Hi\n');
  assert.ok(calls.some((u) => u.includes('raw.githubusercontent.com/a/b/HEAD/README.md')));
});

test('github: 404 stays not-found', async () => {
  const { loadRepo } = await import('../src/github.js');
  const r = await loadRepo('a', 'b', { fetchImpl: async () => new Response('', { status: 404 }) });
  assert.equal(r.error, 'not-found');
});

test('repo input: accepts owner/repo and every pasted GitHub URL shape', async () => {
  const { parseRepoInput: p } = await import('../src/repo-input.js');
  for (const v of ['flisk-sh/flisk', ' flisk-sh/flisk ', 'github.com/flisk-sh/flisk', 'https://github.com/flisk-sh/flisk/', 'https://www.github.com/flisk-sh/flisk.git', 'https://github.com/flisk-sh/flisk/tree/main/docs?x=1#y', 'git@github.com:flisk-sh/flisk.git']) {
    assert.equal(p(v), 'flisk-sh/flisk', v);
  }
  for (const v of ['', 'flisk', 'https://github.com/', '../x', 'a b/c', null, undefined, 'https://example.com/a/b/c<']) assert.equal(p(v), '', String(v));
});

test('site: landing, check redirect, result page, icon', async () => {
  const env = { PUBLIC_ORIGIN: 'https://diagram.flisk.si' };
  const get = (u) => worker.fetch(new Request(`https://x${u}`), env);
  const home = await (await get('/')).text();
  assert.match(home, /<form class="repo" action="\/check"/);
  const r = await worker.fetch(new Request('https://x/check?repo=' + encodeURIComponent('https://github.com/flisk-sh/flisk/')), env);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://diagram.flisk.si/flisk-sh/flisk');
  const bad = await get('/check?repo=nope');
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /Enter a GitHub repo/);
  const res = await get('/flisk-sh/flisk');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /src="https:\/\/diagram\.flisk\.si\/flisk-sh\/flisk\.svg"/);
  assert.ok(!html.includes('https://diagram.flisk.si/https://'));
  assert.equal((await get('/icon.svg')).headers.get('content-type'), 'image/svg+xml');
});

test('site: hostile repo path cannot inject into the result page', async () => {
  const res = await worker.fetch(new Request('https://x/a%22%3E%3Cscript%3E/b'), {});
  assert.ok(res.status === 400 || !(await res.text()).includes('<script>alert'));
});

test('quality: thin repos are flagged, rich ones pass', async () => {
  const { quality } = await import('../src/model.js');
  assert.equal(quality(buildModel(fx('minimal'))).ok, false);
  assert.ok(quality(buildModel(fx('minimal'))).reasons.length >= 2);
  const rich = `# Rich\n\nA rich project with plenty of detail for the tagline.\n\n## Setup\n\n- React Vue Svelte Angular Astro Vite\n- Express Hono Fastify NestJS FastAPI Django\n- Postgres MySQL Redis Kafka Docker Qdrant\n\nTypeScript Python Go Rust Ruby PHP.\n`;
  assert.equal(quality(buildModel(rich)).ok, true);
});

test('render: few rows are centred, stat strip and INSIDE card appear', () => {
  const svg = renderSvg(buildModel(fx('minimal')));
  assert.match(svg, /building blocks/);
  assert.match(svg, /RUN/);
});

test('model: long README titles are cut at the colon', async () => {
  const { shortTitle } = await import('../src/model.js');
  assert.equal(shortTitle('README Score: your README, scored out of 100'), 'README Score');
  assert.equal(shortTitle('Tool - does things'), 'Tool');
  assert.equal(shortTitle('flisk-sh'), 'flisk-sh');
  assert.equal(shortTitle(''), '');
});

test('render: radar labels stay inside the radar card', () => {
  const svg = renderSvg(buildModel(fx('fullstack')));
  for (const m of svg.matchAll(/class="tag"[^>]* x="([\d.]+)"/g)) assert.ok(+m[1] >= 940 && +m[1] <= 1046, m[1]);
});

test('edit link: uses the real branch and README file, falls back to HEAD', async () => {
  const { readmeEditUrl } = await import('../src/github.js');
  const { resultPage } = await import('../src/page.js');
  const ok = async () => Response.json({ html_url: 'https://github.com/o/r/blob/trunk/docs/readme.md' });
  assert.equal(await readmeEditUrl('o', 'r', { fetchImpl: ok }), 'https://github.com/o/r/edit/trunk/docs/readme.md');
  const limited = async (u) => (String(u).startsWith('https://api.github.com') ? new Response('', { status: 403 }) : new Response('x "defaultBranch":"trunk" y'));
  assert.equal(await readmeEditUrl('o', 'r', { fetchImpl: limited }), 'https://github.com/o/r/edit/trunk/README.md');
  assert.equal(await readmeEditUrl('o', 'r', { fetchImpl: async () => new Response('', { status: 403 }) }), null);
  assert.equal(await readmeEditUrl('o', 'r', { fetchImpl: async () => { throw new Error('x'); } }), null);
  assert.match(resultPage('https://d', 'o/r', 'https://github.com/o/r/edit/trunk/docs/readme.md'), /href="https:\/\/github\.com\/o\/r\/edit\/trunk\/docs\/readme\.md"/);
  assert.match(resultPage('https://d', 'o/r', null), /edit\/HEAD\/README\.md/);
});

test('github: raw fallback tries readme.md when README.md is missing', async () => {
  const { loadRepo } = await import('../src/github.js');
  const fetchImpl = async (u) => {
    if (u.startsWith('https://api.github.com')) return new Response('', { status: 403 });
    return u.endsWith('/readme.md') ? new Response('# low\n') : new Response('', { status: 404 });
  };
  assert.equal((await loadRepo('a', 'b', { fetchImpl })).readme, '# low\n');
});

test('commands: only real runnable commands, never invented filler', () => {
  const svg = renderSvg(buildModel('# T\n\nA project long enough to have a tagline here.\n\n## Docs\n\nNothing to run.\n', [], 'o/t'));
  for (const fake of ['cat README.md', 'git log', 'open README.md', 'git clone t']) assert.ok(!svg.includes(fake), fake);
  assert.match(svg, /gh repo clone o\/t/);
  const p = parseReadme('```bash\necho hi\n./deploy.sh\nnpm run dev\nOutput: ok\n```\n');
  assert.deepEqual(p.commands, ['npm run dev']);
});

test('detect: a long README must mention a thing twice; "claude" alone is not Anthropic', () => {
  const long = `# X\n\n${'filler text. '.repeat(400)}\nOnce: Rust. Ask claude for help.\n`;
  const d = detect(parseReadme(long));
  assert.ok(!d.languages.includes('Rust') && !d.services.includes('Anthropic'));
});

test('model: sponsor and generic headings do not become sections', () => {
  const m = buildModel('# X\n\nA tagline that is long enough to count.\n\n## Gold Sponsors\n## Community\n## Real Feature\n');
  assert.deepEqual(m.inside, ['Real Feature']);
});
