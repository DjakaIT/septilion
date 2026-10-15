// Česta pitanja — iz prototipa v4 (hr), engleski prijevod. FAQPage JSON-LD gradi se iz ovih istih podataka.
import { JELLY_MENU_PDF } from '../site.config.mjs';

type L = { hr: string; en: string };
export type Faq = { q: L; a: L; link?: { href: string; label: L } };

export const FAQ_PASTA: Faq[] = [
  { q: { hr: 'Gdje se nalazi Pasta Rhymes?', en: 'Where is Pasta Rhymes?' },
    a: { hr: 'Pasta Rhymes je u Ulici Pavla Hatza 5, na uglu s Petrinjskom, u centru Zagreba. Traži crno-crveni lokal preko puta beertije i kluba Kluba.',
         en: 'Pasta Rhymes is at Ulica Pavla Hatza 5, on the corner with Petrinjska, in central Zagreb. Look for the black-and-red place across from the beer bar and the club Klub.' } },
  { q: { hr: 'Imate li dostavu?', en: 'Do you deliver?' },
    a: { hr: 'Da, cijeli jelovnik Pasta Rhymesa dostavlja Wolt.', en: 'Yes, Wolt delivers the full Pasta Rhymes menu.' } },
  { q: { hr: 'Je li tjestenina domaća?', en: 'Is the pasta homemade?' },
    a: { hr: 'Da, sve tjestenine na jelovniku su domaće: conchigliette, conchiglie, tagliatelle, rigatoni, fusili i spaghetti. Bez vrećica s police.',
         en: 'Yes, every pasta on the menu is made in house: conchigliette, conchiglie, tagliatelle, rigatoni, fusilli and spaghetti. No bags off the shelf.' } },
  { q: { hr: 'Imate li jela bez mesa?', en: 'Do you have meat-free dishes?' },
    a: { hr: 'Da, bez mesa su Aglio olio e peperoncino i Arrabiata, a od salata Tricolore, Caprino i Primavera.',
         en: 'Yes: Aglio olio e peperoncino and Arrabiata, plus the Tricolore, Caprino and Primavera salads.' } },
  { q: { hr: 'Mogu li sam birati glazbu?', en: 'Can I pick the music?' },
    a: { hr: 'Da, u Pasta Rhymesu gosti sami biraju ploču: uz gramofon stoji kolekcija vinila. Dok čekaš paštu, ti si DJ.',
         en: "Yes, at Pasta Rhymes guests pick the record: there's a vinyl collection next to the turntable. While you wait for your pasta, you're the DJ." } },
];

export const FAQ_JELLY: Faq[] = [
  { q: { hr: 'Gdje se nalazi Jellyfish in Space?', en: 'Where is Jellyfish in Space?' },
    a: { hr: 'Jellyfish in Space je u Martićevoj ulici 71 u Zagrebu.', en: 'Jellyfish in Space is at Martićeva ulica 71 in Zagreb.' } },
  { q: { hr: 'Imate li dostavu?', en: 'Do you deliver?' },
    a: { hr: 'Da, Jellyfish in Space dostavlja preko Wolta, i sushi i street food. Koktele ipak piješ kod nas.',
         en: 'Yes, Jellyfish in Space delivers through Wolt, sushi and street food alike. The cocktails, though, you drink at our place.' } },
  { q: { hr: 'Imate li jela bez mesa i ribe?', en: 'Do you have dishes without meat or fish?' },
    a: { hr: 'Da: Vege bowl, Gyoza vege, Spring roll vege i Uramaki vege.', en: 'Yes: Vege bowl, Gyoza vege, Spring roll vege and Uramaki vege.' } },
  { q: { hr: 'Mogu li cijeli jelovnik vidjeti u PDF-u?', en: 'Can I see the full menu as a PDF?' },
    a: { hr: 'Da. Cijeli jelovnik s pićima, isti kao u lokalu:', en: 'Yes. The full food and drinks menu, the same one you get at the bar:' },
    link: { href: JELLY_MENU_PDF, label: { hr: 'Jelovnik Jellyfish in Space', en: 'Jellyfish in Space menu' } } },
];
