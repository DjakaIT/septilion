// Pretvara izvorne jelovnike (src/data/source/hrvatski_jelly_menu.md + english_jelly_menu.md)
// u strukturirane podatke src/data/jelly-menu.json. Datoteke su poravnate redak po redak,
// pa se engleski tekst uzima s istog retka kao hrvatski. Ispravke prema PDF-u: ./corrections.mjs
//
// Pokretanje: npm run menu
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINE_PRICES, MOVE_TO_JELLY_SUSHI, PAIRING_FIX, GROUP_PAIRING, TYPOS } from './corrections.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => fs.readFileSync(path.join(root, 'src/data/source', f), 'utf8').replace(/\r/g, '').split('\n');
const HR = read('hrvatski_jelly_menu.md');
const EN = read('english_jelly_menu.md');
if (HR.length !== EN.length) throw new Error(`hr/en nisu poravnati: ${HR.length} vs ${EN.length}`);

const fixTypos = (s) => TYPOS.reduce((t, [a, b]) => t.split(a).join(b), s);
const bi = (i) => ({ hr: fixTypos(HR[i].trim()), en: fixTypos(EN[i].trim()) });
const mapBi = (o, f) => ({ hr: f(o.hr, 'hr'), en: f(o.en, 'en') });

// ---------- blokovi odvojeni praznim retkom ----------
const blocks = [];
for (let i = 0, cur = null; i <= HR.length; i++) {
  if (i === HR.length || HR[i].trim() === '') { if (cur) blocks.push(cur); cur = null; }
  else (cur ||= []).push(i);
}

// ---------- naslovi kategorija i skupina ----------
const CATS = [
  { id: 'predjela', title: { hr: 'Predjela', en: 'Appetizers' }, img: 'jf_tacos', kind: 'food' },
  { id: 'glavna-jela', title: { hr: 'Glavna jela', en: 'Main courses' }, img: 'jf_nachos', kind: 'food' },
  { id: 'jelly-bowl', title: { hr: 'Jelly Bowl', en: 'Jelly Bowl' }, img: 'jf_poke', kind: 'food' },
  { id: 'plate', title: { hr: 'Plate', en: 'Platters' }, img: 'jf_platter', kind: 'plate' },
  { id: 'jelly-sushi', title: { hr: 'Jelly Sushi', en: 'Jelly Sushi' }, img: 'jf_sushi', kind: 'food' },
  { id: 'sushi', title: { hr: 'Sushi', en: 'Sushi' }, img: 'jf_nigiri', kind: 'food' },
  { id: 'prilozi', title: { hr: 'Prilozi', en: 'Extras' }, pimg: 'jf_bowl', kind: 'list' },
  { id: 'desert', title: { hr: 'Desert', en: 'Dessert' }, kind: 'food' },
  { id: 'kokteli', title: { hr: 'Kokteli', en: 'Cocktails' }, img: 'jf_mart2', kind: 'drink' },
  { id: 'pica', title: { hr: 'Pića', en: 'Drinks' }, img: 'jf_oldf', kind: 'drink' },
];
// hr naslov u .md -> [kategorija, skupina (hr/en) ili null, vrsta parsera]
const HEADINGS = {
  'PREDJELA': ['predjela'], 'GLAVNA JELA': ['glavna-jela'], 'JELLY BOWL': ['jelly-bowl'], 'PLATE': ['plate'],
  'JELLY SUSHI': ['jelly-sushi'], 'SUSHI': ['sushi'], 'PRILOZI': ['prilozi'], 'DESERT': ['desert'],
  'KOKTELI — BUBBLY': ['kokteli', { hr: 'Bubbly', en: 'Bubbly' }],
  'ALL TIME FAVOURITES': ['kokteli', { hr: 'All Time Favourites', en: 'All Time Favourites' }],
  'JELLY JAM SESSIONS': ['kokteli', { hr: 'Jelly Jam Sessions', en: 'Jelly Jam Sessions' }],
  'COCKTAILS': ['kokteli', { hr: 'Cocktails', en: 'Cocktails' }],
  'APERITIVO': ['kokteli', { hr: 'Aperitivo', en: 'Aperitivo' }],
  'MOCKTAILS (ALCOHOL FREE)': ['kokteli', { hr: 'Mocktails (bez alkohola)', en: 'Mocktails (alcohol free)' }],
  'VINA': ['pica', null, 'skip'],
  'BIJELA VINA': ['pica', { hr: 'Bijela vina', en: 'White wine' }, 'wine'],
  'CRVENA VINA': ['pica', { hr: 'Crvena vina', en: 'Red wine' }, 'wine'],
  'ROSÉ': ['pica', { hr: 'Rosé', en: 'Rosé wine' }, 'wine'],
  'ŠAMPANJCI': ['pica', { hr: 'Šampanjci', en: 'Champagne' }, 'wine'],
  'PJENUŠAVA VINA': ['pica', { hr: 'Pjenušava vina', en: 'Sparkling wine' }, 'wine'],
  'LIKERi': ['pica', { hr: 'Likeri', en: 'Liqueurs' }, 'spirit'],
  'RAKIJE': ['pica', { hr: 'Rakije', en: 'Schnapps' }, 'spirit'],
  'VODKA': ['pica', { hr: 'Vodka', en: 'Vodka' }, 'spirit'],
  'GIN': ['pica', { hr: 'Gin', en: 'Gin' }, 'spirit'],
  'RUM': ['pica', { hr: 'Rum', en: 'Rum' }, 'spirit'],
  'WHISKEY': ['pica', { hr: 'Whiskey', en: 'Whiskey' }, 'spirit'],
  'TEQUILLA': ['pica', { hr: 'Tequila', en: 'Tequila' }, 'spirit'],
  'COGNAC / BRANDY': ['pica', { hr: 'Cognac / Brandy', en: 'Cognac / Brandy' }, 'spirit'],
  'TOPLI NAPITCI': ['pica', { hr: 'Topli napitci', en: 'Hot drinks' }, 'spirit'],
  'VODA': ['pica', { hr: 'Voda', en: 'Water' }, 'spirit'],
  'PIVA': ['pica', { hr: 'Pivo', en: 'Beer' }, 'spirit'],
  'BEZALKOHOLNA PIĆA': ['pica', { hr: 'Bezalkoholna pića', en: 'Soft drinks' }, 'spirit'],
};

