// Lokali i kategorije jelovnika koje uredništvo prikazuje (dijele ga stranica, poslužitelj uredništva i testovi).
// Ključevi kategorija su stalni: ulaze u id-eve na stranici (npr. #list-pica). Kategorije se u uredništvu
// ne dodaju ni brišu (orbita i kaseta računaju na njih), samo se uređuje njihov sadržaj.

/**
 * @typedef {'naslov'|'slikaKategorije'|'planet'|'napomena'|'skupine'|'slika'|'slikaJela'|'boja'|'galerija'|'porcija'|'preporuka'|'kolicina'|'cijena2'} Polje
 * @typedef {{ kljuc: string, naziv: string, polja: Polje[] }} KategorijaKonfig
 * @typedef {{ id: 'pasta-rhymes'|'jellyfish-in-space', naziv: string, kategorije: KategorijaKonfig[] }} LokalKonfig
 */

/** boje naljepnica kaseta (prototip v4) — jedine dopuštene za jela sa Strane A */
export const BOJE = [
  { naziv: 'Žuta', vrijednost: '#FFCE53' },
  { naziv: 'Narančasta', vrijednost: '#FF8800' },
  { naziv: 'Plava', vrijednost: '#63CFFE' },
  { naziv: 'Zelena', vrijednost: '#108A11' },
  { naziv: 'Krem', vrijednost: '#F5EAD4' },
  { naziv: 'Ljubičasta', vrijednost: '#8B3A96' },
  { naziv: 'Crvena', vrijednost: '#FE0000' },
];

// slika = obavezna fotografija jela (Pasta, kaseta); slikaJela = neobavezna (Jellyfish: jela s fotografijom idu u galeriju)
/** @type {Polje[]} */
const JELLY = ['naslov', 'slikaKategorije', 'planet', 'napomena', 'skupine', 'slikaJela', 'galerija', 'porcija', 'preporuka', 'kolicina', 'cijena2'];

/** @type {LokalKonfig[]} */
export const LOKALI = [
  {
    id: 'pasta-rhymes',
    naziv: 'Pasta Rhymes',
    kategorije: [
      { kljuc: 'strana-a', naziv: 'Strana A — paste', polja: ['slika', 'boja', 'galerija'] },
      { kljuc: 'salate', naziv: 'Strana B — salate', polja: [] },
      { kljuc: 'prilozi', naziv: 'Strana B — prilozi', polja: [] },
    ],
  },
  {
    id: 'jellyfish-in-space',
    naziv: 'Jellyfish in Space',
    kategorije: ['predjela', 'glavna-jela', 'jelly-bowl', 'plate', 'jelly-sushi', 'sushi', 'prilozi', 'desert', 'kokteli', 'pica']
      .map((kljuc) => ({ kljuc, naziv: '', polja: [...JELLY] })), // naziv = naslov iz sadržaja (uređuje se)
  },
];

/** ključ kategorije u sadržaju, npr. "pasta-rhymes/strana-a" */
export const kljucKategorije = (/** @type {string} */ lokal, /** @type {string} */ kljuc) => `${lokal}/${kljuc}`;

/** @returns {{ lokal: LokalKonfig, kat: KategorijaKonfig }[]} sve kategorije redom */
export const sveKategorije = () => LOKALI.flatMap((lokal) => lokal.kategorije.map((kat) => ({ lokal, kat })));
