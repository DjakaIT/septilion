// Uredništvo od početka do kraja (pravi HTTP, prava izgradnja stranice) — isti testovi za obje pozadine:
// api-node.test.mjs (npm start) i api-php.test.mjs (hosting). Sigurnost, prijava, sesije, spremanje, objava, fotografije.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { posluzitelj, klijent, kod, postaviPrvog, datotekaSesije, POSLUZITELJ, imaPhp, PHP_ORIGIN, GITHUB_TOKEN } from './pomoc.mjs';
import { pokreni } from '../../urednistvo/posluzitelj.mjs';
import { ROOT } from '../../urednistvo/lib/postavke.mjs';
import { provjeri } from '../../src/data/sadrzaj.mjs';
import { zip } from '../../scripts/zip.mjs';

sharp.cache(false); // sharp inače drži datoteke otvorenima (Windows ih tada ne može obrisati)
const API = '/urednistvo/api';
/** samo status odgovora; tijelo se pročita do kraja (nepročitan odgovor u Node 22 ruši fetch kad poslužitelj zatvori vezu) */
const status = async (...a) => { const r = await fetch(...a); await r.arrayBuffer(); return r.status; };
const NODE = POSLUZITELJ === 'node', PHP = POSLUZITELJ === 'php';
const preskoci = PHP && !imaPhp() ? 'nema PHP-a (postavi PHP_BINARY)' : false;

