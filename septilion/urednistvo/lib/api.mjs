// API uredništva (/urednistvo/api/*). Pravila za svaki zahtjev koji nešto mijenja:
//  - Origin mora biti naša stranica (+ Sec-Fetch-Site same-origin) — zaštita od CSRF-a
//  - tijelo je JSON (ili slika) s ograničenom veličinom
//  - prijavljeni zahtjevi nose CSRF token iz sesije (zaglavlje X-CSRF) i provjerava se je li sesija i dalje valjana
//  - poruke o neuspjeloj prijavi ne otkrivaju postoji li korisnik
// Isti ugovor ima PHP inačica za hosting (urednistvo/php/) — testovi tests/urednistvo/ provjeravaju obje.
import { LOKALI, BOJE } from '../../src/data/lokali.mjs';
import { Greska } from './spremiste.mjs';
import { NAJVECA_DATOTEKA } from './slike.mjs';
import { ispravnoIme, normalizirajIme, stanjeRacuna, PORUKA_IME } from './korisnici.mjs';
import {
  hashLozinke, provjeriLozinku, lazniZapis, provjeriNovuLozinku, novaTotpTajna, provjeriTotp, otpauthUri,
  noviRezervniKodovi, pronadjiRezervni, jednako,
} from './sigurnost.mjs';
import { ogranicenje } from './ogranicenja.mjs';
import { imaPregled, kolacicPregleda } from './odrzavanje.mjs';

