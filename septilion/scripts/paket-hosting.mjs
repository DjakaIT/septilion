// Paket za hosting (infonet cPanel: Apache + PHP): sadržaj mape public_html.
//   hosting/                 izgrađena stranica (dist/, s .htaccess) + uredništvo u hosting/urednistvo/
//   hosting/urednistvo/      index.php, .htaccess, lib/*.php, static/ (sučelje), konfiguracija.json, pocetni.json, minijature/
//   hosting.zip              isto, za prvo postavljanje ručno (cPanel -> File Manager -> public_html -> Upload -> Extract)
// Podaci uredništva NISU u paketu: na hostingu su izvan public_html (septillion-podaci/) i paket ih nikad ne dira.
// Upotreba: npm run build && npm run paket   (to radi i .github/workflows/objava.yml prije prijenosa FTPS-om)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from '../urednistvo/lib/postavke.mjs';
import { pripremi } from '../urednistvo/php/pripremi.mjs';

const DIST = path.join(ROOT, 'dist');
const IZLAZ = path.join(ROOT, 'hosting');
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('Nema dist/ — prvo npm run build'); process.exit(1); }

fs.rmSync(IZLAZ, { recursive: true, force: true });
fs.cpSync(DIST, IZLAZ, { recursive: true, filter: (f) => path.basename(f) !== '_headers' }); // _headers je za Netlify/Cloudflare
const U = path.join(IZLAZ, 'urednistvo');
fs.mkdirSync(path.join(U, 'lib'), { recursive: true });
fs.mkdirSync(path.join(U, 'static'), { recursive: true });
for (const f of ['index.php', '.htaccess']) fs.copyFileSync(path.join(ROOT, 'urednistvo/php', f), path.join(U, f));
for (const f of fs.readdirSync(path.join(ROOT, 'urednistvo/php/lib'))) if (f.endsWith('.php')) fs.copyFileSync(path.join(ROOT, 'urednistvo/php/lib', f), path.join(U, 'lib', f));
for (const f of ['index.html', 'app.js', 'app.css', 'ikona.svg', 'qrcode.mjs']) fs.copyFileSync(path.join(ROOT, 'urednistvo/sucelje', f), path.join(U, 'static', f));
await pripremi(U);

// trial fontovi ne smiju na javnu stranicu (TypeType EULA) — ni slučajno u paketu
const fontovi = path.join(IZLAZ, 'fonts/tt-lakes-neue');
if (fs.existsSync(fontovi) && fs.readdirSync(path.join(ROOT, 'private/fonts/tt-lakes-neue')).some((f) => /trial/i.test(f))) {
  fs.rmSync(fontovi, { recursive: true, force: true });
  console.warn('[paket] TRIAL fontovi izostavljeni (stranica koristi sistemski font dok ne staviš licencirane).');
}

// ---- zip (bez vanjskih paketa): deflate + središnji direktorij, UTF-8 imena ----
function zip(korijen, cilj) {
  const lokalni = [], sredisnji = [];
  let pomak = 0;
  const datoteke = [];
  (function obidi(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) obidi(p); else datoteke.push(p); } })(korijen);
  for (const p of datoteke.sort()) {
    const ime = Buffer.from(path.relative(korijen, p).split(path.sep).join('/'), 'utf8');
    const podaci = fs.readFileSync(p);
    const sazeto = zlib.deflateRawSync(podaci, { level: 9 });
    const crc = zlib.crc32(podaci);
    const t = fs.statSync(p).mtime;
    const vrijeme = (t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1);
    const datum = ((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate();
    const zaglavlje = (potpis, dodatno) => {
      const b = Buffer.alloc(dodatno ? 46 : 30);
      let i = 0;
      const w2 = (v) => { b.writeUInt16LE(v, i); i += 2; }, w4 = (v) => { b.writeUInt32LE(v >>> 0, i); i += 4; };
      w4(potpis); if (dodatno) w2(20); w2(20); w2(0x0800); w2(8); w2(vrijeme); w2(datum); w4(crc); w4(sazeto.length); w4(podaci.length); w2(ime.length); w2(0);
      if (dodatno) { w2(0); w2(0); w2(0); w4(0); w4(pomak); }
      return b;
    };
    sredisnji.push(zaglavlje(0x02014b50, true), ime);
    const l = [zaglavlje(0x04034b50, false), ime, sazeto];
    lokalni.push(...l);
    pomak += l.reduce((s, x) => s + x.length, 0);
  }
  const cd = Buffer.concat(sredisnji);
  const kraj = Buffer.alloc(22);
  kraj.writeUInt32LE(0x06054b50, 0); kraj.writeUInt16LE(datoteke.length, 8); kraj.writeUInt16LE(datoteke.length, 10);
  kraj.writeUInt32LE(cd.length, 12); kraj.writeUInt32LE(pomak, 16);
  fs.writeFileSync(cilj, Buffer.concat([...lokalni, cd, kraj]));
  return datoteke.length;
}
const n = zip(IZLAZ, path.join(ROOT, 'hosting.zip'));
console.log(`[paket] hosting/ i hosting.zip (${n} datoteka) — sadržaj za public_html`);
