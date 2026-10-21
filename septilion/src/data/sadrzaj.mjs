// Sadržaj jelovnika iz uredništva (podaci/jelovnik.json): oblik, provjera, početni sadržaj i pretvorba u oblik
// koji stranica koristi. Čisti JS — dijele ga build stranice (src/data/*.ts) i poslužitelj uredništva.
//
// Oblik datoteke:
// { format: 1, verzija, azurirano, azurirao, kategorije: { "pasta-rhymes/strana-a": { naslov, slika, planet, napomena, stavke: [...] } } }
// stavke su ravan popis kao na stranici: { tip: 'jelo', ... } ili { tip: 'skupina', naslov, ... } (naslov skupine pića).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'astro/zod';
import { BOJE, LOKALI, kljucKategorije, sveKategorije } from './lokali.mjs';
import { LOCAL_SIDE_A, LOCAL_SALADS, LOCAL_SIDES } from './pasta-local.mjs';

export const FORMAT = 1;
/** ključ slike: lokalna (src/assets/img, npr. pr_shrimp) ili učitana u uredništvu (podaci/slike/n-<24 hex>.webp) */
export const KLJUC_SLIKE = /^(?:[a-z0-9_]{1,40}|n-[a-f0-9]{24})$/;
export const ID_STAVKE = /^[a-z0-9]{6,32}$/;
export const noviId = () => crypto.randomBytes(8).toString('hex').slice(0, 12);

