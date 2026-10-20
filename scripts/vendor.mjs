// Copies browser-ready builds of third-party libs into /vendor (committed, so the app works offline).
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
mkdirSync('vendor/katex/fonts', { recursive: true });
cpSync('node_modules/katex/dist/katex.min.js', 'vendor/katex/katex.min.js');
for (const f of readdirSync('node_modules/katex/dist/fonts')) {
  if (f.endsWith('.woff2')) cpSync('node_modules/katex/dist/fonts/' + f, 'vendor/katex/fonts/' + f);
}
// keep only woff2 sources so export tooling never chases missing woff/ttf files
let css = readFileSync('node_modules/katex/dist/katex.min.css', 'utf8');
css = css.replace(/,url\([^)]*\.woff\) format\("woff"\),url\([^)]*\.ttf\) format\("truetype"\)/g, '');
writeFileSync('vendor/katex/katex.min.css', css);
cpSync('node_modules/html-to-image/dist/html-to-image.js', 'vendor/html-to-image.js');
console.log('vendored');
