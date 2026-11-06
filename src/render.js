// Model -> animated SVG (1080x400), same visual language as flisk's docs/assets/ecosystem.svg.

const W = 1080;
const H = 400;
const WINDOW = 306;

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cw = (s) => Math.round((String(s).length * 6.95 + 16) * 10) / 10;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function pills(items, x0, y0, maxW, cls = 'lang') {
  let x = x0;
  let y = y0;
  const out = [];
  items.forEach((t, i) => {
    const w = cw(t);
    if (x + w > x0 + maxW) {
      x = x0;
      y += 28;
    }
    out.push(
      `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="22" rx="11"/><text x="${x + 8}" y="${y + 15}">${esc(t)}</text></g>`,
      `<rect class="lit bring" style="animation-delay:${(i * 0.9).toFixed(1)}s" x="${x}" y="${y}" width="${w}" height="22" rx="11"/>`,
    );
    x += w + 6;
  });
  return { svg: out.join('\n  '), bottom: y + 22 };
}

function marquee(row, i, y) {
  const widths = row.chips.map(cw);
  const period = widths.reduce((a, w) => a + w + 7, 0);
  const copies = Math.ceil(WINDOW / period) + 1;
  const chips = [];
  let x = 406;
  for (let c = 0; c < copies; c++) {
    row.chips.forEach((t, k) => {
      chips.push(`<g class="chip"><rect x="${x.toFixed(1)}" y="${y}" width="${widths[k]}" height="22" rx="11"/><text x="${(x + 8).toFixed(1)}" y="${y + 15}">${esc(t)}</text></g>`);
      x += widths[k] + 7;
    });
  }
  const dur = Math.max(8, period / 45).toFixed(1);
  const dir = i % 2 ? [`-${period.toFixed(1)}px`, '0px'] : ['0px', `-${period.toFixed(1)}px`];
  return {
    css: `.m${i} { animation: m${i} ${dur}s linear infinite; }\n    @keyframes m${i} { from { transform: translateX(${dir[0]}); } to { transform: translateX(${dir[1]}); } }`,
    svg: `<text class="count" x="270" y="${y + 16}" text-anchor="end">${row.chips.length}</text>
  <text class="what" x="276" y="${y + 15}">${esc(row.label)}</text>
  <g mask="url(#fade)"><g class="m${i}">
    ${chips.join('\n    ')}
  </g></g>`,
  };
}