describe(`uredništvo (${POSLUZITELJ})`, { skip: preskoci }, () => {
  let srv, t; // t = { k, kljuc, rezervni, lozinka, ime }
  before(async () => { srv = await posluzitelj(); });
  after(async () => { await srv?.zatvori(); });

  test('zaglavlja uredništva (default-src none, noindex, no-store); nema pristupa izvornim datotekama', async () => {
    const u = await fetch(`${srv.url}/urednistvo`);
    await u.arrayBuffer();
    assert.equal(u.status, 200);
    assert.match(u.headers.get('content-security-policy'), /^default-src 'none'; script-src 'self'; style-src 'self';/);
    assert.match(u.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(u.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.equal(u.headers.get('cache-control'), 'no-store');
    assert.equal(u.headers.get('x-frame-options'), 'DENY');
    for (const put of ['/urednistvo/static/..%2f..%2fpackage.json', '/urednistvo/static/%2e%2e%2flib%2fapi.mjs', '/urednistvo/lib/api.php', '/urednistvo/konfiguracija.json', '/urednistvo/index.php']) {
      const r = await fetch(srv.url + put);
      const tekst = await r.text();
      assert.ok(r.status === 404 || (r.status === 200 && tekst.startsWith('<!doctype html>') && tekst.includes('Uredništvo')), `${put} -> ${r.status}`);
      assert.ok(!tekst.includes('"name": "septillion-web"') && !tekst.includes('export function api') && !tekst.includes('<?php') && !tekst.includes('"lokalneSlike"'), `${put} otkriva datoteku`);
    }
    assert.equal((await status(`${srv.url}/urednistvo`, { method: 'DELETE' })), 405);
    const qr = await fetch(`${srv.url}/urednistvo/static/qrcode.mjs`);
    await qr.arrayBuffer();
    assert.equal(qr.status, 200); assert.match(qr.headers.get('content-type'), /javascript/);
  });

  test('stranica (node): strogi CSP s hashom; robots.txt ne oglašava uredništvo', { skip: !NODE && 'stranicu na hostingu poslužuje Apache (.htaccess)' }, async () => {
    const s = await fetch(`${srv.url}/pasta-rhymes`);
    await s.arrayBuffer();
    assert.equal(s.status, 200, srv.zapisi.join('\n'));
    assert.match(s.headers.get('content-security-policy'), /^default-src 'self'; script-src 'self' 'sha256-/);
    assert.equal(s.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
    for (const put of ['/.htaccess', '/_headers', '/..%2fpackage.json']) assert.equal(await status(srv.url + put), 404, put);
    assert.equal((await status(`${srv.url}/pasta-rhymes`, { method: 'DELETE' })), 405);
    assert.ok(!(await srv.stranica('/robots.txt')).includes('urednistvo'));
  });

  test('prvo postavljanje izravno na /urednistvo (lokalno bez koda); zahtjev s druge stranice, slaba lozinka i krivo ime se odbijaju', async () => {
    const k = klijent(srv.url);
    const st = (await k.z('GET', `${API}/stanje`)).j;
    assert.equal(st.prvoPostavljanje, true); assert.equal(st.kodPotreban, false);
    const ok = { ime: 'tomislav', lozinka: 'plava kaseta svira jazz' };
    assert.equal((await k.z('POST', `${API}/postavljanje`, ok, { origin: 'https://zlo.example' })).status, 403);
    assert.equal((await k.z('POST', `${API}/postavljanje`, ok, { origin: null })).status, 403);
    assert.equal((await k.z('POST', `${API}/postavljanje`, ok, { zaglavlja: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal((await k.z('POST', `${API}/postavljanje`, { ...ok, lozinka: 'kratka' })).status, 422);
    assert.equal((await k.z('POST', `${API}/postavljanje`, { ...ok, ime: '../x' })).status, 422);
    assert.equal((await k.z('POST', `${API}/postavljanje`, 'ime=x', { vrsta: 'application/x-www-form-urlencoded', sirovo: true })).status, 415);
    assert.equal(fs.existsSync(path.join(srv.podaci, 'korisnici.json')) && JSON.parse(fs.readFileSync(path.join(srv.podaci, 'korisnici.json'), 'utf8')).korisnici.length > 0, false, 'ništa nije stvoreno');
  });

  test('postavljanje i dvostruka potvrda: kolačić HttpOnly/SameSite=Strict, lozinka samo kao hash, rezervni kodovi, administrator', async () => {
    const k = klijent(srv.url);
    const r1 = await k.z('POST', `${API}/postavljanje`, { ime: 'Tomislav', lozinka: 'plava kaseta svira jazz' });
    assert.equal(r1.status, 200);
    assert.match(r1.setCookie, /^sx-urednistvo=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+$/);
    assert.match(r1.j.uri, /^otpauth:\/\/totp\/Septillion%20uredni%C5%A1tvo%3Atomislav\?secret=[A-Z2-7]{32}&issuer=Septillion%20uredni%C5%A1tvo&/);
    assert.equal(r1.j.qr, undefined, 'QR crta preglednik');
    assert.equal((await k.z('GET', `${API}/jelovnik`)).status, 401, 'bez potvrđenog koda nema pristupa');
    assert.equal((await k.z('POST', `${API}/2fa/potvrdi`, { kod: '000000' })).status, 400);
    const prije = k.kolacic;
    const r2 = await k.z('POST', `${API}/2fa/potvrdi`, { kod: kod(r1.j.kljuc) });
    assert.equal(r2.status, 200);
    assert.equal(r2.j.uloga, 'admin');
    assert.notEqual(k.kolacic, prije, 'nova sesija nakon prijave (zaštita od fiksacije sesije)');
    assert.equal(r2.j.rezervniKodovi.length, 8);
    assert.equal((await k.z('POST', `${API}/postavljanje`, { ime: 'drugi', lozinka: 'plava kaseta svira jazz' })).status, 409, 'postavljanje je samo jednom');
    const st = (await klijent(srv.url).z('GET', `${API}/stanje`)).j;
    assert.equal(st.prvoPostavljanje, false); assert.equal(st.kodPotreban, undefined);
    const datoteka = fs.readFileSync(path.join(srv.podaci, 'korisnici.json'), 'utf8');
    assert.ok(!datoteka.includes('plava kaseta') && !r2.j.rezervniKodovi.some((x) => datoteka.includes(x)));
    assert.match(JSON.parse(datoteka).korisnici[0].lozinka, NODE ? /^scrypt\$/ : /^\$argon2id\$|^\$2y\$/);
    t = { k, kljuc: r1.j.kljuc.replace(/\s/g, ''), rezervni: r2.j.rezervniKodovi, lozinka: 'plava kaseta svira jazz', ime: 'tomislav' };
  });

  test('prijava: ista poruka za krivu lozinku i nepostojećeg korisnika; kod se ne može ponoviti; rezervni kod samo jednom', async () => {
    const k = klijent(srv.url);
    const a = await k.z('POST', `${API}/prijava`, { ime: 'tomislav', lozinka: 'kriva lozinka 123' });
    const b = await k.z('POST', `${API}/prijava`, { ime: 'nepostojeci', lozinka: 'kriva lozinka 123' });
    assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.j.greska, b.j.greska);
    assert.deepEqual((await k.z('POST', `${API}/prijava`, { ime: 'TOMISLAV', lozinka: t.lozinka })).j, { korak: '2fa' });
    assert.equal((await k.z('POST', `${API}/prijava/2fa`, { kod: kod(t.kljuc) })).status, 400, 'isti kod kao pri postavljanju se ne prihvaća');
    assert.equal((await k.z('POST', `${API}/prijava/2fa`, { kod: kod(t.kljuc, 1) })).status, 200);
    const k2 = klijent(srv.url);
    await k2.z('POST', `${API}/prijava`, { ime: 'tomislav', lozinka: t.lozinka });
    const r = await k2.z('POST', `${API}/prijava/2fa`, { kod: t.rezervni[0].toLowerCase() });
    assert.equal(r.status, 200); assert.equal(r.j.preostaloRezervnih, 7);
    const k3 = klijent(srv.url);
    await k3.z('POST', `${API}/prijava`, { ime: 'tomislav', lozinka: t.lozinka });
    assert.equal((await k3.z('POST', `${API}/prijava/2fa`, { kod: t.rezervni[0] })).status, 400, 'iskorišteni rezervni kod');
  });

  test('API: traži prijavu, CSRF token i naš Origin', async () => {
    const anon = klijent(srv.url);
    assert.equal((await anon.z('GET', `${API}/jelovnik`)).status, 401);
    assert.equal((await anon.z('PUT', `${API}/kategorija`, {})).status, 401);
    const j = await t.k.z('GET', `${API}/jelovnik`);
    assert.equal(j.status, 200);
    assert.equal(Object.keys(j.j.sadrzaj.kategorije).length, 13);
    const tijelo = { kljuc: 'pasta-rhymes/salate', verzija: j.j.sadrzaj.verzija, kategorija: j.j.sadrzaj.kategorije['pasta-rhymes/salate'] };
    assert.equal((await t.k.z('PUT', `${API}/kategorija`, tijelo, { bezCsrf: true })).status, 403);
    assert.equal((await t.k.z('PUT', `${API}/kategorija`, tijelo, { origin: 'https://zlo.example' })).status, 403);
    assert.equal((await t.k.z('PUT', `${API}/kategorija`, tijelo, { zaglavlja: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  });

  test('sesije: preživljavaju ponovno pokretanje; istek zbog neaktivnosti s razlogom; pozadinske provjere ne produljuju prijavu', async () => {
    await srv.ponovnoPokreni();
    assert.equal((await t.k.z('GET', `${API}/jelovnik`)).status, 200, 'prijava vrijedi i nakon ponovnog pokretanja');
    const k = klijent(srv.url);
    await k.z('POST', `${API}/prijava`, { ime: 'tomislav', lozinka: t.lozinka });
    assert.equal((await k.z('POST', `${API}/prijava/2fa`, { kod: t.rezervni[2] })).status, 200);
    const f = datotekaSesije(srv, k);
    const pomakni = (min) => { const s = JSON.parse(fs.readFileSync(f, 'utf8')); s.aktivno = Date.now() - min * 60_000; s.zapisano = s.aktivno; fs.writeFileSync(f, JSON.stringify(s)); return s.aktivno; };
    const staro = pomakni(10);
    assert.equal((await k.z('GET', `${API}/objava`, undefined, { zaglavlja: { 'x-pozadina': '1' } })).status, 200);
    assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).aktivno, staro, 'pozadinska provjera ne broji se kao aktivnost');
    assert.equal((await k.z('GET', `${API}/stanje`)).j.korak, 'puno');
    assert.ok(JSON.parse(fs.readFileSync(f, 'utf8')).aktivno > staro, 'rad korisnika produljuje prijavu');
    pomakni(31);
    const r = await k.z('GET', `${API}/jelovnik`);
    assert.equal(r.status, 401); assert.equal(r.j.razlog, 'neaktivnost');
    assert.equal(fs.existsSync(f), false, 'istekla sesija se briše');
    assert.equal((await k.z('GET', `${API}/stanje`)).j.razlog, 'nema');
  });

  test('spremanje: zastarjela verzija 409, neispravan sadržaj 422, ispravno -> objava na stranici (tekst escapean)', async () => {
    const j = (await t.k.z('GET', `${API}/jelovnik`)).j;
    const kat = structuredClone(j.sadrzaj.kategorije['pasta-rhymes/salate']);
    kat.stavke[0].cijena = 12.75;
    kat.stavke[0].naziv.hr = '  Salata <b>Sicilianna</b> ';
    assert.equal((await t.k.z('PUT', `${API}/kategorija`, { kljuc: 'pasta-rhymes/salate', verzija: j.sadrzaj.verzija - 1, kategorija: kat })).status, 409);
    for (const [promjena, put] of [
      [(x) => { x.stavke[1].cijena = -3; }, ['stavke', 1, 'cijena']],
      [(x) => { x.stavke[1].cijena = 8.999; }, ['stavke', 1, 'cijena']],
      [(x) => { x.stavke[1].opis.hr = 'x'.repeat(601); }, ['stavke', 1, 'opis', 'hr']],
      [(x) => { x.stavke[1].slika = '../../etc/passwd'; }, ['stavke', 1, 'slika']],
      [(x) => { x.stavke[1].naziv.hr = ''; }, ['stavke', 1, 'naziv', 'hr']],
    ]) {
      const losa = structuredClone(kat); promjena(losa);
      const r = await t.k.z('PUT', `${API}/kategorija`, { kljuc: 'pasta-rhymes/salate', verzija: j.sadrzaj.verzija, kategorija: losa });
      assert.equal(r.status, 422, JSON.stringify(put));
      assert.ok(r.j.greske.some((g) => JSON.stringify(g.putanja.slice(2)) === JSON.stringify(put)), `${JSON.stringify(put)}: ${JSON.stringify(r.j.greske)}`);
    }
    const nepoznato = structuredClone(kat); nepoznato.stavke[0].zlo = '<script>';
    assert.equal((await t.k.z('PUT', `${API}/kategorija`, { kljuc: 'pasta-rhymes/salate', verzija: j.sadrzaj.verzija, kategorija: nepoznato })).status, 422, 'nepoznato polje');
    const pasta = structuredClone(j.sadrzaj.kategorije['pasta-rhymes/strana-a']); pasta.stavke[0].boja = '#123456';
    assert.equal((await t.k.z('PUT', `${API}/kategorija`, { kljuc: 'pasta-rhymes/strana-a', verzija: j.sadrzaj.verzija, kategorija: pasta })).status, 422, 'boja izvan palete');
    const r = await t.k.z('PUT', `${API}/kategorija`, { kljuc: 'pasta-rhymes/salate', verzija: j.sadrzaj.verzija, kategorija: kat });
    assert.equal(r.status, 200); assert.equal(r.j.verzija, j.sadrzaj.verzija + 1);
    assert.equal(r.j.kategorija.stavke[0].naziv.hr, 'Salata <b>Sicilianna</b>', 'tekst je obrezan');
    const o = await srv.objavljeno();
    assert.equal(o.stanje, 'spremno'); assert.equal(o.verzija, r.j.verzija);
    const html = await srv.stranica('/pasta-rhymes');
    assert.ok(html.includes('12,75 €'), 'nova cijena je na stranici');
    assert.ok(html.includes('Salata &lt;b&gt;Sicilianna&lt;/b&gt;') && !html.includes('<b>Sicilianna</b>'), 'tekst iz uredništva se escapea');
    assert.match(fs.readFileSync(path.join(srv.podaci, 'dnevnik.log'), 'utf8'), /"ime":"tomislav","radnja":"spremanje"/);
    let s; for (let i = 0; i < 20 && (s = (await t.k.z('GET', `${API}/objava`)).j).stanje === 'u-tijeku'; i++) await new Promise((x) => setTimeout(x, 500));
    assert.equal(s.stanje, 'spremno', 'sučelje vidi da je objava gotova');
  });

  test('fotografije: samo prave slike; EXIF/GPS se uklanja; nasumično ime; minijatura samo prijavljenima; objavljuje se s jelovnikom', async () => {
    assert.equal((await t.k.z('POST', `${API}/slike`, Buffer.from('<?php system($_GET[1]); ?>'), { sirovo: true, vrsta: 'image/png' })).status, 415);
    assert.equal((await t.k.z('POST', `${API}/slike`, Buffer.from('x'), { sirovo: true, vrsta: 'text/html' })).status, 415);
    const jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#c33' } })
      .jpeg().withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Copyright: 'tajni-podatak', ImageDescription: 'GPS 45.8150 15.9819' } }).toBuffer();
    const r = await t.k.z('POST', `${API}/slike`, jpeg, { sirovo: true, vrsta: 'image/jpeg' });
    assert.equal(r.status, 201, JSON.stringify(r.j));
    assert.match(r.j.kljuc, /^n-[a-f0-9]{24}$/);
    const spremljena = fs.readFileSync(path.join(srv.podaci, 'slike', `${r.j.kljuc}.webp`));
    const meta = await sharp(spremljena).metadata();
    assert.equal(meta.format, 'webp'); assert.equal(meta.exif, undefined);
    assert.ok(!spremljena.includes('tajni-podatak'));
    assert.deepEqual([meta.width, meta.height], [600, 900], 'uspravljeno prema EXIF oznaci (mobitel snima položeno)');
    assert.equal((await status(`${srv.url}${API}/slike/${r.j.kljuc}`)), 401);
    const m = await t.k.z('GET', `${API}/slike/${r.j.kljuc}`);
    assert.equal(m.status, 200); assert.equal(m.h.get('content-type'), 'image/webp');
    assert.equal((await t.k.z('GET', `${API}/slike/pr_shrimp`)).status, 200, 'minijatura lokalne slike');
    const mala = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#fff' } }).png().toBuffer();
    assert.equal((await t.k.z('POST', `${API}/slike`, mala, { sirovo: true, vrsta: 'image/png' })).status, 422);
    // nova fotografija u jelovniku -> na stranici
    const j = (await t.k.z('GET', `${API}/jelovnik`)).j;
    const pasta = structuredClone(j.sadrzaj.kategorije['pasta-rhymes/strana-a']);
    pasta.stavke[0].slika = r.j.kljuc;
    const s = await t.k.z('PUT', `${API}/kategorija`, { kljuc: 'pasta-rhymes/strana-a', verzija: j.sadrzaj.verzija, kategorija: pasta });
    assert.equal(s.status, 200, JSON.stringify(s.j));
    const losa = structuredClone(pasta); losa.stavke[1].slika = 'n-000000000000000000000000';
    assert.equal((await t.k.z('PUT', `${API}/kategorija`, { kljuc: 'pasta-rhymes/strana-a', verzija: s.j.verzija, kategorija: losa })).status, 422, 'nepostojeća fotografija');
    assert.equal((await srv.objavljeno()).stanje, 'spremno');
    if (PHP) assert.ok(srv.github.datoteka(`podaci/slike/${r.j.kljuc}.webp`)?.equals(spremljena), 'fotografija je u commitu sa sadržajem');
    assert.ok((await srv.stranica('/pasta-rhymes')).includes('/_astro/'), 'stranica izgrađena');
  });

  test('povijest: stara verzija se vraća kao nova i objavljuje', async () => {
    const p = (await t.k.z('GET', `${API}/povijest`)).j;
    assert.ok(p.length >= 3);
    const trenutna = (await t.k.z('GET', `${API}/jelovnik`)).j.sadrzaj.verzija;
    const r = await t.k.z('POST', `${API}/povijest/vrati`, { verzija: 1, trenutna });
    assert.equal(r.status, 200); assert.equal(r.j.verzija, trenutna + 1);
    await srv.objavljeno();
    const html = await srv.stranica('/pasta-rhymes');
    assert.ok(!html.includes('12,75 €') && html.includes('12,00 €'), 'vraćena je izvorna cijena');
  });

  test('održavanje: samo administrator; posjetitelji dobiju 503 stranicu, datoteke i uredništvo rade; administratorov preglednik vidi stranicu', async () => {
    // tijelo se uvijek pročita do kraja (nepročitan odgovor u Node 22 ruši fetch kad poslužitelj zatvori vezu)
    const posjeti = async (put, cookie) => {
      const r = await fetch(srv.url + put, { redirect: 'manual', headers: cookie ? { cookie } : {} });
      const tekst = await r.text();
      return { status: r.status, headers: r.headers, text: async () => tekst };
    };
    // na hostingu oznaku čita .htaccess (public_html/.odrzavanje), lokalno poslužitelj (podaci/odrzavanje.json)
    const oznaka = PHP ? path.join(srv.dir, 'stranica', '.odrzavanje') : path.join(srv.podaci, 'odrzavanje.json');
    assert.equal((await posjeti('/pasta-rhymes')).status, 200);
    assert.equal((await posjeti('/odrzavanje')).status, 404, 'stranica za održavanje ne postoji dok je isključeno');

    // urednik (ne administrator) ne može; zahtjev bez CSRF-a i neispravan zahtjev se odbijaju
    const poz = await t.k.z('POST', `${API}/korisnici/pozivnica`, { ime: 'ana' });
    const a = klijent(srv.url);
    const p1 = await a.z('POST', `${API}/pozivnica`, { token: /#pozivnica=([A-Za-z0-9_-]+)$/.exec(poz.j.poveznica)[1], lozinka: 'ljubicasta kaseta svira' });
    assert.equal((await a.z('POST', `${API}/2fa/potvrdi`, { kod: kod(p1.j.kljuc) })).status, 200);
    assert.equal((await a.z('POST', `${API}/odrzavanje`, { ukljuceno: true })).status, 403);
    assert.equal((await a.z('GET', `${API}/odrzavanje`)).status, 403);
    assert.equal((await t.k.z('POST', `${API}/korisnici/obrisi`, { ime: 'ana' })).status, 200);
    assert.equal((await t.k.z('POST', `${API}/odrzavanje`, { ukljuceno: true }, { bezCsrf: true })).status, 403);
    assert.equal((await t.k.z('POST', `${API}/odrzavanje`, { ukljuceno: 'da' })).status, 422);
    assert.deepEqual((await t.k.z('GET', `${API}/odrzavanje`)).j, { ukljuceno: false, od: null, ime: null, pregled: false });
    assert.ok(!fs.existsSync(oznaka));

    const r = await t.k.z('POST', `${API}/odrzavanje`, { ukljuceno: true });
    assert.equal(r.status, 200);
    assert.equal(r.j.ukljuceno, true); assert.equal(r.j.ime, 'tomislav'); assert.ok(Date.parse(r.j.od)); assert.equal(r.j.pregled, false);
    assert.ok(!t.k.ostali.has('septillion_pregled'), 'po zadanom i administrator vidi poruku (nema kolačića pregleda)');
    assert.ok(fs.existsSync(oznaka));
    assert.equal((await t.k.z('GET', `${API}/objava`)).j.odrzavanje, true, 'status u zaglavlju uredništva');

    const v = await posjeti('/pasta-rhymes');
    assert.equal(v.status, 503); assert.equal(v.headers.get('retry-after'), '3600');
    const html = await v.text();
    assert.ok(html.includes('Uskoro se vraćamo') && html.includes('name="robots" content="noindex"'), 'stranica za održavanje');
    for (const put of ['/', '/en', '/jellyfish-in-space', '/odrzavanje', '/nepostoji']) assert.equal((await posjeti(put)).status, 503, put);
    assert.equal((await posjeti('/septillion-icon.svg')).status, 200, 'datoteke rade');
    assert.equal((await posjeti('/urednistvo')).status, 200, 'uredništvo radi');
    assert.ok(!(await (await posjeti('/.odrzavanje')).text()).includes('tomislav'), 'oznaka nije javna');

    // "Pokaži mi stranicu": samo taj preglednik dobije kolačić pregleda i vidi stranicu; "Pokaži mi poruku" ga briše
    const sa = await t.k.z('POST', `${API}/odrzavanje`, { ukljuceno: true, pregled: true });
    assert.equal(sa.j.pregled, true); assert.equal(sa.j.od, r.j.od, 'ponovno uključivanje ne mijenja početak');
    assert.equal(t.k.ostali.get('septillion_pregled'), '1');
    assert.match(sa.setCookie, /^septillion_pregled=1; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+$/);
    assert.equal((await posjeti('/pasta-rhymes', 'septillion_pregled=1')).status, 200, 'administrator vidi stranicu');
    const bez = await t.k.z('POST', `${API}/odrzavanje`, { ukljuceno: true, pregled: false });
    assert.equal(bez.j.pregled, false);
    assert.ok(!t.k.ostali.has('septillion_pregled'));

    const off = await t.k.z('POST', `${API}/odrzavanje`, { ukljuceno: false });
    assert.deepEqual(off.j, { ukljuceno: false, od: null, ime: null, pregled: false });
    assert.ok(!fs.existsSync(oznaka));
    assert.equal((await posjeti('/pasta-rhymes')).status, 200);
    assert.equal((await t.k.z('GET', `${API}/objava`)).j.odrzavanje, false);

    // ručno (cPanel -> File Manager): prazna datoteka uključuje održavanje, uredništvo ga isključuje
    fs.writeFileSync(oznaka, '');
    assert.deepEqual((await t.k.z('GET', `${API}/odrzavanje`)).j, { ukljuceno: true, od: null, ime: null, pregled: false });
    assert.equal((await posjeti('/pasta-rhymes')).status, 503);
    assert.equal((await t.k.z('POST', `${API}/odrzavanje`, { ukljuceno: false })).status, 200);
    assert.equal((await posjeti('/pasta-rhymes')).status, 200);
  });

  test('korisnici: administrator poziva, novi korisnik sam postavlja lozinku i 2FA; nema administratorska prava; reset odjavljuje; uklanjanje', async () => {
    const r = await t.k.z('POST', `${API}/korisnici/pozivnica`, { ime: 'Marko' });
    assert.equal(r.status, 200);
    const token = /#pozivnica=([A-Za-z0-9_-]+)$/.exec(r.j.poveznica)[1];
    assert.match(r.j.poveznica, /^http:\/\/127\.0\.0\.1:\d+\/urednistvo\/#pozivnica=/);
    assert.equal((await t.k.z('POST', `${API}/korisnici/pozivnica`, { ime: 'tomislav' })).status, 422, 'ne sebi');
    const m = klijent(srv.url);
    assert.deepEqual((await m.z('POST', `${API}/pozivnica/provjeri`, { token })).j, { ime: 'marko' });
    const p1 = await m.z('POST', `${API}/pozivnica`, { token, lozinka: 'zelena gitara pjeva tiho' });
    assert.equal(p1.status, 200);
    const p2 = await m.z('POST', `${API}/2fa/potvrdi`, { kod: kod(p1.j.kljuc) });
    assert.equal(p2.status, 200); assert.equal(p2.j.uloga, 'urednik');
    assert.equal((await m.z('POST', `${API}/pozivnica/provjeri`, { token })).status, 404, 'pozivnica je jednokratna');
    assert.equal((await m.z('GET', `${API}/jelovnik`)).status, 200);
    assert.equal((await m.z('GET', `${API}/korisnici`)).status, 403, 'urednik ne upravlja korisnicima');
    assert.equal((await m.z('POST', `${API}/korisnici/pozivnica`, { ime: 'treci' })).status, 403);
    const popis = (await t.k.z('GET', `${API}/korisnici`)).j;
    assert.deepEqual(popis.map((x) => [x.ime, x.uloga, x.stanje]), [['tomislav', 'admin', 'aktivan'], ['marko', 'urednik', 'aktivan']]);
    assert.equal((await t.k.z('POST', `${API}/korisnici/pozivnica`, { ime: 'marko' })).status, 409, 'postojeći korisnik samo uz reset');
    const reset = await t.k.z('POST', `${API}/korisnici/pozivnica`, { ime: 'marko', resetiraj: true });
    assert.equal(reset.status, 200);
    const odj = await m.z('GET', `${API}/jelovnik`);
    assert.equal(odj.status, 401, 'reset odjavljuje'); assert.ok(['odjavljen', 'nema'].includes(odj.j.razlog));
    assert.equal((await klijent(srv.url).z('POST', `${API}/prijava`, { ime: 'marko', lozinka: 'zelena gitara pjeva tiho' })).status, 401, 'stara lozinka više ne vrijedi');
    assert.equal((await t.k.z('POST', `${API}/korisnici/obrisi`, { ime: 'tomislav' })).status, 422, 'ne sebe');
    assert.equal((await t.k.z('POST', `${API}/korisnici/obrisi`, { ime: 'marko' })).status, 200);
    assert.deepEqual((await t.k.z('GET', `${API}/korisnici`)).j.map((x) => x.ime), ['tomislav']);
  });

  test('promjena lozinke odjavljuje druge uređaje, ovaj ostaje prijavljen', async () => {
    const drugi = klijent(srv.url);
    await drugi.z('POST', `${API}/prijava`, { ime: 'tomislav', lozinka: t.lozinka });
    assert.equal((await drugi.z('POST', `${API}/prijava/2fa`, { kod: t.rezervni[1] })).status, 200);
    assert.equal((await t.k.z('POST', `${API}/lozinka`, { stara: 'kriva lozinka xyz', nova: 'nova duga lozinka ovdje' })).status, 400);
    assert.equal((await t.k.z('POST', `${API}/lozinka`, { stara: t.lozinka, nova: 'nova duga lozinka ovdje' })).status, 200);
    assert.equal((await t.k.z('GET', `${API}/jelovnik`)).status, 200);
    assert.equal((await drugi.z('GET', `${API}/jelovnik`)).status, 401);
    assert.equal((await t.k.z('POST', `${API}/lozinka`, { stara: 'nova duga lozinka ovdje', nova: t.lozinka })).status, 200);
  });

  test('ograničenje pokušaja: nakon 5 krivih lozinki korisnik je zaključan (429), i s ispravnom lozinkom', async () => {
    const k = klijent(srv.url);
    let r, krivih = 0; // i ranije krive lozinke (testovi iznad) se broje
    while (krivih < 6 && (r = await k.z('POST', `${API}/prijava`, { ime: 'tomislav', lozinka: `pogresna lozinka ${krivih}` })).status === 401) krivih++;
    assert.equal(r.status, 429, 'najkasnije nakon 5 krivih lozinki'); assert.ok(krivih <= 5);
    r = await k.z('POST', `${API}/prijava`, { ime: 'tomislav', lozinka: t.lozinka });
    assert.equal(r.status, 429); assert.ok(Number(r.h.get('retry-after')) > 0);
  });

  test('postavljanje s GitHuba (php): paket bez tokena sa spremišta; novi kod preko /osvjezi (Cron Job); PR, izgradnja bez paketa i "../" se ne postavljaju', { skip: !PHP && 'lokalno se stranica gradi na računalu' }, async () => {
    const gh = srv.github, stranica = path.join(srv.dir, 'stranica');
    const osvjezi = async () => (await (await fetch(`${srv.url}/urednistvo/api/osvjezi`)).json()).stanje;
    const paket = (datoteke) => zip(Object.entries(datoteke).map(([ime, sadrzaj]) => ({ ime, podaci: Buffer.from(sadrzaj) })));
    await srv.objavljeno();
    assert.equal(await osvjezi(), 'aktualno');
    assert.ok(gh.stat.preuzimanja >= 1, 'paketi su preuzeti sa spremišta bez tokena (lažni GitHub odbija token)');
    const html = fs.readFileSync(path.join(stranica, 'index.html'), 'utf8');
    const prije = fs.statSync(path.join(stranica, 'pasta-rhymes.html')).mtimeMs;

    // push na main (novi kod): Cron Job ga postavi; iste datoteke se ne prepisuju
    gh.noviRun({ event: 'push', artefakt: paket({ 'index.html': html.replace('</body>', '<!-- novi-kod --></body>'), 'pasta-rhymes.html': fs.readFileSync(path.join(stranica, 'pasta-rhymes.html')), '_astro/novo.css': 'a{}', '.htaccess': fs.readFileSync(path.join(stranica, '.htaccess')) }) });
    assert.equal(await osvjezi(), 'postavljeno');
    assert.ok((await srv.stranica('/')).includes('novi-kod'));
    assert.equal(fs.readFileSync(path.join(stranica, '_astro/novo.css'), 'utf8'), 'a{}');
    assert.equal(fs.statSync(path.join(stranica, 'pasta-rhymes.html')).mtimeMs, prije, 'nepromijenjena datoteka se ne prepisuje');
    assert.equal(await osvjezi(), 'aktualno');

    // pull request (i iz tuđeg repozitorija) se nikad ne postavlja; uspješna izgradnja bez paketa se preskače
    gh.noviRun({ event: 'pull_request', grana: 'zlo', repo: 'zlo/septilion', artefakt: paket({ 'index.html': 'HAKIRANO' }) });
    gh.noviRun({ event: 'push', repo: 'zlo/septilion', artefakt: paket({ 'index.html': 'HAKIRANO' }) });
    gh.noviRun({ event: 'push', artefakt: null });
    assert.equal(await osvjezi(), 'aktualno');
    assert.ok(!(await srv.stranica('/')).includes('HAKIRANO'));

    // paket s "../" se odbija cijeli: ništa izvan public_html, stranica ostaje
    gh.noviRun({ event: 'push', artefakt: paket({ 'index.html': 'LOSE', '../izvan.txt': 'x' }) });
    assert.equal(await osvjezi(), 'greska');
    assert.ok(!fs.existsSync(path.join(srv.dir, 'izvan.txt')));
    assert.ok((await srv.stranica('/')).includes('novi-kod'));
    assert.ok(!fs.existsSync(path.join(srv.podaci, 'instalacija')) && !fs.existsSync(path.join(srv.podaci, 'instalacija.zip')), 'privremene datoteke obrisane');

    // ispravna novija izgradnja popravlja stanje
    gh.noviRun({ event: 'workflow_dispatch', artefakt: paket({ 'index.html': html }) });
    assert.equal(await osvjezi(), 'postavljeno');
    assert.ok(!(await srv.stranica('/')).includes('novi-kod'));
  });

  test('objava (php): postavke samo administratoru, token se ne vraća, kriv token se odbija; bez postavki stanje "nije postavljeno"', { skip: !PHP && 'lokalno se stranica gradi na računalu' }, async () => {
    const o = (await t.k.z('GET', `${API}/objava/postavke`)).j;
    assert.deepEqual(o, { vrsta: 'github', repo: 'test/septilion', grana: 'sadrzaj', tokenPostavljen: true, tokenIstjece: o.tokenIstjece });
    assert.ok(!JSON.stringify(o).includes(GITHUB_TOKEN));
    assert.equal((await t.k.z('POST', `${API}/objava/postavke`, { repo: 'ne valja', grana: 'sadrzaj', token: '' })).status, 422);
    const krivi = await t.k.z('POST', `${API}/objava/postavke`, { repo: 'test/septilion', grana: 'sadrzaj', token: `github_pat_${'X'.repeat(40)}` });
    assert.equal(krivi.status, 502); assert.match(krivi.j.greska, /token ne vrijedi/);
    const dobar = await t.k.z('POST', `${API}/objava/postavke`, { repo: 'test/septilion', grana: 'sadrzaj', token: '' });
    assert.equal(dobar.status, 200, 'prazan token = zadrži postojeći'); assert.equal(dobar.j.tokenIstjece, '2027-10-15T12:00:00Z');
    const jelovnik = JSON.parse(srv.github.datoteka('podaci/jelovnik.json').toString('utf8'));
    assert.equal(provjeri(jelovnik).ok, true, 'poslani jelovnik prolazi provjeru izgradnje stranice (zod)');
    assert.ok(srv.github.zahtjevi.includes('POST /repos/test/septilion/dispatches'));
    fs.rmSync(path.join(srv.podaci, 'objava-postavke.json'));
    assert.equal((await t.k.z('GET', `${API}/objava`)).j.stanje, 'nije-postavljeno');
  });

  test('pozivnica preko naredbe (cli.mjs) i reset: korisnik postavlja svoju lozinku, reset odjavljuje sesije', { skip: !NODE && 'na hostingu nema terminala — korisnike poziva administrator u uredništvu' }, async () => {
    const env = { ...process.env, UREDNISTVO_PODACI: srv.podaci, PORT: '3000' };
    const r = spawnSync(process.execPath, [path.join(ROOT, 'urednistvo/cli.mjs'), 'pozivnica', 'ana'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const token = /#pozivnica=([A-Za-z0-9_-]+)/.exec(r.stdout)[1];
    const a = klijent(srv.url);
    const p1 = await a.z('POST', `${API}/pozivnica`, { token, lozinka: 'crvena truba svira glasno' });
    assert.equal(p1.status, 200);
    assert.equal((await a.z('POST', `${API}/2fa/potvrdi`, { kod: kod(p1.j.kljuc) })).status, 200);
    assert.equal((await a.z('GET', `${API}/jelovnik`)).status, 200);
    const rr = spawnSync(process.execPath, [path.join(ROOT, 'urednistvo/cli.mjs'), 'pozivnica', 'ana', '--resetiraj'], { env, encoding: 'utf8' });
    assert.equal(rr.status, 0, rr.stderr);
    assert.equal((await a.z('GET', `${API}/jelovnik`)).status, 401, 'reset odjavljuje postojeće sesije');
    const popis = spawnSync(process.execPath, [path.join(ROOT, 'urednistvo/cli.mjs'), 'popis'], { env, encoding: 'utf8' });
    assert.match(popis.stdout, /ana\s+urednik\s+čeka pozivnicu/);
    assert.match(popis.stdout, /tomislav\s+admin\s+aktivan/);
  });

  test('produkcija: prvo postavljanje traži stalni kod iz PRVO-POSTAVLJANJE.txt; kolačić __Host- i Secure; HSTS; samo prava domena', async () => {
    const host = new URL(PHP_ORIGIN).host;
    const p = NODE
      ? await (async () => {
        await assert.rejects(() => pokreni({ NODE_ENV: 'production', PORT: '0', UREDNISTVO_PODACI: path.join(srv.dir, 'p2'), UREDNISTVO_IZDANJA: path.join(srv.dir, 'i2') }), /UREDNISTVO_ORIGIN/);
        const s = await pokreni({ NODE_ENV: 'production', PORT: '0', UREDNISTVO_ORIGIN: PHP_ORIGIN, UREDNISTVO_PODACI: path.join(srv.dir, 'p3'), UREDNISTVO_IZDANJA: path.join(srv.dir, 'izdanja') }, { log() {}, error() {} });
        return { url: `http://127.0.0.1:${s.port}`, podaci: path.join(srv.dir, 'p3'), zatvori: async () => { await s.objava.gotovo(); await s.zatvori(); } };
      })()
      : await posluzitelj({ produkcija: true });
    try {
      assert.equal((await status(`${p.url}/urednistvo`)), 421, 'kriv Host');
      const k = klijent(p.url, { host });
      const st = await k.z('GET', `${API}/stanje`);
      assert.equal(st.j.kodPotreban, true);
      assert.match(st.h.get('strict-transport-security'), /max-age=31536000/);
      const datoteka = path.join(p.podaci, 'PRVO-POSTAVLJANJE.txt');
      const kodPostavljanja = /^ {2}([A-Z0-9-]{17})$/m.exec(fs.readFileSync(datoteka, 'utf8'))[1];
      const pr = { ime: 'daniel', lozinka: 'plava kaseta svira jazz' };
      assert.equal((await k.z('POST', `${API}/postavljanje`, { ...pr, kod: 'AAAAA-BBBBB-CCCCC' })).status, 403);
      assert.equal((await k.z('POST', `${API}/postavljanje`, pr, { origin: `http://${host}` })).status, 403, 'samo https izvor');
      const r = await k.z('POST', `${API}/postavljanje`, { ...pr, kod: kodPostavljanja.toLowerCase() });
      assert.equal(r.status, 200, JSON.stringify(r.j));
      assert.match(r.setCookie, /^__Host-sx-urednistvo=[^;]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/);
      assert.equal(fs.existsSync(datoteka), false, 'kod se briše nakon postavljanja');
    } finally { await p.zatvori(); }
  });
});
