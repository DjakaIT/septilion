// Strukturirani podaci (schema.org JSON-LD) — grade se iz istih podataka koje stranica prikazuje,
// nikad ručno dvaput. Bez sidrenih cijena (zakon ukinut, GUIDE.md).
import { SITE_URL, WOLT, RESERVE_PASTA, INSTAGRAM_PASTA, FACEBOOK_JELLY, PHONE_JELLY } from '../site.config.mjs';
import type { Lang } from '../i18n/ui';
import { href } from '../i18n/ui';
import { SIDE_A, SALADS, SIDES, pastaPrices, nameOf } from '../data/pasta';
import { JELLY_MENU } from '../data/jelly-menu';
import type { Faq } from '../data/faq';
import { schemaPrice, priceShort, sizeLabel } from './format';

const abs = (p: string) => new URL(p, SITE_URL).href;
const ORG_ID = `${SITE_URL}/#org`;
const id = (route: 'pasta-rhymes' | 'jellyfish-in-space') => `${SITE_URL}/${route}#r`;
const offer = (amount: number, name?: string) => ({
  '@type': 'Offer', price: schemaPrice(amount), priceCurrency: 'EUR', ...(name ? { name } : {}),
});
const range = (xs: number[], lang: Lang) => `${priceShort(Math.min(...xs), lang)} – ${priceShort(Math.max(...xs), lang)}`;

export const ADDR_PASTA = { '@type': 'PostalAddress', streetAddress: 'Ulica Pavla Hatza 5', postalCode: '10000', addressLocality: 'Zagreb', addressCountry: 'HR' };
export const ADDR_JELLY = { '@type': 'PostalAddress', streetAddress: 'Martićeva ulica 71', postalCode: '10000', addressLocality: 'Zagreb', addressCountry: 'HR' };

function org(lang: Lang) {
  return {
    '@type': 'Organization', '@id': ORG_ID, name: 'Septillion', url: abs(href('gate', lang)),
    subOrganization: [{ '@id': id('pasta-rhymes') }, { '@id': id('jellyfish-in-space') }],
  };
}

function pastaRestaurant(lang: Lang) {
  const t = (o: { hr: string; en: string }) => o[lang];
  return {
    '@type': 'Restaurant', '@id': id('pasta-rhymes'), name: 'Pasta Rhymes', url: abs(href('pasta-rhymes', lang)),
    parentOrganization: { '@id': ORG_ID }, servesCuisine: ['Pasta', 'Italian'],
    acceptsReservations: RESERVE_PASTA, address: ADDR_PASTA, sameAs: [INSTAGRAM_PASTA],
    priceRange: range(pastaPrices(), lang),
    hasMenu: {
      '@type': 'Menu', name: 'The Spraylist', inLanguage: lang,
      hasMenuSection: [
        { '@type': 'MenuSection', name: lang === 'hr' ? 'Tjestenine' : 'Pasta',
          hasMenuItem: SIDE_A.map((p) => ({ '@type': 'MenuItem', name: nameOf(p, lang), description: t(p.desc), offers: offer(p.price) })) },
        { '@type': 'MenuSection', name: lang === 'hr' ? 'Salate' : 'Salads',
          hasMenuItem: SALADS.map((p) => ({ '@type': 'MenuItem', name: nameOf(p, lang), description: t(p.desc), offers: offer(p.price) })) },
        { '@type': 'MenuSection', name: lang === 'hr' ? 'Prilozi' : 'Sides',
          hasMenuItem: SIDES.map((p) => ({ '@type': 'MenuItem', name: nameOf(p, lang), description: t(p.desc), offers: offer(p.price) })) },
      ],
    },
  };
}

function jellyRestaurant(lang: Lang) {
  const all = JELLY_MENU.flatMap((c) => c.groups.flatMap((g) => g.items.flatMap((i) => i.prices.map((p) => p.amount))));
  return {
    '@type': ['Restaurant', 'BarOrPub'], '@id': id('jellyfish-in-space'), name: 'Jellyfish in Space',
    url: abs(href('jellyfish-in-space', lang)), parentOrganization: { '@id': ORG_ID },
    slogan: 'Somewhere out there, there is a jellyfish floating in space.',
    servesCuisine: ['Street food', 'Sushi', 'Cocktails'], telephone: PHONE_JELLY.e164, address: ADDR_JELLY,
    sameAs: [FACEBOOK_JELLY], priceRange: range(all, lang),
    hasMenu: {
      '@type': 'Menu', inLanguage: lang,
      hasMenuSection: JELLY_MENU.map((c) => ({
        '@type': 'MenuSection', name: c.title[lang],
        hasMenuItem: c.groups.flatMap((g) => g.items.map((i) => ({
          '@type': 'MenuItem', name: i.name[lang],
          ...(i.desc ? { description: i.desc[lang] } : {}),
          offers: i.prices.length === 1 && !i.prices[0].size
            ? offer(i.prices[0].amount)
            : i.prices.map((p, k) => offer(p.amount, p.size ? sizeLabel(p.size, lang) : i.portion?.[lang].split(/ ili | or /)[k])),
        }))),
      })),
    },
  };
}

function faqPage(route: 'pasta-rhymes' | 'jellyfish-in-space', faq: Faq[], lang: Lang) {
  return {
    '@type': 'FAQPage', '@id': `${abs(href(route, lang))}#faq`, about: { '@id': id(route) }, inLanguage: lang,
    mainEntity: faq.map((f) => ({
      '@type': 'Question', name: f.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: f.link ? `${f.a[lang]} ${abs(f.link.href)}` : f.a[lang] },
    })),
  };
}

export function graph(route: 'gate' | 'pasta-rhymes' | 'jellyfish-in-space', lang: Lang, faq?: Faq[]) {
  const nodes: object[] = [org(lang)];
  if (route === 'gate') {
    nodes.push(
      { '@type': 'WebSite', '@id': `${SITE_URL}/#web`, name: 'Septillion', url: abs(href('gate', lang)), inLanguage: lang, publisher: { '@id': ORG_ID } },
      { '@type': 'Restaurant', '@id': id('pasta-rhymes'), name: 'Pasta Rhymes', url: abs(href('pasta-rhymes', lang)), address: ADDR_PASTA },
      { '@type': ['Restaurant', 'BarOrPub'], '@id': id('jellyfish-in-space'), name: 'Jellyfish in Space', url: abs(href('jellyfish-in-space', lang)), address: ADDR_JELLY, telephone: PHONE_JELLY.e164 },
    );
  }
  if (route === 'pasta-rhymes') nodes.push(pastaRestaurant(lang), faqPage(route, faq!, lang));
  if (route === 'jellyfish-in-space') nodes.push(jellyRestaurant(lang), faqPage(route, faq!, lang));
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}

export const woltFor = (route: 'pasta-rhymes' | 'jellyfish-in-space') => WOLT[route];
