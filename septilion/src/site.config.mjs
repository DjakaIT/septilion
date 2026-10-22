// Domena stranice (primarna domena hostinga, infonet.hr cPanel). Mijenja se ovdje i nigdje drugdje
// (kanonske adrese, sitemap, JSON-LD i dopušteni izvor uredništva).
export const SITE_URL = 'https://septillion.com.hr';

export const WOLT = {
  'pasta-rhymes': 'https://wolt.com/en/hrv/zagreb/restaurant/pasta-rhymes-1',
  'jellyfish-in-space': 'https://wolt.com/en/hrv/zagreb/restaurant/jellyfish-in-space1',
};
export const RESERVE_PASTA = 'https://reserve.dotyourspot.com/en/venue/191';
// dotyourspot venue 191 je "Jellyfish In Space" (provjereno 21.10.2026.)
export const RESERVE_JELLY = 'https://reserve.dotyourspot.com/en/venue/191';
export const INSTAGRAM_PASTA = 'https://www.instagram.com/pasta_rhymes__/';
export const FACEBOOK_JELLY = 'https://www.facebook.com/jellyfish.in.space/';
export const INSTAGRAM_JELLY = 'https://www.instagram.com/jellyfish_in_space_/';
// Google karte (gumb "Ostavi recenziju" i hasMap u JSON-LD)
export const MAPS_PASTA = 'https://www.google.com/maps/search/?api=1&query=Pasta+Rhymes+Ulica+Pavla+Hatza+5+Zagreb';
export const MAPS_JELLY = 'https://www.google.com/maps/search/?api=1&query=Jellyfish+in+Space+Marti%C4%87eva+71+Zagreb';
export const PHONE_JELLY = { href: 'tel:+385916144464', label: '+385 91 614 4464', e164: '+385916144464' };
// Web verzija PDF jelovnika (public/)
export const JELLY_MENU_PDF = '/jelovnik/jellyfish-in-space-jelovnik.pdf';
