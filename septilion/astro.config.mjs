// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/site.config.mjs';
import { csp } from './src/lib/csp.mjs';

/** Upisuje CSP (s hashom inline boot skripte) u zaglavlja za Apache (.htaccess) i Netlify/Cloudflare (_headers). */
const securityHeaders = {
  name: 'septillion-security-headers',
  hooks: {
    'astro:build:done': ({ dir }) => {
      for (const f of ['.htaccess', '_headers']) {
        const p = fileURLToPath(new URL(f, dir));
        if (!fs.existsSync(p)) continue;
        const txt = fs.readFileSync(p, 'utf8');
        if (!txt.includes('__CSP__')) throw new Error(`${f}: nema oznake __CSP__`);
        fs.writeFileSync(p, txt.replace('__CSP__', csp({ frameAncestors: true })));
      }
    },
  },
};

/** @font-face čija datoteka nije u public/ (TT Lakes Neue bez fontova: GitHub Actions, produkcija s trial fontovima)
 *  izbacuje se iz fonts.css — inače svaka stranica traži nepostojeće datoteke (404), a font je ionako sistemski. */
const fontoviBezDatoteka = {
  name: 'septillion-fontovi-bez-datoteka',
  enforce: /** @type {const} */ ('pre'),
  transform(/** @type {string} */ kod, /** @type {string} */ id) {
    if (!id.split('?')[0].endsWith('/src/styles/fonts.css')) return null;
    return kod.replace(/@font-face\{[^}]*url\((\/fonts\/[^)]+)\)[^}]*\}\n?/g, (pravilo, url) => (fs.existsSync(path.join('public', url)) ? pravilo : ''));
  },
};

/** Samo `npm run dev` (4321): uredništvo živi na poslužitelju (`npm start`, 3000), pa umjesto 404 stranice objasni gdje je. */
const urednistvoUDevu = {
  name: 'septillion-urednistvo-dev',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use((req, res, next) => {
        const put = (req.url ?? '').split('?')[0];
        if (put !== '/urednistvo' && !put.startsWith('/urednistvo/')) return next();
        const adresa = `http://${(req.headers.host ?? 'localhost').replace(/:\d+$/, '')}:3000/urednistvo`;
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Uredništvo · razvojni način</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;color:#17171a}code{background:#f0eee9;padding:2px 6px;border-radius:5px}a{color:#2563eb}</style>
<h1>Uredništvo nije u razvojnom načinu</h1>
<p><code>npm run dev</code> (ovaj port, 4321) služi samo za uređivanje dizajna. Uredništvo radi na vlastitom poslužitelju.</p>
<p>U drugom terminalu pokreni <code>npm start</code> i otvori adresu ispod. Prvi put te ondje dočeka postavljanje računa (lozinka i jednom QR kod), a poslije prijava.</p>
<p><a href="${adresa}">${adresa}</a></p>`);
      });
    },
  },
};

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  // CSS inline: bez zahtjeva koji blokira iscrtavanje (style-src ionako dopušta inline)
  build: { format: 'file', inlineStylesheets: 'always' },
  // HTML razmaci kao u v6 (prototip računa na razmake između inline elemenata)
  compressHTML: true,
  i18n: {
    locales: ['hr', 'en'],
    defaultLocale: 'hr',
    routing: { prefixDefaultLocale: false },
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'hr', locales: { hr: 'hr-HR', en: 'en' } },
      // stranica za održavanje (503) nije za tražilice
      filter: (adresa) => !/\/odrzavanje\/?$/.test(adresa),
    }),
    securityHeaders,
    urednistvoUDevu,
  ],
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  vite: {
    plugins: [fontoviBezDatoteka],
    build: { assetsInlineLimit: 0 },
    // @podaci = podaci uredništva (jelovnik.json, učitane fotografije); testovi koriste svoju mapu
    resolve: { alias: { '@podaci': path.resolve(process.env.UREDNISTVO_PODACI || 'podaci') } },
  },
});
