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
