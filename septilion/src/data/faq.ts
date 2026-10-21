// Česta pitanja — iz prototipa v4 (hr), engleski prijevod. FAQPage JSON-LD gradi se iz ovih istih podataka.
import { JELLY_MENU_PDF } from '../site.config.mjs';

type L = { hr: string; en: string };
export type Faq = { q: L; a: L; link?: { href: string; label: L } };

export const FAQ_PASTA: Faq[] = [
  { q: { hr: 'Gdje se nalazi Pasta Rhymes?', en: 'Where is Pasta Rhymes?' },
    a: { hr: 'Pasta Rhymes je u Ulici Pavla Hatza 5, na uglu s Petrinjskom, u centru Zagreba. Traži crno-crveni lokal preko puta beertije i kluba Kluba.',
         en: 'Pasta Rhymes is at Ulica Pavla Hatza 5, on the corner with Petrinjska, in central Zagreb. Look for the black-and-red place across from the beer bar and the club Klub.' } },
  { q: { hr: 'Možemo li jesti kod vas?', en: 'Can we eat in?' },
    a: { hr: 'Naravno!', en: 'Of course!' } },
  { q: { hr: 'Je li tjestenina domaća?', en: 'Is the pasta homemade?' },
    a: { hr: 'Da, sve tjestenine na jelovniku su domaće: conchigliette, conchiglie, tagliatelle, rigatoni, fusili i spaghetti. Bez vrećica s police.',
         en: 'Yes, every pasta on the menu is made in house: conchigliette, conchiglie, tagliatelle, rigatoni, fusilli and spaghetti. No bags off the shelf.' } },
  { q: { hr: 'Imate li jela bez mesa?', en: 'Do you have meat-free dishes?' },
    a: { hr: 'Da, bez mesa su Aglio olio e peperoncino i Arrabiata, a od salata Tricolore, Caprino i Primavera.',
         en: 'Yes: Aglio olio e peperoncino and Arrabiata, plus the Tricolore, Caprino and Primavera salads.' } },
  { q: { hr: 'Mogu li sam birati glazbu?', en: 'Can I pick the music?' },
    a: { hr: 'Da, uz to dobijete slušalice i uživate u omiljenom jelu i omiljenoj glazbi.',
         en: 'Yes, and you get headphones to enjoy your favourite dish with your favourite music.' } },
];

export const FAQ_JELLY: Faq[] = [
  // službena pitanja s Instagrama (@jellyfish_in_space_, highlight "FAQ"), 21.10.2026.
  { q: { hr: 'Kojim danima imate ponudu All You Can Eat Sushi?', en: 'Which days do you have All You Can Eat Sushi?' },
    a: { hr: 'All You Can Eat Sushi ponuda je dostupna svake srijede i nedjelje. Može se naručiti do 20 h navečer po cijeni od 29 € po osobi. Ponuda se odnosi isključivo na sushi rolice po izboru sushi majstora, a dobivate ih u slijedovima.',
         en: 'All You Can Eat Sushi is available every Wednesday and Sunday. You can order it until 8 pm, at €29 per person. The offer covers sushi rolls only, chosen by the sushi master, and they arrive in rounds.' } },
  { q: { hr: 'Koliko slijedova ima All You Can Eat?', en: 'How many rounds does All You Can Eat have?' },
    a: { hr: 'To ovisi o vama! Sushi rolice dolaze u slijedovima: kad pojedete prvi slijed, dolazi drugi i tako dalje, sve dok vi ne kažete „Stop”.',
         en: 'That depends on you! The sushi rolls come in rounds: when you finish one, the next one arrives, and so on until you say "Stop".' } },
  { q: { hr: 'Imate li dostavu hrane?', en: 'Do you deliver?' },
    a: { hr: 'Surađujemo s platformama za naručivanje hrane Glovo i Wolt, pa preko njihovih aplikacija možete naručiti našu hranu, koja vam zatim ubrzo stiže na kućni prag.',
         en: 'We work with the food delivery platforms Glovo and Wolt, so you can order our food through their apps and it will be at your door soon after.' } },
  { q: { hr: 'Pokušali smo naručiti preko aplikacije, no narudžba nije prihvaćena.', en: "We tried to order through the app, but the order wasn't accepted." },
    a: { hr: 'Nekada se dogodi da platforme poput Wolta i Glova ograniče udaljenost dostave zbog vremenskih uvjeta ili raspoloživosti dostavljača, na što ne možemo utjecati. Također, kada je u restoranu gužva, znamo privremeno obustaviti dostavu.',
         en: "Sometimes platforms like Wolt and Glovo limit the delivery distance because of the weather or courier availability, which we can't influence. Also, when the restaurant is busy, we sometimes pause delivery for a while." } },
  { q: { hr: 'Koliko traje rezervacija stola?', en: 'How long is a table reservation?' },
    a: { hr: 'Zbog velikog broja upita i rezervacija morali smo organizirati rezervacije u nekoliko termina u trajanju od 2 sata.',
         en: 'Because of the large number of requests and bookings, reservations are organised in several time slots of 2 hours each.' } },
  { q: { hr: 'Imate li parking u sklopu restorana?', en: 'Do you have parking at the restaurant?' },
    a: { hr: 'Nažalost, nemamo svoj parking, ali u blizini restorana su 2 javne garaže: garaža Gorica udaljena je 50 m, a garaža Kvaternikov trg oko 350 m.',
         en: "Unfortunately we don't have our own parking, but there are 2 public garages nearby: Gorica garage is 50 m away and Kvaternikov trg garage about 350 m." } },
  { q: { hr: 'Mogu li cijeli jelovnik vidjeti u PDF-u?', en: 'Can I see the full menu as a PDF?' },
    a: { hr: 'Da. Cijeli jelovnik s pićima, isti kao u lokalu:', en: 'Yes. The full food and drinks menu, the same one you get at the bar:' },
    link: { href: JELLY_MENU_PDF, label: { hr: 'Jelovnik Jellyfish in Space', en: 'Jellyfish in Space menu' } } },
];
