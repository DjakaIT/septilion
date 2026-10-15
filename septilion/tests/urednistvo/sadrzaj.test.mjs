// Sadržaj uredništva: početni sadržaj, provjera pravila po kategoriji, pretvorba u oblik stranice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pocetniSadrzaj, provjeri, uPasta, uJelly, tinta, praznoJelo } from '../../src/data/sadrzaj.mjs';
import { LOCAL_SIDE_A, LOCAL_SALADS } from '../../src/data/pasta-local.mjs';
import jelly from '../../src/data/jelly-menu.json' with { type: 'json' };

const pocetni = () => pocetniSadrzaj();
const strana = (s) => s.kategorije['pasta-rhymes/strana-a'];
const pica = (s) => s.kategorije['jellyfish-in-space/pica'];
const greske = (s) => { const r = provjeri(s, () => true); return r.ok ? [] : r.greske.map((g) => `${g.putanja.slice(1).join('.')}: ${g.poruka}`); };

test('početni sadržaj je ispravan i u stranici daje iste podatke kao lokalni', () => {
  const s = pocetni();
  assert.deepEqual(greske(s), []);
  const p = uPasta(s);
  assert.deepEqual(p.SIDE_A.map((x) => [x.name, x.price, x.img, x.color, x.ink, x.gallery]), LOCAL_SIDE_A.map((x) => [x.name, x.price, x.img, x.color, x.ink, x.gallery !== false]));
  assert.deepEqual(p.SALADS.map((x) => [x.name, x.nameEn, x.desc]), LOCAL_SALADS.map((x) => [x.name, x.nameEn, x.desc]));
  const j = uJelly(s);
  const bezId = (c) => JSON.parse(JSON.stringify(c, (k, v) => (k === 'id' && typeof v === 'string' && v.length === 12 ? undefined : v)));
  const lokalno = jelly.categories.map((c) => ({ ...c, groups: c.groups.map((g) => ({ ...g, items: g.items.map(({ id, ...it }) => it) })) }));
  assert.deepEqual(bezId(j), lokalno);
});

test('pravila: naziv, cijena, fotografija i boja paste, skupine samo gdje postoje', () => {
  const s = pocetni();
  strana(s).stavke[0].naziv.hr = '';
  strana(s).stavke[1].slika = null;
  strana(s).stavke[2].boja = '#123456';
  s.kategorije['pasta-rhymes/salate'].stavke.push({ id: 'skupina0001', tip: 'skupina', naslov: { hr: 'X', en: '' }, napomena: { hr: '', en: '' }, preporuka: { hr: '', en: '' } });
  const g = greske(s);
  assert.ok(g.some((x) => x.includes('strana-a.stavke.0.naziv.hr')), g.join('\n'));
  assert.ok(g.some((x) => x.includes('strana-a.stavke.1.slika')));
  assert.ok(g.some((x) => x.includes('strana-a.stavke.2.boja')));
  assert.ok(g.some((x) => x.includes('nema skupine')));
});

test('oblik: kriva cijena, nepoznato polje, predugačak tekst, kriv ključ slike, prazna kategorija', () => {
  for (const [promjena, ocek] of [
    [(s) => { strana(s).stavke[0].cijena = 0; }, /cijena/],
    [(s) => { strana(s).stavke[0].cijena = 8.999; }, /cijena/],
    [(s) => { strana(s).stavke[0].zlo = '<script>'; }, /stavke\.0/],
    [(s) => { strana(s).stavke[0].opis.hr = 'x'.repeat(601); }, /opis/],
    [(s) => { strana(s).stavke[0].slika = '../../etc/passwd'; }, /slika/],
    [(s) => { pica(s).stavke = pica(s).stavke.filter((x) => x.tip === 'skupina'); }, /barem jedno jelo/],
    [(s) => { delete s.kategorije['jellyfish-in-space/desert']; }, /Nedostaje kategorija/],
    [(s) => { s.kategorije['jellyfish-in-space/novo'] = s.kategorije['jellyfish-in-space/desert']; }, /Nepoznata kategorija/],
  ]) {
    const s = pocetni(); promjena(s);
    assert.match(greske(s).join('\n') || 'OK', ocek);
  }
});

test('skupine: ravan popis -> skupine; jela prije prvog naslova su skupina bez naslova; prazne se izbacuju', () => {
  const s = pocetni();
  const jelo = (naziv, c, kol) => ({ ...praznoJelo(), naziv: { hr: naziv, en: '' }, cijena: c, kolicina: kol ?? '' });
  pica(s).stavke = [
    jelo('Voda', 2),
    { id: 'skupina0001', tip: 'skupina', naslov: { hr: 'Whiskey', en: '' }, napomena: { hr: '0,03 l', en: '' }, preporuka: { hr: '', en: '' } },
    { ...jelo('Jameson', 5, '0,03 l'), cijena2: 60, kolicina2: '0,7 l' },
    { id: 'skupina0002', tip: 'skupina', naslov: { hr: 'Prazna', en: '' }, napomena: { hr: '', en: '' }, preporuka: { hr: '', en: '' } },
  ];
  assert.deepEqual(greske(s), []);
  const g = uJelly(s).find((c) => c.id === 'pica').groups;
  assert.equal(g.length, 2);
  assert.equal(g[0].title, null);
  assert.deepEqual(g[1].title, { hr: 'Whiskey', en: 'Whiskey' });
  assert.deepEqual(g[1].items[0].prices, [{ amount: 5, size: '0,03 l' }, { amount: 60, size: '0,7 l' }]);
});

test('tinta naljepnice po kontrastu (sve boje iz prototipa)', () => {
  for (const [c, t] of [['#FFCE53', '#000'], ['#FF8800', '#000'], ['#63CFFE', '#000'], ['#108A11', '#000'], ['#F5EAD4', '#000'], ['#8B3A96', '#fff'], ['#FE0000', '#000']]) assert.equal(tinta(c), t, c);
});
