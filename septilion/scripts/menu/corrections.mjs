// Ispravke izvornih .md jelovnika (src/data/source/*.md) prema PDF-u "09-2026 Menu.pdf".
// PDF je izvor istine za cijene (odluka naručitelja, 01.10.2026.). Svaka ispravka je ovdje
// zapisana da se može provjeriti i, ako treba, poništiti.

// Cijene vina iz PDF-a, str. 17: [0,1 L, 0,75 L]; null = nema čaše.
// .md je za bijela i crvena vina imao drukčije cijene boca od PDF-a.
export const WINE_PRICES = {
  'Jakovac Graševina': [5, 30],
  'Bertoša Malvazija': [5, 30],
  'Cantina Terlano Pinot Grigio': [null, 45],
  'Sette Ponti Vermentino': [6.5, 40],
  'M. Molitor Pinot Blanc Haus Klosterberg': [null, 40],
  'Masciarelli Gianni Trebbiano': [6, 35],
  'Marques De Riscal Verdejo': [5, 30],
  'Festigia Malvazija': [6, 35],
  'Puhelek Sauvignon': [6, 38],
  'Jakovac Chardonnay Mystique': [6.5, 40],
  "Chambre d'Amour": [6.5, 40],
  'Tunella Pinot Nero': [null, 50],
  'Korlat Syrah': [6.5, 40],
  'Korlat Merlot': [6.5, 40],
  'Matsu El Picaro': [6, 35],
  'La Vie En Rosé': [6.5, 40],
  'Jakovac Rosé': [6, 35],
  'Lanson Green Label Bio – Organic': [null, 170],
  'Lanson Le Rose Creation': [null, 150],
  'Lanson Le Black Creation': [16, 100],
  'La Dolce Italia Prosecco': [5, 30],
  'Kolarić Coletti Blanc Nature': [6, 40],
  'Bertoša Rose Pjenušac': [null, 55],
  'Meneghetti Classic': [null, 65],
};

// U PDF-u (str. 7) ove role stoje u stupcu "Jelly Sushi"; .md ih je stavio pod "Sushi".
export const MOVE_TO_JELLY_SUSHI = [
  'RAINBOW ROLL', 'CRISPY LOSOS', 'MANGO ROLL', 'KARAGE ROLL', 'TUNA OLIVE ROLL', 'TUNA SUSHI TAQUITOS',
];

// Preporuke vina u PDF-u (str. 7): .md je preporuku za Salmon Fig prebacio na Mango Curry Ebi,
// a preporuku cijele skupine (Jelly Sushi, Nigiri) prepisao na prvu stavku ili izostavio.
export const PAIRING_FIX = {
  'SALMON FIG & CHEESE ROLL': { hr: 'Puhelek Sauvignon, Jakovac Mystique Chardonnay', en: 'Puhelek Sauvignon, Jakovac Mystique Chardonnay' },
  'MANGO CURRY EBI': null,
};
export const GROUP_PAIRING = {
  'jelly-sushi': { hr: 'Jakovac Graševina, Bertoša Malvazija', en: 'Jakovac Graševina, Bertoša Malvazija' },
  'nigiri': { hr: 'Jakovac Graševina, Bertoša Malvazija', en: 'Jakovac Graševina, Bertoša Malvazija' },
};

// Očiti tipfeleri iz izvora (većina postoji i u PDF-u). Primjenjuju se na sav tekst, točno po riječi.
export const TYPOS = [
  ['Avokado uss', 'Avokado mus'],
  ['Mladil luk', 'Mladi luk'],
  ['Riža, osos,', 'Riža, losos,'],
  ['Souvignon', 'Sauvignon'],
  ['Sauvgnon', 'Sauvignon'],
  ['Cocktaill', 'Cocktail'],
  ['CocaCcola', 'Coca-Cola'],
  ['Hennesy', 'Hennessy'],
  ['Prosseco', 'Prosecco'],
  ['Lavander Spritz', 'Lavender Spritz'],
  ['Jagermaister', 'Jägermeister'],
  ['Cherry Yam', 'Cherry Jam'],
  ['´S ', "'s "],
  ['´S', "'s"],
  ['D´Amour', "d'Amour"],
  [' Y0', ' YO'],
  ['Mistique', 'Mystique'],
  ['Ice cream bourbon vanilija', 'Bourbon vanilla ice cream'],
];
