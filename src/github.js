const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function validRepo(owner, repo) {
  return NAME.test(owner) && NAME.test(repo) && owner !== '.' && owner !== '..' && repo !== '.' && repo !== '..';
}

// README + top-level file names via GitHub; fetchImpl is injectable for tests.
export async function loadRepo(owner, repo, { fetchImpl = fetch, token } = {}) {
  const headers = { 'user-agent': 'readme-diagram', accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const r = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: { ...headers, accept: 'application/vnd.github.raw+json' } });
  if (!r.ok) return { error: r.status === 404 ? 'not-found' : 'github-error', status: r.status };
  const readme = await r.text();
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
