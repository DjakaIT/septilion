// Septillion poslužitelj: stranica (zadnje objavljeno izdanje) + uredništvo na /urednistvo.
// Pokretanje: npm start   (lokalno http://localhost:3000, u produkciji iza HTTPS proxyja — vidi README)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { postavke, ROOT } from './lib/postavke.mjs';
import { ucitajEnv } from './lib/env.mjs';
import { korisnici as korisniciStore } from './lib/korisnici.mjs';
import { sesije as sesijeStore } from './lib/sesije.mjs';
import { spremiste as spremisteStore } from './lib/spremiste.mjs';
import { slike as slikeStore } from './lib/slike.mjs';
import { objava as objavaStore } from './lib/objava.mjs';
import { posluzitelj as staticno, zaglavljaStranice, unutar } from './lib/staticno.mjs';
import { api as apiRute, zaglavljaUrednistva } from './lib/api.mjs';
import { postavljanje as postavljanjeStore } from './lib/postavljanje.mjs';
import { odrzavanje as odrzavanjeStore, imaPregled } from './lib/odrzavanje.mjs';

export async function pokreni(env = process.env, zapisnik = console) {
  const p = postavke(env);
  fs.mkdirSync(p.podaci, { recursive: true, mode: 0o700 });
  fs.mkdirSync(p.izdanja, { recursive: true });

  const korisnici = korisniciStore(p.podaci);
  const sesije = sesijeStore({ sigurno: p.produkcija, dir: path.join(p.podaci, 'sesije') });
  const slike = slikeStore(p.podaci);
  const spremiste = spremisteStore(p.podaci, { slikaPostoji: slike.postoji });
  const objava = objavaStore({ podaciDir: p.podaci, izdanjaDir: p.izdanja, zapisnik });
  const postavljanje = postavljanjeStore(p.podaci, p.origin);
  const odrzavanje = odrzavanjeStore(p.podaci);
  const datoteke = staticno(p);
  spremiste.ucitaj(); // prvi put: početni sadržaj iz lokalnih podataka stranice

  const api = apiRute({ p, korisnici, sesije, spremiste, slike, objava, postavljanje, odrzavanje, zapisnik });
  const SUCELJE = path.join(ROOT, 'urednistvo/sucelje');
  const zagUred = zaglavljaUrednistva(p);
  const hostUredništva = p.produkcija ? new URL(p.origin).host : null;

  const server = http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD', 'POST', 'PUT'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD, POST, PUT' }); res.end(); return; }
      const put = new URL(req.url, 'http://x').pathname;

      if (put === '/urednistvo' || put.startsWith('/urednistvo/')) {
        // u produkciji samo preko prave adrese (zaštita od DNS rebindinga)
        if (hostUredništva && req.headers.host !== hostUredništva) { res.writeHead(421, zagUred); res.end(); return; }
        if (put.startsWith('/urednistvo/api/')) { await api(req, res, put.slice('/urednistvo/api'.length)); return; }
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, zagUred); res.end(); return; }
        const datoteka = put.startsWith('/urednistvo/static/') ? unutar(SUCELJE, put.slice('/urednistvo/static'.length)) : path.join(SUCELJE, 'index.html');
        if (!datoteka || !fs.existsSync(datoteka) || !fs.statSync(datoteka).isFile()) { res.writeHead(404, zagUred); res.end(); return; }
        datoteke.posalji(req, res, datoteka, { zaglavlja: zagUred, cache: 'no-store' });
        return;
      }

      const mapa = objava.aktivnaMapa();
      if (!mapa) {
        // prvo izdanje se gradi (nekoliko sekundi): stranica se sama osvježava
        res.writeHead(503, { ...zaglavljaStranice(p), 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '5', 'Cache-Control': 'no-store' });
        res.end('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="3"><meta name="viewport" content="width=device-width"><title>Septillion</title><p>Stranica se priprema, osvježava se sama za nekoliko sekundi…</p>');
        return;
      }
      datoteke.stranica(req, res, mapa, { odrzavanje: odrzavanje.ukljuceno() && !imaPregled(req) });
    } catch (e) {
      zapisnik.error('[poslužitelj]', e);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Greška na poslužitelju.'); } else res.destroy();
    }
  });
  // zaštita od sporih zahtjeva (slowloris) i predugih veza
  server.headersTimeout = 15_000;
  server.requestTimeout = 120_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 1000;

  await new Promise((r) => server.listen(p.port, p.host, r));
  const adresa = env.UREDNISTVO_ORIGIN ? p.origin : `http://localhost:${server.address().port}`;
  zapisnik.log(`[poslužitelj] ${adresa} (sluša ${p.host}:${server.address().port}${p.produkcija ? ', produkcija' : ''})`);
  zapisnik.log(`[uredništvo] ${adresa}/urednistvo`);
  if (korisnici.broj() === 0) {
    // prvi račun se postavlja izravno na /urednistvo; na serveru uz stalni kod iz datoteke (ne mijenja se pri ponovnom pokretanju)
    if (p.produkcija || p.proxy) zapisnik.log(`[uredništvo] prvo postavljanje: kod ${postavljanje.kod()} (i u ${postavljanje.datoteka})`);
    else zapisnik.log('[uredništvo] prvi put: otvori tu adresu i postavi svoj račun');
  }
  objava.pripremi();

  const zatvori = () => new Promise((r) => { sesije.zatvori(); server.close(() => r()); server.closeAllConnections?.(); });
  return { server, objava, korisnici, zatvori, port: server.address().port };
}

// izravno pokretanje (npm start)
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  ucitajEnv();
  const s = await pokreni();
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await s.zatvori(); process.exit(0); });
}
