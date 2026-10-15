// Navigacija između stranica s prijelazima iz prototipa, ali na pravim putanjama.
// Stara stranica odigra prvu polovicu prijelaza, zapiše zastavicu u sessionStorage i učita novu
// stranicu; /js/boot.js na novoj stranici odmah prekrije ekran, a ovaj modul odigra drugu polovicu.
import { $, $$, RM } from './dom';
import { Wipe } from './wipe';

export type RouteId = 'gate' | 'pasta-rhymes' | 'jellyfish-in-space';
type Flag = { kind: 'wipe' | 'fade'; color?: string; edge?: string; from: RouteId; to: string; t: number };

const KEY = 'sx-nav';
export const route = (document.body.dataset.route || 'gate') as RouteId;
const COLOR: Record<RouteId, string> = { 'pasta-rhymes': '#FE0000', 'jellyfish-in-space': '#050507', gate: '#0F0F10' };
const EDGE: Record<RouteId, string> = { 'pasta-rhymes': '#FFFFFF', 'jellyfish-in-space': '#EDEBE6', gate: '#FFFFFF' };
const norm = (p: string) => p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1') || '/';

let busy = false;

function save(kind: Flag['kind'], url: string, to: RouteId) {
  const f: Flag = { kind, from: route, to: norm(new URL(url, location.href).pathname), t: Date.now(), color: COLOR[to], edge: EDGE[to] };
  try { sessionStorage.setItem(KEY, JSON.stringify(f)); } catch { /* privatni način: bez prijelaza */ }
}

/** Prijelaz "val" prema drugom lokalu ili ulazu. */
export function go(to: RouteId, url: string) {
  if (busy || to === route) return;
  busy = true;
  if (RM) { location.assign(url); return; }
  Wipe.cover(COLOR[to], EDGE[to]).then(() => { save('wipe', url, to); location.assign(url); });
}
/** Ulaz: nakon "poplave" jedne strane, nova stranica se samo pojavi. */
export function goFade(to: RouteId, url: string) {
  save('fade', url, to);
  location.assign(url);
}

/** Što je prethodna stranica ostavila (ako išta). Briše zastavicu. */
export function arrival(): Flag | null {
  let f: Flag | null = null;
  try {
    const s = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (s) f = JSON.parse(s);
  } catch { /* ignore */ }
  if (!f || Date.now() - f.t > 4000 || f.to !== norm(location.pathname)) return null;
  return f;
}

function settle(f: Flag | null) {
  const html = document.documentElement;
  if (f?.kind === 'wipe' && html.classList.contains('sx-cover') && !RM) {
    Wipe.reveal(f.color!, f.edge!, () => html.classList.remove('sx-cover'));
  } else if (f?.kind === 'fade' && html.classList.contains('sx-fade') && !RM) {
    const main = $('#main');
    main.style.opacity = '0';
    html.classList.remove('sx-fade');
    main.style.transition = 'opacity .45s ease';
    requestAnimationFrame(() => requestAnimationFrame(() => { main.style.opacity = '1'; }));
  } else {
    html.classList.remove('sx-cover', 'sx-fade');
  }
}

export function initNav() {
  const f = arrival();
  settle(f);
  // poveznice prema drugim lokalima (gornja traka, podnožje): isti val kao u prototipu
  for (const a of $$<HTMLAnchorElement>('a[data-nav]')) {
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const to = a.dataset.nav as RouteId;
      e.preventDefault();
      if (to === route) { if (to !== 'gate') window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); return; }
      go(to, a.href);
    });
  }
  // povratak tipkom "natrag" iz bfcache-a: stranica ne smije ostati prekrivena
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    busy = false;
    Wipe.clear();
    document.documentElement.classList.remove('sx-cover', 'sx-fade');
    $('#main').style.opacity = '';
    dispatchEvent(new Event('sx:restore'));
  });
  return f;
}