export function renderSvg(model) {
  const title = esc(clip(model.title, 40));
  const left = pills(model.left.langs, 22, 84, 176);
  let fy = left.bottom + 34;
  const files = model.left.files.slice(0, 4).map((f, i) => {
    const y = fy + i * 32;
    return `<rect class="slot" x="22" y="${y}" width="176" height="25" rx="6"/>
  <rect class="lit from" style="animation-delay:${(i * 2).toFixed(1)}s" x="22" y="${y}" width="176" height="25" rx="6"/>
  <text class="file" x="32" y="${y + 17}">${esc(clip(f, 18))}</text>
  <text class="tick from" style="animation-delay:${(i * 2).toFixed(1)}s" x="182" y="${y + 17}">✓</text>`;
  });
  const rowEls = model.rows.slice(0, 5).map((r, i) => marquee(r, i, 110 + i * 38));
  const cmds = model.commands.map((c, i) => {
    const y = 84 + i * 40;
    return `<rect class="slot" x="748" y="${y}" width="214" height="30" rx="6"/>
  <rect class="lit out" style="animation-delay:${(i * 2.5).toFixed(1)}s" x="748" y="${y}" width="214" height="30" rx="6"/>
  <text class="file" x="758" y="${y + 20}"><tspan class="dollar">$ </tspan>${esc(clip(c, 24))}</text>`;
  });
  const tagline = model.tagline ? clip(model.tagline, 46) : `${model.sections} sections`;
  const desc = `${model.title}: ${model.blocks} building blocks across ${model.rows.map((r) => r.label).join(', ')}.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
  <title id="t">${title}</title>
  <desc id="d">${esc(desc)}</desc>
  <defs>
    <linearGradient id="bolt" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0" stop-color="#5ee0a0"/><stop offset="1" stop-color="#1f9d6b"/></linearGradient>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ee0a0"/><stop offset=".5" stop-color="#1f9d6b" stop-opacity=".35"/><stop offset="1" stop-color="#5ee0a0"/><animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="6s" repeatCount="indefinite"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#5ee0a0" stop-opacity=".16"/><stop offset="1" stop-color="#5ee0a0" stop-opacity="0"/></radialGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="fade" maskUnits="userSpaceOnUse" x="406" y="0" width="${WINDOW}" height="${H}"><rect x="406" y="0" width="${WINDOW}" height="${H}" fill="url(#edge)"/></mask>
  </defs>
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; fill: #24292f; }
    .card { fill: #f6f8fa; stroke: #d0d7de; }
    .hero { fill: #fff; stroke: url(#hero); stroke-width: 1.6; }
    .kick { font-size: 10.5px; font-weight: 700; letter-spacing: 1.6px; fill: #1f9d6b; }
    .num { font-size: 10.5px; font-weight: 700; fill: #8c959f; }
    .head { font-size: 15px; font-weight: 700; }
    .sub, .what { font-size: 10.5px; fill: #6e7781; }
    .count { font-size: 21px; font-weight: 800; fill: #1f9d6b; }
    .file { font-size: 12px; font-weight: 600; }
    .dollar, .tick { fill: #1f9d6b; }
    .lang rect, .slot, .chip rect { fill: #fff; stroke: #d0d7de; }
    .lang text, .chip text { font-size: 11px; }
    .lit { fill: #5ee0a0; fill-opacity: .25; stroke: #1f9d6b; opacity: 0; }
    .bring { animation: bring 8s linear infinite; }
    .from, .out { animation: bring 10s linear infinite; }
    .tick { opacity: 0; font-size: 12px; }
    @keyframes bring { 0% { opacity: 0; } 4% { opacity: 1; } 16% { opacity: 1; } 22%, 100% { opacity: 0; } }
    .flow { fill: #1f9d6b; opacity: 0; animation: flow 1.2s linear infinite; }
    .f2 { animation-delay: .4s; } .f3 { animation-delay: .8s; }
    @keyframes flow { 0% { opacity: 0; transform: translateX(0); } 25%, 75% { opacity: 1; } 100% { opacity: 0; transform: translateX(14px); } }
    .core { animation: pulse 1.5s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
    @keyframes pulse { from { transform: scale(.9); } to { transform: scale(1.1); } }
    .cursor { animation: blink 1s steps(1, end) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    ${rowEls.map((r) => r.css).join('\n    ')}
    @media (prefers-color-scheme: dark) {
      text { fill: #e6edf3; }
      .card { fill: #161b22; stroke: #30363d; }
      .hero { fill: #0d1117; }
      .kick, .count, .dollar, .tick { fill: #5ee0a0; }
      .sub, .what { fill: #8b949e; }
      .lang rect, .slot, .chip rect { fill: #0d1117; stroke: #30363d; }
      .lit { stroke: #5ee0a0; }
      .flow { fill: #5ee0a0; }
    }
  </style>

  <rect class="card" x="10" y="10" width="200" height="380" rx="12"/>
  <text class="num" x="24" y="32">01</text><text class="kick" x="46" y="32">READS</text>
  <text class="head" x="24" y="53">your repo</text>
  <text class="sub" x="24" y="74">written in</text>
  ${left.svg}
  ${files.length ? `<text class="sub" x="24" y="${fy - 8}">from what you have</text>` : ''}
  ${files.join('\n  ')}
  <circle class="flow" cx="215" cy="200" r="2.3"/><circle class="flow f2" cx="215" cy="200" r="2.3"/><circle class="flow f3" cx="215" cy="200" r="2.3"/>

  <rect class="hero" x="228" y="10" width="492" height="380" rx="12"/>
  <rect x="229" y="11" width="490" height="378" rx="11" fill="url(#glow)"/>
  <g class="core"><path transform="translate(242 19)" d="M10 0 1 16h7l-4 12 11-17h-7z" fill="url(#bolt)" stroke="#16805a" stroke-width=".8" stroke-linejoin="round"/></g>
  <text class="kick" x="266" y="32">${esc(clip(model.title, 22).toUpperCase())}<tspan class="sub" dx="10" style="letter-spacing:0;font-weight:400">· ${model.blocks} building blocks</tspan></text>
  <text class="head" x="266" y="53">${esc(tagline)}<tspan class="cursor"> _</tspan></text>
  ${rowEls.map((r) => r.svg).join('\n  ')}
  <circle class="flow" cx="735" cy="200" r="2.3"/><circle class="flow f2" cx="735" cy="200" r="2.3"/><circle class="flow f3" cx="735" cy="200" r="2.3"/>

  <rect class="card" x="750" y="10" width="320" height="380" rx="12"/>
  <text class="num" x="764" y="32">03</text><text class="kick" x="786" y="32">RUN</text>
  <text class="head" x="764" y="53">commands from the README</text>
  ${cmds.length ? cmds.join('\n  ').replace(/x="748"/g, 'x="764"').replace(/x="758"/g, 'x="774"').replace(/width="214"/g, 'width="290"') : '<text class="sub" x="764" y="84">no shell commands found</text>'}
</svg>
`;
}
