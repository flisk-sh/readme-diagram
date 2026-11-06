import { detect } from './detect.js';
import { parseReadme } from './parse.js';

// Facts -> the fixed three-card model the renderer draws. Same README in, same model out.
export function buildModel(md, repoFiles = [], name = '') {
  const parsed = parseReadme(md);
  const found = detect(parsed, repoFiles);
  const rows = [
    { label: 'languages', chips: found.languages },
    { label: 'frameworks', chips: found.frameworks },
    { label: 'services', chips: found.services },
    { label: 'sections', chips: parsed.sections.map((s) => s.title).filter((t) => t.length <= 24) },
  ].filter((r) => r.chips.length > 0).map((r) => ({ ...r, chips: r.chips.slice(0, 14) }));

  const commands = parsed.commands.filter((c) => c.length <= 30).slice(0, 4);
  const blocks = rows.reduce((n, r) => n + r.chips.length, 0);
  return {
    title: parsed.title || name || 'Project',
    tagline: parsed.tagline,
    left: { langs: found.languages.slice(0, 6), files: found.files },
    rows,
    blocks,
    commands,
    sections: parsed.sections.length,
  };
}
