// Uredništvo Septillion — sučelje (bez okvira i bez vanjskih skripti; CSP dopušta samo datoteke s ove adrese).
// Sadržaj se nikad ne umeće kao HTML: sve ide kroz textContent / atribute.
import qrcode from './qrcode.mjs';

// ---------------- pomoćno ----------------
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const kopija = (x) => structuredClone(x);

/** h('div', { class: 'x', onclick: fn, 'aria-label': '…' }, 'tekst', dijete) */
function h(tag, props = {}, ...djeca) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const d of djeca.flat(Infinity)) if (d !== null && d !== undefined && d !== false) el.append(d instanceof Node ? d : document.createTextNode(String(d)));
  return el;
}

const IKONE = {
  rucka: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  gore: 'M12 19V5M5 12l7-7 7 7', dolje: 'M12 5v14M19 12l-7 7-7-7',
  brisi: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14', van: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  slika: 'M4 5h16v14H4zM4 15l4-4 5 5 3-3 4 4M15 9h.01', izbornik: 'M4 7h16M4 12h16M4 17h16',
  povijest: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3', kljuc: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7z', odjava: 'M15 4h4v16h-4M10 16l4-4-4-4M14 12H4',
  korisnici: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  objava: 'M12 3v12M7 8l5-5 5 5M4 15v4h16v-4',
  odrzavanje: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
};
function ikona(ime) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', ime === 'rucka' ? '3' : '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', IKONE[ime]); svg.append(p);
  return svg;
}

const eur = (n) => (typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')} €` : '—');
const brojUTekst = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '');
/** "8,90" / "8.90" / "8" -> 8.9; null ako nije broj */
function uBroj(s) {
  const t = String(s ?? '').trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100) / 100;
}
const vrijeme = (iso) => (iso ? new Date(iso).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const sat = (iso) => (iso ? new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) : '');
const mnozina = (n, [a, b, c]) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);

// ---------------- stanje ----------------
const S = {
  csrf: null, ime: null, uloga: null,
  jelovnik: null, // { lokali, boje, sadrzaj }
  odabrana: null, // "lokal/kljuc"
  radna: null, // radna kopija odabrane kategorije
  prljavo: false,
  otvoreno: new Set(), // id-evi otvorenih stavki
  greske: {}, // id -> { polje: poruka }
  sirovo: {}, // "id:polje" -> upisani tekst cijene
  objava: null,
  nakonPrijave: null,
};

// ---------------- obavijesti ----------------
function obavijest(tekst, { vrsta = 'uspjeh', akcija, trajanje = 5000 } = {}) {
  const el = h('div', { class: `obavijest ${vrsta}` }, h('p', {}, tekst));
  if (akcija) el.append(h('button', { class: 'gumb', type: 'button', onclick: () => { akcija.fn(); el.remove(); } }, akcija.tekst));
  $('#obavijesti').append(el);
  setTimeout(() => el.remove(), trajanje);
}

// ---------------- API ----------------
class ApiGreska extends Error { constructor(status, podaci) { super(podaci?.greska || `Greška ${status}`); this.status = status; this.podaci = podaci; } }
/** pozadina = automatska provjera (status objave): poslužitelj je ne broji kao aktivnost, pa ne produljuje prijavu */
async function api(metoda, put, tijelo, { sirovo = false, vrsta, pozadina = false } = {}) {
  const zag = {};
  if (S.csrf) zag['X-CSRF'] = S.csrf;
  if (pozadina) zag['X-Pozadina'] = '1';
  if (tijelo !== undefined) zag['Content-Type'] = vrsta || 'application/json';
  const res = await fetch(`/urednistvo/api${put}`, {
    method: metoda, headers: zag, credentials: 'same-origin', cache: 'no-store',
    body: tijelo === undefined ? undefined : sirovo ? tijelo : JSON.stringify(tijelo),
  });
  const podaci = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && S.csrf) { S.csrf = null; prijavaIstekla(podaci?.razlog); }
    throw new ApiGreska(res.status, podaci);
  }
  if (!pozadina) zadnjiDodir = Date.now();
  return podaci;
}

// Prijava traje dok radiš: tipkanje, klikovi i dodiri jave poslužitelju da si tu (najviše jednom u 4 min).
// Sama provjera statusa u pozadini to ne radi — nakon 30 min bez ikakve aktivnosti prijava istječe.
let zadnjiDodir = Date.now();
function aktivnost() {
  if (!S.csrf || Date.now() - zadnjiDodir < 4 * 60_000) return;
  zadnjiDodir = Date.now();
  api('GET', '/stanje').then((st) => { if (st.korak !== 'puno' && S.csrf) { S.csrf = null; prijavaIstekla(st.razlog); } }).catch(() => {});
}
for (const dogadaj of ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart']) addEventListener(dogadaj, aktivnost, { passive: true, capture: true });

const RAZLOZI = {
  neaktivnost: 'Prijava je istekla nakon 30 minuta bez aktivnosti.',
  trajanje: 'Prijava traje najviše 12 sati.',
  odjavljen: 'Odjavljen si: lozinka je promijenjena ili je račun ponovno postavljen.',
};
const porukaIsteka = (razlog) => `${RAZLOZI[razlog] ?? 'Prijava više ne vrijedi.'} Prijavi se ponovno`;

// ---------------- ekrani: prijava, pozivnica, dvostruka potvrda ----------------
function ekran(...sadrzaj) {
  app.replaceChildren(h('main', { class: 'ekran' }, h('div', { class: 'kartica' }, h('div', { class: 'znak' }, h('img', { src: '/urednistvo/static/ikona.svg', alt: '' }), 'Septillion · Uredništvo'), ...sadrzaj)));
  $('h1', app)?.setAttribute('tabindex', '-1');
  $('h1', app)?.focus();
}
const porukaGreske = (el, tekst) => { el.textContent = tekst || ''; el.hidden = !tekst; };

function zaslonPrijave(napomena) {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'kartica-forma', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const gumb = $('button[type=submit]', forma); gumb.disabled = true; porukaGreske(greska, '');
    try {
      const r = await api('POST', '/prijava', { ime: forma.ime.value, lozinka: forma.lozinka.value });
      if (r.korak === '2fa') zaslonKoda(); else zaslonPostavljanja2fa(r);
    } catch (err) { porukaGreske(greska, err.message); gumb.disabled = false; forma.lozinka.select(); }
  } },
  h('label', { class: 'polje' }, h('span', {}, 'Korisničko ime'), h('input', { name: 'ime', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true })),
  h('label', { class: 'polje' }, h('span', {}, 'Lozinka'), h('input', { name: 'lozinka', type: 'password', autocomplete: 'current-password', required: true })),
  greska,
  h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Prijava'));
  const dijelovi = [h('h1', {}, 'Prijava')];
  if (napomena) dijelovi.push(h('p', { class: 'poruka info' }, napomena));
  ekran(...dijelovi, forma, h('p', { class: 'uvod' }, 'Zaboravljena lozinka ili izgubljen mobitel? Javi se administratoru uredništva za novu pozivnicu.'));
  forma.ime.focus();
}

function zaslonKoda() {
  let rezervni = false;
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const unos = h('input', { name: 'kod', type: 'text', class: 'kod-unos', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '[0-9]*', required: true });
  const oznaka = h('span', {}, 'Šesteroznamenkasti kod iz aplikacije');
  const prebaci = h('button', { class: 'veza', type: 'button', onclick: () => {
    rezervni = !rezervni;
    oznaka.textContent = rezervni ? 'Rezervni kod (npr. ABCDE-FGHJK)' : 'Šesteroznamenkasti kod iz aplikacije';
    unos.className = rezervni ? '' : 'kod-unos'; unos.inputMode = rezervni ? 'text' : 'numeric'; unos.maxLength = rezervni ? 11 : 6; unos.value = ''; unos.focus();
    prebaci.textContent = rezervni ? 'Upotrijebi kod iz aplikacije' : 'Nemam mobitel — upotrijebi rezervni kod';
  } }, 'Nemam mobitel — upotrijebi rezervni kod');
  const forma = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const gumb = $('button[type=submit]', forma); gumb.disabled = true; porukaGreske(greska, '');
    try {
      const r = await api('POST', '/prijava/2fa', { kod: unos.value });
      prijavljen(r);
      if (r.preostaloRezervnih !== undefined) obavijest(`Iskoristio si rezervni kod. Preostalo: ${r.preostaloRezervnih}. Kad ih ostane malo, javi se developeru.`, { vrsta: 'greska', trajanje: 12000 });
    } catch (err) {
      porukaGreske(greska, err.message); gumb.disabled = false; unos.select();
      if (err.status === 401 || err.status === 429) setTimeout(() => zaslonPrijave(err.message), 1500);
    }
  } }, h('label', { class: 'polje' }, oznaka, unos), greska, h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Potvrdi'));
  ekran(h('h1', {}, 'Dvostruka potvrda'), h('p', { class: 'uvod' }, 'Otvori aplikaciju za potvrdu na mobitelu i upiši kod za Septillion.'), forma, prebaci);
  unos.focus();
}

