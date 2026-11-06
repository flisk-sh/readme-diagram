// Open a pull request that adds the diagram to a repo's README, using the signed-in user's own GitHub token.
// Plain REST calls: fork if the user cannot push, branch, one-file commit, PR. Nothing is stored.

const API = 'https://api.github.com';
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export class PrError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const snippetFor = (origin, repo) => `<p align="center"><img src="${origin}/${repo}.svg" alt="Diagram of ${repo}" width="100%"></p>`;

export function decodeB64Utf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeUtf8B64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Put the snippet under the first "# Title" (within 15 lines), else at the very top.
// Returns null when the README already has this repo's diagram, so running twice never duplicates it.
export function insertSnippet(md, snippet, repo) {
  if (md.includes(`/${repo}.svg`)) return null;
  const eol = md.includes('\r\n') ? '\r\n' : '\n';
  const lines = md.split(/\r?\n/);
  const h1 = lines.slice(0, 15).findIndex((l) => /^#\s+\S/.test(l));
  if (h1 === -1) return [snippet, '', ...lines].join(eol);
  const rest = lines.slice(h1 + 1);
  while (rest.length && rest[0].trim() === '') rest.shift();
  return [...lines.slice(0, h1 + 1), '', snippet, '', ...rest].join(eol);
}

export function prBody(origin, repo, login) {
  return `Adds an animated diagram of this project to the top of the README: its languages, stack, sections and commands, drawn from the README itself.

${origin}/${repo}.svg

- No AI is involved: the same README always gives the same picture.
- It follows light and dark mode and is re-drawn when the README changes (cached for a day).
- To remove it, delete the three added lines.

Opened by @${login} with [README Diagram](${origin}).`;
}

export async function createReadmePr({ token, repo, origin, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const [owner, name] = String(repo).split('/');
  if (!NAME.test(owner || '') || !NAME.test(name || '')) throw new PrError('bad-repo', 'That is not a GitHub repo.');

  const call = async (method, path, body) => {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'readme-diagram', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON error body
    }
    return { ok: res.ok, status: res.status, json };
  };

  const me = await call('GET', '/user');
  if (!me.ok) throw new PrError('auth', 'GitHub did not accept the sign-in. Try again.');
  const login = me.json.login;

  const info = await call('GET', `/repos/${owner}/${name}`);
  if (info.status === 404) throw new PrError('not-found', 'That repo does not exist or is private.');
  if (!info.ok) throw new PrError('github', `GitHub answered ${info.status}.`);
  if (info.json.private) throw new PrError('private', 'Only public repos are supported.');
  if (info.json.archived) throw new PrError('archived', 'That repo is archived, so it cannot take pull requests.');
  const base = info.json.default_branch;

  // Write straight to the repo when allowed, otherwise to the user's fork.
  let target = `${owner}/${name}`;
  let head;
  const branch = `readme-diagram-${Date.now().toString(36)}`;
  if (info.json.permissions?.push) {
    head = branch;
  } else {
    const fk = await call('POST', `/repos/${owner}/${name}/forks`, { default_branch_only: true });
    if (!fk.ok) throw new PrError('fork', 'Could not fork the repo. Is forking disabled?');
    target = fk.json.full_name;
    for (let i = 0; i < 8; i++) {
      const ready = await call('GET', `/repos/${target}`);
      if (ready.ok) break;
      if (i === 7) throw new PrError('fork', 'The fork is not ready yet. Try again in a minute.');
      await sleep(1500);
    }
    await call('POST', `/repos/${target}/merge-upstream`, { branch: base }); // bring a stale fork up to date; failure is fine
    head = `${login}:${branch}`;
  }

  const file = await call('GET', `/repos/${target}/readme?ref=${encodeURIComponent(base)}`);
  if (!file.ok) throw new PrError('no-readme', 'That repo has no README.');
  if (!/\.(md|markdown)$/i.test(file.json.path)) throw new PrError('format', `${file.json.path} is not Markdown, so the picture cannot be embedded.`);
  if (file.json.size > 900_000 || file.json.encoding !== 'base64') throw new PrError('too-large', 'That README is too large to edit here.');

  const updated = insertSnippet(decodeB64Utf8(file.json.content), snippetFor(origin, `${owner}/${name}`), `${owner}/${name}`);
  if (updated === null) throw new PrError('already', 'That README already has its diagram.');

  const ref = await call('GET', `/repos/${target}/git/ref/heads/${encodeURIComponent(base)}`);
  if (!ref.ok) throw new PrError('github', 'Could not read the default branch.');
  const mk = await call('POST', `/repos/${target}/git/refs`, { ref: `refs/heads/${branch}`, sha: ref.json.object.sha });
  if (!mk.ok) throw new PrError('github', 'Could not create a branch.');

  const put = await call('PUT', `/repos/${target}/contents/${file.json.path.split('/').map(encodeURIComponent).join('/')}`, {
    message: 'docs: add an animated diagram to the README',
    content: encodeUtf8B64(updated),
    sha: file.json.sha,
    branch,
  });
  if (!put.ok) throw new PrError('github', 'Could not commit the change.');

  const pr = await call('POST', `/repos/${owner}/${name}/pulls`, {
    title: 'docs: add an animated diagram to the README',
    head,
    base,
    body: prBody(origin, `${owner}/${name}`, login),
    maintainer_can_modify: true,
  });
  if (!pr.ok) throw new PrError('github', `Could not open the pull request (${pr.status}).`);
  return { url: pr.json.html_url, number: pr.json.number, forked: target !== `${owner}/${name}` };
}
