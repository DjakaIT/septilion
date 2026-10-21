// Brza funkcionalna provjera nad `npm run preview` (http://127.0.0.1:4321).
// Pokretanje: node tests/smoke.mjs [mapa-za-snimke]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.argv[2] || 'test-results/smoke';
fs.mkdirSync(OUT, { recursive: true });
const B = process.env.BASE_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch();
let failed = 0;
const ok = (cond, msg, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg} ${extra}`); if (!cond) failed++; };
async function mk(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // /jelovnik-uzivo.json piše tek uredništvo na hostingu: ovdje ga nema (404) i to je u redu
  page.on('console', (m) => { if (m.type() === 'error' && !/jelovnik-uzivo|recenzije.json/.test(String(m.location()?.url))) errs.push(m.text()); });
  return { ctx, page, errs };
}

// 1) lokal -> lokal: val, pa natrag na ulaz preko logotipa
{ const { ctx, page, errs } = await mk();
  await page.goto(B + '/pasta-rhymes', { waitUntil: 'networkidle' });
  await page.click('.switch a[data-to="jellyfish-in-space"]');
  await page.waitForTimeout(250); await page.screenshot({ path: OUT + '/wipe-mid.png' });
  await page.waitForURL('**/jellyfish-in-space', { timeout: 5000 });
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => ({ cls: document.documentElement.className, wipe: getComputedStyle(document.querySelector('#wipe')).visibility, cur: document.querySelector('.switch a[aria-current]')?.textContent }));
  ok(st.cls === 'js' && st.wipe === 'hidden' && st.cur === 'Jellyfish in Space', 'val pasta -> jellyfish', JSON.stringify(st));
  await page.click('.topbar .home'); await page.waitForURL(B + '/', { timeout: 5000 }); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => document.documentElement.className) === 'js', 'val jellyfish -> ulaz');
  ok(errs.length === 0, 'bez JS grešaka (1)', errs.join(' | '));
  await ctx.close(); }

// 2) ulaz -> "poplava" -> Pasta, pa "natrag" (bfcache)
{ const { ctx, page, errs } = await mk();
  await page.goto(B + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  await page.click('.side.a'); await page.waitForTimeout(400); await page.screenshot({ path: OUT + '/flood-mid.png' });
  await page.waitForURL('**/pasta-rhymes', { timeout: 5000 }); await page.waitForTimeout(900);
  const s = await page.evaluate(() => [document.documentElement.className, getComputedStyle(document.querySelector('#main')).opacity]);
  ok(s[0] === 'js' && s[1] === '1', 'poplava ulaz -> pasta', JSON.stringify(s));
  await page.goBack(); await page.waitForTimeout(1200); await page.screenshot({ path: OUT + '/back-gate.png' });
  ok(page.url() === B + '/', 'natrag na ulaz');
  ok(errs.length === 0, 'bez JS grešaka (2)', errs.join(' | '));
  await ctx.close(); }

// blok orbite: visina (mora biti ista za svaku kategoriju) i je li cijeli na ekranu (između gornje i donje trake)
const blockState = (page) => page.evaluate(() => {
  const w = document.querySelector('.orbit-wrap'), r = (w.getClientRects().length ? w : document.querySelector('.orbit-grid')).getBoundingClientRect(), tb = document.querySelector('.topbar').getBoundingClientRect().bottom;
  const ob = document.querySelector('#orderbar'), obOn = document.body.classList.contains('show-ob') && getComputedStyle(ob).display !== 'none';
  const lim = obOn ? ob.getBoundingClientRect().top : innerHeight;
  return { h: Math.round(r.height), inView: r.top >= tb - 1 && r.bottom <= lim + 1 };
});

// kategorija s najviše skupina (u sadašnjem jelovniku Pića) i njezina treća skupina — izvedeno iz stranice,
// pa provjere vrijede i kad urednik promijeni jelovnik
const skupinaZaTest = (page) => page.evaluate(() => {
  const bar = [...document.querySelectorAll('.pgroups')].reduce((a, b) => (b.children.length > (a?.children.length ?? 0) ? b : a), null);
  if (!bar) return null;
  const i = +bar.dataset.cat, list = document.querySelectorAll('.pcat')[i], btn = bar.children[Math.min(2, bar.children.length - 1)];
  return { i, list: list.id, title: list.dataset.title, target: btn.dataset.target };
});
const naVrhuPopisa = (page, g) => page.evaluate((g) => [Math.round(document.getElementById(g.target).getBoundingClientRect().top), Math.round(document.querySelector('#' + g.list + ' .plist').getBoundingClientRect().top)], g);

// 3) orbita: kategorija sa skupinama i skok na skupinu (desktop)
{ const { ctx, page, errs } = await mk();
  await page.goto(B + '/jellyfish-in-space', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#orbita').scrollIntoView());
  await page.waitForTimeout(600);
  await page.click('.planet[data-i="0"]', { force: true }); await page.waitForTimeout(1600);
  const b0 = await blockState(page);
  const g = await skupinaZaTest(page);
  await page.click(`.planet[data-i="${g.i}"]`, { force: true }); await page.waitForTimeout(1600);
  const s = await page.evaluate(() => ({ t: document.querySelector('#pn-t').textContent, d: document.querySelector('#pn-d').textContent,
    vis: [...document.querySelectorAll('.pcat')].filter((l) => !l.hidden).map((l) => l.id),
    groups: [...document.querySelectorAll('.pgroups')].filter((g) => !g.hidden).length }));
  ok(s.t === g.title && s.vis.join() === g.list && s.groups === 1, `orbita -> ${g.title}`, JSON.stringify(s));
  const b9 = await blockState(page);
  ok(b0.inView && b9.inView && b0.h === b9.h, 'desktop: orbita i jelovnik cijeli na ekranu, iste visine', JSON.stringify([b0, b9]));
  await page.click(`.pgroups:not([hidden]) button[data-target="${g.target}"]`); await page.waitForTimeout(2200);
  await page.screenshot({ path: OUT + '/skupina-desktop.png' });
  const d = await naVrhuPopisa(page, g);
  ok(Math.abs(d[0] - d[1]) <= 2, `desktop: skupina ${g.target} na vrhu popisa`, JSON.stringify(d));
  ok(errs.length === 0, 'bez JS grešaka (3)', errs.join(' | '));
  await ctx.close(); }

// 4) mobitel: učitavanje ne skače, kategorije, skupine, kaseta
{ const { ctx, page, errs } = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(B + '/jellyfish-in-space', { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
  ok(await page.evaluate(() => scrollY) === 0, 'jellyfish se na mobitelu otvara na vrhu');
  await page.evaluate(() => document.querySelector('#orbita').scrollIntoView()); await page.waitForTimeout(500);
  await page.tap('#chips button:nth-child(1)'); await page.waitForTimeout(1200);
  const b0 = await blockState(page);
  const g = await skupinaZaTest(page);
  await page.tap(`#chips button:nth-child(${g.i + 1})`); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/skupina-mobile.png' });
  const b9 = await blockState(page);
  ok(b0.inView && b9.inView && b0.h === b9.h, 'mobitel: orbita i jelovnik cijeli na ekranu, iste visine', JSON.stringify([b0, b9]));
  await page.tap(`.pgroups:not([hidden]) button[data-target="${g.target}"]`); await page.waitForTimeout(2200);
  await page.screenshot({ path: OUT + '/skupina-mobile-skok.png' });
  const vis = await naVrhuPopisa(page, g);
  ok(Math.abs(vis[0] - vis[1]) <= 2, `mobitel: skupina ${g.target} na vrhu popisa`, JSON.stringify(vis));
  ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) === 0, 'bez vodoravnog prelijevanja (jellyfish 390)');
  await page.goto(B + '/pasta-rhymes', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#spraylist').scrollIntoView()); await page.waitForTimeout(500);
  await page.tap('.spine[data-i="2"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/spine-mobile.png' });
  const sp = await page.evaluate(() => [document.querySelector('#c-name').textContent, document.querySelector('#deck').parentElement.className, document.querySelector('.spine[data-i="2"]').dataset.n]);
  ok(sp[0] === sp[2] && sp[1] === 'sp', 'kaseta se otvara ispod hrpta (naziv treće paste)', JSON.stringify(sp));
  // kaseta: slika gore (60–65 %), naziv jela između dva kotačića, "Strana A" na slici
  const cs = await page.evaluate(() => {
    const w = document.querySelector('#cas .win').getBoundingClientRect(), l = document.querySelector('#cas .clab').getBoundingClientRect();
    const h = [...document.querySelectorAll('#cas .hub')].map((x) => x.getBoundingClientRect()), n = document.querySelector('#c-name').getBoundingClientRect();
    return { share: +(w.height / (w.height + l.height)).toFixed(2), above: w.bottom <= l.top, between: h.length === 2 && h[0].right <= n.left && n.right <= h[1].left,
      side: document.querySelector('#cas .win #c-no').textContent, label: document.querySelector('#c-no').dataset.label, font: parseFloat(getComputedStyle(document.querySelector('#c-name')).fontSize) };
  });
  ok(cs.above && cs.share >= 0.6 && cs.share <= 0.66 && cs.between && cs.side === `${cs.label} · 03` && cs.font >= 18, 'kaseta: slika gore, naziv između kotačića', JSON.stringify(cs));
  // kaseta i omot s popisom jednako široki (simetrično)
  const wd = await page.evaluate(() => ['#cas', '#inlay'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
  ok(wd[0][0] === wd[1][0] && wd[0][1] === wd[1][1], 'mobitel: kaseta i popis iste širine', JSON.stringify(wd));
  ok(errs.length === 0, 'bez JS grešaka (4)', errs.join(' | '));
  await ctx.close(); }

// 5) puni prikaz fotografije tipkovnicom
{ const { ctx, page, errs } = await mk();
  await page.goto(B + '/pasta-rhymes', { waitUntil: 'networkidle' });
  await page.focus('.gopen[data-i="2"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  const a = await page.evaluate(() => [document.querySelector('.lb').classList.contains('on'), document.activeElement.className, document.querySelector('.lb-n').textContent]);
  const uk = String(await page.evaluate(() => document.querySelectorAll('.gopen').length)).padStart(2, '0');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  const b = await page.evaluate(() => document.querySelector('.lb-n').textContent);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const c = await page.evaluate(() => [document.querySelector('.lb').classList.contains('on'), document.activeElement.className]);
  ok(a[0] && a[1] === 'lb-x' && a[2] === `03 / ${uk}` && b === `04 / ${uk}` && !c[0] && c[1] === 'gopen', 'puni prikaz: otvori, lista, Escape vraća fokus', JSON.stringify([a, b, c]));
  ok(errs.length === 0, 'bez JS grešaka (5)', errs.join(' | '));
  await ctx.close(); }

// 6) smanjeno kretanje: bez vala, kokteli statični
{ const { ctx, page, errs } = await mk({ reducedMotion: 'reduce' });
  await page.goto(B + '/pasta-rhymes', { waitUntil: 'networkidle' });
  await page.click('.switch a[data-to="jellyfish-in-space"]'); await page.waitForURL('**/jellyfish-in-space', { timeout: 5000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(() => [document.documentElement.className, getComputedStyle(document.querySelector('.ck-stage')).position]);
  ok(r[0] === 'js' && r[1] === 'relative', 'smanjeno kretanje', JSON.stringify(r));
  ok(errs.length === 0, 'bez JS grešaka (6)', errs.join(' | '));
  await ctx.close(); }

// 7) bez JS-a: sav sadržaj vidljiv
{ const { ctx, page } = await mk({ javaScriptEnabled: false });
  await page.goto(B + '/jellyfish-in-space');
  const r = await page.evaluate(() => ({ rvHidden: [...document.querySelectorAll('.rv')].filter((e) => getComputedStyle(e).opacity === '0').length,
    lists: [...document.querySelectorAll('.pcat')].filter((l) => getComputedStyle(l).display !== 'none').length, ukupno: document.querySelectorAll('.pcat').length,
    text: document.body.innerText.includes([...document.querySelectorAll('.pcat:last-of-type .plist .it b')].pop()?.textContent ?? '##') }));
  ok(r.rvHidden === 0 && r.lists === r.ukupno && r.ukupno > 0 && r.text, 'bez JS-a sadržaj vidljiv', JSON.stringify(r));
  await ctx.close(); }

// 8) engleski + hreflang
{ const { ctx, page, errs } = await mk();
  await page.goto(B + '/en/jellyfish-in-space', { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => [document.documentElement.lang, document.querySelector('#pn-t').textContent, document.querySelector('#pn-d').textContent,
    document.querySelector('.plist li .pr').textContent, document.querySelectorAll('link[hreflang]').length, document.querySelector('#chips button').textContent]);
  // naslov = prva kategorija, broj stavki i cijena u engleskom obliku (€8.00), tri hreflang veze
  ok(r[0] === 'en' && r[1] === r[5] && /^\d+ items?$/.test(r[2]) && /^€\d+\.\d{2}/.test(r[3]) && r[4] === 3, 'engleska stranica', JSON.stringify(r));
  ok(errs.length === 0, 'bez JS grešaka (8)', errs.join(' | '));
  await ctx.close(); }

// 9) 360 px: nijedna stranica ne prelijeva vodoravno
for (const p of ['/', '/pasta-rhymes', '/jellyfish-in-space', '/en', '/en/pasta-rhymes', '/en/jellyfish-in-space']) {
  const { ctx, page } = await mk({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await page.goto(B + p, { waitUntil: 'networkidle' });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const tb = await page.evaluate(() => { const r = document.querySelector('.tb-r').getBoundingClientRect(); const h = document.querySelector('.home').getBoundingClientRect(); return [Math.round(h.right), Math.round(r.left), Math.round(r.right)]; });
  ok(ov === 0 && tb[0] <= tb[1] && tb[2] <= 360, `360 px ${p}`, `overflow=${ov} topbar=${tb}`);
  await ctx.close();
}

// 11) brojači fotografija: svaki broj redom do zadnjeg (strelicama i ručnim listanjem do kraja)
for (const vp of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
  const { ctx, page, errs } = await mk({ viewport: vp, ...(vp.width < 900 ? { isMobile: true, hasTouch: true } : {}) });
  await page.goto(B + '/pasta-rhymes', { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.pr-gal').scrollIntoView(); });
  const cur = () => page.evaluate(() => document.querySelector('#g-cur').textContent);
  const N = +(await page.evaluate(() => document.querySelector('#g-tot').textContent));
  const fwd = [await cur()];
  for (let i = 0; i < N - 1; i++) { await page.evaluate(() => document.querySelector('#g-next').click()); await page.waitForTimeout(700); fwd.push(await cur()); }
  const nextOff = await page.evaluate(() => document.querySelector('#g-next').disabled);
  const back = [];
  for (let i = 0; i < N - 1; i++) { await page.evaluate(() => document.querySelector('#g-prev').click()); await page.waitForTimeout(700); back.push(await cur()); }
  await page.evaluate(() => { const g = document.querySelector('#gtrack'); g.scrollTo({ left: g.scrollWidth }); });
  await page.waitForTimeout(600);
  const end = await cur();
  const want = Array.from({ length: N }, (_, i) => String(i + 1).padStart(2, '0'));
  ok(N > 1 && fwd.join() === want.join() && nextOff && back.join() === want.slice(0, -1).reverse().join() && end === want.at(-1),
    `Pasta galerija ${vp.width}: brojač 01–${want.at(-1)} bez preskakanja`, JSON.stringify({ fwd: fwd.join(' '), back: back.join(' '), end }));
  if (vp.width === 1440) {
    await page.goto(B + '/jellyfish-in-space', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelector('#galerija').scrollIntoView());
    const cf = [], M = await page.evaluate(() => document.querySelectorAll('.cf-dot').length);
    for (let i = 0; i < M; i++) { cf.push(await page.evaluate(() => document.querySelector('#cf-n').textContent)); await page.evaluate(() => document.querySelector('.cf-nav.n').click()); await page.waitForTimeout(500); }
    ok(M > 1 && cf.join() === Array.from({ length: M }, (_, i) => String(i + 1).padStart(2, '0')).join(), `Jellyfish galerija: brojač 01–${String(M).padStart(2, '0')}`, cf.join(' '));
  }
  ok(errs.length === 0, `bez JS grešaka (galerija ${vp.width})`, errs.join(' | '));
  await ctx.close();
}

// 12) Spraylist na desktopu: naslov u ravnini s uvodom, popis završava s omotom kasete
for (const vp of [{ width: 1024, height: 768 }, { width: 1525, height: 748 }]) {
  const { ctx, page } = await mk({ viewport: vp });
  await page.goto(B + '/pasta-rhymes', { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('#spraylist').scrollIntoView(); });
  await page.waitForTimeout(1300);
  const a = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return [Math.round(r('#sl-h').top), Math.round(r('.sl-lead').top), Math.round(r('#spines').bottom), Math.round(r('#deck').bottom)]; });
  ok(Math.abs(a[0] - a[1]) <= 1 && Math.abs(a[2] - a[3]) <= 1, `Spraylist ${vp.width}: naslov = uvod (vrh), popis = omot (dno)`, JSON.stringify(a));
  await ctx.close();
}

// 13) ulaz je klikabilan bilo gdje na strani: ruka umjesto strelice
{ const { ctx, page } = await mk();
  await page.goto(B + '/', { waitUntil: 'networkidle' });
  const c = await page.evaluate(() => { const h = document.elementFromPoint(innerWidth * 0.3, innerHeight * 0.6); return getComputedStyle(h).cursor; });
  ok(c === 'pointer', 'ulaz: kursor ruka', c);
  await ctx.close(); }

// 10) CSP: svaka inline skripta ima hash u politici (inače je preglednik blokira)
{ const { createHash } = await import('node:crypto');
  for (const p of ['/', '/pasta-rhymes', '/en/jellyfish-in-space']) {
    const html = await (await fetch(B + p)).text();
    const inl = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const meta = (html.match(/content-security-policy" content="([^"]+)/) || [])[1] || '';
    const okAll = inl.every((s) => meta.includes(`'sha256-${createHash('sha256').update(s).digest('base64')}'`));
    ok(meta && okAll && !/unsafe-inline'[^;]*;?\s*$/.test(meta.split('script-src')[1]?.split(';')[0] || ''), `CSP hash inline skripti ${p}`, `${inl.length} inline`);
  }
}

await browser.close();
console.log(failed ?`\n${failed} provjera nije prošlo` : '\nSve provjere prošle');
process.exit(failed ? 1 : 0);