function koraci(n) { return h('div', { class: 'koraci', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => h('i', { class: i <= n ? 'da' : '' }))); }

/** obrazac za novu lozinku (prvo postavljanje i pozivnica); posalji(forma) vraća odgovor s korakom dvostruke potvrde */
function obrazacLozinke(polja, posalji) {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    if (forma.lozinka.value !== forma.ponovi.value) { porukaGreske(greska, 'Lozinke se ne podudaraju.'); return; }
    const gumb = $('button[type=submit]', forma); gumb.disabled = true;
    try { zaslonPostavljanja2fa(await posalji(forma)); } catch (err) { porukaGreske(greska, err.message); gumb.disabled = false; }
  } },
  ...polja,
  h('label', { class: 'polje' }, h('span', {}, 'Nova lozinka'), h('input', { name: 'lozinka', type: 'password', autocomplete: 'new-password', minlength: 12, required: true }),
    h('small', {}, 'Najmanje 12 znakova. Najlakše je nekoliko riječi, npr. "plava kaseta svira jazz".')),
  h('label', { class: 'polje' }, h('span', {}, 'Ponovi lozinku'), h('input', { name: 'ponovi', type: 'password', autocomplete: 'new-password', required: true })),
  greska, h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Dalje'));
  return forma;
}

/** prvi račun — izravno na /urednistvo; na serveru uz kod iz datoteke PRVO-POSTAVLJANJE.txt */
function zaslonPostavljanja({ kodPotreban }) {
  const forma = obrazacLozinke([
    kodPotreban ? h('label', { class: 'polje' }, h('span', {}, 'Kod za postavljanje'),
      h('input', { name: 'kod', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', required: true }),
      h('small', {}, 'U datoteci PRVO-POSTAVLJANJE.txt u mapi s podacima uredništva (cPanel → File Manager → septillion-podaci).')) : null,
    h('label', { class: 'polje' }, h('span', {}, 'Korisničko ime'), h('input', { name: 'ime', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true }), h('small', {}, 'Mala slova i brojke, npr. daniel')),
  ], (f) => api('POST', '/postavljanje', { kod: f.kod?.value, ime: f.ime.value, lozinka: f.lozinka.value }));
  ekran(koraci(1), h('h1', {}, 'Postavljanje uredništva'),
    h('p', { class: 'uvod' }, 'Ovo radiš samo jednom: odaberi korisničko ime i lozinku, zatim uključi dvostruku potvrdu na mobitelu. Ostale korisnike poslije pozivaš iz uredništva.'), forma);
  (forma.kod ?? forma.ime).focus();
}

async function zaslonPozivnice(token) {
  let info;
  try { info = await api('POST', '/pozivnica/provjeri', { token }); } catch (err) {
    ekran(h('h1', {}, 'Pozivnica ne vrijedi'), h('p', { class: 'poruka greska' }, err.message), h('p', { class: 'uvod' }, 'Zatraži novu pozivnicu od administratora uredništva.'),
      h('button', { class: 'gumb', type: 'button', onclick: () => zaslonPrijave() }, 'Na prijavu'));
    return;
  }
  const forma = obrazacLozinke([h('p', { class: 'poruka info' }, `Korisničko ime: ${info.ime}`)],
    (f) => api('POST', '/pozivnica', { token, lozinka: f.lozinka.value }));
  ekran(koraci(1), h('h1', {}, 'Dobrodošao u uredništvo'), h('p', { class: 'uvod' }, 'Prvo odaberi lozinku, zatim uključi dvostruku potvrdu na mobitelu. To radiš samo jednom.'), forma);
  forma.lozinka.focus();
}

function qrSlika(uri) {
  const q = qrcode(0, 'M');
  q.addData(uri);
  q.make();
  return q.createDataURL(5, 4);
}

function zaslonPostavljanja2fa({ uri, kljuc }) {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const unos = h('input', { name: 'kod', type: 'text', class: 'kod-unos', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, required: true });
  const forma = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    const gumb = $('button[type=submit]', forma); gumb.disabled = true;
    try { const r = await api('POST', '/2fa/potvrdi', { kod: unos.value }); zaslonRezervnihKodova(r); } catch (err) {
      porukaGreske(greska, err.message); gumb.disabled = false; unos.select();
      if (err.status === 401 || err.status === 429) setTimeout(() => zaslonPrijave(err.message), 1500);
    }
  } }, h('label', { class: 'polje' }, h('span', {}, '3. Upiši šesteroznamenkasti kod koji aplikacija prikazuje'), unos), greska, h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Uključi dvostruku potvrdu'));
  const kljucEl = h('details', {}, h('summary', { class: 'veza' }, 'Ne mogu skenirati — upiši ključ ručno'), h('p', { class: 'tajni-kljuc' }, kljuc));
  ekran(koraci(2), h('h1', {}, 'Dvostruka potvrda'),
    h('p', { class: 'uvod' }, '1. Na mobitel instaliraj aplikaciju za potvrdu (npr. Google Authenticator ili Microsoft Authenticator).'),
    h('p', { class: 'uvod' }, '2. U aplikaciji dodaj račun i skeniraj ovaj kod:'),
    h('div', { class: 'qr' }, h('img', { src: qrSlika(uri), alt: 'QR kod za aplikaciju za potvrdu', width: 220, height: 220 })), kljucEl, forma);
  $('.kartica', app).classList.add('siroka');
}

function zaslonRezervnihKodova(r) {
  const tekst = `Septillion uredništvo — rezervni kodovi (${r.ime})\nSvaki kod vrijedi jednom, ako nemaš mobitel.\n\n${r.rezervniKodovi.join('\n')}\n`;
  const nastavi = h('button', { class: 'gumb glavni cijela', type: 'button', disabled: true, onclick: () => prijavljen(r) }, 'Otvori uredništvo');
  ekran(koraci(3), h('h1', {}, 'Spremi rezervne kodove'),
    h('p', { class: 'uvod' }, 'Ako izgubiš mobitel, s ovim kodovima se i dalje možeš prijaviti (svaki jednom). Prikazuju se samo sada.'),
    h('ul', { class: 'rezervni' }, r.rezervniKodovi.map((k) => h('li', {}, k))),
    h('div', { class: 'dva' },
      h('button', { class: 'gumb', type: 'button', onclick: async (e) => { try { await navigator.clipboard.writeText(tekst); e.currentTarget.textContent = 'Kopirano ✓'; } catch { obavijest('Kopiranje nije uspjelo — preuzmi datoteku.', { vrsta: 'greska' }); } } }, 'Kopiraj'),
      h('button', { class: 'gumb', type: 'button', onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([tekst], { type: 'text/plain' })), download: 'septillion-rezervni-kodovi.txt' }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } }, 'Preuzmi .txt')),
    h('label', { class: 'kvacica' }, h('input', { type: 'checkbox', onchange: (e) => { nastavi.disabled = !e.target.checked; } }), 'Spremio sam kodove na sigurno mjesto (ne na isti mobitel).'),
    nastavi);
  $('.kartica', app).classList.add('siroka');
}

function prijavljen({ ime, uloga, csrf }) {
  S.ime = ime; S.uloga = uloga; S.csrf = csrf; zadnjiDodir = Date.now();
  if (S.nakonPrijave) { const fn = S.nakonPrijave; S.nakonPrijave = null; fn(); return; }
  ucitajUrednik();
}
function prijavaIstekla(razlog) {
  const sacuvano = S.jelovnik && S.prljavo;
  if (sacuvano) S.nakonPrijave = () => { crtajUrednik(); obavijest('Prijavljen si ponovno. Promjene su sačuvane — sada ih spremi.'); };
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  zaslonPrijave(`${porukaIsteka(razlog)}${sacuvano ? ' — nespremljene promjene ostaju.' : '.'}`);
}

