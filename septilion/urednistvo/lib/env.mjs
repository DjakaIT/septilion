// .env (ako postoji) -> process.env, bez ikakve poruke kad ga nema. Postavljene varijable okruženja imaju prednost.
// Poziva se samo pri izravnom pokretanju (npm start, naredbe), nikad pri uvozu — testovi ne smiju čitati tuđi .env.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './postavke.mjs';

export function ucitajEnv() {
  const f = path.join(ROOT, '.env');
  if (fs.existsSync(f)) process.loadEnvFile(f);
}
