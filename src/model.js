import { detect } from './detect.js';
import { parseReadme } from './parse.js';

// Facts -> the fixed three-card model the renderer draws. Same README in, same model out.
const GENERIC = /^(table of contents|contents|toc|license|licen[cs]e.*|contributing.*|contributors?|credits|acknowledg\w*|changelog|what it does|things to know|about|overview|introduction|readme|support|faq|security|code of conduct|badges?|community|communication|documentation.*|resources|additional resources|links|screenshots?.*|good first issues?:?|.*sponsors?|.*backers|keystone.*|opinions|authors?|maintainers?|team)$/i;

// "README Score: your README, scored" -> "README Score"
export function shortTitle(t) {
  const head = String(t || '').split(/\s[:\u2013\u2014|-]\s|:\s/)[0].trim();
  return head || String(t || '').trim();
}

// Commands the repo itself defines: package.json scripts, or the standard build for Cargo and Go.
export function manifestCommands(files = [], pkg = null) {
  const out = [];
  if (pkg && typeof pkg.scripts === 'object' && pkg.scripts) {
    const pm = files.includes('pnpm-lock.yaml') ? 'pnpm' : files.includes('yarn.lock') ? 'yarn' : files.includes('bun.lock') || files.includes('bun.lockb') ? 'bun' : 'npm';
    for (const k of ['dev', 'start', 'build', 'test', 'lint']) {
      if (typeof pkg.scripts[k] === 'string') out.push(pm === 'npm' && k !== 'start' && k !== 'test' ? `npm run ${k}` : `${pm} ${k}`);
    }
  }
  if (files.includes('Cargo.toml')) out.push('cargo build', 'cargo test');
  if (files.includes('go.mod')) out.push('go build ./...', 'go test ./...');
  return out;
}

export function buildModel(md, repoFiles = [], name = '', pkg = null) {
  const parsed = parseReadme(md);
  const found = detect(parsed, repoFiles);
  const rows = [
    { label: 'languages', chips: found.languages },
    { label: 'frameworks', chips: found.frameworks },
    { label: 'services', chips: found.services },
    { label: 'sections', chips: [...new Set(parsed.sections.map((s) => s.title).filter((t) => t.length <= 24 && !GENERIC.test(t)))] },
  ].filter((r) => r.chips.length > 0).map((r) => ({ ...r, chips: r.chips.slice(0, 14) }));

  const fromReadme = parsed.commands.filter((c) => c.length <= 30);
  const fromRepo = manifestCommands(repoFiles, pkg).filter((c) => !fromReadme.includes(c));
  const commands = [...fromReadme, ...fromRepo].slice(0, 6);
  const sources = Object.fromEntries([...fromReadme.map((c) => [c, 'README']), ...fromRepo.map((c) => [c, 'repo'])]);
  const blocks = rows.reduce((n, r) => n + r.chips.length, 0);
  return {
    slug: name,
    title: shortTitle(parsed.title) || name || 'Project',
    tagline: parsed.tagline,
    left: { langs: found.languages.slice(0, 6), files: found.files },
    rows,
    blocks,
    commands,
    sources,
    inside: [...new Set(parsed.sections.map((s) => s.title).filter((t) => !GENERIC.test(t)))].slice(0, 8),
    radar: [...new Set([...found.services, ...found.frameworks, ...found.languages])].slice(0, 8),
    sections: parsed.sections.length,
  };
}

// A thin diagram is not worth embedding. Scanners use this to skip repos before opening a PR.
export function quality(model) {
  const reasons = [];
  if (model.blocks < 10) reasons.push('fewer than 10 building blocks');
  if (model.rows.length < 3) reasons.push('fewer than 3 rows');
  if (!model.tagline) reasons.push('no tagline');
  return { ok: reasons.length === 0, blocks: model.blocks, rows: model.rows.length, reasons };
}