// ---------------- urednik ----------------
async function ucitajUrednik() {
  app.replaceChildren(h('p', { class: 'ucitavanje', role: 'status' }, 'Učitavam jelovnik…'));
  S.jelovnik = await api('GET', '/jelovnik');
  const prva = `${S.jelovnik.lokali[0].id}/${S.jelovnik.lokali[0].kategorije[0].kljuc}`;
  odaberi(S.odabrana && S.jelovnik.sadrzaj.kategorije[S.odabrana] ? S.odabrana : prva);
  osvjeziObjavu();
}

const konfig = (kk) => { const [l, k] = kk.split('/'); const lokal = S.jelovnik.lokali.find((x) => x.id === l); return { lokal, kat: lokal.kategorije.find((x) => x.kljuc === k) }; };
const nazivKategorije = (kk) => { const { kat } = konfig(kk); return kat.naziv || S.jelovnik.sadrzaj.kategorije[kk].naslov.hr || kat.kljuc; };
const brojJela = (k) => k.stavke.filter((s) => s.tip === 'jelo').length;

function odaberi(kk) {
  if (S.prljavo && kk !== S.odabrana && !confirm(`Imaš nespremljene promjene u kategoriji "${nazivKategorije(S.odabrana)}". Odbaciti ih?`)) { crtajUrednik(); return; }
  S.odabrana = kk; S.radna = kopija(S.jelovnik.sadrzaj.kategorije[kk]); S.prljavo = false; S.otvoreno.clear(); S.greske = {}; S.sirovo = {};
  crtajUrednik();
  $('.glava h1', app)?.focus();
}

function oznaciPromjenu() {
  if (!S.prljavo) { S.prljavo = true; crtajTrakuSpremanja(); $('.bocno button[aria-current="true"]')?.append(h('span', { class: 'tocka', 'aria-label': 'nespremljeno' })); }
}

function crtajUrednik() {
  const { lokal, kat } = konfig(S.odabrana);
  const polja = new Set(kat.polja);
  app.replaceChildren(
    crtajVrh(),
    h('div', { class: 'radno' },
      crtajBocno(),
      h('main', { class: 'sadrzaj', id: 'sadrzaj' },
        crtajOdabirMobitel(),
        h('div', { class: 'glava' },
          h('div', {}, h('p', {}, lokal.naziv), h('h1', { tabindex: '-1' }, nazivKategorije(S.odabrana))),
          h('p', {}, `${brojJela(S.radna)} ${mnozina(brojJela(S.radna), ['jelo', 'jela', 'jela'])}`)),
        (polja.has('slikaKategorije') || polja.has('naslov')) ? crtajPostavkeKategorije(polja) : null,
        S.radna.stavke.length ? h('ul', { class: 'popis', id: 'popis' }, S.radna.stavke.map((s, i) => crtajStavku(s, i, polja))) : h('p', { class: 'prazno' }, 'Kategorija još nema jela.'),
        h('div', { class: 'dodaj' },
          h('button', { class: 'gumb', type: 'button', onclick: () => dodaj('jelo') }, ikona('plus'), 'Dodaj jelo'),
          polja.has('skupine') ? h('button', { class: 'gumb', type: 'button', onclick: () => dodaj('skupina') }, ikona('plus'), 'Dodaj naslov skupine') : null))),
    h('div', { class: 'spremanje', id: 'spremanje', role: 'region', 'aria-label': 'Spremanje' }));
  crtajTrakuSpremanja();
}

function crtajVrh() {
  const zatvori = () => {
    popis.hidden = true; gumb.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', vani); document.removeEventListener('keydown', esc);
  };
  const vani = (e) => { if (!popis.contains(e.target) && !gumb.contains(e.target)) zatvori(); };
  const esc = (e) => { if (e.key === 'Escape') { zatvori(); gumb.focus(); } };
  const stavka = (ik, tekst, fn) => h('button', { type: 'button', onclick: () => { zatvori(); fn(); } }, ikona(ik), tekst);
  const popis = h('div', { class: 'izbornik-popis', hidden: true, id: 'izbornik' },
    h('p', { class: 'ime' }, `Prijavljen: ${S.ime}${S.uloga === 'admin' ? ' (administrator)' : ''}`),
    stavka('povijest', 'Povijest promjena', dijalogPovijesti),
    S.uloga === 'admin' ? stavka('korisnici', 'Korisnici', dijalogKorisnika) : null,
    S.uloga === 'admin' ? stavka('objava', 'Objava stranice', dijalogObjave) : null,
    S.uloga === 'admin' ? stavka('odrzavanje', 'Održavanje stranice', dijalogOdrzavanja) : null,
    stavka('kljuc', 'Promijeni lozinku', dijalogLozinke),
    stavka('odjava', 'Odjava', odjava));
  const gumb = h('button', { class: 'gumb ikona tih', type: 'button', 'aria-label': 'Izbornik', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'izbornik', onclick: () => {
    if (!popis.hidden) { zatvori(); return; }
    popis.hidden = false; gumb.setAttribute('aria-expanded', 'true'); $('button', popis).focus();
    document.addEventListener('click', vani); document.addEventListener('keydown', esc);
  } }, ikona('izbornik'));
  return h('header', { class: 'vrh' },
    h('div', { class: 'znak' }, h('img', { src: '/urednistvo/static/ikona.svg', alt: '' }), h('span', {}, 'Uredništvo', h('small', {}, 'Septillion'))),
    h('span', { class: 'status', id: 'status', role: 'status' }, h('span', { class: 'status-tekst' }, 'Objavljeno')),
    // dok je održavanje uključeno, to se stalno vidi (da se ne zaboravi isključiti)
    S.uloga === 'admin'
      ? h('button', { class: 'oznaka-odrzavanja', id: 'odrzavanje', type: 'button', hidden: !S.objava?.odrzavanje, onclick: dijalogOdrzavanja }, ikona('odrzavanje'), h('span', {}, 'Održavanje'))
      : h('span', { class: 'oznaka-odrzavanja', id: 'odrzavanje', hidden: !S.objava?.odrzavanje, title: 'Posjetitelji vide poruku o održavanju; isključuje ga administrator.' }, ikona('odrzavanje'), h('span', {}, 'Održavanje')),
    h('a', { class: 'gumb tih', href: '/', target: '_blank', rel: 'noopener noreferrer' }, ikona('van'), h('span', { class: 'pogledaj-tekst' }, 'Stranica')),
    h('div', { class: 'izbornik' }, gumb, popis));
}

function crtajBocno() {
  return h('nav', { class: 'bocno', 'aria-label': 'Kategorije' }, S.jelovnik.lokali.map((l) => h('div', {},
    h('h2', {}, l.naziv),
    h('ul', {}, l.kategorije.map((k) => {
      const kk = `${l.id}/${k.kljuc}`;
      const kat = kk === S.odabrana ? S.radna : S.jelovnik.sadrzaj.kategorije[kk];
      return h('li', {}, h('button', { type: 'button', 'aria-current': kk === S.odabrana ? 'true' : 'false', onclick: () => odaberi(kk) },
        h('span', {}, nazivKategorije(kk)), h('span', { class: 'broj' }, brojJela(kat)), kk === S.odabrana && S.prljavo ? h('span', { class: 'tocka', 'aria-label': 'nespremljeno' }) : null));
    })))));
}

function crtajOdabirMobitel() {
  const sel = h('select', { id: 'odabir-kategorije', onchange: (e) => odaberi(e.target.value) }, S.jelovnik.lokali.map((l) =>
    h('optgroup', { label: l.naziv }, l.kategorije.map((k) => { const kk = `${l.id}/${k.kljuc}`; return h('option', { value: kk, selected: kk === S.odabrana }, nazivKategorije(kk)); }))));
  return h('label', { class: 'odabir-mobitel polje' }, h('span', {}, 'Kategorija'), sel);
}

