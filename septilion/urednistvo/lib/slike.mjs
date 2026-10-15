// Fotografije iz uredništva: svaka se dekodira i iznova kodira (sharp) — uklanja EXIF/GPS i sve skriveno u datoteci,
// ograničava veličinu i dimenzije (zaštita od "dekompresijskih bombi"), sprema pod nasumičnim imenom.
// Stranica ih zatim pri buildu optimizira kao i sve ostale (AVIF/WebP u više veličina).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { pisiAtomarno } from './datoteke.mjs';
import { ROOT } from './postavke.mjs';
import { KLJUC_SLIKE } from '../../src/data/sadrzaj.mjs';

export const NAJVECA_DATOTEKA = 15 * 1024 * 1024;
const NAJVISE_PIKSELA = 40_000_000;
const DOPUSTENI_FORMATI = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);
const LOKALNE = path.join(ROOT, 'src/assets/img');

export function slike(podaciDir) {
  const dir = path.join(podaciDir, 'slike');
  const minijature = new Map(); // ključ -> Buffer (mali LRU)

  /** putanja izvorne datoteke za ključ ili null (ključ se provjerava regexom — nema "../") */
  function putanja(kljuc) {
    if (typeof kljuc !== 'string' || !KLJUC_SLIKE.test(kljuc)) return null;
    if (kljuc.startsWith('n-')) { const p = path.join(dir, `${kljuc}.webp`); return fs.existsSync(p) ? p : null; }
    for (const ext of ['webp', 'jpg', 'jpeg', 'png']) { const p = path.join(LOKALNE, `${kljuc}.${ext}`); if (fs.existsSync(p)) return p; }
    return null;
  }

  return {
    putanja,
    postoji: (kljuc) => putanja(kljuc) !== null,

    /** @returns {Promise<{ kljuc: string, sirina: number, visina: number }>} */
    async obradi(buf) {
      if (!Buffer.isBuffer(buf) || buf.length === 0) throw Object.assign(new Error('Prazna datoteka'), { status: 400 });
      if (buf.length > NAJVECA_DATOTEKA) throw Object.assign(new Error('Fotografija je veća od 15 MB'), { status: 413 });
      let meta;
      try { meta = await sharp(buf, { limitInputPixels: NAJVISE_PIKSELA }).metadata(); } catch {
        throw Object.assign(new Error('Datoteka nije fotografija (JPG, PNG, WebP ili AVIF)'), { status: 415 });
      }
      if (!DOPUSTENI_FORMATI.has(meta.format)) throw Object.assign(new Error('Podržani formati: JPG, PNG, WebP, AVIF'), { status: 415 });
      if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 300) throw Object.assign(new Error('Fotografija je premala (najmanje 300 × 300 px)'), { status: 422 });
      const { data, info } = await sharp(buf, { limitInputPixels: NAJVISE_PIKSELA, failOn: 'error' })
        .rotate() // uspravno prema EXIF-u, pa se EXIF odbacuje
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer({ resolveWithObject: true });
      const kljuc = `n-${crypto.randomBytes(12).toString('hex')}`;
      pisiAtomarno(path.join(dir, `${kljuc}.webp`), data, 0o644);
      return { kljuc, sirina: info.width, visina: info.height };
    },

    /** mala verzija za uredništvo (WebP 480 px) */
    async minijatura(kljuc) {
      if (minijature.has(kljuc)) return minijature.get(kljuc);
      const p = putanja(kljuc);
      if (!p) return null;
      // iz memorije, ne s putanje: sharp inače drži datoteku otvorenom (na Windowsu se tada ne može obrisati)
      const b = await sharp(fs.readFileSync(p)).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      minijature.set(kljuc, b);
      if (minijature.size > 300) minijature.delete(minijature.keys().next().value);
      return b;
    },
  };
}
