// README markdown -> plain facts. No network, no LLM: headings, badges, code fences, lists.

// A line only counts as a command when it starts with a program people actually run.
const RUNNABLE = /^(npm|npx|pnpm|yarn|bun|bunx|deno|node|pip3?|pipx|uv|uvx|poetry|python3?|cargo|rustup|go|docker|docker-compose|make|git|gh|brew|curl|wget|sudo|apt|apt-get|dotnet|mvn|gradle|bundle|gem|composer|flisk|tilt|kubectl|helm|terraform|\.\/[\w.-]+|bash|sh)\s/;

const SHELL = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'terminal']);

export function parseReadme(md) {
  const text = String(md ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const sections = [];
  const commands = [];
  const fenceLangs = new Set();
  let title = '';
  let tagline = '';
  let inFence = false;
  let fenceLang = '';
  let current = null;

  for (const raw of lines) {
    const fence = raw.match(/^\s*(```+|~~~+)\s*([\w+-]*)/);
    if (fence) {
      if (inFence) {
        inFence = false;
      } else {
        inFence = true;
        fenceLang = fence[2].toLowerCase();
        if (fenceLang && !SHELL.has(fenceLang)) fenceLangs.add(fenceLang);
      }
      continue;
    }
    if (inFence) {
      const line = raw.trim().replace(/^\$\s+/, '');
      if ((SHELL.has(fenceLang) || fenceLang === '') && RUNNABLE.test(line) && !commands.includes(line) && commands.length < 40) {
        commands.push(line);
      }
      continue;
    }
    const h = raw.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (h) {
      const name = cleanInline(h[2]);
      if (h[1].length === 1 && !title) {
        title = name;
        continue;
      }
      if (h[1].length >= 2 && name) {
        current = { title: name, items: [] };
        sections.push(current);
      }
      continue;
    }
    if (!tagline && title) {
      const plain = cleanInline(raw);
      if (plain.length > 20 && !/^[-*>|<!\[]/.test(raw.trim())) tagline = plain;
    }
    const li = raw.match(/^\s*[-*+]\s+(.+)$/);
    if (li && current) current.items.push(cleanInline(li[1]));
  }

  const badges = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]);
  return {
    title,
    tagline: tagline.length > 90 ? `${tagline.slice(0, 87).trimEnd()}...` : tagline,
    sections: sections.filter((s) => !/^(table of contents|contents|toc)$/i.test(s.title)),
    commands,
    fenceLangs: [...fenceLangs],
    badges,
    text,
  };
}

export function cleanInline(s) {
  return String(s)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
