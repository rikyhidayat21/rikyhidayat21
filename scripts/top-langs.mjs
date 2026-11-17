#!/usr/bin/env node
// Builds assets/top-langs.svg: a static "Most used languages" card.
// Reads language byte counts from every repo you own (forks skipped) via the GitHub CLI,
// so private repos count toward the totals too. Only language names and percentages
// end up in the SVG, never repo names.
//
// Usage (needs `gh auth login` once):
//   node scripts/top-langs.mjs
//
// Options (env vars):
//   TOP=8                     how many languages to show
//   EXCLUDE="HTML,CSS,SCSS"   languages to leave out (comma-separated)

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOP = Number(process.env.TOP ?? 8);
const EXCLUDE = new Set(
  (process.env.EXCLUDE ?? 'HTML,CSS,SCSS,Shell,Dockerfile,Procfile,Makefile')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'top-langs.svg');

const gh = (path) =>
  JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', path], { encoding: 'utf8' })).flat();

const repos = gh('user/repos?affiliation=owner&per_page=100').filter((r) => !r.fork && !r.archived);

const totals = {};
for (const repo of repos) {
  const langs = JSON.parse(execFileSync('gh', ['api', `repos/${repo.full_name}/languages`], { encoding: 'utf8' }));
  for (const [lang, bytes] of Object.entries(langs)) {
    if (!EXCLUDE.has(lang)) totals[lang] = (totals[lang] ?? 0) + bytes;
  }
}

const sum = Object.values(totals).reduce((a, b) => a + b, 0);
if (!sum) throw new Error('No language data found.');
const top = Object.entries(totals)
  .sort((a, b) => b[1] - a[1])
  .slice(0, TOP);
const topSum = top.reduce((a, [, b]) => a + b, 0);
const rows = top.map(([name, bytes]) => ({ name, pct: (bytes / topSum) * 100 }));

const COLORS = {
  Ruby: '#701516', Go: '#00ADD8', TypeScript: '#3178c6', JavaScript: '#f1e05a', Svelte: '#ff3e00',
  Astro: '#ff5a03', Rust: '#dea584', Python: '#3572A5', Vue: '#41b883', HTML: '#e34c26', CSS: '#663399',
  SCSS: '#c6538c', Shell: '#89e051', MDX: '#fcb32c', Java: '#b07219', PHP: '#4F5D95', Dart: '#00B4AB',
  Kotlin: '#A97BFF', Swift: '#F05138', 'C#': '#178600', C: '#555555', 'C++': '#f34b7d', PLpgSQL: '#336790',
};
const color = (n) => COLORS[n] ?? '#8b949e';
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Design matches rikyhidayat.dev: brand orange, GitHub-style neutrals, terminal header,
// one row per language, light/dark follows the viewer's GitHub theme.
const W = 480;
const PAD = 24;
const HEAD = 34; // terminal title bar
const ROW = 30;
const TOP_Y = HEAD + 66;
const H = TOP_Y + rows.length * ROW + 14;
const LABEL_W = 96;
const PCT_W = 56;
const BAR_X = PAD + LABEL_W;
const BAR_W = W - PAD * 2 - LABEL_W - PCT_W;
const maxPct = rows[0].pct;

const body = rows
  .map((r, i) => {
    const y = TOP_Y + i * ROW;
    const w = Math.max((r.pct / maxPct) * BAR_W, 4);
    const delay = (0.15 + i * 0.08).toFixed(2);
    return `<g transform="translate(0 ${y})" class="row" style="animation-delay:${delay}s">
<rect x="${PAD}" y="-4" width="8" height="8" rx="2" fill="${color(r.name)}"/>
<text x="${PAD + 16}" y="4" class="name">${esc(r.name)}</text>
<rect x="${BAR_X}" y="-4" width="${BAR_W}" height="8" rx="4" class="track"/>
<rect x="${BAR_X}" y="-4" width="${w.toFixed(2)}" height="8" rx="4" class="${i === 0 ? 'bar top' : 'bar'}" style="animation-delay:${delay}s"/>
<text x="${W - PAD}" y="4" class="pct" text-anchor="end">${r.pct.toFixed(1)}%</text>
</g>`;
  })
  .join('\n');

const updated = new Date().toISOString().slice(0, 10);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">Most used languages: ${rows.map((r) => `${esc(r.name)} ${r.pct.toFixed(1)}%`).join(', ')}</title>
<style>
:root{--bg:#ffffff;--head:#f3f4f6;--text:#0d1117;--muted:#57606a;--border:#e2e5e9;--track:#eaeef2;--brand:#ff6b35;--accent:#c4441a}
@media (prefers-color-scheme: dark){:root{--bg:#0d1117;--head:#161b22;--text:#e6edf3;--muted:#8b949e;--border:#30363d;--track:#21262d;--accent:#ff6b35}}
.card{fill:var(--bg);stroke:var(--border)}
.head{fill:var(--head)}
.rule{stroke:var(--border)}
.mono{font:500 12px 'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace}
.path{fill:var(--muted)}
.cmd{font:600 13px 'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;fill:var(--text)}
.prompt{fill:var(--accent)}
.name{font:600 12px 'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;fill:var(--text)}
.pct{font:500 12px 'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;fill:var(--muted)}
.track{fill:var(--track)}
.bar{fill:var(--brand);opacity:.55;transform-box:fill-box;transform-origin:left;animation:grow .8s cubic-bezier(.2,.8,.2,1) both}
.bar.top{opacity:1}
.row{animation:fade .5s ease-out both}
.foot{font:400 10px 'IBM Plex Mono',ui-monospace,Menlo,monospace;fill:var(--muted)}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.bar,.row{animation:none}}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" class="card"/>
<path d="M0.5 10.5a10 10 0 0 1 10-10h${W - 21}a10 10 0 0 1 10 10v${HEAD - 10}h-${W - 1}z" class="head"/>
<line x1="0.5" y1="${HEAD + 0.5}" x2="${W - 0.5}" y2="${HEAD + 0.5}" class="rule"/>
<circle cx="${PAD - 4}" cy="${HEAD / 2}" r="5" fill="#ff5f57"/><circle cx="${PAD + 12}" cy="${HEAD / 2}" r="5" fill="#febc2e"/><circle cx="${PAD + 28}" cy="${HEAD / 2}" r="5" fill="#28c840"/>
<text x="${W / 2}" y="${HEAD / 2 + 4}" class="mono path" text-anchor="middle">~/rikyhidayat21</text>
<text x="${PAD}" y="${HEAD + 28}" class="cmd"><tspan class="prompt">$</tspan> langs --top ${rows.length}</text>
<text x="${W - PAD}" y="${HEAD + 28}" class="foot" text-anchor="end">updated ${updated}</text>
${body}
</svg>
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`Wrote ${OUT} from ${repos.length} repos:`);
for (const r of rows) console.log(`  ${r.name.padEnd(12)} ${r.pct.toFixed(2)}%`);
