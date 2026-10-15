// Posluživanje statičnih datoteka (stranica iz aktivnog izdanja, sučelje uredništva) — ista pravila kao public/.htaccess:
// čiste adrese, sigurnosna zaglavlja, cache, kompresija (br/gzip), ETag. Ništa izvan zadane mape, bez "." datoteka.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { csp } from '../../src/lib/csp.mjs';
import { DATOTEKA } from './odrzavanje.mjs';

export const VRSTE = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
};
const SAZIMLJIVO = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.json', '.webmanifest', '.xml', '.txt']);

export function zaglavljaStranice({ produkcija }) {
  return {
    'Content-Security-Policy': csp({ frameAncestors: true }),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...(produkcija ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

/** cache prema stvarnoj datoteci (adresa /pasta-rhymes je pasta-rhymes.html): HTML se uvijek provjerava, da objava odmah vrijedi */
function cacheZa(rel, datoteka) {
  if (rel.startsWith('/_astro/')) return 'public, max-age=31536000, immutable';
  if (/\.(html|xml|txt)$/.test(datoteka)) return 'public, max-age=0, must-revalidate';
  if (rel.startsWith('/fonts/')) return 'public, max-age=604800';
  if (datoteka.endsWith('.pdf')) return 'public, max-age=86400';
  return 'public, max-age=3600';
}

/** sigurno pretvara URL put u datoteku unutar korijena; null ako izlazi iz njega ili dira skrivene datoteke */
export function unutar(korijen, urlPut) {
  let put;
  try { put = decodeURIComponent(urlPut); } catch { return null; }
  if (put.includes('\0') || put.includes('\\')) return null;
  if (put.split('/').some((d) => d.startsWith('.') && d !== '')) return null; // .htaccess, .git, ../
  const p = path.resolve(korijen, '.' + path.posix.normalize('/' + put));
  return p === korijen || p.startsWith(korijen + path.sep) ? p : null;
}

const jeDatoteka = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

export function posluzitelj({ produkcija }) {
  const sazeto = new Map(); // "putanja|mtime|kodiranje" -> Buffer
  let velicina = 0;

  function posalji(req, res, datoteka, { status = 200, zaglavlja = {}, cache = 'no-store' } = {}) {
    const st = fs.statSync(datoteka);
    const ext = path.extname(datoteka).toLowerCase();
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const h = { ...zaglavlja, 'Content-Type': VRSTE[ext] ?? 'application/octet-stream', 'Cache-Control': cache, ETag: etag, Vary: 'Accept-Encoding' };
    if (status === 200 && req.headers['if-none-match'] === etag) { res.writeHead(304, h); res.end(); return; }
    let tijelo = fs.readFileSync(datoteka);
    const ae = String(req.headers['accept-encoding'] ?? '');
    const kod = SAZIMLJIVO.has(ext) && tijelo.length > 1024 ? (/\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null) : null;
    if (kod) {
      const kljuc = `${datoteka}|${st.mtimeMs}|${kod}`;
      let b = sazeto.get(kljuc);
      if (!b) {
        b = kod === 'br' ? zlib.brotliCompressSync(tijelo, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } }) : zlib.gzipSync(tijelo, { level: 9 });
        if (velicina > 64 * 1024 * 1024) { sazeto.clear(); velicina = 0; }
        sazeto.set(kljuc, b); velicina += b.length;
      }
      tijelo = b; h['Content-Encoding'] = kod;
    }
    h['Content-Length'] = tijelo.length;
    res.writeHead(status, h);
    res.end(req.method === 'HEAD' ? undefined : tijelo);
  }

  /** stranica iz izdanja (pravila kao .htaccess); odrzavanje: posjetitelji dobiju odrzavanje.html (503), datoteke rade i dalje */
  function stranica(req, res, korijen, { odrzavanje = false } = {}) {
    const url = new URL(req.url, 'http://x');
    const zag = zaglavljaStranice({ produkcija });
    const put = url.pathname;
    if (odrzavanje && !DATOTEKA.test(put) && jeDatoteka(path.join(korijen, 'odrzavanje.html'))) {
      posalji(req, res, path.join(korijen, 'odrzavanje.html'), { status: 503, zaglavlja: { ...zag, 'Retry-After': '3600' }, cache: 'no-store' });
      return;
    }
    // stranica za održavanje postoji samo dok je održavanje uključeno
    if (!odrzavanje && /^\/odrzavanje(\.html)?$/.test(put)) { posalji(req, res, path.join(korijen, '404.html'), { status: 404, zaglavlja: zag, cache: 'no-store' }); return; }
    // jedna kanonska adresa: /x.html -> /x, /x/ -> /x
    if (/\.html$/.test(put)) { res.writeHead(301, { ...zag, Location: put.replace(/(index)?\.html$/, '').replace(/(.)\/$/, '$1') || '/' }); res.end(); return; }
    if (put.length > 1 && put.endsWith('/')) { res.writeHead(301, { ...zag, Location: put.replace(/\/+$/, '') }); res.end(); return; }
    let p = unutar(korijen, put === '/' ? '/index.html' : put);
    if (p && !jeDatoteka(p)) p = jeDatoteka(p + '.html') ? p + '.html' : null;
    if (p && path.basename(p) === '_headers') p = null;
    if (!p) { posalji(req, res, path.join(korijen, '404.html'), { status: 404, zaglavlja: zag, cache: 'no-store' }); return; }
    posalji(req, res, p, { zaglavlja: zag, cache: cacheZa(put, p) });
  }

  return { posalji, stranica };
}
