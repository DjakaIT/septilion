// Google recenzije na stranici: odabrao ih je naručitelj (5★), prepisane s Google karata 22.10.2026.
// Duže su skraćene na pohvalni dio (izostavljeno je označeno s "…"), očiti tipfeleri su ispravljeni,
// engleski je prijevod. Datumi se ne prikazuju (zastarjeli bi). Ocjena lokala je s Google karata istog dana.
// Ako uredništvo na hostingu dobije Google API ključ (☰ → Google recenzije), /recenzije.json ih zamijeni svježima
// (src/scripts/core/recenzije.ts) — ovdje se tada ništa ne mijenja.
export type Recenzija = { autor: string; tekst: { hr: string; en: string } };
export type GoogleLokal = { ocjena: number; recenzije: Recenzija[] };

export const GOOGLE_RECENZIJE: Record<'pasta' | 'jelly', GoogleLokal> = {
  pasta: {
    ocjena: 5.0,
    recenzije: [
      {
        autor: 'ivan klepić',
        tekst: {
          hr: 'Interijer fenomenalan, osoblje preljubazno i cool, a hrana je čudesna, takvu tjesteninu nisam nigdje jeo.',
          en: 'Phenomenal interior, super friendly and cool staff, and the food is amazing. I have never had pasta like this anywhere.',
        },
      },
      { autor: 'Anica Valer', tekst: { hr: 'Obilne porcije i top okusi 👍🏻', en: 'Generous portions and top flavours 👍🏻' } },
      { autor: 'Nora Juras', tekst: { hr: 'Bolje od najboljeg 🍝🤌🏻', en: 'Better than the best 🍝🤌🏻' } },
      { autor: 'Mirna Čulja', tekst: { hr: 'Odlično! 👌🏼🤤', en: 'Excellent! 👌🏼🤤' } },
    ],
  },
  jelly: {
    ocjena: 4.6,
    recenzije: [
      {
        autor: 'Dino Dučić',
        tekst: {
          hr: 'Odlično iskustvo! Hrana je bila stvarno ukusna i odlično pripremljena, a cijene su vrlo prihvatljive s obzirom na kvalitetu koju dobijete. … Svakako preporučujem svima koji traže kvalitetnu azijsku kuhinju, ugodnu atmosferu i odličan omjer cijene i kvalitete!',
          en: 'A great experience! The food was really tasty and well prepared, and the prices are very reasonable for the quality you get. … I recommend it to anyone looking for quality Asian food, a pleasant atmosphere and great value for money!',
        },
      },
      {
        autor: 'margaret a',
        tekst: {
          hr: 'Ambijent je baš fora. Konobarica je bila simpatična i strpljiva. Uzele smo bao bunse od svinjetine (3) i sushije (4, nisam sigurna koje) i bilo je taman za 2 curke, a da stane još desert. Bao bunsi su bili predobri!',
          en: 'Really cool vibe. The waitress was sweet and patient. We had the pork bao buns (3) and sushi (4, not sure which ones), just right for two girls with room left for dessert. The bao buns were amazing!',
        },
      },
      {
        autor: 'Mila Skoko',
        tekst: {
          hr: 'Hrana je bila savršena, preporuke za gyoze od svinjetine. Osoblje je ljubazno i profesionalno, a atmosfera ugodna i opuštajuća. Svakako se vraćam.',
          en: 'The food was perfect, I recommend the pork gyoza. The staff are friendly and professional, and the atmosphere is pleasant and relaxed. I will definitely be back.',
        },
      },
      {
        autor: 'Lucija',
        tekst: {
          hr: 'Moja prijateljica i ja smo došle probati njihov ‚neograničeni sushi‘ i to je jedno od najcool iskustava u Zagrebu. Plaća se po osobi, i svaki put kad očistiš tanjur, dobiješ novi. … Definitivno preporučujem, jer neograničeni sushi nije baš čest u Zagrebu!',
          en: 'My friend and I came to try their ‘all-you-can-eat sushi’ and it is one of the coolest experiences in Zagreb. You pay per person, and every time you clear your plate, you get a new one. … Definitely recommended, because all-you-can-eat sushi is not common in Zagreb!',
        },
      },
      {
        autor: 'Anja Pongračić',
        tekst: {
          hr: 'Odlično je sve bilo, rado ćemo se vratiti. Hrana vrhunska, osoblje također. Velike pohvale konobaru Kristijanu (ako sam dobro zapamtila ime), odličan konobar, spreman za šalu, a s druge strane i profesionalan što se tiče posla.',
          en: 'Everything was excellent, we will gladly be back. Top food, and top staff too. Big praise to our waiter Kristijan (if I remember the name right): a great waiter, up for a joke and at the same time thoroughly professional.',
        },
      },
      {
        autor: 'Dora Šango',
        tekst: {
          hr: 'Konobar je bio vrlo ljubazan, vrlo brzo smo dobile hranu. Hrana sama po sebi je fenomenalna … Kokteli su isto odlični 🥰',
          en: 'The waiter was very friendly and the food came very quickly. The food itself is phenomenal … The cocktails are great too 🥰',
        },
      },
    ],
  },
};

/** ocjena kao na Googleu: 4,6 (hr) / 4.6 (en) */
export const ocjenaTekst = (n: number, lang: 'hr' | 'en') => (lang === 'hr' ? n.toFixed(1).replace('.', ',') : n.toFixed(1));
/** navodnici oko teksta recenzije */
export const navodnici = (lang: 'hr' | 'en') => (lang === 'hr' ? ['„', '”'] : ['“', '”']);
