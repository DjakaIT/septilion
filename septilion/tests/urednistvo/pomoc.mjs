// Pomoć za testove uredništva — isti testovi za obje pozadine:
//   node: urednistvo/posluzitelj.mjs (lokalno, npm start)
//   php:  urednistvo/php/ (hosting) preko `php -S`; GitHub glumi lažni API koji nakon objave stvarno izgradi
//         stranicu iz poslanog jelovnika (kao .github/workflows/objava.yml), pa se i ovdje provjerava cijeli lanac.
// Pozadinu bira UREDNISTVO_POSLUZITELJ (node | php); PHP se traži u PHP_BINARY ili PATH-u.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { pokreni } from '../../urednistvo/posluzitelj.mjs';
import { ROOT } from '../../urednistvo/lib/postavke.mjs';
import { totpKod, trenutniKorak, sha256 } from '../../urednistvo/lib/sigurnost.mjs';
import { pripremi } from '../../urednistvo/php/pripremi.mjs';
import { zipMape } from '../../scripts/zip.mjs';

export const POSLUZITELJ = process.env.UREDNISTVO_POSLUZITELJ === 'php' ? 'php' : 'node';
export const PHP = process.env.PHP_BINARY || 'php';
export const PHP_ORIGIN = 'https://septillion.example';
export const GITHUB_TOKEN = `github_pat_${'T'.repeat(40)}`;
export const imaPhp = () => spawnSync(PHP, ['-r', 'echo PHP_VERSION;'], { encoding: 'utf8' }).status === 0;

