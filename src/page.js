import { parseRepoInput } from './repo-input.js';
import { esc } from './render.js';

export const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#07080c"/><path d="M18 3 7 18h8l-3 11 13-17h-8z" fill="#5ee0a0" stroke="#1f9d6b" stroke-width="1" stroke-linejoin="round"/></svg>`;

const CSS = `
:root{--bg:#fbfaf7;--fg:#141413;--muted:#66635c;--line:#e3e0d7;--card:#fff;--accent:#1f9d6b;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#eceae4;--muted:#a29f97;--line:#272a31;--card:#16181d;--accent:#5ee0a0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:3px}.wrap{max-width:880px;margin:0 auto;padding:0 20px}
.stage{position:relative;overflow:hidden;background:#07080c;color:#f4f3ef;--fg:#f4f3ef;--muted:#b0afba;--line:#262833;--card:#11131a;--accent:#5ee0a0}
.stage::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(60% 65% at 50% 38%,#000,transparent 75%);mask-image:radial-gradient(60% 65% at 50% 38%,#000,transparent 75%)}
.stage::after{content:"";position:absolute;inset:-10%;background:radial-gradient(38% 32% at 22% 18%,rgba(94,224,160,.30),transparent 70%),radial-gradient(32% 30% at 82% 30%,rgba(31,157,107,.28),transparent 70%),radial-gradient(40% 36% at 55% 95%,rgba(91,124,255,.22),transparent 70%);pointer-events:none}
.stage>*{position:relative;z-index:1}
header.top{background:#07080c;border-bottom:1px solid #1d2029}header.top::before,header.top::after{display:none}
header.top .wrap{max-width:1080px;display:flex;gap:20px;align-items:center;min-height:60px;font-size:15px}header.top .wrap a:nth-child(2){margin-left:auto}
header.top a{color:var(--muted);text-decoration:none}header.top a:first-child{color:var(--fg);font-weight:750;font-size:17px;display:flex;gap:10px;align-items:center}header.top img{border-radius:6px}
.hero{padding:48px 0 64px;text-align:center}
h1{font-size:clamp(34px,6.5vw,58px);line-height:1.04;letter-spacing:-.04em;font-weight:800;margin:0 auto 16px;max-width:18ch}
.grad{background:linear-gradient(92deg,#5ee0a0,#4ade80 40%,#9db0ff);-webkit-background-clip:text;background-clip:text;color:transparent}
h2{font-size:clamp(22px,3.4vw,30px);letter-spacing:-.025em;margin:0 0 14px;font-weight:780}
.lede{color:var(--muted);font-size:clamp(17px,2.3vw,19px);max-width:640px;margin:0 auto 26px}
form.repo{display:flex;gap:10px;max-width:620px;margin:0 auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:8px}
form.repo input{flex:1;min-width:0;background:transparent;border:0;color:var(--fg);font:15px var(--mono);padding:11px 14px}form.repo input:focus{outline:none}
form.repo:focus-within{border-color:#5ee0a0}
button,a.btn{font:inherit;font-weight:650;padding:12px 22px;border:0;border-radius:10px;background:linear-gradient(135deg,#1f9d6b,#16805a);color:#fff;cursor:pointer;text-decoration:none;display:inline-block;box-shadow:0 8px 24px -10px rgba(31,157,107,.8)}
button:hover,a.btn:hover{filter:brightness(1.1)}button.ghostbtn,a.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--fg);box-shadow:none}
.chips{margin:18px 0 0;font-size:13px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.chip{text-decoration:none;color:var(--fg);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:4px 12px;background:rgba(255,255,255,.05);font-family:var(--mono)}.chip:hover{border-color:var(--accent)}
.reassure{margin:14px 0 0;font-size:13px;color:var(--muted)}.reassure b{color:var(--accent)}
.error{max-width:620px;margin:0 auto 18px;padding:10px 14px;border-radius:10px;background:rgba(255,123,114,.16);color:var(--fg)}
.shot{margin:40px auto 0;max-width:900px;background:#fff;border-radius:18px;padding:12px;box-shadow:0 40px 100px -30px rgba(31,157,107,.55)}
.shot img{display:block;width:100%;height:auto;border-radius:10px}
@media (prefers-color-scheme:dark){.shot{background:#0d1117}}
.stats{display:grid;grid-template-columns:repeat(4,1fr);margin:56px 0 0;border-top:1px solid var(--line);text-align:left}
.stats div{padding:24px 20px 28px 0}.stats div+div{padding-left:20px;border-left:1px solid var(--line)}
.stats b{display:block;font-size:clamp(30px,4vw,48px);line-height:1;font-weight:800;letter-spacing:-.04em}.stats span{display:block;margin-top:8px;color:var(--muted);font-size:14px;line-height:1.4;max-width:22ch}
.kick{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin:72px 0 10px}
table{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:650}
pre{background:#0e0f12;color:#e8e6e1;border:1px solid #272a31;border-radius:12px;padding:12px 14px;overflow-x:auto;font:13px/1.6 var(--mono);white-space:pre-wrap;word-break:break-all;margin:8px 0 0;text-align:left}
.row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:22px 0 0}
.steps{color:var(--muted);font-size:14px;margin-top:14px}
footer{margin-top:96px;border-top:1px solid var(--line);padding:26px 0 44px;color:var(--muted);font-size:14px}
@media (max-width:640px){.stats{grid-template-columns:1fr 1fr}.stats div{padding:18px 12px 20px 0}.stats div+div{padding-left:12px}.stats div:nth-child(3){padding-left:0;border-left:0}.stats div:nth-child(n+3){border-top:1px solid var(--line)}form.repo{flex-direction:column}}
`;

