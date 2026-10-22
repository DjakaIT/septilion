// Sadržaj uredništva: početni sadržaj, provjera pravila po kategoriji, pretvorba u oblik stranice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pocetniSadrzaj, provjeri, uPasta, uJelly, tinta, praznoJelo, migriraj, FORMAT, ZADANE_FOTOGRAFIJE_JELA } from '../../src/data/sadrzaj.mjs';
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
  // fotografije jela (galerija) nisu u jelly-menu.json: zadane su prema nazivu
  const sJelima = j.flatMap((c) => c.groups.flatMap((g) => g.items)).filter((i) => i.img);
  assert.deepEqual(sJelima.map((i) => i.img).sort(), Object.values(ZADANE_FOTOGRAFIJE_JELA).sort(), 'svaka zadana fotografija ima svoje jelo');
  assert.ok(sJelima.every((i) => i.gallery));
  const bezId = (c) => JSON.parse(JSON.stringify(c, (k, v) => (k === 'id' && typeof v === 'string' && v.length === 12 ? undefined : k === 'img' && v !== null && typeof v !== 'string' ? undefined : v)));
  for (const c of j) for (const g of c.groups) for (const i of g.items) { delete i.img; delete i.gallery; }
  // planet deserta je zadan (sadrzaj.mjs ZADANI_PLANETI) dok ga urednik ne postavi
  const lokalno = jelly.categories.map((c) => ({ ...c, pimg: c.pimg ?? (c.id === 'desert' ? 'jf_desert' : null), groups: c.groups.map((g) => ({ ...g, items: g.items.map(({ id, ...it }) => it) })) }));
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

test('nadogradnja formata 1 -> 2: jela Jellyfisha bez fotografije dobiju zadanu prema nazivu, ništa drugo se ne mijenja', () => {
  assert.equal(FORMAT, 2);
  const s = pocetni();
  const stari = structuredClone(s); stari.format = 1;
  const jela = (x) => Object.entries(x.kategorije).filter(([kk]) => kk.startsWith('jellyfish-in-space/')).flatMap(([, k]) => k.stavke.filter((i) => i.tip === 'jelo'));
  for (const x of jela(stari)) x.slika = null;
  const tacos = jela(stari).find((x) => x.naziv.hr === 'Tacos beef');
  tacos.naziv.hr = '  tacos   BEEF '; // velika slova i razmaci nisu bitni
  const vlastita = jela(stari).find((x) => x.naziv.hr === 'Tuna tartare'); vlastita.slika = 'n-0123456789abcdef01234567';
  const prije = JSON.stringify(stari);
  const m = migriraj(stari);
  assert.equal(JSON.stringify(stari), prije, 'ulaz se ne mijenja');
  assert.equal(m.format, 2);
  assert.equal(jela(m).find((x) => x.naziv.hr === '  tacos   BEEF ').slika, 'jf_jelo_tacos_beef');
  assert.equal(jela(m).find((x) => x.naziv.hr === 'Tuna tartare').slika, 'n-0123456789abcdef01234567', 'urednikova fotografija ostaje');
  assert.equal(jela(m).filter((x) => x.slika).length, Object.keys(ZADANE_FOTOGRAFIJE_JELA).length);
  assert.deepEqual(m.kategorije['pasta-rhymes/strana-a'], s.kategorije['pasta-rhymes/strana-a'], 'Pasta se ne dira');
  // format 2 (urednik je maknuo fotografiju) ostaje kakav jest; provjera prima i stari format
  const novi = structuredClone(m); jela(novi)[0].slika = null;
  assert.equal(migriraj(novi), novi);
  assert.ok(provjeri(stari, () => true).ok);
  assert.ok(!provjeri({ ...stari, format: 3 }, () => true).ok, 'nepoznat format se odbija');
});