const ASTRO = path.join(ROOT, 'node_modules/astro/bin/astro.mjs');
const slobodanPort = () => new Promise((ok) => { const s = http.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const cekaj = (ms) => new Promise((r) => setTimeout(r, ms));
function izgradi(outDir, podaci) {
  return new Promise((ok, ne) => {
    const p = spawn(process.execPath, [ASTRO, 'build', '--outDir', outDir], { cwd: ROOT, env: { ...process.env, ...(podaci ? { UREDNISTVO_PODACI: podaci } : {}), NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let izlaz = ''; p.stdout.on('data', (d) => { izlaz += d; }); p.stderr.on('data', (d) => { izlaz += d; });
    p.on('close', (k) => (k === 0 ? ok() : ne(new Error(`build ${k}: ${izlaz.slice(-2000)}`))));
  });
}
const novaMapa = () => {
  fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
  return fs.mkdtempSync(path.join(ROOT, 'test-results', 'ured-'));
};
const obrisi = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });

/**
 * Poslužitelj uredništva s vlastitim podacima (test-results/ured-*).
 * @returns {Promise<{ vrsta, url, stranica: (put) => Promise<string>, dir, podaci, zapisi, objavljeno: () => Promise<{stanje, verzija}>, zatvori, ponovnoPokreni, github?, s? }>}
 */
export async function posluzitelj(env = {}) {
  return POSLUZITELJ === 'php' ? phpPosluzitelj(env) : nodePosluzitelj(env);
}

async function nodePosluzitelj(env) {
  const dir = novaMapa();
  const zapisi = [];
  const zapisnik = { log: (...a) => zapisi.push(a.join(' ')), error: (...a) => zapisi.push(a.join(' ')) };
  const e = { PORT: '0', UREDNISTVO_PODACI: path.join(dir, 'podaci'), UREDNISTVO_IZDANJA: path.join(dir, 'izdanja'), ...env };
  let s = await pokreni(e, zapisnik);
  const srv = {
    vrsta: 'node', dir, zapisi, podaci: path.join(dir, 'podaci'),
    get s() { return s; },
    get url() { return `http://127.0.0.1:${s.port}`; },
    stranica: async (put) => (await fetch(`http://127.0.0.1:${s.port}${put}`)).text(),
    objavljeno: () => s.objava.gotovo(),
    async ponovnoPokreni() { await s.objava.gotovo(); const port = s.port; await s.zatvori(); await cekaj(300); s = await pokreni({ ...e, PORT: String(port) }, zapisnik); await s.objava.gotovo(); },
    async zatvori() { await s.objava.gotovo(); await s.zatvori(); obrisi(dir); },
  };
  await s.objava.gotovo();
  return srv;
}

/**
 * lažni GitHub: git podaci (blobovi, stabla, commiti, grane), repository_dispatch, workflow runs i artefakti.
 * Kao pravi: paket se preuzima preko preusmjerenja na "spremište" koje odbija zahtjev s tokenom.
 */
function lazniGitHub({ token, naObjavu }) {
  const blobovi = new Map(), stabla = new Map(), commiti = new Map(), grane = new Map(), runovi = [], artefakti = new Map();
  let gradnja = Promise.resolve();
  const id = (x) => crypto.createHash('sha1').update(JSON.stringify(x) + crypto.randomBytes(4).toString('hex')).digest('hex');
  const zahtjevi = [];
  const stat = { preuzimanja: 0 };
  /** novi run (najnoviji prvi, kao GitHub); artefakt = Buffer (zip) ili null (objava preskočena) */
  function noviRun({ event = 'push', naslov, sha = id(Math.random()), repo = 'test/septilion', grana = 'main', gotov = true, artefakt = null } = {}) {
    const run = {
      id: runovi.length + 1, run_number: runovi.length + 1, event, head_branch: grana, head_sha: sha, path: '.github/workflows/objava.yml',
      head_repository: { full_name: repo }, display_title: naslov ?? `Objava koda ${sha}`, created_at: new Date().toISOString(),
      status: gotov ? 'completed' : 'in_progress', conclusion: gotov ? 'success' : null, updated_at: null, html_url: 'https://github.example/run',
    };
    runovi.unshift(run);
    if (artefakt) artefakti.set(run.id, artefakt);
    return run;
  }
  const server = http.createServer(async (req, res) => {
    const dijelovi = []; for await (const d of req) dijelovi.push(d);
    const tijelo = dijelovi.length ? JSON.parse(Buffer.concat(dijelovi).toString('utf8')) : null;
    const u = new URL(req.url, 'http://x');
    zahtjevi.push(`${req.method} ${u.pathname}`);
    const odg = (status, j, dodatno = {}) => { res.writeHead(status, { 'content-type': 'application/json', 'github-authentication-token-expiration': '2027-10-15 12:00:00 UTC', ...dodatno }); res.end(j === undefined ? '' : JSON.stringify(j)); };
    let r;
    // spremište artefakata (druga adresa): bez tokena, kao Azure blob s potpisanom adresom
    if ((r = /^\/spremiste\/(\d+)$/.exec(u.pathname))) {
      if (req.headers.authorization) return odg(400, { message: 'Token se ne šalje spremištu' });
      stat.preuzimanja++;
      res.writeHead(200, { 'content-type': 'application/zip' }); res.end(artefakti.get(Number(r[1]))); return;
    }
    if (req.headers.authorization !== `Bearer ${token}`) return odg(401, { message: 'Bad credentials' });
    const m = /^\/repos\/[^/]+\/[^/]+(.*)$/.exec(u.pathname);
    if (!m) return odg(404, { message: 'Not Found' });
    const p = m[1];
    if (req.method === 'GET' && p === '') return odg(200, { full_name: 'test/septilion' });
    if (req.method === 'GET' && (r = /^\/git\/ref\/heads\/(.+)$/.exec(p))) return grane.has(r[1]) ? odg(200, { object: { sha: grane.get(r[1]) } }) : odg(404, { message: 'Not Found' });
    if (req.method === 'GET' && (r = /^\/git\/commits\/(\w+)$/.exec(p))) return odg(200, { sha: r[1], tree: { sha: commiti.get(r[1]).tree } });
    if (req.method === 'GET' && (r = /^\/git\/trees\/(\w+)$/.exec(p))) return odg(200, { tree: [...stabla.get(r[1]).keys()].map((path) => ({ path, type: 'blob' })) });
    if (req.method === 'POST' && p === '/git/blobs') { const sha = id(tijelo); blobovi.set(sha, Buffer.from(tijelo.content, tijelo.encoding === 'base64' ? 'base64' : 'utf8')); return odg(201, { sha }); }
    if (req.method === 'POST' && p === '/git/trees') {
      const t = new Map(tijelo.base_tree ? stabla.get(tijelo.base_tree) : []);
      for (const e of tijelo.tree) t.set(e.path, e.sha);
      const sha = id([...t]); stabla.set(sha, t); return odg(201, { sha });
    }
    if (req.method === 'POST' && p === '/git/commits') { const sha = id(tijelo); commiti.set(sha, { tree: tijelo.tree, parents: tijelo.parents, message: tijelo.message }); return odg(201, { sha }); }
    if (req.method === 'PATCH' && (r = /^\/git\/refs\/heads\/(.+)$/.exec(p))) { grane.set(r[1], tijelo.sha); return odg(200, {}); }
    if (req.method === 'POST' && p === '/git/refs') { grane.set(tijelo.ref.replace('refs/heads/', ''), tijelo.sha); return odg(201, {}); }
    if (req.method === 'POST' && p === '/dispatches') {
      const sha = tijelo.client_payload.sha;
      const run = noviRun({ event: 'repository_dispatch', naslov: `Objava ${sha}`, gotov: false });
      // kao objava.yml: datoteke iz commita -> izgradnja stranice -> artefakt "hosting"; run je gotov kad je paket spreman
      const datoteke = new Map([...stabla.get(commiti.get(sha).tree)].map(([put, b]) => [put, blobovi.get(b)]));
      gradnja = gradnja.then(() => naObjavu(datoteke)).then((paket) => {
        artefakti.set(run.id, paket);
        Object.assign(run, { status: 'completed', conclusion: 'success', updated_at: new Date().toISOString() });
      }, () => { Object.assign(run, { status: 'completed', conclusion: 'failure', updated_at: new Date().toISOString() }); });
      return odg(204);
    }
    if (req.method === 'GET' && p === '/actions/runs') {
      const q = u.searchParams;
      const popis = runovi.filter((x) => (!q.get('event') || x.event === q.get('event')) && (!q.get('branch') || x.head_branch === q.get('branch'))
        && (!q.get('status') || x.conclusion === q.get('status') || x.status === q.get('status')));
      return odg(200, { total_count: popis.length, workflow_runs: popis });
    }
    if (req.method === 'GET' && (r = /^\/actions\/runs\/(\d+)\/artifacts$/.exec(p))) {
      const a = artefakti.has(Number(r[1])) ? [{ id: Number(r[1]), name: 'hosting', expired: false, archive_download_url: `http://${req.headers.host}/repos/test/septilion/actions/artifacts/${r[1]}/zip` }] : [];
      return odg(200, { total_count: a.length, artifacts: a });
    }
    if (req.method === 'GET' && (r = /^\/actions\/artifacts\/(\d+)\/zip$/.exec(p))) return odg(302, undefined, { location: `http://${req.headers.host}/spremiste/${r[1]}` });
    odg(404, { message: `Nepoznato: ${req.method} ${p}` });
  });
  return {
    server, grane, commiti, runovi, zahtjevi, stat, noviRun,
    datoteka: (put, grana = 'sadrzaj') => { const c = commiti.get(grane.get(grana)); const b = c && stabla.get(c.tree).get(put); return b ? blobovi.get(b) : null; },
    gotovo: () => gradnja,
  };
}

async function phpPosluzitelj(env) {
  const dir = novaMapa();
  const podaci = path.join(dir, 'podaci'), konf = path.join(dir, 'konf'), stranica = path.join(dir, 'stranica');
  await pripremi(konf, { origin: PHP_ORIGIN });
  if (!env.produkcija) await izgradi(stranica); // početna stranica iz lokalnih podataka (kao prva objava)
  let br = 0;
  const github = lazniGitHub({
    token: GITHUB_TOKEN,
    async naObjavu(datoteke) {
      const p = path.join(dir, `objava-${++br}`);
      for (const [put, b] of datoteke) { fs.mkdirSync(path.dirname(path.join(p, put)), { recursive: true }); fs.writeFileSync(path.join(p, put), b); }
      const nova = path.join(dir, `stranica-${br}`);
      await izgradi(nova, path.join(p, 'podaci'));
      return zipMape(nova).podaci; // artefakt "hosting": uredništvo ga samo preuzme i postavi u stranica/ (public_html)
    },
  });
  await new Promise((r) => github.server.listen(0, '127.0.0.1', r));
  // postavke objave kao da ih je administrator upisao (izbornik -> Objava stranice); test ih može i obrisati
  fs.mkdirSync(podaci, { recursive: true });
  if (env.bezObjave !== true) fs.writeFileSync(path.join(podaci, 'objava-postavke.json'), JSON.stringify({ repo: 'test/septilion', grana: 'sadrzaj', token: GITHUB_TOKEN }));
  const port = await slobodanPort();
  const zapisi = [];
  const procesEnv = {
    ...process.env, UREDNISTVO_PODACI: podaci, UREDNISTVO_KONFIGURACIJA: konf, UREDNISTVO_SUCELJE: path.join(ROOT, 'urednistvo/sucelje'),
    UREDNISTVO_STRANICA: stranica, UREDNISTVO_JAVNO: stranica, UREDNISTVO_GITHUB_API: `http://127.0.0.1:${github.server.address().port}`,
    UREDNISTVO_OSVJEZI_MS: '0',
    ...(env.produkcija ? {} : { UREDNISTVO_LOKALNO: '1' }),
  };
  let proces;
  const pokreniPhp = async () => {
    proces = spawn(PHP, ['-S', `127.0.0.1:${port}`, path.join(ROOT, 'tests/urednistvo/php-router.php')], { cwd: ROOT, env: procesEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    proces.stdout.on('data', (d) => zapisi.push(String(d))); proces.stderr.on('data', (d) => zapisi.push(String(d)));
    for (let i = 0; i < 100; i++) { try { await (await fetch(`http://127.0.0.1:${port}/urednistvo/static/app.css`)).arrayBuffer(); return; } catch { await cekaj(100); } }
    throw new Error(`php -S se nije pokrenuo: ${zapisi.join('')}`);
  };
  const ugasi = () => new Promise((r) => { if (!proces || proces.exitCode !== null) return r(); proces.once('exit', r); proces.kill(); });
  await pokreniPhp();
  const url = `http://127.0.0.1:${port}`;
  return {
    vrsta: 'php', url, dir, podaci, zapisi, github,
    stranica: async (put) => (await fetch(url + put)).text(),
    /** php -S radi jedan zahtjev za drugim: kad odgovori, slanje na GitHub iz prošlog zahtjeva je gotovo; zatim gradnja,
     *  pa postavljanje paketa kao cPanel Cron Job (/api/osvjezi) */
    async objavljeno() {
      await (await fetch(`${url}/urednistvo/api/stanje`)).arrayBuffer();
      await github.gotovo();
      await (await fetch(`${url}/urednistvo/api/osvjezi`)).arrayBuffer();
      const j = JSON.parse(github.datoteka('podaci/jelovnik.json')?.toString('utf8') ?? 'null');
      return { stanje: github.runovi[0]?.conclusion === 'failure' ? 'greska' : 'spremno', verzija: j?.verzija ?? null };
    },
    async ponovnoPokreni() { await ugasi(); await cekaj(300); await pokreniPhp(); },
    async zatvori() { await this.objavljeno(); await ugasi(); await new Promise((r) => github.server.close(r)); obrisi(dir); },
  };
}

/** HTTP klijent kao preglednik: pamti kolačiće (kolacic = sesija uredništva, ostali = npr. pregled za vrijeme održavanja) i CSRF, šalje Origin naše stranice */
export function klijent(url, { host } = {}) {
  let kolacic = '', csrf = null;
  const ostali = new Map();
  async function z(metoda, put, tijelo, { origin = host ? `https://${host}` : url, zaglavlja = {}, sirovo = false, vrsta, bezCsrf = false } = {}) {
    const h = { ...zaglavlja };
    const kolacici = [kolacic, ...[...ostali].map(([k, v]) => `${k}=${v}`)].filter(Boolean).join('; ');
    if (kolacici) h.cookie = kolacici;
    if (origin) h.origin = origin;
    if (csrf && !bezCsrf) h['x-csrf'] = csrf;
    if (tijelo !== undefined) h['content-type'] = vrsta ?? 'application/json';
    const b = tijelo === undefined ? undefined : sirovo ? tijelo : Buffer.from(JSON.stringify(tijelo));
    // fetch ne dopušta drugi Host, pa za "pravu domenu" ide http.request (kao iza Apachea/proxyja)
    const r = host ? await zahtjevHost(url + put, metoda, { ...h, host }, b) : await fetch(url + put, { method: metoda, headers: h, redirect: 'manual', body: b });
    const svi = r.headers.getSetCookie();
    for (const c of svi) {
      const par = c.split(';')[0], ime = par.slice(0, par.indexOf('=')), brisi = /Max-Age=0/i.test(c);
      if (ime.endsWith('urednistvo')) kolacic = brisi ? '' : par;
      else if (brisi) ostali.delete(ime); else ostali.set(ime, par.slice(ime.length + 1));
    }
    const sc = svi.find((c) => c.split('=')[0].endsWith('urednistvo')) ?? svi[0] ?? null;
    const t = Buffer.from(await r.arrayBuffer());
    let j = null; try { j = JSON.parse(t.toString('utf8')); } catch { /* nije JSON */ }
    if (j?.csrf) csrf = j.csrf;
    return { status: r.status, j, h: r.headers, tijelo: t, setCookie: sc };
  }
  return { z, ostali, get csrf() { return csrf; }, set csrf(v) { csrf = v; }, get kolacic() { return kolacic; }, set kolacic(v) { kolacic = v; } };
}
function zahtjevHost(url, metoda, zaglavlja, tijelo) {
  const u = new URL(url);
  return new Promise((ok, ne) => {
    const q = http.request({ host: u.hostname, port: u.port, method: metoda, path: u.pathname + u.search, headers: zaglavlja }, (res) => {
      const d = []; res.on('data', (x) => d.push(x));
      res.on('end', () => {
        const b = Buffer.concat(d);
        const hs = new Headers(); for (const [k, v] of Object.entries(res.headers)) for (const x of [v].flat()) hs.append(k, x);
        ok({ status: res.statusCode, headers: hs, arrayBuffer: async () => b });
      });
    });
    q.on('error', ne); q.end(tijelo);
  });
}

/** kod za dvostruku potvrdu: za sljedeći korak od zadanog (prijava ne prihvaća isti korak dvaput) */
export const kod = (kljuc, pomak = 0) => totpKod(kljuc.replace(/\s/g, ''), trenutniKorak() + pomak);

/** postavi prvi račun (lokalno, bez koda) i dvostruku potvrdu; vraća { k, kljuc, rezervni } */
export async function postaviPrvog(srv, ime = 'tomislav', lozinka = 'plava kaseta svira jazz') {
  const k = klijent(srv.url);
  const r1 = await k.z('POST', '/urednistvo/api/postavljanje', { ime, lozinka });
  if (r1.status !== 200) throw new Error(`postavljanje ${r1.status} ${JSON.stringify(r1.j)}`);
  const r2 = await k.z('POST', '/urednistvo/api/2fa/potvrdi', { kod: kod(r1.j.kljuc) });
  if (r2.status !== 200) throw new Error(`2fa ${r2.status} ${JSON.stringify(r2.j)}`);
  return { k, kljuc: r1.j.kljuc.replace(/\s/g, ''), rezervni: r2.j.rezervniKodovi, lozinka, ime };
}

/** datoteka sesije klijenta (ista za obje pozadine: podaci/sesije/<sha256(id)>.json) */
export function datotekaSesije(srv, k) {
  return path.join(srv.podaci, 'sesije', `${sha256(k.kolacic.split('=')[1])}.json`);
}

