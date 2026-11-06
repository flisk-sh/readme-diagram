// Model -> animated SVG (1080x400): four cards, light and dark, same visual language as flisk's docs/assets/ecosystem.svg.

const W = 1080;
const H = 400;
const WINDOW = 306;

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;
const pillW = (s) => r1(String(s).length * 6.95 + 16);
const chipW = (s) => r1(String(s).length * 7.2 + 16);
const clip = (s, n) => (s.length > n ? `${s.slice(0, Math.max(n - 1, 1))}…` : s);

// One highlight that walks through n items, `step` seconds each: keyframes in % of the whole cycle.
function walk(name, n, step) {
  const d = Math.max(n, 1) * step;
  const p = (sec) => r1((sec / d) * 100);
  return {
    d,
    css: `.${name} { animation: ${name} ${r1(d)}s linear infinite; }\n    @keyframes ${name} { 0% { opacity: 0; } ${p(0.22)}% { opacity: 1; } ${p(step * 0.9)}% { opacity: 1; } ${p(Math.min(step * 0.9 + 0.3, d))}%, 100% { opacity: 0; } }`,
  };
}

function pills(items, x0, y0, maxW) {
  let x = x0;
  let y = y0;
  const out = [];
  items.forEach((t, i) => {
    const w = pillW(t);
    if (x + w > x0 + maxW) {
      x = x0;
      y += 28;
    }
    out.push(
      `<g class="lang"><rect x="${x}" y="${y}" width="${w}" height="22" rx="11"/><text x="${r1(x + 8)}" y="${y + 15}">${esc(t)}</text></g>`,
      `<rect class="lit bring" style="animation-delay:${r1(i * 0.9)}s" x="${x}" y="${y}" width="${w}" height="22" rx="11"/>`,
    );
    x += w + 6;
  });
  return { svg: out.join('\n  '), bottom: y + 22 };
}

function odometer(n, y, delay, cls) {
  const top = Math.min(n, 60);
  const texts = [];
  for (let k = 0; k <= top; k++) texts.push(`<text class="count" x="270" y="${16 - 22 * k}" text-anchor="end">${top - k}</text>`);
  return {
    css: `.${cls} { animation: ${cls} 12s cubic-bezier(.2,.7,.2,1) infinite; animation-delay: ${r1(delay)}s; }\n    @keyframes ${cls} { 0% { transform: translateY(${top * 22}px); } 14%, 100% { transform: translateY(0); } }`,
    svg: `<g clip-path="url(#odo)" transform="translate(0 ${y})"><g class="${cls}">${texts.join('')}</g></g>`,
  };
}

function marquee(row, i, y) {
  const widths = row.chips.map(chipW);
  const period = widths.reduce((a, w) => a + w + 7, 0);
  const copies = Math.ceil(WINDOW / period) + 1;
  const chips = [];
  let x = 406;
  for (let c = 0; c < copies; c++) {
    row.chips.forEach((t, k) => {
      chips.push(`<g class="chip"><rect x="${r1(x)}" y="${y}" width="${widths[k]}" height="22" rx="11"/><text x="${r1(x + 8)}" y="${y + 15}">${esc(t)}</text></g>`);
      x += widths[k] + 7;
    });
  }
  const dur = r1(Math.max(8, period / 45));
  const dir = i % 2 ? [`-${r1(period)}px`, '0px'] : ['0px', `-${r1(period)}px`];
  const odo = odometer(row.chips.length, y, i * 0.12, `o${i}`);
  return {
    css: `${odo.css}\n    .m${i} { animation: m${i} ${dur}s linear infinite; }\n    @keyframes m${i} { from { transform: translateX(${dir[0]}); } to { transform: translateX(${dir[1]}); } }`,
    svg: `${odo.svg}
  <text class="what" x="276" y="${y + 15}">${esc(row.label)}</text>
  <g mask="url(#fade)"><g class="m${i}">
    ${chips.join('\n    ')}
  </g></g>`,
  };
}

function radar(tags, cx, cy, R) {
  const n = tags.length;
  const out = [];
  tags.forEach((raw, i) => {
    const deg = (i * 360) / Math.max(n, 1) + 18;
    const a = deg * (Math.PI / 180);
    const rad = R * [0.8, 0.5, 0.92, 0.65][i % 4];
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    const label = clip(raw, 7);
    const lx = Math.min(Math.max(x, 942), 1044); // label is centred under the blip and must stay inside the card
    const delay = r1((deg / 360) * 3.6);
    out.push(
      `<circle class="blip" style="animation-delay:${delay}s" cx="${r1(x)}" cy="${r1(y)}" r="2.8"/>`,
      `<text class="tag" style="animation-delay:${delay}s" x="${r1(lx)}" y="${r1(y + 13)}" text-anchor="middle">${esc(label)}</text>`,
    );
  });
  return out.join('\n  ');
}