// ----- polja obrasca -----
function tekstPolje(obj, kljuc, oznaka, { visered = false, id, putanja, opis, mjesto } = {}) {
  const el = h(visered ? 'textarea' : 'input', {
    ...(visered ? { rows: 3 } : { type: 'text' }), value: obj[kljuc] ?? '', placeholder: mjesto,
    'data-putanja': putanja, oninput: (e) => { obj[kljuc] = e.target.value; oznaciPromjenu(); ocistiGresku(putanja); osvjeziSazetak(id); },
  });
  return h('label', { class: 'polje' }, h('span', {}, oznaka), el, opis ? h('small', {}, opis) : null);
}
function dvojezicno(obj, oznaka, { visered, id, polje, opis } = {}) {
  return h('div', { class: 'dva' },
    tekstPolje(obj, 'hr', `${oznaka} (hrvatski)`, { visered, id, putanja: `${id}:${polje}.hr`, opis }),
    tekstPolje(obj, 'en', `${oznaka} (engleski)`, { visered, id, putanja: `${id}:${polje}.en`, mjesto: 'Prazno = kao hrvatski' }));
}
function poljeCijene(s, kljuc, oznaka, { obavezno = true } = {}) {
  const k = `${s.id}:${kljuc}`;
  const vrijednost = S.sirovo[k] ?? brojUTekst(s[kljuc]);
  const el = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: vrijednost, placeholder: obavezno ? '0,00' : 'prazno = nema', 'data-putanja': k,
    oninput: (e) => {
      S.sirovo[k] = e.target.value;
      const t = e.target.value.trim();
      s[kljuc] = t === '' && !obavezno ? null : uBroj(t) ?? s[kljuc];
      oznaciPromjenu(); ocistiGresku(k); osvjeziSazetak(s.id);
    } });
  return h('label', { class: 'polje' }, h('span', {}, oznaka), h('span', { class: 'unos-cijene' }, el));
}
/**
 * Fotografija s mobitela (4000+ px, 5–20 MB) smanji se već u pregledniku na najviše 2400 px: slanje je brzo i na
 * mobilnim podacima, a poslužitelj (i hosting s ograničenom memorijom) dobiva malu datoteku. Poslužitelj je svejedno
 * iznova kodira i uklanja EXIF. Formate koje preglednik ne zna otvoriti (npr. HEIC) šalje kakve jesu.
 */
async function pripremiFotografiju(f) {
  const NAJVISE = 2400;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || typeof createImageBitmap !== 'function') return f;
  let bmp;
  try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch { return f; }
  const omjer = Math.min(1, NAJVISE / Math.max(bmp.width, bmp.height));
  if (omjer === 1 && f.size <= 3 * 1024 * 1024) { bmp.close(); return f; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * omjer); c.height = Math.round(bmp.height * omjer);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // prozirni PNG ne smije postati crn
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
  return blob ?? f;
}

function poljeSlike(obj, kljuc, oznaka, { id, opis } = {}) {
  const unos = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', hidden: true });
  const prikaz = () => (obj[kljuc] ? h('img', { src: `/urednistvo/api/slike/${obj[kljuc]}`, alt: '' }) : h('span', { class: 'prazna-slika' }, 'Nema fotografije', h('small', {}, 'klikni ili dovuci')));
  let slikaEl = prikaz();
  const tekst = h('span', {}, obj[kljuc] ? 'Promijeni fotografiju' : 'Dodaj fotografiju');
  const gumb = h('button', { class: 'gumb', type: 'button', 'data-putanja': `${id}:${kljuc}`, 'aria-label': `${tekst.textContent}: ${oznaka}`, onclick: () => unos.click() }, ikona('slika'), tekst);
  async function ucitaj(f) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { obavijest('To nije fotografija (JPG, PNG, WebP).', { vrsta: 'greska' }); return; }
    gumb.disabled = true; tekst.textContent = 'Učitavam…'; okvir.classList.add('ucitava');
    try {
      const datoteka = await pripremiFotografiju(f);
      if (datoteka.size > 15 * 1024 * 1024) throw new Error('Fotografija je veća od 15 MB.');
      const r = await api('POST', '/slike', datoteka, { sirovo: true, vrsta: datoteka.type || 'application/octet-stream' });
      obj[kljuc] = r.kljuc; oznaciPromjenu();
      const novo = prikaz(); slikaEl.replaceWith(novo); slikaEl = novo;
      ocistiGresku(`${id}:${kljuc}`); osvjeziSazetak(id);
      obavijest('Fotografija učitana. Ne zaboravi spremiti.');
    } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska', trajanje: 8000 }); }
    finally {
      gumb.disabled = false; okvir.classList.remove('ucitava');
      tekst.textContent = obj[kljuc] ? 'Promijeni fotografiju' : 'Dodaj fotografiju'; gumb.setAttribute('aria-label', `${tekst.textContent}: ${oznaka}`);
    }
  }
  unos.addEventListener('change', () => { const f = unos.files?.[0]; unos.value = ''; ucitaj(f); });
  // fotografija se može i dovući mišem (s računala ili iz druge kartice) na okvir, ili odabrati klikom na sliku
  const okvir = h('div', { class: 'fotografija',
    ondragover: (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); okvir.classList.add('povlaci'); } },
    ondragleave: () => okvir.classList.remove('povlaci'),
    ondrop: (e) => { e.preventDefault(); okvir.classList.remove('povlaci'); ucitaj(e.dataTransfer?.files?.[0]); },
    onclick: (e) => { if (e.target === slikaEl || slikaEl.contains(e.target)) unos.click(); },
  }, slikaEl, gumb, unos);
  return h('div', { class: 'polje' }, h('span', { class: 'oznaka' }, oznaka), okvir, opis ? h('small', {}, opis) : null);
}

function crtajPostavkeKategorije(polja) {
  const k = S.radna;
  const id = 'kategorija';
  return h('details', { class: 'postavke' }, h('summary', {}, 'Postavke kategorije (naslov, fotografija, napomena)'),
    h('div', { class: 'obrazac' },
      polja.has('naslov') ? dvojezicno(k.naslov, 'Naslov', { id, polje: 'naslov' }) : null,
      polja.has('slikaKategorije') ? poljeSlike(k, 'slika', 'Fotografija kategorije', { id, opis: 'Vidi se na planetu u orbiti i iznad popisa jela.' }) : null,
      polja.has('planet') ? poljeSlike(k, 'planet', 'Slika planeta (samo ako nema fotografije kategorije)', { id }) : null,
      polja.has('napomena') ? dvojezicno(k.napomena, 'Napomena na vrhu popisa', { visered: true, id, polje: 'napomena' }) : null));
}

function sazetakStavke(s) {
  if (s.tip === 'skupina') return { naziv: s.naslov.hr ? `Skupina: ${s.naslov.hr}` : 'Skupina bez naslova', opis: [s.napomena.hr, s.preporuka.hr && `Preporuka: ${s.preporuka.hr}`].filter(Boolean).join(' · ') };
  return { naziv: s.naziv.hr || 'Novo jelo (bez naziva)', novo: !s.naziv.hr, opis: s.opis.hr };
}
function cijenaStavke(s) {
  if (s.tip !== 'jelo') return null;
  return h('span', { class: 'cijena' }, eur(s.cijena), s.kolicina ? h('small', {}, s.kolicina) : null,
    s.cijena2 !== null ? h('small', {}, `${eur(s.cijena2)}${s.kolicina2 ? ` · ${s.kolicina2}` : ''}`) : null);
}

