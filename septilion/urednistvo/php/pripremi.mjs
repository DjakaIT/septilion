// Priprema PHP uredništva za hosting: iz istih izvora kao stranica (src/data, src/assets/img) zapisuje u <izlaz>:
//   konfiguracija.json  lokali, kategorije, boje naljepnica, javna adresa, popis lokalnih slika
//   pocetni.json        početni jelovnik (dok uredništvo još nema svoj podaci/jelovnik.json)
//   minijature/*.webp   male verzije lokalnih slika za uredništvo (480 px)
// Poziva je objava (.github/workflows/objava.yml) i testovi. Upotreba: node urednistvo/php/pripremi.mjs <izlaz>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LOKALI, BOJE } from '../../src/data/lokali.mjs';
import { pocetniSadrzaj } from '../../src/data/sadrzaj.mjs';
import { SITE_URL } from '../../src/site.config.mjs';
import { ROOT } from '../lib/postavke.mjs';

sharp.cache(false);

export async function pripremi(izlaz, { origin = SITE_URL } = {}) {
  const IMG = path.join(ROOT, 'src/assets/img');
  const lokalne = fs.readdirSync(IMG).filter((f) => /^[a-z0-9_]{1,40}\.(webp|jpe?g|png)$/.test(f));
  fs.mkdirSync(path.join(izlaz, 'minijature'), { recursive: true });
  fs.writeFileSync(path.join(izlaz, 'konfiguracija.json'), JSON.stringify({
    format: 1, origin, lokali: LOKALI, boje: BOJE, lokalneSlike: lokalne.map((f) => f.replace(/\.[^.]+$/, '')),
  }, null, 1));
  fs.writeFileSync(path.join(izlaz, 'pocetni.json'), JSON.stringify(pocetniSadrzaj(ROOT), null, 1));
  for (const f of lokalne) {
    const cilj = path.join(izlaz, 'minijature', f.replace(/\.[^.]+$/, '.webp'));
    if (fs.existsSync(cilj)) continue;
    // iz memorije: sharp inače drži datoteku otvorenom (Windows je tada ne može obrisati)
    await sharp(fs.readFileSync(path.join(IMG, f))).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(cilj);
  }
  return { slika: lokalne.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const izlaz = process.argv[2];
  if (!izlaz) { console.error('Upotreba: node urednistvo/php/pripremi.mjs <izlaz>'); process.exit(1); }
  const r = await pripremi(path.resolve(izlaz));
  console.log(`[uredništvo] konfiguracija, početni jelovnik i ${r.slika} minijatura -> ${izlaz}`);
}