export function zaglavljaUrednistva({ produkcija }) {
  return {
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    ...(produkcija ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

const PREVISE = (s) => `Previše pokušaja. Pokušaj ponovno za ${Math.max(1, Math.ceil(s / 60))} min.`;
const KRIVA_PRIJAVA = 'Pogrešno korisničko ime ili lozinka.';
const grupiraj = (tajna) => tajna.replace(/(.{4})/g, '$1 ').trim();
const LOKALNE_ADRESE = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function api({ p, korisnici, sesije, spremiste, slike, objava, postavljanje, odrzavanje, zapisnik = console }) {
  const zag = zaglavljaUrednistva(p);
  const poIp = ogranicenje({ prozorMs: 15 * 60_000, najvise: 20 });
  const poKorisniku = ogranicenje({ prozorMs: 15 * 60_000, najvise: 5 });

  const ip = (req) => {
    if (p.proxy) { const x = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean); if (x.length) return x[x.length - 1]; }
    return req.socket.remoteAddress ?? '?';
  };
  /** prvo postavljanje bez koda samo lokalno: ne produkcija, bez proxyja, zahtjev s ovog računala */
  const kodPotreban = (req) => p.produkcija || p.proxy || !LOKALNE_ADRESE.has(req.socket.remoteAddress);
  /** dopušteni izvori: javna adresa; lokalno i adresa s kojom je otvoreno (localhost/127.0.0.1) */
  const istiIzvor = (req) => {
    const o = req.headers.origin;
    if (!o || req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return false;
    if (o === p.origin) return true;
    if (p.produkcija) return false;
    try { const u = new URL(o); return ['localhost', '127.0.0.1'].includes(u.hostname) && u.host === req.headers.host; } catch { return false; }
  };
  const pozadina = (req) => req.headers['x-pozadina'] === '1';

  function json(res, status, tijelo, dodatno = {}) {
    const b = Buffer.from(JSON.stringify(tijelo));
    res.writeHead(status, { ...zag, ...dodatno, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length });
    res.end(b);
  }
  async function tijelo(req, granica) {
    const duljina = Number(req.headers['content-length'] ?? 0);
    if (duljina > granica) throw new Greska(413, 'Zahtjev je prevelik');
    const dijelovi = []; let n = 0;
    for await (const d of req) { n += d.length; if (n > granica) throw new Greska(413, 'Zahtjev je prevelik'); dijelovi.push(d); }
    return Buffer.concat(dijelovi);
  }
  async function jsonTijelo(req, granica = 2 * 1024 * 1024) {
    if (!/^application\/json\b/.test(String(req.headers['content-type'] ?? ''))) throw new Greska(415, 'Očekuje se JSON');
    try { return JSON.parse((await tijelo(req, granica)).toString('utf8') || '{}'); } catch (e) { if (e instanceof Greska) throw e; throw new Greska(400, 'Neispravan JSON'); }
  }
  const istekla = (razlog) => new Greska(401, 'Prijava je istekla', { razlog: razlog ?? 'nema' });
  /** prijavljeni korisnik (sesija 'puno', korisnik postoji, verzija sesije ista) */
  function prijavljen(req, { csrf, admin = false }) {
    const ses = sesije.procitaj(req, { pozadina: pozadina(req) });
    if (!ses || ses.s.korak !== 'puno') throw istekla(req.razlogIsteka);
    const k = korisnici.pronadji(ses.s.ime);
    if (!k || (k.sesijaVerzija ?? 1) !== ses.s.sesijaVerzija) { sesije.obrisi({ setHeader() {} }, ses.id); throw istekla('odjavljen'); }
    if (csrf && !jednako(req.headers['x-csrf'] ?? '', ses.s.csrf)) throw new Greska(403, 'Neispravan zahtjev (CSRF)');
    if (admin && k.uloga !== 'admin') throw new Greska(403, 'Samo administrator uredništva.');
    return { ses, k };
  }
  function zakljucano(kljucevi) {
    const s = Math.max(...kljucevi.map(([o, k]) => o.cekaj(k)));
    if (s > 0) throw new Greska(429, PREVISE(s), { cekaj: s });
  }
  function pozivnicaZa(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    return korisnici.poPozivnici(token);
  }
  function zapocni2fa(res, ime, staraId) {
    const tajna = novaTotpTajna();
    sesije.stvori(res, { ime, korak: 'postavljanje-2fa', totpTajna: tajna, pokusaji: 0 }, staraId);
    return { korak: 'postavljanje-2fa', uri: otpauthUri(tajna, ime), kljuc: grupiraj(tajna) };
  }
  function prijaviPuno(res, k, staraId) {
    const s = sesije.stvori(res, { ime: k.ime, korak: 'puno', sesijaVerzija: k.sesijaVerzija ?? 1 }, staraId);
    return { ime: k.ime, uloga: k.uloga ?? 'urednik', csrf: s.csrf };
  }
  function postaviLozinku(n, hash) {
    korisnici.promijeni(n, (k) => { Object.assign(k, { lozinka: hash, pozivnica: null, totp: null, rezervni: [], zadnjiKorak: -1, sesijaVerzija: (k.sesijaVerzija ?? 1) + 1 }); });
    sesije.odjaviKorisnika(n);
  }
  // produkcija: javna adresa; lokalno: adresa s kojom je uredništvo otvoreno (localhost ili 127.0.0.1)
  const poveznica = (req, token) => `${p.produkcija ? p.origin : `http://${req.headers.host}`}/urednistvo/#pozivnica=${token}`;

  const rute = {
    'GET /stanje': async (req, res) => {
      const ses = sesije.procitaj(req, { pozadina: pozadina(req) });
      const k = ses?.s.korak === 'puno' ? korisnici.pronadji(ses.s.ime) : null;
      const puno = k && (k.sesijaVerzija ?? 1) === ses.s.sesijaVerzija;
      let razlog = ses ? null : req.razlogIsteka ?? null;
      if (ses?.s.korak === 'puno' && !puno) { sesije.obrisi(res, ses.id); razlog = 'odjavljen'; }
      const prvo = korisnici.broj() === 0;
      if (prvo && kodPotreban(req)) postavljanje.kod(); // datoteka s kodom postoji čim se uredništvo otvori
      json(res, 200, {
        korak: puno ? 'puno' : ses && ses.s.korak !== 'puno' ? ses.s.korak : null,
        ime: puno ? k.ime : null, uloga: puno ? k.uloga ?? 'urednik' : null, csrf: puno ? ses.s.csrf : null,
        razlog,
        prvoPostavljanje: prvo, kodPotreban: prvo ? kodPotreban(req) : undefined,
      });
    },

    // prvi račun: uvijek na /urednistvo; na serveru uz kod iz PRVO-POSTAVLJANJE.txt
    'POST /postavljanje': async (req, res) => {
      zakljucano([[poIp, ip(req)]]);
      const { kod, ime, lozinka } = await jsonTijelo(req, 8192);
      if (korisnici.broj() > 0) throw new Greska(409, 'Uredništvo je već postavljeno. Prijavi se.');
      if (kodPotreban(req) && !postavljanje.provjeri(kod)) {
        poIp.zabiljezi(ip(req));
        spremiste.dnevnik({ ime: '-', ip: ip(req), radnja: 'pogrešan kod za postavljanje' });
        throw new Greska(403, 'Kod za postavljanje nije ispravan.');
      }
      const n = normalizirajIme(ime);
      if (!ispravnoIme(n)) throw new Greska(422, PORUKA_IME);
      const losa = provjeriNovuLozinku(lozinka, n);
      if (losa) throw new Greska(422, losa);
      const hash = await hashLozinke(lozinka);
      if (korisnici.broj() > 0) throw new Greska(409, 'Uredništvo je već postavljeno. Prijavi se.');
      korisnici.stvoriPrvog(n);
      postaviLozinku(n, hash);
      postavljanje.ukloni();
      spremiste.dnevnik({ ime: n, ip: ip(req), radnja: 'prvo postavljanje: lozinka postavljena' });
      json(res, 200, zapocni2fa(res, n, sesije.procitaj(req)?.id));
    },

    'POST /pozivnica/provjeri': async (req, res) => {
      zakljucano([[poIp, ip(req)]]);
      const { token } = await jsonTijelo(req, 4096);
      const k = pozivnicaZa(token);
      if (!k) { poIp.zabiljezi(ip(req)); throw new Greska(404, 'Pozivnica ne vrijedi ili je istekla.'); }
      json(res, 200, { ime: k.ime });
    },

    'POST /pozivnica': async (req, res) => {
      zakljucano([[poIp, ip(req)]]);
      const { token, lozinka } = await jsonTijelo(req, 8192);
      const k = pozivnicaZa(token);
      if (!k) { poIp.zabiljezi(ip(req)); throw new Greska(404, 'Pozivnica ne vrijedi ili je istekla.'); }
      const losa = provjeriNovuLozinku(lozinka, k.ime);
      if (losa) throw new Greska(422, losa);
      postaviLozinku(k.ime, await hashLozinke(lozinka));
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: 'pozivnica: lozinka postavljena' });
      json(res, 200, zapocni2fa(res, k.ime, sesije.procitaj(req)?.id));
    },

    'POST /2fa/potvrdi': async (req, res) => {
      const ses = sesije.procitaj(req);
      if (!ses || ses.s.korak !== 'postavljanje-2fa') throw new Greska(401, 'Postavljanje je isteklo, prijavi se ponovno.', { razlog: req.razlogIsteka ?? 'nema' });
      const { kod } = await jsonTijelo(req, 1024);
      const korak = provjeriTotp(ses.s.totpTajna, kod);
      if (korak === null) {
        if (++ses.s.pokusaji >= 5) { sesije.obrisi(res, ses.id); throw new Greska(429, 'Previše pogrešnih kodova. Prijavi se ponovno.'); }
        sesije.spremi(ses);
        throw new Greska(400, 'Kod nije ispravan. Upiši šesteroznamenkasti kod iz aplikacije.');
      }
      const { kodovi, hashevi } = noviRezervniKodovi();
      const k = korisnici.promijeni(ses.s.ime, (x) => { Object.assign(x, { totp: { tajna: ses.s.totpTajna }, zadnjiKorak: korak, rezervni: hashevi, zadnjaPrijava: new Date().toISOString() }); });
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: 'dvostruka potvrda uključena' });
      json(res, 200, { ...prijaviPuno(res, k, ses.id), rezervniKodovi: kodovi });
    },

    'POST /prijava': async (req, res) => {
      const { ime, lozinka } = await jsonTijelo(req, 4096);
      const n = normalizirajIme(ime).slice(0, 64);
      zakljucano([[poIp, ip(req)], [poKorisniku, n]]);
      const k = korisnici.pronadji(n);
      const ok = (await provjeriLozinku(String(lozinka ?? '').slice(0, 200), k?.lozinka ?? await lazniZapis())) && Boolean(k?.lozinka);
      if (!ok) {
        poIp.zabiljezi(ip(req)); poKorisniku.zabiljezi(n);
        spremiste.dnevnik({ ime: n, ip: ip(req), radnja: 'neuspjela prijava' });
        throw new Greska(401, KRIVA_PRIJAVA);
      }
      const staraId = sesije.procitaj(req)?.id;
      if (!k.totp) { json(res, 200, zapocni2fa(res, k.ime, staraId)); return; }
      sesije.stvori(res, { ime: k.ime, korak: '2fa', pokusaji: 0 }, staraId);
      json(res, 200, { korak: '2fa' });
    },

    'POST /prijava/2fa': async (req, res) => {
      const ses = sesije.procitaj(req);
      if (!ses || ses.s.korak !== '2fa') throw new Greska(401, 'Prijava je istekla, upiši lozinku ponovno.', { razlog: req.razlogIsteka ?? 'nema' });
      zakljucano([[poKorisniku, ses.s.ime]]);
      const { kod } = await jsonTijelo(req, 1024);
      const k = korisnici.pronadji(ses.s.ime);
      let rezervni = -1;
      const korak = k?.totp ? provjeriTotp(k.totp.tajna, kod, k.zadnjiKorak ?? -1) : null;
      if (korak === null && k) rezervni = pronadjiRezervni(kod, k.rezervni);
      if (!k || (korak === null && rezervni < 0)) {
        poKorisniku.zabiljezi(ses.s.ime);
        spremiste.dnevnik({ ime: ses.s.ime, ip: ip(req), radnja: 'pogrešan kod dvostruke potvrde' });
        if (++ses.s.pokusaji >= 5) { sesije.obrisi(res, ses.id); throw new Greska(429, 'Previše pogrešnih kodova. Prijavi se ponovno.'); }
        sesije.spremi(ses);
        throw new Greska(400, 'Kod nije ispravan.');
      }
      const nk = korisnici.promijeni(k.ime, (x) => {
        if (korak !== null) x.zadnjiKorak = korak;
        else x.rezervni = x.rezervni.filter((_, i) => i !== rezervni);
        x.zadnjaPrijava = new Date().toISOString();
      });
      poKorisniku.ponisti(k.ime);
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: korak !== null ? 'prijava' : 'prijava rezervnim kodom' });
      json(res, 200, { ...prijaviPuno(res, nk, ses.id), preostaloRezervnih: rezervni >= 0 ? nk.rezervni.length : undefined });
    },

    'POST /odjava': async (req, res) => {
      const ses = sesije.procitaj(req);
      if (ses) spremiste.dnevnik({ ime: ses.s.ime, ip: ip(req), radnja: 'odjava' });
      sesije.obrisi(res, ses?.id);
      json(res, 200, { ok: true });
    },

    'GET /jelovnik': async (req, res) => {
      prijavljen(req, { csrf: false });
      json(res, 200, { lokali: LOKALI, boje: BOJE, sadrzaj: spremiste.ucitaj() });
    },

    'PUT /kategorija': async (req, res) => {
      const { k } = prijavljen(req, { csrf: true });
      const { kljuc, verzija, kategorija } = await jsonTijelo(req);
      const s = await spremiste.spremiKategoriju(String(kljuc), kategorija, Number(verzija), k.ime);
      objava.zatrazi();
      json(res, 200, { verzija: s.verzija, kategorija: s.kategorije[kljuc] });
    },

    'POST /slike': async (req, res) => {
      const { k } = prijavljen(req, { csrf: true });
      if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(String(req.headers['content-type'] ?? ''))) throw new Greska(415, 'Podržani formati: JPG, PNG, WebP, AVIF');
      const r = await slike.obradi(await tijelo(req, NAJVECA_DATOTEKA));
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: 'fotografija učitana', kljuc: r.kljuc });
      json(res, 201, r);
    },

    'GET /objava': async (req, res) => {
      prijavljen(req, { csrf: false });
      json(res, 200, { ...objava.stanje(), odrzavanje: odrzavanje.ukljuceno() });
    },
    // lokalno se stranica gradi na ovom računalu; na hostingu (PHP) ovdje su postavke objave preko GitHuba
    'GET /objava/postavke': async (req, res) => {
      prijavljen(req, { csrf: false, admin: true });
      json(res, 200, { vrsta: 'lokalno' });
    },
    'POST /objava/ponovi': async (req, res) => {
      const { k } = prijavljen(req, { csrf: true, admin: true });
      objava.zatrazi(0);
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: 'ponovna objava' });
      json(res, 200, { ok: true });
    },

    // ----- održavanje stranice (samo administrator): posjetitelji vide poruku, uredništvo radi normalno -----
    'GET /odrzavanje': async (req, res) => {
      prijavljen(req, { csrf: false, admin: true });
      json(res, 200, { ...odrzavanje.stanje(), pregled: imaPregled(req) });
    },
    'POST /odrzavanje': async (req, res) => {
      const { k } = prijavljen(req, { csrf: true, admin: true });
      const { ukljuceno, pregled } = await jsonTijelo(req, 1024);
      if (typeof ukljuceno !== 'boolean') throw new Greska(422, 'Neispravan zahtjev.');
      const prije = odrzavanje.ukljuceno();
      const st = odrzavanje.postavi(ukljuceno, k.ime);
      // ovaj preglednik i dalje vidi stranicu (osim ako administrator želi vidjeti poruku kao posjetitelj)
      const vidi = ukljuceno && pregled !== false;
      res.appendHeader('Set-Cookie', kolacicPregleda(vidi, p.produkcija));
      if (prije !== ukljuceno) spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: ukljuceno ? 'održavanje uključeno' : 'održavanje isključeno' });
      json(res, 200, { ...st, pregled: vidi });
    },

    'GET /povijest': async (req, res) => {
      prijavljen(req, { csrf: false });
      json(res, 200, spremiste.povijest());
    },

    'POST /povijest/vrati': async (req, res) => {
      const { k } = prijavljen(req, { csrf: true });
      const { verzija, trenutna } = await jsonTijelo(req, 1024);
      const s = await spremiste.vrati(Number(verzija), Number(trenutna), k.ime);
      objava.zatrazi();
      json(res, 200, { verzija: s.verzija });
    },

    'POST /lozinka': async (req, res) => {
      const { ses, k } = prijavljen(req, { csrf: true });
      zakljucano([[poKorisniku, k.ime]]);
      const { stara, nova } = await jsonTijelo(req, 4096);
      if (!(await provjeriLozinku(String(stara ?? '').slice(0, 200), k.lozinka))) { poKorisniku.zabiljezi(k.ime); throw new Greska(400, 'Trenutna lozinka nije ispravna.'); }
      const losa = provjeriNovuLozinku(nova, k.ime);
      if (losa) throw new Greska(422, losa);
      const hash = await hashLozinke(nova);
      const nk = korisnici.promijeni(k.ime, (x) => { Object.assign(x, { lozinka: hash, sesijaVerzija: (x.sesijaVerzija ?? 1) + 1 }); });
      sesije.odjaviKorisnika(k.ime, ses.id); // ostale sesije (drugi uređaji) se odjavljuju
      ses.s.sesijaVerzija = nk.sesijaVerzija; sesije.spremi(ses);
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: 'lozinka promijenjena' });
      json(res, 200, { ok: true });
    },

    // ----- korisnici (samo administrator) -----
    'GET /korisnici': async (req, res) => {
      prijavljen(req, { csrf: false, admin: true });
      json(res, 200, korisnici.sve().korisnici.map((x) => ({
        ime: x.ime, uloga: x.uloga ?? 'urednik', stanje: stanjeRacuna(x), zadnjaPrijava: x.zadnjaPrijava ?? null, rezervnih: x.rezervni?.length ?? 0,
      })));
    },
    'POST /korisnici/pozivnica': async (req, res) => {
      const { k } = prijavljen(req, { csrf: true, admin: true });
      const { ime, resetiraj } = await jsonTijelo(req, 1024);
      const n = normalizirajIme(ime);
      if (!ispravnoIme(n)) throw new Greska(422, PORUKA_IME);
      if (n === k.ime) throw new Greska(422, 'Za svoj račun upotrijebi "Promijeni lozinku".');
      const postoji = korisnici.pronadji(n);
      if (postoji?.lozinka && !resetiraj) throw new Greska(409, `Korisnik "${n}" već postoji.`);
      const token = korisnici.pozivnica(n, { resetiraj: Boolean(resetiraj) });
      if (resetiraj) sesije.odjaviKorisnika(n);
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: resetiraj && postoji ? `nova pozivnica (reset): ${n}` : `pozivnica: ${n}` });
      json(res, 200, { ime: n, poveznica: poveznica(req, token) });
    },
    'POST /korisnici/obrisi': async (req, res) => {
      const { k } = prijavljen(req, { csrf: true, admin: true });
      const n = normalizirajIme((await jsonTijelo(req, 1024)).ime);
      if (n === k.ime) throw new Greska(422, 'Ne možeš ukloniti svoj račun.');
      if (!korisnici.pronadji(n)) throw new Greska(404, 'Korisnik ne postoji.');
      korisnici.obrisi(n);
      sesije.odjaviKorisnika(n);
      spremiste.dnevnik({ ime: k.ime, ip: ip(req), radnja: `korisnik uklonjen: ${n}` });
      json(res, 200, { ok: true });
    },
  };

  return async function obradi(req, res, podput) {
    try {
      // minijature: GET /slike/<ključ>
      const m = /^\/slike\/([a-z0-9_-]{1,60})$/.exec(podput);
      if (req.method === 'GET' && m) {
        prijavljen(req, { csrf: false });
        const b = await slike.minijatura(m[1]);
        if (!b) throw new Greska(404, 'Nema fotografije');
        res.writeHead(200, { ...zag, 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=3600', 'Content-Length': b.length });
        res.end(b); return;
      }
      const ruta = rute[`${req.method} ${podput}`];
      if (!ruta) throw new Greska(404, 'Nepoznata adresa');
      if (req.method !== 'GET' && !istiIzvor(req)) throw new Greska(403, 'Zahtjev nije s ove stranice');
      await ruta(req, res);
    } catch (e) {
      if (res.headersSent) { res.destroy(); return; }
      if (e instanceof Greska || e.status) json(res, e.status, { greska: e.message, ...(e.podaci ?? {}) }, e.status === 429 && e.podaci?.cekaj ? { 'Retry-After': String(e.podaci.cekaj) } : {});
      else { zapisnik.error('[uredništvo]', e); json(res, 500, { greska: 'Greška na poslužitelju.' }); }
    }
  };
}
