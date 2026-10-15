// Objava: nakon spremanja stranica se izgradi u novu mapu (izdanja/<vrijeme>/) i tek nakon uspjeha postaje aktivna.
// Poslužitelj uvijek poslužuje cijelo staro ili cijelo novo izdanje. Neuspjeh ostavlja zadnje ispravno izdanje.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { citajJson, pisiJson } from './datoteke.mjs';
import { ROOT } from './postavke.mjs';

const ASTRO = path.join(ROOT, 'node_modules/astro/bin/astro.mjs');
const FONTOVI = path.join(ROOT, 'scripts/build-fonts.mjs');
const NAJDULJE_MS = 10 * 60 * 1000;

function pokreni(args, env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let izlaz = '';
    const dodaj = (d) => { izlaz = (izlaz + d).slice(-8000); };
    p.stdout.on('data', dodaj); p.stderr.on('data', dodaj);
    const t = setTimeout(() => p.kill('SIGKILL'), NAJDULJE_MS);
    p.on('close', (kod) => { clearTimeout(t); resolve({ kod, izlaz }); });
  });
}

export function objava({ podaciDir, izdanjaDir, zapisnik = console }) {
  const aktivnoDatoteka = path.join(izdanjaDir, 'aktivno.json');
  const stanje = { stanje: 'spremno', aktivno: null, objavljeno: null, verzija: null, poruka: null, pocetak: null };
  let gradi = false, ponovo = false, odgoda = null, fontovi = false;

  const a = citajJson(aktivnoDatoteka);
  if (a?.mapa && fs.existsSync(path.join(izdanjaDir, a.mapa, 'index.html'))) Object.assign(stanje, { aktivno: path.join(izdanjaDir, a.mapa), objavljeno: a.objavljeno, verzija: a.verzija });

  async function izgradi() {
    gradi = true; ponovo = false;
    Object.assign(stanje, { stanje: 'u-tijeku', poruka: null, pocetak: new Date().toISOString() });
    zapisnik.log('[objava] gradim stranicu…');
    try {
      if (!fontovi) {
        const f = await pokreni([FONTOVI], {}); fontovi = true;
        if (f.kod !== 0) zapisnik.error(`[objava] fontovi nisu izrađeni, stranica koristi sistemski font:\n${f.izlaz.trim().split('\n').slice(-3).join('\n')}`);
        else if (/TRIAL/.test(f.izlaz)) zapisnik.error(f.izlaz.trim().split('\n').find((l) => /TRIAL/.test(l)));
      }
      const verzija = citajJson(path.join(podaciDir, 'jelovnik.json'))?.verzija ?? null;
      const mapa = new Date().toISOString().replace(/[:.]/g, '-');
      const izlazDir = path.join(izdanjaDir, mapa);
      const r = await pokreni([ASTRO, 'build', '--outDir', izlazDir], { UREDNISTVO_PODACI: podaciDir, NODE_ENV: 'production' });
      if (r.kod !== 0 || !fs.existsSync(path.join(izlazDir, 'index.html'))) {
        fs.rmSync(izlazDir, { recursive: true, force: true });
        const zadnje = r.izlaz.split('\n').filter((l) => /error|greška|Uredništvo|Error/i.test(l)).slice(-6).join('\n');
        throw new Error(zadnje || `build nije uspio (${r.kod})`);
      }
      const objavljeno = new Date().toISOString();
      pisiJson(aktivnoDatoteka, { mapa, objavljeno, verzija });
      const staro = stanje.aktivno;
      Object.assign(stanje, { stanje: 'spremno', aktivno: izlazDir, objavljeno, verzija, poruka: null });
      // čuva se trenutno i prethodno izdanje, starija se brišu
      for (const d of fs.readdirSync(izdanjaDir, { withFileTypes: true })) {
        const p = path.join(izdanjaDir, d.name);
        if (d.isDirectory() && p !== izlazDir && p !== staro) fs.rmSync(p, { recursive: true, force: true });
      }
      zapisnik.log(`[objava] verzija ${verzija} objavljena (${mapa})`);
    } catch (e) {
      Object.assign(stanje, { stanje: 'greska', poruka: String(e.message).slice(0, 600) });
      zapisnik.error(`[objava] greška: ${e.message}`);
    } finally {
      gradi = false;
      if (ponovo) zatrazi(0);
    }
  }

  /** objavi trenutni sadržaj (više brzih spremanja = jedna objava) */
  function zatrazi(odgodaMs = 500) {
    if (gradi) { ponovo = true; return; }
    clearTimeout(odgoda);
    if (stanje.stanje !== 'u-tijeku') Object.assign(stanje, { stanje: 'u-tijeku', poruka: null });
    odgoda = setTimeout(izgradi, odgodaMs);
  }

  return {
    stanje: () => ({ ...stanje, aktivno: undefined }),
    aktivnaMapa: () => stanje.aktivno,
    zatrazi,
    /** pri pokretanju: ako nema objavljenog izdanja, izgradi ga */
    pripremi() { if (!stanje.aktivno) zatrazi(0); },
    gotovo: () => new Promise((r) => { const t = setInterval(() => { if (!gradi && stanje.stanje !== 'u-tijeku') { clearInterval(t); r(stanje); } }, 200); }),
  };
}
