// Iz private/fonts/tt-lakes-neue/ (TTF/OTF/WOFF/WOFF2) radi woff2 podskup u public/fonts/tt-lakes-neue/.
// Izvorne datoteke se NE commitaju (licenca), pa ni izlaz. Ako izvora nema, stranica pada na
// sistemski sans-serif (vidi src/styles/fonts.css) — build se ne ruši.
//
// Za produkciju u private/fonts/tt-lakes-neue/ stavi naručiteljeve LICENCIRANE web datoteke
// (trial verzija smije samo za lokalno testiranje, vidi TypeType Trial EULA čl. 2b).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'private/fonts/tt-lakes-neue');
const OUT = path.join(root, 'public/fonts/tt-lakes-neue');

// [izlazna datoteka, širina (null = osnovna), rez]
const FACES = [
  ['tt-lakes-neue-400.woff2', null, 'Regular'],
  ['tt-lakes-neue-500.woff2', null, 'Medium'],
  ['tt-lakes-neue-600.woff2', null, 'DemiBold'],
  ['tt-lakes-neue-expanded-400.woff2', 'Expanded', 'Regular'],
  ['tt-lakes-neue-expanded-500.woff2', 'Expanded', 'Medium'],
];
const WIDTHS = ['Compressed', 'Condensed', 'Extended', 'Expanded'];

// latinica, latinica-1, latinica proširena A (hrvatski), interpunkcija, €, strelice
const RANGES = [[0x20, 0x7e], [0xa0, 0xff], [0x100, 0x17f], [0x2000, 0x206f], [0x20ac, 0x20ac], [0x2190, 0x21ff]];
const TEXT = RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i))).join('');

function find(files, width, weight) {
  return files.find((f) => {
    if (!/\.(ttf|otf|woff2?)$/i.test(f) || /italic/i.test(f)) return false;
    const name = f.replace(/\.[^.]+$/, '');
    const tokens = name.split(/[\s_-]+/);
    const w = WIDTHS.find((x) => tokens.includes(x)) || null;
    return w === width && tokens[tokens.length - 1] === weight;
  });
}

if (!fs.existsSync(SRC)) {
  console.warn(`[fonts] Nema ${path.relative(root, SRC)} — TT Lakes Neue se preskače (fallback na sistemski font).`);
  process.exit(0);
}
const files = fs.readdirSync(SRC);
if (process.env.NODE_ENV === 'production' && /trial/i.test(files.join(' '))) {
  // poslužitelj uredništva gradi javnu stranicu: trial fontovi tamo ne smiju (ni ranije izrađeni podskupovi)
  fs.rmSync(OUT, { recursive: true, force: true });
  console.error('[fonts] TRIAL datoteke u produkciji — TT Lakes Neue se izostavlja (sistemski font). Stavi licencirane datoteke.');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });
let made = 0;
for (const [out, width, weight] of FACES) {
  const src = find(files, width, weight);
  if (!src) { console.warn(`[fonts] Nedostaje ${width || 'Normal'} ${weight}`); continue; }
  const inPath = path.join(SRC, src), outPath = path.join(OUT, out);
  if (fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs > fs.statSync(inPath).mtimeMs) continue;
  const buf = await subsetFont(fs.readFileSync(inPath), TEXT, { targetFormat: 'woff2' });
  fs.writeFileSync(outPath, buf);
  console.log(`[fonts] ${src} -> ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
  made++;
}
if (/trial/i.test(files.join(' '))) {
  console.warn('[fonts] UPOZORENJE: koriste se TRIAL datoteke — ne smiju na javnu stranicu (EULA čl. 2b).');
}
console.log(`[fonts] gotovo (${made} novih)`);
