import { esc } from './render.js';

export function page(origin) {
  const o = esc(origin);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>README diagram</title>
<meta name="description" content="Turn any GitHub README into an animated SVG diagram. No LLM, no sign-up.">
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#24292f}input{font:inherit;padding:.5rem;width:min(100%,24rem)}button{font:inherit;padding:.5rem 1rem;margin:.25rem 0}img{max-width:100%;margin-top:1rem}pre{background:#f6f8fa;padding:.75rem;overflow:auto}@media(prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}pre{background:#161b22}}</style></head><body>
<h1>README diagram</h1>
<p>Give it a GitHub repo and get an animated SVG for the top of your README. No LLM: it reads headings, code blocks and the stack your README mentions.</p>
<form id="f"><input id="r" placeholder="owner/repo" required pattern="[A-Za-z0-9._-]+/[A-Za-z0-9._-]+"> <button>Preview</button></form>
<div id="out" hidden>
<img id="img" alt="Diagram preview">
<p><button id="copy">Copy README snippet</button> <a id="edit" target="_blank" rel="noopener"><button type="button">Open README on GitHub</button></a></p>
<pre id="snip"></pre></div>
<script>
const f=document.getElementById('f'),r=document.getElementById('r');
f.onsubmit=e=>{e.preventDefault();const v=r.value.trim(),u='${o}/'+v+'.svg';
img.src=u;out.hidden=false;
const s='<p align="center"><img src="'+u+'" alt="Diagram of '+v+'" width="100%"></p>';
snip.textContent=s;edit.href='https://github.com/'+v+'/edit/HEAD/README.md';
copy.onclick=()=>navigator.clipboard.writeText(s)};
</script></body></html>`;
}