function crtajStavku(s, i, polja) {
  const otvoreno = S.otvoreno.has(s.id);
  const g = S.greske[s.id] ?? {};
  const z = sazetakStavke(s);
  const sazetak = h('button', { class: 'sazetak', type: 'button', 'aria-expanded': String(otvoreno), 'aria-controls': `obrazac-${s.id}`, onclick: () => { otvoreno ? S.otvoreno.delete(s.id) : S.otvoreno.add(s.id); crtajUrednik(); $(`#stavka-${s.id} .sazetak`)?.focus(); } },
    h('span', { class: `naziv${z.novo ? ' novo' : ''}` }, z.naziv), z.opis ? h('span', { class: 'opis' }, z.opis) : null);
  const rucka = h('button', { class: 'rucka', type: 'button', 'aria-label': `Premjesti: ${z.naziv} (strelice gore/dolje)`, onkeydown: (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); pomakni(i, e.key === 'ArrowUp' ? -1 : 1, true); }
  } }, ikona('rucka'));
  vuci(rucka, s.id);
  const red = h('div', { class: 'red' },
    rucka,
    polja.has('boja') && s.tip === 'jelo' ? h('span', { class: 'boja-oznaka', 'aria-hidden': 'true' }) : null,
    polja.has('slika') && s.tip === 'jelo' ? (s.slika ? h('img', { class: 'minijatura', src: `/urednistvo/api/slike/${s.slika}`, alt: '', loading: 'lazy' }) : h('span', { class: 'minijatura prazna', 'aria-hidden': 'true' }, ikona('slika'))) : null,
    sazetak, cijenaStavke(s),
    h('span', { class: 'akcije' },
      h('button', { class: 'gumb ikona tih gore-dolje', type: 'button', 'aria-label': 'Pomakni gore', disabled: i === 0, onclick: () => pomakni(i, -1) }, ikona('gore')),
      h('button', { class: 'gumb ikona tih gore-dolje', type: 'button', 'aria-label': 'Pomakni dolje', disabled: i === S.radna.stavke.length - 1, onclick: () => pomakni(i, 1) }, ikona('dolje')),
      h('button', { class: 'gumb ikona tih opasno', type: 'button', 'aria-label': `Obriši: ${z.naziv}`, onclick: () => obrisi(i) }, ikona('brisi'))));
  const boja = $('.boja-oznaka', red); if (boja) boja.style.backgroundColor = s.boja || 'transparent';
  const li = h('li', { class: `stavka${s.tip === 'skupina' ? ' skupina' : ''}${otvoreno ? ' otvorena' : ''}${Object.keys(g).length ? ' ima-gresku' : ''}`, id: `stavka-${s.id}`, dataset: { id: s.id } }, red);
  if (otvoreno) li.append(s.tip === 'skupina' ? obrazacSkupine(s) : obrazacJela(s, polja));
  return li;
}

function obrazacJela(s, polja) {
  const id = s.id;
  const druga = polja.has('cijena2');
  const forma = h('div', { class: 'obrazac', id: `obrazac-${id}` },
    dvojezicno(s.naziv, 'Naziv', { id, polje: 'naziv' }),
    dvojezicno(s.opis, 'Opis / sastojci', { visered: true, id, polje: 'opis', opis: polja.has('slika') ? 'Sastojke odvoji zarezom — na kaseti svaki postaje jedna "pjesma".' : undefined }),
    h('div', { class: `cijene${polja.has('kolicina') ? '' : ' jedna'}` }, poljeCijene(s, 'cijena', 'Cijena'), polja.has('kolicina') ? tekstPolje(s, 'kolicina', 'Količina uz cijenu', { id, putanja: `${id}:kolicina`, mjesto: 'npr. 0,1 l' }) : null),
    druga ? h('details', { class: 'druga', open: s.cijena2 !== null }, h('summary', {}, 'Druga veličina (npr. boca ili 8 komada)'),
      h('div', { class: `cijene${polja.has('kolicina') ? '' : ' jedna'}` }, poljeCijene(s, 'cijena2', 'Druga cijena', { obavezno: false }), polja.has('kolicina') ? tekstPolje(s, 'kolicina2', 'Količina uz drugu cijenu', { id, putanja: `${id}:kolicina2`, mjesto: 'npr. 0,75 l' }) : null)) : null,
    polja.has('porcija') ? dvojezicno(s.porcija, 'Porcija', { id, polje: 'porcija', opis: 'npr. 3 kom ili 4 ili 8 zalogaja' }) : null,
    polja.has('preporuka') ? dvojezicno(s.preporuka, 'Preporuka pića', { id, polje: 'preporuka' }) : null,
    polja.has('slika') ? poljeSlike(s, 'slika', 'Fotografija jela', { id, opis: 'Klikni ili dovuci fotografiju na okvir. Može ravno s mobitela — sama se smanji, a stranica radi manje verzije.' }) : null,
    polja.has('boja') ? h('fieldset', { class: 'boje', 'data-putanja': `${id}:boja` }, h('legend', { class: 'oznaka' }, 'Boja naljepnice na kaseti'),
      S.jelovnik.boje.map((b) => { const sw = h('span', {}); sw.style.backgroundColor = b.vrijednost; return h('label', { class: 'boja', title: b.naziv },
        h('input', { type: 'radio', name: `boja-${id}`, value: b.vrijednost, checked: (s.boja ?? '').toLowerCase() === b.vrijednost.toLowerCase(), 'aria-label': b.naziv,
          onchange: () => { s.boja = b.vrijednost; oznaciPromjenu(); ocistiGresku(`${id}:boja`); const o = $(`#stavka-${id} .boja-oznaka`); if (o) o.style.backgroundColor = b.vrijednost; } }), sw); })) : null,
    polja.has('galerija') ? h('label', { class: 'kvacica' }, h('input', { type: 'checkbox', checked: s.galerija, onchange: (e) => { s.galerija = e.target.checked; oznaciPromjenu(); } }), 'Prikaži u galeriji fotografija na stranici') : null,
    h('div', { class: 'dno-obrasca' }, h('button', { class: 'gumb', type: 'button', onclick: () => { S.otvoreno.delete(id); crtajUrednik(); } }, 'Zatvori')));
  pokaziGreske(forma, id);
  return forma;
}

function obrazacSkupine(s) {
  const id = s.id;
  const forma = h('div', { class: 'obrazac', id: `obrazac-${id}` },
    h('p', { class: 'naslov-obrasca' }, 'Naslov skupine — sve ispod njega pripada skupini, do sljedećeg naslova'),
    dvojezicno(s.naslov, 'Naslov', { id, polje: 'naslov', opis: 'npr. Whiskey; prazno = skupina bez naslova' }),
    dvojezicno(s.napomena, 'Napomena uz naslov', { id, polje: 'napomena', opis: 'npr. 0,03 l' }),
    dvojezicno(s.preporuka, 'Preporuka pića za cijelu skupinu', { id, polje: 'preporuka' }),
    h('div', { class: 'dno-obrasca' }, h('button', { class: 'gumb', type: 'button', onclick: () => { S.otvoreno.delete(id); crtajUrednik(); } }, 'Zatvori')));
  pokaziGreske(forma, id);
  return forma;
}

const omotPolja = (el) => el.closest('.polje, fieldset') ?? el.parentElement;
function pokaziGreske(forma, id) {
  for (const [polje, poruka] of Object.entries(S.greske[id] ?? {})) {
    const el = $(`[data-putanja="${id}:${polje}"]`, forma) ?? $(`[data-putanja^="${id}:${polje}"]`, forma);
    const omot = el ? omotPolja(el) : forma;
    omot.classList.add('ima-gresku');
    if (el?.matches('input, textarea')) el.setAttribute('aria-invalid', 'true');
    omot.append(h('span', { class: 'greska-polja', role: 'alert' }, poruka));
  }
}
/** ispravljeno polje odmah gubi poruku (a stavka crveni okvir kad više nema grešaka) */
function ocistiGresku(putanja) {
  if (!putanja) return;
  const i = putanja.indexOf(':'); const id = putanja.slice(0, i); const polje = putanja.slice(i + 1);
  const g = S.greske[id]; if (!g) return;
  const kljucevi = Object.keys(g).filter((k) => polje === k || polje.startsWith(`${k}.`));
  if (!kljucevi.length) return;
  for (const k of kljucevi) delete g[k];
  const el = $(`[data-putanja="${putanja}"]`);
  if (el) { const omot = omotPolja(el); omot.classList.remove('ima-gresku'); $('.greska-polja', omot)?.remove(); el.removeAttribute('aria-invalid'); }
  if (!Object.keys(g).length) { delete S.greske[id]; $(`#stavka-${id}`)?.classList.remove('ima-gresku'); }
}

function osvjeziSazetak(id) {
  const s = S.radna.stavke.find((x) => x.id === id);
  const li = $(`#stavka-${id}`);
  if (!s || !li) return;
  const z = sazetakStavke(s);
  const n = $('.naziv', li); n.textContent = z.naziv; n.classList.toggle('novo', Boolean(z.novo));
  const o = $('.sazetak .opis', li); if (o) o.textContent = z.opis ?? ''; else if (z.opis) $('.sazetak', li).append(h('span', { class: 'opis' }, z.opis));
  const c = $('.cijena', li); if (c) c.replaceWith(cijenaStavke(s));
  const m = $('img.minijatura', li); if (m && s.slika) m.src = `/urednistvo/api/slike/${s.slika}`;
}

