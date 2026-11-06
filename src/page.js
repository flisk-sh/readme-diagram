import { parseRepoInput } from './repo-input.js';
import { esc } from './render.js';

const EXAMPLES = ['flisk-sh/citable', 'flisk-sh/readme-score', 'flisk-sh/helpdock', 'flisk-sh/run-my-agents'];

export function page(origin) {
  const o = esc(origin);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>README diagram</title>
<meta name="description" content="Turn any GitHub README into an animated SVG diagram. No LLM, no sign-up.">
<style>
:root{--bg:#fff;--fg:#24292f;--mute:#6e7781;--line:#d0d7de;--card:#f6f8fa;--green:#1f9d6b}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--mute:#8b949e;--line:#30363d;--card:#161b22;--green:#5ee0a0}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:900px;margin:0 auto;padding:48px 16px 64px}
h1{font-size:2rem;margin:0 0 .25rem}h1 span{color:var(--green)}
.lead{color:var(--mute);margin:0 0 1.5rem}
form{display:flex;gap:8px;flex-wrap:wrap}
input{flex:1 1 280px;font:inherit;padding:.65rem .8rem;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg)}
button,.btn{font:inherit;font-weight:600;padding:.6rem 1rem;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;text-decoration:none;display:inline-block}
button.primary{background:var(--green);border-color:var(--green);color:#fff}
.ex{margin:.75rem 0 0;color:var(--mute);font-size:.9rem}.ex a{color:var(--green);margin-right:.75rem;cursor:pointer}
#err{color:#cf222e;margin:.75rem 0 0}
#out{margin-top:1.5rem}
.frame{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--card)}
.frame img{display:block;width:100%;height:auto}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:1rem 0}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:.75rem;overflow:auto;font-size:.8rem;white-space:pre-wrap;word-break:break-all}
footer{margin-top:2.5rem;color:var(--mute);font-size:.85rem}footer a{color:var(--green)}
</style></head><body><main>
<h1>README <span>diagram</span></h1>
<p class="lead">Paste a GitHub repo, get an animated SVG for the top of its README. No LLM: it reads headings, code blocks and the stack your README mentions.</p>
<form id="f"><input id="r" placeholder="owner/repo or https://github.com/owner/repo" autocomplete="off" autofocus><button class="primary">Preview</button></form>
<p class="ex">Try: ${EXAMPLES.map((e) => `<a data-ex="${e}">${e}</a>`).join('')}</p>
<p id="err" role="alert" hidden></p>
<section id="out" hidden>
<div class="frame"><img id="img" alt="Diagram preview"></div>
<div class="row"><button id="copy" class="primary">Copy README snippet</button><a id="edit" class="btn" target="_blank" rel="noopener">Open README on GitHub</a></div>
<pre id="snip"></pre>
<p class="ex">On GitHub: open the README, paste the snippet at the top, then Propose changes.</p>
</section>
<footer>Made with <a href="https://flisk.sh">Flisk</a> · <a href="https://github.com/flisk-sh/readme-diagram">source</a></footer>
<script>
${parseRepoInput.toString()}
const $=id=>document.getElementById(id);
function show(v){
  const repo=parseRepoInput(v);
  $('err').hidden=!!repo;
  if(!repo){$('err').textContent='Enter a GitHub repo like owner/repo or paste its URL.';$('out').hidden=true;return}
  const u='${o}/'+repo+'.svg';
  $('r').value=repo;
  $('img').onerror=()=>{$('err').textContent='Could not load a README for '+repo+'. Is the repo public and does it have a README?';$('err').hidden=false;$('out').hidden=true};
  $('img').onload=()=>{$('err').hidden=true;$('out').hidden=false};
  $('img').src=u;
  const s='<p align="center"><img src="'+u+'" alt="Diagram of '+repo+'" width="100%"></p>';
  $('snip').textContent=s;
  $('edit').href='https://github.com/'+repo+'/edit/HEAD/README.md';
  $('copy').onclick=()=>navigator.clipboard.writeText(s).then(()=>{$('copy').textContent='Copied';setTimeout(()=>$('copy').textContent='Copy README snippet',1500)});
}
$('f').onsubmit=e=>{e.preventDefault();show($('r').value)};
document.querySelectorAll('[data-ex]').forEach(a=>a.onclick=()=>show(a.dataset.ex));
</script></main></body></html>`;
}
