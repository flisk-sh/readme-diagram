// Stack detection from README text + optional repo file names. Dictionary lookups only.

const LANGUAGES = {
  TypeScript: /\btypescript\b|\.tsx?\b|\btsconfig/i,
  JavaScript: /\bjavascript\b|\bnode\.?js\b|\bnpm\b|\byarn\b|\bpnpm\b/i,
  Python: /\bpython\b|\bpip\b|\bpoetry\b|\buv\b run|\.py\b/i,
  Go: /\bgolang\b|\bgo (install|build|run|get)\b|\bgo\.mod\b/i,
  Rust: /\brust\b|\bcargo\b|\.rs\b/i,
  Java: /\bjava\b|\bmaven\b|\bgradle\b|\bkotlin\b|\bspring boot\b/i,
  Ruby: /\bruby\b|\brails\b|\bgem\b|\bbundler\b/i,
  PHP: /\bphp\b|\bcomposer\b|\blaravel\b/i,
  'C#': /\bc#|\bdotnet\b|\.net (core|framework|sdk|\d)/i,
  Swift: /\bswift(ui)?\b/i,
  Elixir: /\belixir\b|\bphoenix\b/i,
  Bun: /\bbun\b (install|run|add|x)/i,
  Deno: /\bdeno\b/i,
};

const FRAMEWORKS = {
  React: /\breact\b/i,
  'Next.js': /\bnext\.?js\b/i,
  Vue: /\bvue(\.js)?\b/i,
  Svelte: /\bsvelte(kit)?\b/i,
  Angular: /\bangular\b/i,
  Astro: /\bastro\b/i,
  Vite: /\bvite\b/i,
  Express: /\bexpress(\.js)?\b/i,
  Hono: /\bhono\b/i,
  Fastify: /\bfastify\b/i,
  NestJS: /\bnest\.?js\b/i,
  FastAPI: /\bfastapi\b/i,
  Django: /\bdjango\b/i,
  Flask: /\bflask\b/i,
  Rails: /\brails\b/i,
  Laravel: /\blaravel\b/i,
  axum: /\baxum\b/i,
  Tailwind: /\btailwind(css)?\b/i,
  LangChain: /\blangchain\b/i,
  'Cloudflare Workers': /\bcloudflare workers?\b|\bwrangler\b/i,
};

const SERVICES = {
  Docker: /\bdocker\b|\bdockerfile\b/i,
  Compose: /docker[- ]compose|compose\.ya?ml/i,
  Kubernetes: /\bkubernetes\b|\bk8s\b|\bhelm\b/i,
  Postgres: /\bpostgres(ql)?\b/i,
  MySQL: /\bmysql\b|\bmariadb\b/i,
  SQLite: /\bsqlite\b/i,
  MongoDB: /\bmongo(db)?\b/i,
  Redis: /\bredis\b|\bvalkey\b/i,
  Kafka: /\bkafka\b/i,
  RabbitMQ: /\brabbitmq\b/i,
  Qdrant: /\bqdrant\b/i,
  Ollama: /\bollama\b/i,
  OpenAI: /\bopenai\b/i,
  Anthropic: /\banthropic\b|claude code|claude api|\bclaude (sonnet|opus|haiku)\b/i,
  MCP: /\bmcp\b|model context protocol/i,
  Prisma: /\bprisma\b/i,
  GraphQL: /\bgraphql\b/i,
  gRPC: /\bgrpc\b/i,
  Terraform: /\bterraform\b/i,
  'GitHub Actions': /github actions|\.github\/workflows/i,
};

const FILES = [
  ['docker-compose.yml', /docker-compose\.ya?ml|compose\.ya?ml/i],
  ['Dockerfile', /\bdockerfile\b/i],
  ['package.json', /\bpackage\.json\b/i],
  ['Cargo.toml', /\bcargo\.toml\b/i],
  ['go.mod', /\bgo\.mod\b/i],
  ['pyproject.toml', /\bpyproject\.toml\b/i],
  ['requirements.txt', /\brequirements\.txt\b/i],
  ['Makefile', /\bmakefile\b|\bmake (build|test|run|install)\b/i],
  ['wrangler.toml', /\bwrangler\.toml\b/i],
  ['Tiltfile', /\btiltfile\b/i],
  ['.env.example', /\.env(\.example)?\b/i],
];

function pick(dict, text, min = 1) {
  return Object.entries(dict)
    .map(([name, re]) => ({ name, hits: (text.match(new RegExp(re.source, `${re.flags.replace('g', '')}g`)) ?? []).length }))
    .filter((x) => x.hits >= min)
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name))
    .map((x) => x.name);
}

export function detect(parsed, repoFiles = []) {
  const names = repoFiles.join('\n');
  const text = `${parsed.text}\n${names}`;
  // A long README mentions many things in passing; only count what it comes back to.
  const min = parsed.text.length > 3000 ? 2 : 1;
  const files = FILES.filter(([, re]) => re.test(text)).map(([f]) => f);
  const langs = pick(LANGUAGES, text, min);
  for (const l of parsed.fenceLangs) {
    const canon = { ts: 'TypeScript', typescript: 'TypeScript', js: 'JavaScript', javascript: 'JavaScript', py: 'Python', python: 'Python', go: 'Go', rust: 'Rust', rs: 'Rust', java: 'Java', ruby: 'Ruby', php: 'PHP' }[l];
    if (canon && !langs.includes(canon)) langs.push(canon);
  }
  return {
    languages: langs.slice(0, 8),
    frameworks: pick(FRAMEWORKS, text, min).slice(0, 12),
    services: pick(SERVICES, text, min).slice(0, 12),
    files: files.slice(0, 4),
  };
}
