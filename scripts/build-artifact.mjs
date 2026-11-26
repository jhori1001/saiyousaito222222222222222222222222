// Bundles dist/ into one self-contained HTML file (JS + CSS inlined) for hosting
// as a single page. Usage: npm run build && node scripts/build-artifact.mjs [out.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/);
const css = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/);
if (!js || !css) throw new Error('Unexpected dist/index.html layout');
const code = readFileSync(join(dist, js[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(join(dist, css[1]), 'utf8');
const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'AIM PROTOCOL';

const out = `<title>${title}</title>
<style>${style}
html, body { height: 100%; background: #0f1216; }</style>
<div id="app"></div>
<script type="module">${code}</script>
`;
const target = process.argv[2] ?? join(dist, 'aim-protocol.html');
writeFileSync(target, out);
console.log(`wrote ${target} (${(out.length / 1024).toFixed(0)} KB)`);
