// npm test: pokrene `astro preview` na slobodnom portu, odvrti tests/smoke.mjs i ugasi server.
// Ako pregled za ovaj projekt već radi (Astro dopušta samo jedan), koristi njega.
// Pretpostavlja da je `npm run build` već napravljen (dist/).
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';

if (!fs.existsSync('dist/index.html')) { console.error('Nema dist/ — prvo `npm run build`.'); process.exit(1); }
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
let base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
server.stdout.on('data', (d) => { out += d; });
server.stderr.on('data', (d) => { out += d; });
const stop = () => { try { server.kill(); } catch { /* već ugašen */ } };
process.on('exit', stop);

let up = false;
for (let i = 0; i < 80 && !up; i++) {
  const other = out.match(/already running[\s\S]*?URL:\s*(\S+)/);
  if (other) base = other[1].replace(/\/$/, '');
  try { up = (await fetch(base + '/')).ok; } catch { /* još se diže */ }
  if (!up) await new Promise((r) => setTimeout(r, 250));
}
if (!up) { console.error(`astro preview se nije podigao na ${base}\n${out}`); process.exit(1); }
console.log(`[test] ${base}`);
const t = spawn(process.execPath, ['tests/smoke.mjs', 'test-results/smoke'], { stdio: 'inherit', env: { ...process.env, BASE_URL: base } });
t.on('exit', (code) => { stop(); process.exit(code ?? 1); });