const EXAMPLES = ['flisk-sh/citable', 'flisk-sh/readme-score', 'flisk-sh/helpdock', 'flisk-sh/run-my-agents'];
const DESC = 'Paste a GitHub repo, get an animated SVG diagram for the top of its README. No AI: same README, same diagram.';

function layout({ title, origin, body, path = '/' }) {
  const t = esc(title);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${esc(origin + path)}">
<meta name="theme-color" content="#07080c">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="README Diagram"><meta property="og:title" content="${t}"><meta property="og:description" content="${esc(DESC)}">
<meta property="og:image" content="${esc(origin)}/flisk-sh/citable.svg"><meta name="twitter:card" content="summary_large_image">
<style>${CSS}</style></head><body>
<header class="top stage"><nav class="wrap" aria-label="Site"><a href="/"><img src="/icon.svg" alt="" width="26" height="26">README Diagram</a><a href="https://github.com/flisk-sh/readme-diagram">Source</a></nav></header>
${body}
<footer><div class="wrap">README Diagram: no AI, no sign-up, nothing stored. <a href="https://github.com/flisk-sh/readme-diagram">Open source</a>, made by <a href="https://flisk.sh">Flisk</a>.</div></footer>
</body></html>`;
}

const form = (value = '') => `<form class="repo" action="/check" method="get" role="search"><input type="text" name="repo" value="${esc(value)}" placeholder="github.com/owner/repo" autocomplete="off" spellcheck="false" required aria-label="GitHub repository"><button type="submit">Make diagram</button></form>
<p class="chips">${EXAMPLES.map((e) => `<a class="chip" href="/${e}">${e}</a>`).join('')}</p>`;

export function page(origin, { error = '', value = '' } = {}) {
  return layout({
    title: 'README Diagram: your README as an animated SVG',
    origin,
    body: `<main><section class="hero stage"><div class="wrap">
<h1 class="grad">Your README, as an animated diagram</h1>
<p class="lede">Paste a GitHub repo. Get an animated SVG for the top of its README: your stack, sections and commands, drawn in one picture.</p>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}${form(value)}
<p class="reassure"><b>●</b> No AI · No sign-up · Same README, same diagram</p>
<div class="shot"><img src="/flisk-sh/citable.svg" alt="Sample diagram of the citable repo" width="1080" height="400"></div>
<div class="stats"><div><b>1</b><span>image tag to embed, works in any README</span></div><div><b>0</b><span>models: headings, code blocks and keyword lists</span></div><div><b>3</b><span>cards: what it reads, the stack, what to run</span></div><div><b>1 day</b><span>edge cache, so a README edit shows up tomorrow</span></div></div>
</div></section>
<div class="wrap"><p class="kick">How it works</p><h2>Read the README. Draw what is in it.</h2>
<table><thead><tr><th>Card</th><th>Where it comes from</th></tr></thead><tbody>
<tr><td>Reads</td><td>Languages and files (Dockerfile, package.json, Cargo.toml) the README and the repo name</td></tr>
<tr><td>Stack</td><td>Frameworks, services and the README's own sections, matched by fixed keyword lists</td></tr>
<tr><td>Run</td><td>The shell commands in the README's code blocks, or its sections when it has none</td></tr></tbody></table>
<p class="kick">Or type it</p><h2>One URL per repo.</h2>
<pre>https://diagram.flisk.si/owner/repo.svg</pre></div></main>`,
  });
}

