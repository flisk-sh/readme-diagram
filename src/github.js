const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function validRepo(owner, repo) {
  return NAME.test(owner) && NAME.test(repo) && owner !== '.' && owner !== '..' && repo !== '.' && repo !== '..';
}

// README + top-level file names via GitHub; fetchImpl is injectable for tests.
export async function loadRepo(owner, repo, { fetchImpl = fetch, token } = {}) {
  const headers = { 'user-agent': 'readme-diagram', accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const r = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: { ...headers, accept: 'application/vnd.github.raw+json' } });
  let readme;
  if (r.ok) {
    readme = await r.text();
  } else if (r.status === 404) {
    return { error: 'not-found', status: 404 };
  } else {
    // API rate-limited (shared Worker IPs): raw.githubusercontent.com has no such limit.
    const raw = await fetchImpl(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`, { headers: { 'user-agent': 'readme-diagram' } });
    if (!raw.ok) return { error: raw.status === 404 ? 'not-found' : 'github-error', status: raw.status };
    readme = await raw.text();
  }
  if (readme.length > 400_000) return { error: 'too-large' };
  let files = [];
  try {
    const t = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
    if (t.ok) files = (await t.json()).map((f) => f.name).filter((n) => typeof n === 'string');
  } catch {
    // the file list only enriches the diagram
  }
  return { readme, files };
}

// The README's real edit URL (right branch, right file name, e.g. readme.md or docs/README.rst), or null.
// The API is tried first; Worker IPs are often rate-limited, so the repo page's default branch is the fallback.
export async function readmeEditUrl(owner, repo, { fetchImpl = fetch, token } = {}) {
  try {
    const r = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { 'user-agent': 'readme-diagram', accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (r.ok) {
      const html = (await r.json()).html_url;
      const m = typeof html === 'string' && html.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
      if (m) return `https://github.com/${m[1]}/${m[2]}/edit/${m[3]}`;
    }
    const page = await fetchImpl(`https://github.com/${owner}/${repo}`, { headers: { 'user-agent': 'readme-diagram' } });
    if (!page.ok) return null;
    const branch = (await page.text()).match(/"defaultBranch":"([^"]{1,100})"/)?.[1];
    return branch ? `https://github.com/${owner}/${repo}/edit/${branch}/README.md` : null;
  } catch {
    return null;
  }
}