// ----- radnje nad popisom -----
function noviId() { const b = new Uint8Array(8); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 12); }
function dodaj(tip) {
  const t = { hr: '', en: '' };
  const s = tip === 'jelo'
    ? { id: noviId(), tip: 'jelo', naziv: { ...t }, opis: { ...t }, porcija: { ...t }, preporuka: { ...t }, cijena: null, kolicina: '', cijena2: null, kolicina2: '', slika: null, boja: null, galerija: true }
    : { id: noviId(), tip: 'skupina', naslov: { ...t }, napomena: { ...t }, preporuka: { ...t } };
  S.radna.stavke.push(s); S.otvoreno.add(s.id); oznaciPromjenu(); crtajUrednik();
  const li = $(`#stavka-${s.id}`); li?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  $('input, textarea', li)?.focus();
}
function obrisi(i) {
  const [s] = S.radna.stavke.splice(i, 1);
  S.otvoreno.delete(s.id); delete S.greske[s.id];
  oznaciPromjenu(); crtajUrednik();
  obavijest(`Obrisano: ${sazetakStavke(s).naziv}`, { akcija: { tekst: 'Poništi', fn: () => { S.radna.stavke.splice(i, 0, s); crtajUrednik(); } }, trajanje: 8000 });
}
function pomakni(i, d, fokus) {
  const j = i + d;
  if (j < 0 || j >= S.radna.stavke.length) return;
  const st = S.radna.stavke;
  [st[i], st[j]] = [st[j], st[i]];
  oznaciPromjenu(); crtajUrednik();
  if (fokus) $(`#stavka-${st[j].id} .rucka`)?.focus();
}
/** povlačenje za ručku (miš i prst) */
function vuci(rucka, id) {
  rucka.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    const popis = $('#popis'); const li = $(`#stavka-${id}`);
    if (!popis || !li) return;
    rucka.setPointerCapture(e.pointerId); li.classList.add('vuce');
    let pomaknuto = false;
    const pomak = (ev) => {
      const ostali = [...popis.children].filter((x) => x !== li);
      const iza = ostali.find((x) => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      if (iza ? li.nextElementSibling !== iza : popis.lastElementChild !== li) { popis.insertBefore(li, iza ?? null); pomaknuto = true; }
    };
    const kraj = () => {
      rucka.removeEventListener('pointermove', pomak); li.classList.remove('vuce');
      if (pomaknuto) {
        const red = [...popis.children].map((x) => x.dataset.id);
        S.radna.stavke.sort((a, b) => red.indexOf(a.id) - red.indexOf(b.id));
        oznaciPromjenu(); crtajUrednik();
      }
    };
    rucka.addEventListener('pointermove', pomak);
    rucka.addEventListener('pointerup', kraj, { once: true });
    rucka.addEventListener('pointercancel', kraj, { once: true });
  });
}

// ----- provjera i spremanje -----
function provjeriRadnu() {
  const { kat } = konfig(S.odabrana); const polja = new Set(kat.polja);
  const g = {};
  const dodajG = (id, polje, poruka) => { (g[id] ??= {})[polje] = poruka; };
  for (const s of S.radna.stavke) {
    if (s.tip === 'skupina') continue;
    if (!s.naziv.hr.trim()) dodajG(s.id, 'naziv.hr', 'Upiši naziv jela');
    const c = S.sirovo[`${s.id}:cijena`];
    if (c !== undefined ? uBroj(c) === null : !(s.cijena > 0)) dodajG(s.id, 'cijena', 'Upiši cijenu, npr. 8,90');
    const c2 = S.sirovo[`${s.id}:cijena2`];
    if (c2 !== undefined && c2.trim() !== '' && uBroj(c2) === null) dodajG(s.id, 'cijena2', 'Druga cijena nije broj');
    if (s.kolicina2 && s.cijena2 === null) dodajG(s.id, 'cijena2', 'Upiši drugu cijenu ili obriši drugu količinu');
    if (polja.has('slika') && !s.slika) dodajG(s.id, 'slika', 'Dodaj fotografiju jela');
    if (polja.has('boja') && !s.boja) dodajG(s.id, 'boja', 'Odaberi boju naljepnice');
  }
  if (polja.has('naslov') && !S.radna.naslov.hr.trim()) dodajG('kategorija', 'naslov.hr', 'Upiši naslov kategorije');
  if (!S.radna.stavke.some((s) => s.tip === 'jelo')) obavijest('Kategorija mora imati barem jedno jelo.', { vrsta: 'greska' });
  return g;
}

function crtajTrakuSpremanja() {
  const traka = $('#spremanje');
  if (!traka) return;
  traka.replaceChildren(
    h('p', {}, 'Imaš nespremljene promjene'),
    h('button', { class: 'gumb tih', type: 'button', onclick: () => { if (confirm('Odbaciti sve nespremljene promjene u ovoj kategoriji?')) { S.prljavo = false; odaberi(S.odabrana); } } }, 'Odbaci'),
    h('button', { class: 'gumb glavni', type: 'button', id: 'spremi', onclick: spremi }, 'Spremi i objavi'));
  traka.classList.toggle('vidljivo', S.prljavo);
  traka.inert = !S.prljavo;
}

async function spremi() {
  S.greske = provjeriRadnu();
  if (Object.keys(S.greske).length || !S.radna.stavke.some((s) => s.tip === 'jelo')) {
    for (const id of Object.keys(S.greske)) if (id !== 'kategorija') S.otvoreno.add(id);
    crtajUrednik();
    if (S.greske.kategorija) $('.postavke')?.setAttribute('open', '');
    const prva = $('.ima-gresku input, .ima-gresku textarea, .greska-polja');
    prva?.scrollIntoView({ block: 'center' }); if (prva?.focus) prva.focus();
    obavijest('Provjeri označena polja.', { vrsta: 'greska' });
    return;
  }
  const gumb = $('#spremi'); if (gumb) { gumb.disabled = true; gumb.textContent = 'Spremam…'; }
  try {
    const r = await api('PUT', '/kategorija', { kljuc: S.odabrana, verzija: S.jelovnik.sadrzaj.verzija, kategorija: S.radna });
    S.jelovnik.sadrzaj.verzija = r.verzija;
    S.jelovnik.sadrzaj.kategorije[S.odabrana] = r.kategorija;
    S.radna = kopija(r.kategorija); S.prljavo = false; S.sirovo = {}; S.greske = {};
    crtajUrednik();
    obavijest('Spremljeno. Stranica se osvježava…');
    pratiObjavu(true);
  } catch (err) {
    if (err.status === 409) { obavijest('Netko je u međuvremenu spremio promjene. Osvježi stranicu (tvoje promjene treba ponoviti).', { vrsta: 'greska', trajanje: 15000, akcija: { tekst: 'Osvježi', fn: () => location.reload() } }); }
    else if (err.status === 422 && err.podaci?.greske) {
      for (const g of err.podaci.greske) {
        const [, , , i, ...polje] = g.putanja;
        const s = typeof i === 'number' ? S.radna.stavke[i] : null;
        const id = s ? s.id : 'kategorija';
        const p = (s ? polje : g.putanja.slice(2)).join('.') || 'naziv.hr';
        (S.greske[id] ??= {})[p] = g.poruka; if (s) S.otvoreno.add(id);
      }
      crtajUrednik(); obavijest('Provjeri označena polja.', { vrsta: 'greska' });
    } else if (err.status !== 401) obavijest(err.message, { vrsta: 'greska', trajanje: 10000 });
    const g2 = $('#spremi'); if (g2) { g2.disabled = false; g2.textContent = 'Spremi i objavi'; }
  }
}

