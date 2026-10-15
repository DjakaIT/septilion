// "Tracklist" kasete: opis jela -> sastojci kao pjesme (A1, A2 …). Koristi se pri buildu i u pregledniku.
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
export function tracksOf(d: string): { t: string; b?: boolean }[] {
  const sent = d.split(/(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean);
  if (!sent.length) return []; // jelo bez opisa (može doći iz uredništva)
  const main = sent[0].replace(/\.$/, '').split(/,\s*/).map(cap);
  const bonus = sent.slice(1).map((t) => ({ b: true, t }));
  return [...main.map((t) => ({ t })), ...bonus];
}
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function tracksHtml(d: string, bonusLabel: string) {
  return tracksOf(d).map((x, k) => `<li><span>${x.b ? esc(bonusLabel) : 'A' + (k + 1)}</span>${esc(x.t)}</li>`).join('');
}
