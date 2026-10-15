// Paket za hosting (infonet cPanel: Apache + PHP): sadržaj mape public_html.
//   hosting/                 izgrađena stranica (dist/, s .htaccess) + uredništvo u hosting/urednistvo/
//   hosting/urednistvo/      index.php, .htaccess, lib/*.php, static/ (sučelje), konfiguracija.json, pocetni.json, minijature/
//   hosting.zip              isto u jednoj datoteci (za ručno: cPanel -> File Manager -> public_html -> Upload -> Extract)
// GitHub Actions sprema hosting/ kao artefakt "hosting"; uredništvo na hostingu ga preuzima i postavlja (lib/instalacija.php).
// Podaci uredništva NISU u paketu: na hostingu su izvan public_html (septillion-podaci/) i paket ih nikad ne dira.
// Upotreba: npm run build && npm run paket   (to radi i .github/workflows/objava.yml)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../urednistvo/lib/postavke.mjs';
import { pripremi } from '../urednistvo/php/pripremi.mjs';
import { zipMape } from './zip.mjs';

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

const { podaci, broj } = zipMape(IZLAZ);
fs.writeFileSync(path.join(ROOT, 'hosting.zip'), podaci);
console.log(`[paket] hosting/ i hosting.zip (${broj} datoteka) — sadržaj za public_html`);