// ---------- pomoćne funkcije ----------
const KEEP_CASE = [['bbq', 'BBQ'], ['black angus', 'Black Angus'], ['milky way', 'Milky Way'], ['sushi dream', 'Sushi Dream']];
const sentence = (s) => {
  let t = s.toLowerCase();
  for (const [a, b] of KEEP_CASE) t = t.split(a).join(b);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const parsePrice = (s) => {
  const m = s.trim().match(/^(\d+(?:,\d+)?)\s*€$/);
  if (!m) throw new Error(`Nije cijena: "${s}"`);
  return Number(m[1].replace(',', '.'));
};
const size = (s) => s.trim().replace(/\s*L$/i, '').trim() + ' l';
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const portionOf = (s) => {
  // "(3 KOM)" / "(4 ILI 8 ZALOGAJA)" / "(1 ZALOGAJ)" -> "3 kom", "4 ili 8 zalogaja"
  const m = s.trim().match(/^\((.+)\)$/);
  return m ? m[1].toLowerCase() : null;
};
const isPortion = (i) => /^\(.+\)$/.test(HR[i].trim());
const isPairing = (i) => /^Preporuka uz jelo:/i.test(HR[i].trim());
const VARIANTS = new Set(['VEGE', 'PORK', 'PILETINA']);
const pairingOf = (i) => mapBi(bi(i), (s) => s.replace(/^(Preporuka uz jelo|Recommended with):\s*/i, '')
  .replace(/ Ili /g, ' ili ').replace(/ Or /g, ' or '));

// ---------- parseri po vrsti ----------
function parseFood(b, kind) {
  const [head, ...rest] = b;
  const parts = bi(head);
  const segH = parts.hr.split(' / '), segE = parts.en.split(' / ');
  let name = { hr: segH[0], en: segE[0] };
  const prices = segH.slice(1).map((p) => ({ amount: parsePrice(p) }));
  let portion = null;
  // porcija u samom nazivu: "GYOZE APPLE SA SLADOLEDOM (5 KOM)"
  const inName = name.hr.match(/\s*\((\d+ KOM)\)$/);
  if (inName) {
    portion = { hr: inName[1].toLowerCase(), en: name.en.match(/\((\d+ PCS)\)/)[1].toLowerCase() };
    name = mapBi(name, (s) => s.replace(/\s*\(\d+ (KOM|PCS)\)$/, ''));
  }
  let variant = null, pairing = null; const desc = [];
  for (const i of rest) {
    if (isPortion(i)) portion = mapBi(bi(i), portionOf);
    else if (isPairing(i)) pairing = pairingOf(i);
    else if (VARIANTS.has(HR[i].trim())) variant = bi(i);
    else desc.push(i);
  }
  if (variant) name = { hr: `${name.hr} ${variant.hr}`, en: `${name.en} ${variant.en}` };
  let d = null;
  if (desc.length) {
    if (kind === 'plate') {
      // sadržaj plate: ili po jedna stavka u retku ili prelomljena rečenica (Milky Way, retci završavaju zarezom)
      const join = (lang) => {
        const lines = desc.map((i) => (lang === 'hr' ? HR : EN)[i].trim());
        return lines.some((l) => l.endsWith(',')) ? lines.join(' ') : lines.join(', ');
      };
      d = mapBi({ hr: fixTypos(join('hr')), en: fixTypos(join('en')) }, (s) => sentence(s.replace(/,\s*$/, '')));
    } else {
      d = mapBi({ hr: desc.map((i) => bi(i).hr).join(' '), en: desc.map((i) => bi(i).en).join(' ') }, sentence);
    }
  }
  return {
    key: HR[head].split(' / ')[0].trim(),
    name: mapBi(name, sentence),
    desc: d, portion, pairing, prices,
  };
}
function parseListBlock(b) {
  // Prilozi: svaki redak "NAZIV / CIJENA"
  return b.map((i) => {
    const h = bi(i).hr.split(' / '), e = bi(i).en.split(' / ');
    return { key: h[0], name: { hr: sentence(h[0]), en: sentence(e[0]) }, desc: null, portion: null, pairing: null, prices: [{ amount: parsePrice(h[1]) }] };
  });
}
function parseDrink(b) {
  const [head, ...rest] = b;
  const h = bi(head).hr.split(' / '), e = bi(head).en.split(' / ');
  return {
    key: h[0], name: { hr: h[0], en: e[0] },
    desc: rest.length ? { hr: rest.map((i) => bi(i).hr).join(' '), en: rest.map((i) => bi(i).en).join(' ') } : null,
    portion: null, pairing: null, prices: [{ amount: parsePrice(h[1]) }],
  };
}
function parseWine(b) {
  // "Naziv / 0,75 L / 50,00 €" — cijene iz PDF-a (corrections.WINE_PRICES)
  return b.filter((i) => / \/ /.test(HR[i])).map((i) => {
    const name = bi(i).hr.split(' / ')[0];
    const p = WINE_PRICES[name];
    if (!p) throw new Error(`Nema cijene iz PDF-a za vino "${name}"`);
    const prices = [];
    if (p[0] != null) prices.push({ amount: p[0], size: '0,1 l' });
    prices.push({ amount: p[1], size: '0,75 l' });
    return { key: name, name: { hr: name, en: bi(i).en.split(' / ')[0] }, desc: null, portion: null, pairing: null, prices };
  });
}
function parseSpirit(b) {
  // "Naziv / 4,00 € / 0,03" ili "Kava / 2,00 €"; redak "(…)" ispod je opis prethodne stavke
  const out = [];
  for (const i of b) {
    const t = bi(i);
    if (/^\(.+\)$/.test(t.hr)) { out[out.length - 1].desc = mapBi(t, (s) => s.slice(1, -1)); continue; }
    const h = t.hr.split(' / '), e = t.en.split(' / ');
    const price = { amount: parsePrice(h[1]) };
    if (h[2]) price.size = size(h[2]);
    out.push({ key: h[0], name: { hr: h[0], en: e[0] }, desc: null, portion: null, pairing: null, prices: [price] });
  }
  return out;
}

// ---------- prolaz kroz blokove ----------
const cats = Object.fromEntries(CATS.map((c) => [c.id, { ...c, note: null, groups: [] }]));
let cat = null, group = null, mode = null;
const open = (catId, title, m) => {
  cat = cats[catId]; mode = m || cat.kind;
  group = { title: title || null, note: null, pairing: null, items: [] };
  cat.groups.push(group);
};
for (const b of blocks) {
  const first = HR[b[0]].trim();
  if (HEADINGS[first] && b.length === 1) {
    const [catId, title, m] = HEADINGS[first];
    if (m === 'skip') { mode = 'skip'; continue; }
    open(catId, title, m);
    continue;
  }
  if (mode === 'skip') continue;
  if (/^0,1 L$/.test(first)) continue; // stupac čaša — cijene dolaze iz PDF-a
  if (/^Extra Zalogaji/i.test(first)) {
    cat.note = mapBi({ hr: b.map((i) => bi(i).hr).join(' '), en: b.map((i) => bi(i).en).join(' ') },
      (s) => sentence(s).replace(' - ', ' – '));
    continue;
  }
  if (mode === 'food' || mode === 'plate') group.items.push(parseFood(b, mode));
  else if (mode === 'list') group.items.push(...parseListBlock(b));
  else if (mode === 'drink') group.items.push(parseDrink(b));
  else if (mode === 'wine') group.items.push(...parseWine(b));
  else if (mode === 'spirit') group.items.push(...parseSpirit(b));
}

// ---------- ispravke strukture prema PDF-u ----------
const sushi = cats['sushi'].groups[0].items, jelly = cats['jelly-sushi'].groups[0];
for (const key of MOVE_TO_JELLY_SUSHI) {
  const idx = sushi.findIndex((x) => x.key === key);
  if (idx < 0) throw new Error(`Nema stavke ${key} u Sushiju`);
  jelly.items.push(...sushi.splice(idx, 1));
}
for (const it of jelly.items) if (it.key in PAIRING_FIX) it.pairing = PAIRING_FIX[it.key];
jelly.pairing = GROUP_PAIRING['jelly-sushi'];
jelly.note = { hr: '4 ili 8 zalogaja', en: '4 or 8 bites' };
// Sushi: Nigiri (skupina s preporukom) · sashimi i gunkan · Uramaki (4 ili 8 zalogaja)
{
  const all = cats['sushi'].groups[0].items;
  const nig = all.filter((x) => /NIGIRI/.test(x.key));
  const ura = all.filter((x) => /URAMAKI/.test(x.key));
  const other = all.filter((x) => !nig.includes(x) && !ura.includes(x));
  for (const x of nig) x.pairing = null;
  cats['sushi'].groups = [
    { title: { hr: 'Nigiri', en: 'Nigiri' }, note: { hr: '1 zalogaj', en: '1 bite' }, pairing: GROUP_PAIRING['nigiri'], items: nig },
    { title: null, note: null, pairing: null, items: other },
    { title: { hr: 'Uramaki', en: 'Uramaki' }, note: { hr: '4 ili 8 zalogaja', en: '4 or 8 bites' }, pairing: null, items: ura },
  ];
}

// ---------- id-jevi, čišćenje, provjera ----------
const seen = new Set();
const out = {
  generated: 'npm run menu — ne uređivati ručno; izvor: src/data/source/*.md + scripts/menu/corrections.mjs',
  categories: CATS.map((c) => {
    const k = cats[c.id];
    return {
      id: k.id, title: k.title, img: k.img || null, pimg: k.pimg || null, note: k.note,
      groups: k.groups.filter((g) => g.items.length).map((g) => ({
        title: g.title, note: g.note || null, pairing: g.pairing || null,
        items: g.items.map(({ key, ...it }) => {
          let id = `${k.id}-${slug(it.name.hr)}`, n = 2;
          while (seen.has(id)) id = `${k.id}-${slug(it.name.hr)}-${n++}`;
          seen.add(id);
          for (const p of it.prices) if (!(p.amount > 0)) throw new Error(`Cijena ${id}`);
          return { id, ...it };
        }),
      })),
    };
  }),
};
const count = out.categories.reduce((a, c) => a + c.groups.reduce((b, g) => b + g.items.length, 0), 0);
fs.writeFileSync(path.join(root, 'src/data/jelly-menu.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`jelly-menu.json: ${count} stavki`);
for (const c of out.categories) console.log(`  ${c.id.padEnd(12)} ${c.groups.map((g) => (g.title?.hr || '·') + ':' + g.items.length).join('  ')}`);
