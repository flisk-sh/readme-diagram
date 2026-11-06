import { detect } from './detect.js';
import { parseReadme } from './parse.js';

// Facts -> the fixed three-card model the renderer draws. Same README in, same model out.
const GENERIC = /^(table of contents|contents|license|licence|contributing|contributors|credits|acknowledg\w*|changelog|what it does|things to know|about|overview|introduction|readme|support|faq|security|code of conduct|badges?)$/i;

export function buildModel(md, repoFiles = [], name = '') {
  const parsed = parseReadme(md);
  const found = detect(parsed, repoFiles);
  const rows = [
    { label: 'languages', chips: found.languages },
    { label: 'frameworks', chips: found.frameworks },
    { label: 'services', chips: found.services },
    { label: 'sections', chips: [...new Set(parsed.sections.map((s) => s.title).filter((t) => t.length <= 24 && !GENERIC.test(t)))] },
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
    inside: parsed.sections.map((s) => s.title).filter((t) => !GENERIC.test(t)).slice(0, 6),
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