// ----- objava -----
function crtajStatus() {
  const el = $('#status'); if (!el || !S.objava) return;
  const o = S.objava;
  const odr = $('#odrzavanje'); if (odr) odr.hidden = !o.odrzavanje;
  const problem = o.stanje === 'greska' || o.stanje === 'nije-postavljeno';
  el.className = `status${o.stanje === 'u-tijeku' ? ' u-tijeku' : problem ? ' greska' : ''}`;
  el.title = o.stanje === 'greska' ? `Objava nije uspjela: ${o.poruka ?? ''}` : o.stanje === 'nije-postavljeno' ? 'Jelovnik se sprema, ali objava na stranicu još nije postavljena (izbornik → Objava stranice).' : '';
  $('.status-tekst', el).textContent = o.stanje === 'u-tijeku' ? 'Objavljujem…' : o.stanje === 'greska' ? 'Objava nije uspjela' : o.stanje === 'nije-postavljeno' ? 'Objava nije postavljena' : `Objavljeno ${sat(o.objavljeno)}`;
}
async function osvjeziObjavu() { try { S.objava = await api('GET', '/objava', undefined, { pozadina: true }); crtajStatus(); } catch { /* status nije bitan za rad */ } }
let pracenje = null;
function pratiObjavu(obavijesti) {
  clearTimeout(pracenje);
  // poslužitelj je objavu već pokrenuo — pokaži to odmah, ne tek nakon prve provjere
  S.objava = { ...S.objava, stanje: 'u-tijeku' }; crtajStatus();
  const pocetak = Date.now();
  // lokalno je objava gotova za nekoliko sekundi, na hostingu (GitHub Actions) za 1–2 minute: kasnije se pita rjeđe
  const korak = async () => {
    await osvjeziObjavu();
    if (S.objava?.stanje === 'u-tijeku' && Date.now() - pocetak < 10 * 60_000) { pracenje = setTimeout(korak, Date.now() - pocetak < 20_000 ? 1500 : 5000); return; }
    pracenje = null;
    if (!obavijesti) return;
    if (S.objava?.stanje === 'nije-postavljeno') obavijest('Jelovnik je spremljen, ali objava na stranicu još nije postavljena. Javi administratoru uredništva.', { vrsta: 'greska', trajanje: 12000 });
    else if (S.objava?.stanje === 'spremno') obavijest('Objavljeno — promjene su na stranici.', { akcija: { tekst: 'Pogledaj', fn: () => window.open('/', '_blank', 'noopener,noreferrer') }, trajanje: 8000 });
    else obavijest('Objava nije uspjela; stranica ostaje kakva je bila. Pokušaj spremiti ponovno ili javi administratoru.', { vrsta: 'greska', trajanje: 15000 });
  };
  pracenje = setTimeout(korak, 1500);
}
setInterval(() => { if (S.csrf && document.visibilityState === 'visible' && S.objava?.stanje !== 'u-tijeku') osvjeziObjavu(); }, 30_000);

// ----- dijalozi -----
function dijalog(...sadrzaj) {
  const d = h('dialog', {}, h('div', { class: 'dijalog' }, ...sadrzaj));
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal();
  return d;
}
async function dijalogPovijesti() {
  let popis;
  try { popis = await api('GET', '/povijest'); } catch (err) { obavijest(err.message, { vrsta: 'greska' }); return; }
  const d = dijalog(h('h2', {}, 'Povijest promjena'), h('p', {}, 'Svako spremanje je jedna verzija. Vraćanje stare verzije sprema je kao novu (ništa se ne gubi).'),
    h('ul', { class: 'povijest' }, popis.map((v) => h('li', { class: v.verzija === S.jelovnik.sadrzaj.verzija ? 'trenutna' : '' },
      h('div', {}, h('strong', {}, v.opis || `Verzija ${v.verzija}`), h('span', {}, `${vrijeme(v.azurirano)} · ${v.azurirao} · verzija ${v.verzija}`)),
      v.verzija === S.jelovnik.sadrzaj.verzija ? h('span', {}, 'trenutna') : h('button', { class: 'gumb', type: 'button', onclick: async () => {
        if (!confirm(`Vratiti jelovnik na verziju ${v.verzija} (${vrijeme(v.azurirano)})?`)) return;
        try {
          await api('POST', '/povijest/vrati', { verzija: v.verzija, trenutna: S.jelovnik.sadrzaj.verzija });
          d.close(); S.prljavo = false; await ucitajUrednik(); obavijest(`Vraćena verzija ${v.verzija}. Stranica se osvježava…`); pratiObjavu(true);
        } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
      } }, 'Vrati')))),
    h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori'));
}
async function dijalogKorisnika() {
  let popis;
  try { popis = await api('GET', '/korisnici'); } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska' }); return; }
  const rezultat = h('div', { class: 'poveznica', hidden: true });
  const pokaziPoveznicu = ({ ime, poveznica }) => {
    rezultat.replaceChildren(
      h('p', {}, h('strong', {}, `Pozivnica za ${ime}`), ' — vrijedi 72 sata i jednom. Pošalji je osobno (npr. porukom):'),
      h('input', { type: 'text', readonly: true, value: poveznica, 'aria-label': `Poveznica za ${ime}`, onfocus: (e) => e.target.select() }),
      h('button', { class: 'gumb', type: 'button', onclick: async (e) => {
        try { await navigator.clipboard.writeText(poveznica); e.currentTarget.textContent = 'Kopirano ✓'; } catch { obavijest('Kopiranje nije uspjelo — označi poveznicu i kopiraj.', { vrsta: 'greska' }); }
      } }, 'Kopiraj poveznicu'));
    rezultat.hidden = false; $('input', rezultat).focus();
  };
  const lista = h('ul', { class: 'povijest' });
  const osvjezi = async () => { try { popis = await api('GET', '/korisnici'); crtaj(); } catch { /* ostaje zadnji popis */ } };
  const radnja = (tekst, potvrda, fn, opasno) => h('button', { class: `gumb${opasno ? ' opasno' : ''}`, type: 'button', onclick: async () => {
    if (!confirm(potvrda)) return;
    try { await fn(); osvjezi(); } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
  } }, tekst);
  function crtaj() {
    lista.replaceChildren(...popis.map((k) => h('li', {},
      h('div', {}, h('strong', {}, k.ime, k.uloga === 'admin' ? ' · administrator' : ''),
        h('span', {}, `${k.stanje} · zadnja prijava ${vrijeme(k.zadnjaPrijava)}${k.stanje === 'aktivan' ? ` · rezervnih kodova: ${k.rezervnih}` : ''}`)),
      k.ime === S.ime ? h('span', {}, 'ti') : h('span', { class: 'radnje' },
        radnja('Nova pozivnica', `Nova pozivnica za ${k.ime}? Dosadašnja lozinka i dvostruka potvrda prestaju vrijediti, a ${k.ime} se odjavljuje (npr. kad je izgubio mobitel).`,
          async () => pokaziPoveznicu(await api('POST', '/korisnici/pozivnica', { ime: k.ime, resetiraj: true }))),
        radnja('Ukloni', `Ukloniti korisnika ${k.ime}? Odmah gubi pristup uredništvu.`,
          async () => { await api('POST', '/korisnici/obrisi', { ime: k.ime }); obavijest(`Korisnik ${k.ime} je uklonjen.`); }, true)))));
  }
  crtaj();
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'pozovi', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    try { pokaziPoveznicu(await api('POST', '/korisnici/pozivnica', { ime: forma.ime.value })); forma.reset(); osvjezi(); } catch (err) { porukaGreske(greska, err.message); }
  } },
  h('label', { class: 'polje' }, h('span', {}, 'Pozovi novog korisnika'), h('input', { name: 'ime', type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'korisničko ime, npr. tomislav', required: true })),
  h('button', { class: 'gumb glavni', type: 'submit' }, 'Napravi pozivnicu'));
  const d = dijalog(h('h2', {}, 'Korisnici'),
    h('p', {}, 'Svatko se prijavljuje svojom lozinkom i kodom s mobitela. Pozivnica je poveznica kojom novi korisnik sam odabere lozinku i jednom skenira QR kod.'),
    lista, forma, greska, rezultat, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori'));
}

