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