// Commands are shown whole or not at all: a half command is wrong. Each one appears once.
function pickCommands(model) {
  const used = new Set();
  const take = (max, n = 1) => {
    const got = model.commands.filter((c) => c.length <= max && !used.has(c)).slice(0, n);
    got.forEach((c) => used.add(c));
    return got;
  };
  const clone = model.slug && model.slug.includes('/') ? `gh repo clone ${model.slug}` : '';
  const first = take(24)[0] || (clone.length <= 24 ? clone : '');
  return { first, hero: take(36)[0] || '', slots: take(15, 2), radar: take(14)[0] || '' };
}

export function renderSvg(model) {
  const title = esc(clip(model.title, 40));
  const pick = pickCommands(model);
  const css = [];

  // 01 READS
  const left = pills(model.left.langs, 22, 82, 176);
  css.push(walk('bring', model.left.langs.length, 0.9).css);
  const fy = left.bottom + 34;
  const fileWalk = walk('from', model.left.files.length, 2);
  css.push(fileWalk.css);
  const files = model.left.files.slice(0, 4).map((f, i) => {
    const y = fy + i * 32;
    const dl = `animation-delay:${r1(i * 2)}s`;
    return `<rect class="slot" x="22" y="${y}" width="176" height="25" rx="6"/>
  <rect class="lit from" style="${dl}" x="22" y="${y}" width="176" height="25" rx="6"/>
  <text class="file" x="32" y="${y + 17}">${esc(clip(f, 18))}</text>
  <text class="tick from" style="${dl}" x="182" y="${y + 17}">✓</text>`;
  });
  const cmd0 = pick.first;

  // 02 hero
  const shown = model.rows.slice(0, 5);
  const pitch = Math.min(50, 232 / Math.max(shown.length, 1));
  const top = 104 + (232 - shown.length * pitch) / 2 + (pitch - 22) / 2;
  const rows = shown.map((r, i) => marquee(r, i, Math.round(top + i * pitch)));
  rows.forEach((r) => css.push(r.css));
  const heads = model.inside.length ? model.inside.map((t) => clip(t, 26)) : [clip(model.title, 26)];
  const stackWalk = walk('stack', heads.length, 2);
  css.push(`.stack { opacity: 0; animation: stack ${r1(stackWalk.d)}s linear infinite; }\n    @keyframes stack { 0% { opacity: 0; transform: translateY(6px); } ${r1((0.3 / stackWalk.d) * 100)}% { opacity: 1; transform: translateY(0); } ${r1((1.7 / stackWalk.d) * 100)}% { opacity: 1; transform: translateY(0); } ${r1((2 / stackWalk.d) * 100)}%, 100% { opacity: 0; transform: translateY(-6px); } }`);
  const bigs = heads.map((t, i) => `<text class="big stack" style="animation-delay:${r1(i * 2)}s" x="242" y="84">${esc(t)}</text>`);
  const tagline = model.tagline ? clip(model.tagline, 40) : `${model.sections} sections`;

  // 03 RUN
  const cmds = pick.slots;
  const cmdWalk = walk('out', cmds.length + model.inside.slice(0, 5).length, 1.5);
  css.push(cmdWalk.css);
  const cmdEls = cmds.map((c, i) => {
    const y = 82 + i * 43;
    const dl = `animation-delay:${r1(i * 1.5)}s`;
    return `<rect class="slot" x="750" y="${y}" width="136" height="36" rx="6"/>
  <rect class="lit out" style="${dl}" x="750" y="${y}" width="136" height="36" rx="6"/>
  <text class="file" x="758" y="${y + 16}">${esc(c)}</text>
  <text class="host" x="758" y="${y + 29}">→ ${model.sources?.[c] === 'repo' ? 'from the repo' : 'from README'}</text>`;
  });
  const secs = model.inside.slice(0, 5);
  const secTop = cmds.length ? 190 : 82;
  const secEls = secs.map((t, i) => {
    const y = secTop + i * 27;
    const dl = `animation-delay:${r1((cmds.length + i) * 1.5)}s`;
    return `<rect class="slot" x="750" y="${y}" width="136" height="22" rx="6"/>
  <rect class="lit out" style="${dl}" x="750" y="${y}" width="136" height="22" rx="6"/>
  <text class="file" style="font-size:11.5px" x="758" y="${y + 15}">${esc(clip(t, 15))}</text>`;
  });

  // 04 RADAR
  const tags = model.radar;
  const desc = `${model.title}: ${model.blocks} building blocks across ${model.rows.map((r) => r.label).join(', ')}.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
  <title id="t">${title}</title>
  <desc id="d">${esc(desc)}</desc>
  <defs>
    <linearGradient id="bolt" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0" stop-color="#5ee0a0"/><stop offset="1" stop-color="#1f9d6b"/></linearGradient>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ee0a0"/><stop offset=".5" stop-color="#1f9d6b" stop-opacity=".35"/><stop offset="1" stop-color="#5ee0a0"/><animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="6s" repeatCount="indefinite"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#5ee0a0" stop-opacity=".16"/><stop offset="1" stop-color="#5ee0a0" stop-opacity="0"/></radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5ee0a0" stop-opacity="0"/><stop offset="1" stop-color="#5ee0a0" stop-opacity=".55"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="fade" maskUnits="userSpaceOnUse" x="406" y="0" width="${WINDOW}" height="${H}"><rect x="406" y="0" width="${WINDOW}" height="${H}" fill="url(#edge)"/></mask>
    <clipPath id="odo"><rect x="234" y="0" width="40" height="22"/></clipPath>
  </defs>
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; fill: #24292f; }
    .card { fill: #f6f8fa; stroke: #d0d7de; stroke-width: 1; }
    .hero { fill: #ffffff; stroke: url(#hero); stroke-width: 1.6; }
    .kick { font-size: 10.5px; font-weight: 700; letter-spacing: 1.6px; fill: #1f9d6b; }
    .num { font-size: 10.5px; font-weight: 700; fill: #8c959f; }
    .head { font-size: 15px; font-weight: 700; }
    .big { font-size: 21px; font-weight: 800; fill: #1f9d6b; }
    .sub { font-size: 10.5px; fill: #6e7781; }
    .cmd { font-size: 11px; fill: #57606a; }
    .cmd tspan { fill: #1f9d6b; }
    .file { font-size: 12px; font-weight: 600; }
    .host, .note { font-size: 10px; fill: #6e7781; }
    .chip rect { fill: #f6f8fa; stroke: #d0d7de; }
    .chip text { font-size: 12px; font-weight: 600; }
    .lang rect { fill: #ffffff; stroke: #d0d7de; }
    .lang text { font-size: 11.5px; font-weight: 700; }
    .count { font-size: 18px; font-weight: 800; fill: #1f9d6b; }
    .what { font-size: 10.5px; font-weight: 600; fill: #57606a; }
    .slot { fill: #ffffff; stroke: #d0d7de; }
    .lit { fill: #5ee0a0; fill-opacity: .14; stroke: #1f9d6b; stroke-width: 1.2; opacity: 0; }
    .tick { fill: #1f9d6b; font-size: 11px; font-weight: 700; opacity: 0; }
    .flow { fill: #1f9d6b; opacity: 0; animation: flow 1.2s linear infinite; }
    .f2 { animation-delay: .4s; } .f3 { animation-delay: .8s; }
    @keyframes flow { 0% { opacity: 0; transform: translateX(0); } 25% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; transform: translateX(14px); } }
    .ring { fill: none; stroke: #1f9d6b; stroke-opacity: .28; stroke-width: 1; }
    .axis { stroke: #1f9d6b; stroke-opacity: .18; stroke-width: 1; }
    .arm { transform-box: view-box; animation: spin 3.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .blip { fill: #5ee0a0; stroke: #1f9d6b; stroke-width: .8; opacity: .18; animation: blip 3.6s ease-out infinite; }
    .tag { font-size: 10px; font-weight: 700; fill: #1f9d6b; opacity: .35; animation: tag 3.6s ease-out infinite; }
    @keyframes blip { 0% { opacity: 1; } 70%, 100% { opacity: .18; } }
    @keyframes tag { 0% { opacity: 1; } 70%, 100% { opacity: .35; } }
    .ok { fill: #1f9d6b; animation: pulse 1.8s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
    .core { animation: pulse 1.5s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
    @keyframes pulse { from { transform: scale(.9); } to { transform: scale(1.1); } }
    .cursor { animation: blink 1s steps(1, end) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    ${css.join('\n    ')}
    @media (prefers-color-scheme: dark) {
      text { fill: #e6edf3; }
      .card { fill: #161b22; stroke: #30363d; }
      .hero { fill: #0d1117; }
      .kick, .big, .tag, .cmd tspan, .tick, .count { fill: #5ee0a0; }
      .sub, .note, .cmd, .host, .what { fill: #8b949e; }
      .num { fill: #6e7681; }
      .chip rect { fill: #161b22; stroke: #30363d; }
      .lang rect, .slot { fill: #0d1117; stroke: #30363d; }
      .lit { stroke: #5ee0a0; }
      .flow, .ok { fill: #5ee0a0; }
    }
  </style>

  <rect class="card" x="10" y="10" width="200" height="380" rx="12"/>
  <text class="num" x="24" y="32">01</text><text class="kick" x="46" y="32">READS</text>
  <text class="head" x="24" y="53">your repo</text>
  <text class="sub" x="24" y="74">in ${model.left.langs.length ? 'these languages' : 'plain text'}</text>
  ${left.svg}
  ${files.length ? `<text class="sub" x="24" y="${fy - 8}">from what you have</text>` : ''}
  ${files.join('\n  ')}
  ${cmd0 ? `<text class="cmd" x="24" y="376"><tspan>$</tspan> ${esc(cmd0)}</text>` : ''}
  <circle class="flow" cx="215" cy="200" r="2.3"/><circle class="flow f2" cx="215" cy="200" r="2.3"/><circle class="flow f3" cx="215" cy="200" r="2.3"/>

  <rect class="hero" x="228" y="10" width="492" height="380" rx="12"/>
  <rect x="229" y="11" width="490" height="378" rx="11" fill="url(#glow)"/>
  <g class="core"><path transform="translate(242 19)" d="M10 0 1 16h7l-4 12 11-17h-7z" fill="url(#bolt)" stroke="#16805a" stroke-width=".8" stroke-linejoin="round"/></g>
  <text class="kick" x="266" y="32">${esc(clip(model.title, 22).toUpperCase())}<tspan class="sub" dx="10" style="letter-spacing:0;font-weight:400">· ${model.blocks} building blocks, one README</tspan></text>
  <text class="head" x="266" y="53">${esc(tagline)}<tspan class="cursor"> _</tspan></text>
  ${bigs.join('\n  ')}
  ${rows.map((r) => r.svg).join('\n  ')}
  <text class="cmd" x="242" y="376">${pick.hero ? `<tspan>$</tspan> ${esc(pick.hero)}` : ''}<tspan>${pick.hero ? ' · ' : ''}${model.sections} sections · ${model.blocks} blocks</tspan></text>
  <circle class="flow" cx="723" cy="200" r="2.3"/><circle class="flow f2" cx="723" cy="200" r="2.3"/><circle class="flow f3" cx="723" cy="200" r="2.3"/>

  <rect class="card" x="738" y="10" width="160" height="380" rx="12"/>
  <text class="num" x="752" y="32">03</text><text class="kick" x="774" y="32">RUN</text>
  <text class="head" x="752" y="53">${cmds.length ? 'do this' : 'it covers'}</text>
  ${cmds.length ? `<text class="sub" x="752" y="74">${model.commands.length} command${model.commands.length === 1 ? '' : 's'}</text>` : `<text class="sub" x="752" y="74">${model.inside.length} sections</text>`}
  ${cmdEls.join('\n  ')}
  ${cmds.length && secs.length ? `<text class="sub" x="752" y="182">${model.inside.length} sections</text>` : ''}
  ${secEls.join('\n  ')}
  <text class="note" x="752" y="356">README + repo</text>

  <circle class="flow" cx="903" cy="200" r="2.3"/><circle class="flow f2" cx="903" cy="200" r="2.3"/><circle class="flow f3" cx="903" cy="200" r="2.3"/>

  <rect class="card" x="916" y="10" width="154" height="380" rx="12"/>
  <text class="num" x="930" y="32">04</text><text class="kick" x="952" y="32">RADAR</text>
  <text class="head" x="930" y="53">what it uses</text>
  <circle class="ring" cx="993" cy="172" r="64"/><circle class="ring" cx="993" cy="172" r="42.7"/><circle class="ring" cx="993" cy="172" r="21.3"/>
  <line class="axis" x1="929" y1="172" x2="1057" y2="172"/><line class="axis" x1="993" y1="108" x2="993" y2="236"/>
  <g class="arm" style="transform-origin:993px 172px">
    <path d="M993 172 L1057 172 A64 64 0 0 0 1014.9 111.9 Z" fill="url(#sweep)"/>
    <line x1="993" y1="172" x2="1057" y2="172" stroke="#5ee0a0" stroke-width="1.5"/>
  </g>
  ${radar(tags, 993, 172, 64)}
  <circle class="ok" cx="934" cy="333" r="3.5"/>
  <text class="note" x="944" y="336">${tags.length} part${tags.length === 1 ? '' : 's'} found</text>
  <text class="note" x="930" y="354">stack · files · docs</text>
  ${pick.radar ? `<text class="cmd" x="930" y="376"><tspan>$</tspan> ${esc(pick.radar)}</text>` : ''}
</svg>
`;
}
