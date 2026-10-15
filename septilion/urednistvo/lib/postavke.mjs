// Postavke poslužitelja (varijable okruženja). U produkciji se bez ispravnih postavki ne pokreće.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function postavke(env = process.env) {
  const produkcija = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 3000);
  const p = {
    produkcija,
    port,
    // samo lokalno sučelje; javno ga izlaže obrnuti proxy (nginx/Apache/hosting) s HTTPS-om
    host: env.HOST || '127.0.0.1',
    // vjeruj X-Forwarded-For/Proto samo kad ispred stoji naš proxy
    proxy: env.UREDNISTVO_PROXY === '1',
    // javna adresa stranice (npr. https://septillion.hr): provjera Origin zaglavlja, poveznice u pozivnicama
    origin: (env.UREDNISTVO_ORIGIN || (produkcija ? '' : `http://localhost:${port}`)).replace(/\/+$/, ''),
    podaci: path.resolve(ROOT, env.UREDNISTVO_PODACI || 'podaci'),
    izdanja: path.resolve(ROOT, env.UREDNISTVO_IZDANJA || 'izdanja'),
  };
  if (produkcija && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(p.origin)) {
    throw new Error('U produkciji postavi UREDNISTVO_ORIGIN na https adresu stranice (npr. https://septillion.hr).');
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT nije ispravan'); // 0 = slobodan port (testovi)
  return p;
}