export function resultPage(origin, repo, editUrl, { oauth = false } = {}) {
  const edit = editUrl || `https://github.com/${repo}/edit/HEAD/README.md`;
  const u = `${origin}/${repo}.svg`;
  const snippet = `<p align="center"><img src="${u}" alt="Diagram of ${repo}" width="100%"></p>`;
  return layout({
    title: `${repo} diagram · README Diagram`,
    origin,
    path: `/${repo}`,
    body: `<main><section class="hero stage"><div class="wrap">
<h1 class="grad">${esc(repo)}</h1>
<p class="lede">Your diagram is ready. Copy the snippet to the top of the README.</p>
<p id="err" class="error" role="alert" hidden>Could not load a README for ${esc(repo)}. Is the repo public and does it have a README?</p>
<div class="shot"><img id="img" src="${esc(u)}" alt="Diagram of ${esc(repo)}" width="1080" height="400"></div>
<div class="row">${oauth ? `<a class="btn" href="/auth/start?repo=${esc(repo)}">Open a pull request for me</a>` : ''}<button id="copy" type="button" class="ghostbtn">Copy README snippet</button><a id="edit" class="btn${oauth ? ' ghost' : ''}" href="${esc(edit)}" target="_blank" rel="noopener">Copy snippet and open README on GitHub</a></div>
${oauth ? '<p class="steps">The green button signs you in with GitHub, forks the repo if it is not yours, and opens the pull request. It asks only for access to public repos and stores nothing.</p>' : ''}
<p class="steps" id="steps"><b>1.</b> Click the green button: it copies the snippet and opens the README editor. <b>2.</b> Click in the editor, press Ctrl+V (⌘V on Mac) at the very top. <b>3.</b> Click <b>Commit changes</b>, then <b>Propose changes</b>. GitHub forks the repo for you if it is not yours.</p>
<pre id="snip">${esc(snippet)}</pre>
<p class="row"><a class="btn ghost" href="/">Another repo</a></p>
</div></section></main>
<script>
const s=${JSON.stringify(snippet).replace(/</g, '\\u003c')},c=document.getElementById('copy');
c.onclick=()=>navigator.clipboard.writeText(s).then(()=>{c.textContent='Copied';setTimeout(()=>c.textContent='Copy README snippet',1500)});
document.getElementById('edit').addEventListener('click',()=>{navigator.clipboard.writeText(s).then(()=>{document.getElementById('steps').insertAdjacentHTML('beforebegin','<p class="reassure"><b>●</b> Snippet copied. Paste it at the top of the README.</p>')})});
document.getElementById('img').onerror=()=>{document.getElementById('err').hidden=false;document.getElementById('img').parentNode.hidden=true};
</script>`,
  });
}

export function donePage(origin, { repo, url, forked, error }) {
  const body = error
    ? `<h1 class="grad">Not this time</h1><p class="lede">${esc(error)}</p><div class="row"><a class="btn" href="/${esc(repo || '')}">Back to the diagram</a></div>`
    : `<h1 class="grad">Pull request opened</h1><p class="lede">${forked ? 'We forked the repo to your account and ' : ''}opened a pull request that adds the diagram to the README of ${esc(repo)}.</p><div class="row"><a class="btn" href="${esc(url)}">View the pull request</a><a class="btn ghost" href="/">Another repo</a></div>`;
  return layout({ title: error ? 'README Diagram: not this time' : 'README Diagram: pull request opened', origin, path: '/auth/callback', body: `<main><section class="hero stage"><div class="wrap">${body}</div></section></main>` });
}

export { parseRepoInput };
