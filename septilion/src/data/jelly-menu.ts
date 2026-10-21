// Jellyfish in Space jelovnik. Izvor: uredništvo (podaci/jelovnik.json) ako postoji, inače jelly-menu.json
// (generira se iz .md izvora s ispravkama prema PDF-u: npm run menu; ujedno i početni sadržaj uredništva).
// Oblik se provjerava pri buildu — kriva cijena ili prazan naziv ruše build umjesto da odu na stranicu.
import { z } from 'astro/zod';
import raw from './jelly-menu.json';
import { ucitajZaBuild, uJelly } from './sadrzaj.mjs';

const L = z.object({ hr: z.string().min(1), en: z.string().min(1) });
const Price = z.object({ amount: z.number().positive(), size: z.string().optional() });
// slika: ključ slike (src/assets/img ili podaci/slike — vidi src/lib/images.ts)
const Img = z.string();
const Item = z.object({
  id: z.string(),
  name: L,
  desc: L.nullable(),
  portion: L.nullable(),
  pairing: L.nullable(),
  prices: z.array(Price).min(1),
});
const Group = z.object({ title: L.nullable(), note: L.nullable(), pairing: L.nullable(), items: z.array(Item).min(1) });
const Category = z.object({
  id: z.string(),
  title: L,
  img: Img.nullable(),
  pimg: Img.nullable(),
  note: L.nullable(),
  groups: z.array(Group).min(1),
});
const Menu = z.object({ categories: z.array(Category).min(1) });

export type MenuItem = z.infer<typeof Item>;
export type MenuGroup = z.infer<typeof Group>;
export type MenuCategory = z.infer<typeof Category>;

const izUrednistva = ucitajZaBuild();
/** verzija jelovnika iz uredništva s kojom je stranica izgrađena (novije cijene i tekstove stranica preuzme odmah: core/uzivo.ts) */
export const VERZIJA_JELOVNIKA: number = izUrednistva?.verzija ?? 0;
export const JELLY_MENU = Menu.parse(izUrednistva ? { categories: uJelly(izUrednistva) } : raw).categories;
export const itemCount = (c: MenuCategory) => c.groups.reduce((n, g) => n + g.items.length, 0);
/** cijene plata za opis stranice; ako kategorije Plate nema, sve cijene hrane */
export const platePrices = () => {
  const plate = JELLY_MENU.find((c) => c.id === 'plate');
  const cats = plate ? [plate] : JELLY_MENU.filter((c) => !['kokteli', 'pica'].includes(c.id));
  return cats.flatMap((c) => c.groups.flatMap((g) => g.items.map((i) => i.prices[0].amount)));
};