async function dijalogObjave() {
  let o;
  try { o = await api('GET', '/objava/postavke'); } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska' }); return; }
  const ponovi = h('button', { class: 'gumb', type: 'button', onclick: async () => {
    try { await api('POST', '/objava/ponovi', {}); d.close(); obavijest('Objava je pokrenuta.'); pratiObjavu(true); } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
  } }, 'Objavi ponovno');
  if (o.vrsta === 'lokalno') {
    const d = dijalog(h('h2', {}, 'Objava stranice'),
      h('p', {}, 'Lokalno se stranica nakon svakog spremanja izgradi na ovom računalu i odmah je na adresi poslužitelja (npm start).'),
      h('div', { class: 'dva' }, ponovi, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori')));
    return;
  }
  // hosting: spremanje šalje jelovnik na GitHub (grana sa sadržajem), a GitHub Actions izgradi stranicu i prenese je na hosting
  const istjece = o.tokenIstjece ? new Date(o.tokenIstjece) : null;
  const dana = istjece ? Math.floor((istjece - Date.now()) / 86_400_000) : null;
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'dijalog-forma', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    const gumb = $('button[type=submit]', forma); gumb.disabled = true;
    try {
      await api('POST', '/objava/postavke', { repo: forma.repo.value, grana: forma.grana.value, token: forma.token.value });
      d.close(); obavijest('Postavke objave su spremljene i veza s GitHubom radi.');
    } catch (err) { porukaGreske(greska, err.message); gumb.disabled = false; }
  } },
  h('label', { class: 'polje' }, h('span', {}, 'GitHub repozitorij'), h('input', { name: 'repo', type: 'text', value: o.repo ?? '', placeholder: 'vlasnik/repozitorij', autocomplete: 'off', spellcheck: 'false' })),
  h('label', { class: 'polje' }, h('span', {}, 'Grana za sadržaj'), h('input', { name: 'grana', type: 'text', value: o.grana ?? 'sadrzaj', autocomplete: 'off', spellcheck: 'false' })),
  h('label', { class: 'polje' }, h('span', {}, 'GitHub token'), h('input', { name: 'token', type: 'password', autocomplete: 'off', placeholder: o.tokenPostavljen ? 'postavljen — upiši samo za zamjenu' : 'github_pat_…' }),
    h('small', {}, 'Fine-grained token samo za ovaj repozitorij: Contents (read and write), Actions (read). Sprema se samo na poslužitelju i više se ne prikazuje.')),
  greska,
  h('button', { class: 'gumb glavni', type: 'submit' }, 'Spremi i provjeri vezu'));
  const d = dijalog(h('h2', {}, 'Objava stranice'),
    h('p', {}, 'Nakon spremanja jelovnik ide na GitHub, a GitHub Actions za 1–2 minute izgradi stranicu i prenese je na hosting.'),
    o.tokenPostavljen && dana !== null ? h('p', { class: `poruka ${dana < 30 ? 'greska' : 'info'}` },
      dana < 0 ? 'GitHub token je istekao — objava ne radi dok ne upišeš novi.' : `GitHub token vrijedi do ${istjece.toLocaleDateString('hr-HR')} (još ${dana} ${mnozina(dana, ['dan', 'dana', 'dana'])}).`) : null,
    forma,
    h('div', { class: 'dva' }, ponovi, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori')));
}

// posjetitelji vide "Uskoro se vraćamo" (503), uredništvo radi normalno; administratorov preglednik može i dalje vidjeti stranicu
async function dijalogOdrzavanja() {
  let o;
  try { o = await api('GET', '/odrzavanje'); } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska' }); return; }
  const postavi = async (tijelo, poruka) => {
    try {
      o = await api('POST', '/odrzavanje', tijelo);
      S.objava = { ...S.objava, odrzavanje: o.ukljuceno }; crtajStatus();
      d.close(); obavijest(poruka, { trajanje: 7000 });
    } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
  };
  const zatvori = h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori');
  const d = o.ukljuceno
    ? dijalog(h('h2', {}, 'Održavanje stranice'),
      h('p', { class: 'poruka upozorenje' }, `Održavanje je uključeno${o.od ? ` od ${vrijeme(o.od)}` : ''}${o.ime ? ` (${o.ime})` : ''}. Posjetitelji umjesto stranice vide poruku „Uskoro se vraćamo”.`),
      h('p', {}, o.pregled ? 'Na ovom uređaju i dalje vidiš pravu stranicu, da možeš provjeriti promjene prije nego što je otvoriš svima.' : 'Na ovom uređaju vidiš isto što i posjetitelji.'),
      h('div', { class: 'dva' },
        h('button', { class: 'gumb', type: 'button', onclick: () => postavi({ ukljuceno: true, pregled: !o.pregled }, o.pregled ? 'Sada na ovom uređaju vidiš poruku kao posjetitelji.' : 'Na ovom uređaju opet vidiš stranicu.') },
          o.pregled ? 'Pokaži mi poruku' : 'Pokaži mi stranicu'),
        h('button', { class: 'gumb glavni', type: 'button', onclick: () => postavi({ ukljuceno: false }, 'Održavanje je isključeno — stranica je opet vidljiva svima.') }, 'Isključi održavanje')),
      zatvori)
    : dijalog(h('h2', {}, 'Održavanje stranice'),
      h('p', {}, 'Dok je održavanje uključeno, posjetitelji umjesto stranice vide poruku „Uskoro se vraćamo” s adresama, Woltom i telefonom. Tražilice dobiju znak da je to privremeno.'),
      h('p', {}, 'Uredništvo radi normalno i spremanja se i dalje objavljuju — svima se pokažu kad isključiš održavanje. I ti ćeš vidjeti poruku; pravu stranicu na ovom uređaju možeš otvoriti gumbom „Pokaži mi stranicu”.'),
      h('div', { class: 'dva' }, zatvori,
        h('button', { class: 'gumb glavni', type: 'button', onclick: () => postavi({ ukljuceno: true }, 'Održavanje je uključeno — posjetitelji vide poruku „Uskoro se vraćamo”.') }, 'Uključi održavanje')));
}

function dijalogLozinke() {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'dijalog', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    if (forma.nova.value !== forma.ponovi.value) { porukaGreske(greska, 'Nove lozinke se ne podudaraju.'); return; }
    try { await api('POST', '/lozinka', { stara: forma.stara.value, nova: forma.nova.value }); d.close(); obavijest('Lozinka promijenjena. Ostali uređaji su odjavljeni.'); } catch (err) { porukaGreske(greska, err.message); }
  } },
  h('h2', {}, 'Promijeni lozinku'),
  h('label', { class: 'polje' }, h('span', {}, 'Trenutna lozinka'), h('input', { name: 'stara', type: 'password', autocomplete: 'current-password', required: true })),
  h('label', { class: 'polje' }, h('span', {}, 'Nova lozinka'), h('input', { name: 'nova', type: 'password', autocomplete: 'new-password', minlength: 12, required: true }), h('small', {}, 'Najmanje 12 znakova.')),
  h('label', { class: 'polje' }, h('span', {}, 'Ponovi novu lozinku'), h('input', { name: 'ponovi', type: 'password', autocomplete: 'new-password', required: true })),
  greska,
  h('div', { class: 'dva' }, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Odustani'), h('button', { class: 'gumb glavni', type: 'submit' }, 'Spremi')));
  const d = h('dialog', {}, forma); d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal();
}
async function odjava() {
  if (S.prljavo && !confirm('Imaš nespremljene promjene. Odjaviti se svejedno?')) return;
  try { await api('POST', '/odjava', {}); } catch { /* svejedno */ }
  Object.assign(S, { csrf: null, ime: null, jelovnik: null, prljavo: false });
  zaslonPrijave('Odjavljen si.');
}
addEventListener('beforeunload', (e) => { if (S.prljavo) { e.preventDefault(); e.returnValue = ''; } });

// ---------------- pokretanje ----------------
(async function start() {
  const m = /^#pozivnica=([A-Za-z0-9_-]{20,100})$/.exec(location.hash);
  if (m) { history.replaceState(null, '', location.pathname); zaslonPozivnice(m[1]); return; } // token ne ostaje u adresi
  try {
    const st = await api('GET', '/stanje');
    if (st.korak === 'puno') prijavljen(st);
    else if (st.korak === '2fa') zaslonKoda();
    else if (st.prvoPostavljanje) zaslonPostavljanja(st);
    else zaslonPrijave(st.razlog ? `${porukaIsteka(st.razlog)}.` : undefined);
  } catch { ekran(h('h1', {}, 'Uredništvo nije dostupno'), h('p', { class: 'uvod' }, 'Poslužitelj ne odgovara. Pokušaj ponovno za minutu.')); }
})();
