import type { Lang } from '../i18n/ui';

/** Cijena kao na jelovniku: "8,90 €" (hr) / "€8.90" (en). */
export function price(amount: number, lang: Lang): string {
  const n = amount.toFixed(2);
  return lang === 'hr' ? `${n.replace('.', ',')} €` : `€${n}`;
}
/** Kratki oblik za meta opise: "19 €" / "8,90 €". */
export function priceShort(amount: number, lang: Lang): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return lang === 'hr' ? `${n.replace('.', ',')} €` : `€${n}`;
}
/** Vrijednost za schema.org Offer.price */
export const schemaPrice = (amount: number) => amount.toFixed(2);
/** Volumen iz podataka ("0,1 l") u engleski zapis ("0.1 l"). */
export const sizeLabel = (s: string, lang: Lang) => (lang === 'en' ? s.replace(',', '.') : s);

/** bazna cijena: cijene (redom kao cijene jela) na dan `date` (YYYY-MM-DD) */
export type Base = { prices: number[]; date: string };
const MJESECI_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "10. 9. 2026." / "10 Sep 2026" */
export function dateShort(iso: string, lang: Lang): string {
  const [g, m, d] = iso.split('-').map(Number);
  return lang === 'hr' ? `${d}. ${m}. ${g}.` : `${d} ${MJESECI_EN[m - 1]} ${g}`;
}
/** uz aktualnu cijenu, kako preporučuje Ministarstvo (datum pa cijena): "10. 9. 2026.: 16,00 €" / "10 Sep 2026: €16.00" */
export const baseLabel = (b: Base, lang: Lang) => `${dateShort(b.date, lang)}: ${b.prices.map((p) => price(p, lang)).join(' / ')}`;