// ---------------- oblik (zod) ----------------
const tekst = (max) => z.object({ hr: z.string().trim().max(max), en: z.string().trim().max(max) }).strict();
const dvijeDecimale = (v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
const cijena = z.number().positive('Cijena mora biti veća od 0').max(9999, 'Provjeri cijenu').refine(dvijeDecimale, 'Najviše dvije decimale');
const slika = z.string().regex(KLJUC_SLIKE).nullable();

const Jelo = z.object({
  id: z.string().regex(ID_STAVKE),
  tip: z.literal('jelo'),
  naziv: tekst(120),
  opis: tekst(600),
  porcija: tekst(80),
  preporuka: tekst(200),
  cijena,
  kolicina: z.string().trim().max(20),
  cijena2: cijena.nullable(),
  kolicina2: z.string().trim().max(20),
  slika,
  boja: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  galerija: z.boolean(),
}).strict();
const Skupina = z.object({
  id: z.string().regex(ID_STAVKE),
  tip: z.literal('skupina'),
  naslov: tekst(80),
  napomena: tekst(80),
  preporuka: tekst(200),
}).strict();
export const Kategorija = z.object({
  naslov: tekst(60),
  slika,
  planet: slika,
  napomena: tekst(400),
  stavke: z.array(z.discriminatedUnion('tip', [Jelo, Skupina])).max(400),
}).strict();
export const Sadrzaj = z.object({
  format: z.literal(FORMAT),
  verzija: z.number().int().positive(),
  azurirano: z.string().max(40),
  azurirao: z.string().max(40),
  kategorije: z.record(z.string(), Kategorija),
}).strict();

/** prazne vrijednosti za novu stavku (uredništvo ih popunjava) */
export const praznoJelo = () => ({ id: noviId(), tip: 'jelo', naziv: { hr: '', en: '' }, opis: { hr: '', en: '' }, porcija: { hr: '', en: '' }, preporuka: { hr: '', en: '' },
  cijena: 1, kolicina: '', cijena2: null, kolicina2: '', slika: null, boja: null, galerija: true });

// ---------------- provjera pravila po kategoriji ----------------
/**
 * Provjerava kategoriju prema njezinim poljima (lokali.mjs). Vraća popis grešaka { putanja, poruka } za uredništvo.
 * @param {import('./lokali.mjs').KategorijaKonfig} kat
 * @param {z.infer<typeof Kategorija>} k
 * @param {(kljuc: string) => boolean} [slikaPostoji]
 */
export function provjeriKategoriju(kat, k, slikaPostoji = () => true) {
  const g = [];
  const ima = (p) => kat.polja.includes(p);
  if (ima('naslov') && !k.naslov.hr) g.push({ putanja: ['naslov', 'hr'], poruka: 'Upiši naslov kategorije' });
  for (const [polje, vrijednost] of [['slika', k.slika], ['planet', k.planet]]) {
    if (vrijednost && !slikaPostoji(vrijednost)) g.push({ putanja: [polje], poruka: 'Fotografija ne postoji' });
  }
  if (!k.stavke.some((s) => s.tip === 'jelo')) g.push({ putanja: ['stavke'], poruka: 'Kategorija mora imati barem jedno jelo' });
  const ids = new Set();
  k.stavke.forEach((s, i) => {
    const p = (...x) => ['stavke', i, ...x];
    if (ids.has(s.id)) g.push({ putanja: p('id'), poruka: 'Dvostruki id stavke' });
    ids.add(s.id);
    if (s.tip === 'skupina') {
      if (!ima('skupine')) g.push({ putanja: p(), poruka: 'Ova kategorija nema skupine' });
      return;
    }
    if (!s.naziv.hr) g.push({ putanja: p('naziv', 'hr'), poruka: 'Upiši naziv jela' });
    if (ima('slika') && !s.slika) g.push({ putanja: p('slika'), poruka: 'Dodaj fotografiju jela' });
    if (s.slika && !slikaPostoji(s.slika)) g.push({ putanja: p('slika'), poruka: 'Fotografija ne postoji' });
    if (ima('boja') && !BOJE.some((b) => b.vrijednost.toLowerCase() === (s.boja ?? '').toLowerCase())) g.push({ putanja: p('boja'), poruka: 'Odaberi boju naljepnice' });
    if (s.cijena2 !== null && !ima('cijena2')) g.push({ putanja: p('cijena2'), poruka: 'Ova kategorija nema drugu cijenu' });
    if ((s.kolicina || s.kolicina2) && !ima('kolicina')) g.push({ putanja: p('kolicina'), poruka: 'Ova kategorija nema količinu' });
    if (s.kolicina2 && s.cijena2 === null) g.push({ putanja: p('cijena2'), poruka: 'Upiši drugu cijenu ili obriši drugu količinu' });
  });
  return g;
}

/**
 * Cijeli sadržaj: oblik + pravila + sve kategorije iz lokali.mjs (ni jedna više ni manje).
 * @returns {{ ok: true, sadrzaj: z.infer<typeof Sadrzaj> } | { ok: false, greske: { putanja: (string|number)[], poruka: string }[] }}
 */
export function provjeri(ulaz, slikaPostoji) {
  const r = Sadrzaj.safeParse(ulaz);
  if (!r.success) return { ok: false, greske: r.error.issues.map((i) => ({ putanja: i.path, poruka: i.message })) };
  const greske = [];
  const ocekivano = new Set(sveKategorije().map(({ lokal, kat }) => kljucKategorije(lokal.id, kat.kljuc)));
  for (const k of Object.keys(r.data.kategorije)) if (!ocekivano.has(k)) greske.push({ putanja: ['kategorije', k], poruka: 'Nepoznata kategorija' });
  for (const { lokal, kat } of sveKategorije()) {
    const kk = kljucKategorije(lokal.id, kat.kljuc), k = r.data.kategorije[kk];
    if (!k) { greske.push({ putanja: ['kategorije', kk], poruka: 'Nedostaje kategorija' }); continue; }
    for (const e of provjeriKategoriju(kat, k, slikaPostoji)) greske.push({ putanja: ['kategorije', kk, ...e.putanja], poruka: e.poruka });
  }
  return greske.length ? { ok: false, greske } : { ok: true, sadrzaj: r.data };
}

// ---------------- početni sadržaj (iz lokalnih podataka stranice) ----------------
const T = (hr, en) => ({ hr: hr ?? '', en: en && en !== hr ? en : '' });
const Tl = (v) => T(v?.hr, v?.en);

export function pocetniSadrzaj(root = process.cwd()) {
  const jelly = JSON.parse(fs.readFileSync(path.join(root, 'src/data/jelly-menu.json'), 'utf8')).categories;
  const kategorije = {};
  const pastaIzvor = { 'strana-a': LOCAL_SIDE_A, salate: LOCAL_SALADS, prilozi: LOCAL_SIDES };
  for (const { lokal, kat } of sveKategorije()) {
    const kk = kljucKategorije(lokal.id, kat.kljuc);
    if (lokal.id === 'pasta-rhymes') {
      kategorije[kk] = {
        naslov: T(kat.naziv, ''), slika: null, planet: null, napomena: T('', ''),
        stavke: pastaIzvor[kat.kljuc].map((x) => ({
          ...praznoJelo(), naziv: T(x.name, x.nameEn), opis: Tl(x.desc), cijena: x.price,
          slika: kat.polja.includes('slika') ? x.img ?? null : null,
          boja: kat.polja.includes('boja') ? x.color ?? null : null,
          galerija: x.gallery !== false,
        })),
      };
      continue;
    }
    const c = jelly.find((x) => x.id === kat.kljuc);
    if (!c) throw new Error(`jelly-menu.json nema kategoriju ${kat.kljuc}`);
    const stavke = [];
    c.groups.forEach((g, gi) => {
      // naslov skupine ide kad skupina ima naslov/napomenu/preporuku ili nije prva (inače bi se spojila s prethodnom)
      if (g.title || g.note || g.pairing || gi > 0) stavke.push({ id: noviId(), tip: 'skupina', naslov: Tl(g.title), napomena: Tl(g.note), preporuka: Tl(g.pairing) });
      for (const it of g.items) {
        stavke.push({
          ...praznoJelo(), naziv: Tl(it.name), opis: Tl(it.desc), porcija: Tl(it.portion), preporuka: Tl(it.pairing),
          cijena: it.prices[0].amount, kolicina: it.prices[0].size ?? '', cijena2: it.prices[1]?.amount ?? null, kolicina2: it.prices[1]?.size ?? '',
        });
      }
    });
    kategorije[kk] = { naslov: Tl(c.title), slika: c.img ?? null, planet: c.pimg ?? null, napomena: Tl(c.note), stavke };
  }
  return { format: FORMAT, verzija: 1, azurirano: new Date().toISOString(), azurirao: 'početni sadržaj', kategorije };
}

// ---------------- pretvorba u oblik stranice ----------------
const L = (v) => ({ hr: v.hr, en: v.en || v.hr });
const Lnull = (v) => (v?.hr ? L(v) : null);

/** boja teksta na naljepnici: crna ili bijela, što god ima veći kontrast (WCAG) */
export function tinta(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return '#000';
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const n = parseInt(m[1], 16), Y = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (Y + 0.05) / 0.05 >= 1.05 / (Y + 0.05) ? '#000' : '#fff';
}

const jela = (k) => k.stavke.filter((s) => s.tip === 'jelo');

/** Pasta Rhymes: SIDE_A / SALADS / SIDES (src/data/pasta.ts) */
export function uPasta(s) {
  const k = (kljuc) => s.kategorije[kljucKategorije('pasta-rhymes', kljuc)];
  const osnovno = (x) => ({ id: x.id, name: x.naziv.hr, nameEn: x.naziv.en || x.naziv.hr, desc: x.opis.hr ? L(x.opis) : { hr: '', en: '' }, price: x.cijena });
  const SIDE_A = jela(k('strana-a')).map((x) => {
    const color = /^#[0-9a-f]{6}$/i.test(x.boja ?? '') ? x.boja : '#FE0000';
    return { ...osnovno(x), img: x.slika, color, ink: tinta(color), gallery: x.galerija };
  });
  return { SIDE_A, SALADS: jela(k('salate')).map(osnovno), SIDES: jela(k('prilozi')).map(osnovno) };
}

/** Jellyfish in Space: kategorije sa skupinama (src/data/jelly-menu.ts) */
export function uJelly(s) {
  return LOKALI.find((l) => l.id === 'jellyfish-in-space').kategorije.map((kat) => {
    const k = s.kategorije[kljucKategorije('jellyfish-in-space', kat.kljuc)];
    const groups = [];
    let cur = null;
    for (const x of k.stavke) {
      if (x.tip === 'skupina') { cur = { title: Lnull(x.naslov), note: Lnull(x.napomena), pairing: Lnull(x.preporuka), items: [] }; groups.push(cur); continue; }
      if (!cur) { cur = { title: null, note: null, pairing: null, items: [] }; groups.push(cur); }
      const price = (amount, size) => (size ? { amount, size } : { amount });
      cur.items.push({
        id: x.id, name: L(x.naziv), desc: Lnull(x.opis), portion: Lnull(x.porcija), pairing: Lnull(x.preporuka),
        prices: [price(x.cijena, x.kolicina), ...(x.cijena2 !== null ? [price(x.cijena2, x.kolicina2)] : [])],
      });
    }
    return { id: kat.kljuc, title: L(k.naslov), img: k.slika, pimg: k.planet, note: Lnull(k.napomena), groups: groups.filter((g) => g.items.length) };
  });
}

/** Čita podaci/jelovnik.json ako postoji (build stranice). Neispravan sadržaj ruši build — ostaje zadnja ispravna objava. */
export function ucitajZaBuild(root = process.cwd()) {
  const p = path.resolve(root, process.env.UREDNISTVO_PODACI || 'podaci', 'jelovnik.json');
  if (!fs.existsSync(p)) return null;
  const r = provjeri(JSON.parse(fs.readFileSync(p, 'utf8')));
  if (!r.ok) throw new Error(`Uredništvo: neispravan jelovnik (${p}):\n${r.greske.slice(0, 10).map((g) => `  ${g.putanja.join('.')}: ${g.poruka}`).join('\n')}`);
  return r.sadrzaj;
}
