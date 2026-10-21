// Uredništvo u pravom pregledniku, kao Tomislav — isto za obje pozadine (sucelje-node.test.mjs, sucelje-php.test.mjs):
// prvo postavljanje na /urednistvo -> lozinka -> QR jednom -> rezervni kodovi -> promjena cijene, novo jelo, pasta s
// fotografijom (i povučenom velikom fotografijom), brisanje, redoslijed, ponovno pokretanje poslužitelja usred rada,
// istek prijave s pravim razlogom, poziv drugog korisnika — i provjera da je sve na stranici.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { posluzitelj, kod, datotekaSesije, POSLUZITELJ, imaPhp } from './pomoc.mjs';
import { ROOT } from '../../urednistvo/lib/postavke.mjs';

sharp.cache(false);
const preskoci = POSLUZITELJ === 'php' && !imaPhp() ? 'nema PHP-a (postavi PHP_BINARY)' : false;

describe(`sučelje uredništva (${POSLUZITELJ})`, { skip: preskoci }, () => {
  let srv, browser, ctx, page, kljuc, rezervni;
  const problemi = [];
  const OUT = path.join(ROOT, 'test-results', `urednistvo-${POSLUZITELJ}`);
  const status = (p, t) => p.waitForFunction((x) => document.querySelector('#status')?.textContent.startsWith(x), t, { timeout: 180_000 });
  // nakon spremanja: "Objavljujem…" pa "Objavljeno" (tada je i praćenje objave u pregledniku gotovo)
  const pricekajObjavu = async (p = page) => { await status(p, 'Objavljujem'); await status(p, 'Objavljeno'); await srv.objavljeno(); };

  async function novaStranica(viewport) {
    const c = await browser.newContext({ viewport, ...(viewport.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
    const p = await c.newPage();
    p.on('pageerror', (e) => problemi.push(`JS: ${e.message}`));
    // 400/401 su namjerni (krivi kod, istekla prijava u testu); preglednik ih ispisuje kao grešku
    p.on('console', (m) => { if (m.type() === 'error' && !/status of (400|401)/.test(m.text())) problemi.push(`konzola: ${m.text()}`); });
    p.on('dialog', (d) => d.accept());
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`)));
    return { c, p };
  }
  async function prijava(p, ime, lozinka, drugiKorak) {
    await p.getByLabel('Korisničko ime').fill(ime);
    await p.getByLabel('Lozinka').fill(lozinka);
    await p.getByRole('button', { name: 'Prijava' }).click();
    await drugiKorak(p);
    await p.getByRole('button', { name: 'Potvrdi' }).click();
  }

  before(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    srv = await posluzitelj();
    browser = await chromium.launch();
    ({ c: ctx, p: page } = await novaStranica({ width: 1280, height: 860 }));
  });
  after(async () => { await browser?.close(); await srv?.zatvori(); });

  test('prvo postavljanje izravno na /urednistvo: lozinka, QR jednom (ili ručni ključ), rezervni kodovi', async () => {
    await page.goto(`${srv.url}/urednistvo`);
    await page.getByRole('heading', { name: 'Postavljanje uredništva' }).waitFor();
    assert.equal(await page.getByLabel('Kod za postavljanje').count(), 0, 'lokalno ne treba kod');
    await page.getByLabel('Korisničko ime').fill('tomislav');
    await page.getByLabel('Nova lozinka').fill('plava kaseta svira jazz');
    await page.getByLabel('Ponovi lozinku').fill('plava kaseta svira jazz');
    await page.getByRole('button', { name: 'Dalje' }).click();
    const qr = page.getByRole('img', { name: 'QR kod za aplikaciju za potvrdu' });
    await qr.waitFor();
    assert.match(await qr.getAttribute('src'), /^data:image\/gif;base64,/, 'QR nacrtan u pregledniku');
    assert.ok(await qr.evaluate((img) => img.naturalWidth > 100), 'QR je stvarna slika');
    await page.screenshot({ path: path.join(OUT, '1-dvostruka-potvrda.png') });
    await page.getByText('Ne mogu skenirati').click();
    kljuc = (await page.locator('.tajni-kljuc').textContent()).replace(/\s/g, '');
    await page.getByLabel(/Upiši šesteroznamenkasti kod/).fill('123456');
    await page.getByRole('button', { name: 'Uključi dvostruku potvrdu' }).click();
    await page.getByText('Kod nije ispravan').waitFor();
    await page.getByLabel(/Upiši šesteroznamenkasti kod/).fill(kod(kljuc));
    await page.getByRole('button', { name: 'Uključi dvostruku potvrdu' }).click();
    await page.getByRole('heading', { name: 'Spremi rezervne kodove' }).waitFor();
    rezervni = await page.locator('.rezervni li').allTextContents();
    assert.equal(rezervni.length, 8);
    const otvori = page.getByRole('button', { name: 'Otvori uredništvo' });
    assert.equal(await otvori.isDisabled(), true, 'ne nastavlja bez potvrde da su kodovi spremljeni');
    await page.getByLabel(/Spremio sam kodove/).check();
    await otvori.click();
    await page.getByRole('heading', { name: 'Strana A — paste' }).waitFor();
    assert.equal(await page.locator('.bocno button').count(), 13);
  });

  test('promjena cijene paste -> Spremi i objavi -> nova cijena na stranici', async () => {
    await page.locator('.stavka').first().locator('.sazetak').click();
    const cijena = page.locator('.stavka.otvorena').getByLabel('Cijena', { exact: true });
    assert.equal(await cijena.inputValue(), '19,00');
    await cijena.fill('22,90');
    await page.locator('#spremanje.vidljivo').waitFor();
    assert.ok(await page.locator('.stavka').first().getByText('22,90 €').isVisible(), 'sažetak se odmah osvježi');
    await page.screenshot({ path: path.join(OUT, '2-urednik.png') });
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await page.getByText('Spremljeno. Cijene i opisi su odmah na stranici').waitFor();
    await pricekajObjavu();
    assert.ok((await srv.stranica('/pasta-rhymes')).includes('22,90 €'));
  });

  test('ponovno pokretanje poslužitelja usred rada: nema odjave, spremanje radi', async () => {
    await page.getByRole('button', { name: /Strana B — prilozi/ }).click();
    await page.locator('.stavka').first().locator('.sazetak').click();
    await page.locator('.stavka.otvorena').getByLabel('Cijena', { exact: true }).fill('4,35');
    await srv.ponovnoPokreni();
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await page.getByText('Spremljeno. Cijene i opisi su odmah na stranici').last().waitFor();
    assert.equal(await page.getByLabel('Lozinka').count(), 0, 'nije tražio ponovnu prijavu');
    await pricekajObjavu();
    assert.ok((await srv.stranica('/pasta-rhymes')).includes('4,35 €'));
  });

  test('novo jelo u salatama; pasta se ne sprema bez fotografije, s fotografijom i bojom da', async () => {
    await page.getByRole('button', { name: /Strana B — salate/ }).click();
    await page.getByRole('button', { name: 'Dodaj jelo' }).click();
    const nova = page.locator('.stavka.otvorena');
    await nova.getByLabel('Naziv (hrvatski)').fill('Testna salata');
    await nova.getByLabel('Naziv (engleski)').fill('Test salad');
    await nova.getByLabel('Opis / sastojci (hrvatski)').fill('Rukola, rajčica');
    await nova.getByLabel('Cijena', { exact: true }).fill('7,5');
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await pricekajObjavu();
    const hr = await srv.stranica('/pasta-rhymes'), en = await srv.stranica('/en/pasta-rhymes');
    assert.ok(hr.includes('Testna salata') && hr.includes('7,50 €') && en.includes('Test salad'));

    await page.getByRole('button', { name: /Strana A — paste/ }).click();
    await page.getByRole('button', { name: 'Dodaj jelo' }).click();
    const pasta = page.locator('.stavka.otvorena');
    await pasta.getByLabel('Naziv (hrvatski)').fill('Pasta del test');
    await pasta.getByLabel('Opis / sastojci (hrvatski)').fill('Domaći rigatoni, rajčica, bosiljak');
    await pasta.getByLabel('Cijena', { exact: true }).fill('14');
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await page.getByText('Dodaj fotografiju jela').waitFor();
    await page.getByText('Odaberi boju naljepnice').waitFor();
    const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#d94' } }).jpeg().toBuffer();
    await pasta.locator('input[type=file]').setInputFiles({ name: 'pasta.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    await page.getByText('Fotografija učitana').waitFor();
    assert.equal(await pasta.locator('.greska-polja').count(), 1, 'poruka uz fotografiju nestaje čim je fotografija tu');
    assert.ok(await pasta.locator('fieldset.boje .greska-polja').isVisible(), 'poruka o boji stoji uz izbor boja');
    await pasta.getByRole('radio', { name: 'Ljubičasta' }).check();
    assert.equal(await page.locator('.ima-gresku, .greska-polja').count(), 0, 'sve ispravljeno: bez crvenih okvira');
    await page.screenshot({ path: path.join(OUT, '3-nova-pasta.png') });
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await pricekajObjavu();
    const html = await srv.stranica('/pasta-rhymes');
    assert.ok(html.includes('data-n="Pasta del test"') && html.includes('--c:#8B3A96;--t:#fff'), 'nova pasta s bojom i bijelim tekstom na kaseti');
  });

  test('fotografija povučena mišem; velika fotografija s mobitela smanji se u pregledniku prije slanja', async () => {
    const stavka = page.locator('.stavka').filter({ hasText: 'Pasta del test' });
    if (!(await stavka.evaluate((el) => el.classList.contains('otvorena')))) await stavka.locator('.sazetak').click();
    const okvir = page.locator('.stavka.otvorena .fotografija');
    const velika = await sharp({ create: { width: 5200, height: 3900, channels: 3, background: '#3a7' } }).jpeg({ quality: 95 }).toBuffer();
    const dt = await page.evaluateHandle((b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const d = new DataTransfer(); d.items.add(new File([bin], 'IMG_2041.jpg', { type: 'image/jpeg' })); return d;
    }, velika.toString('base64'));
    await okvir.dispatchEvent('dragover', { dataTransfer: dt });
    assert.ok(await okvir.evaluate((el) => el.classList.contains('povlaci')), 'okvir pokazuje da se može ispustiti');
    await okvir.dispatchEvent('drop', { dataTransfer: dt });
    await page.getByText('Fotografija učitana').last().waitFor();
    const najnovija = fs.readdirSync(path.join(srv.podaci, 'slike')).map((f) => path.join(srv.podaci, 'slike', f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const meta = await sharp(fs.readFileSync(najnovija)).metadata();
    assert.ok(Math.max(meta.width, meta.height) <= 2400, `smanjena na najviše 2400 px (${meta.width}×${meta.height})`);
    await page.getByRole('button', { name: 'Odbaci' }).click();
  });

  test('brisanje (s poništavanjem) i redoslijed tipkovnicom', async () => {
    await page.getByRole('button', { name: /Strana B — salate/ }).click();
    const prije = await page.locator('.stavka').count();
    await page.getByRole('button', { name: 'Obriši: Testna salata' }).click();
    assert.equal(await page.locator('.stavka').count(), prije - 1);
    await page.locator('.obavijest').getByRole('button', { name: 'Poništi' }).click();
    assert.equal(await page.locator('.stavka').count(), prije, 'poništi vraća jelo');
    await page.getByRole('button', { name: 'Obriši: Testna salata' }).click();
    const drugi = await page.locator('.stavka .naziv').nth(1).textContent();
    await page.locator('.stavka').nth(1).locator('.rucka').focus();
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('.stavka .naziv').first().textContent(), drugi, 'strelica gore pomiče jelo');
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await pricekajObjavu();
    const html = await srv.stranica('/pasta-rhymes');
    assert.ok(!html.includes('Testna salata'));
    assert.ok(html.indexOf(drugi) < html.indexOf('Salata Sicilianna'), 'novi redoslijed je na stranici');
  });

  test('30 min bez aktivnosti: poruka kaže točno to; ponovna prijava (rezervnim kodom) i promjene su još tu', async () => {
    await page.getByRole('button', { name: /Strana B — prilozi/ }).click();
    await page.locator('.stavka').first().locator('.sazetak').click();
    await page.locator('.stavka.otvorena').getByLabel('Cijena', { exact: true }).fill('4,45');
    // kao da je prošlo 31 min bez ikakve aktivnosti
    const kolacic = (await ctx.cookies()).find((c) => c.name === 'sx-urednistvo');
    const f = datotekaSesije(srv, { kolacic: `x=${kolacic.value}` });
    const s = JSON.parse(fs.readFileSync(f, 'utf8')); s.aktivno = Date.now() - 31 * 60_000; s.zapisano = s.aktivno; fs.writeFileSync(f, JSON.stringify(s));
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await page.getByText('Prijava je istekla nakon 30 minuta bez aktivnosti').waitFor();
    await page.getByText('nespremljene promjene ostaju').waitFor();
    await page.screenshot({ path: path.join(OUT, '4-istek.png') });
    await prijava(page, 'tomislav', 'plava kaseta svira jazz', async (p) => {
      await p.getByRole('button', { name: /rezervni kod/ }).click();
      await p.getByLabel(/Rezervni kod/).fill(rezervni[0]);
    });
    await page.getByText('Preostalo: 7').waitFor();
    assert.equal(await page.locator('.stavka.otvorena').getByLabel('Cijena', { exact: true }).inputValue(), '4,45', 'nespremljena cijena je sačuvana');
    await page.getByRole('button', { name: 'Spremi i objavi' }).click();
    await pricekajObjavu();
    assert.ok((await srv.stranica('/pasta-rhymes')).includes('4,45 €'));
  });

  test('administrator poziva urednika iz uredništva; urednik postavi lozinku i QR jednom; nema izbornik Korisnici', async () => {
    await page.getByRole('button', { name: 'Izbornik' }).click();
    await page.getByRole('button', { name: 'Korisnici' }).click();
    const d = page.locator('dialog[open]');
    await d.getByLabel('Pozovi novog korisnika').fill('marko');
    await d.getByRole('button', { name: 'Napravi pozivnicu' }).click();
    const poveznica = await d.getByLabel('Poveznica za marko').inputValue();
    assert.match(poveznica, /\/urednistvo\/#pozivnica=[A-Za-z0-9_-]{43}$/);
    await d.getByText('čeka pozivnicu').waitFor();
    await page.screenshot({ path: path.join(OUT, '5-korisnici.png') });
    await d.getByRole('button', { name: 'Zatvori' }).last().click();

    const { c, p } = await novaStranica({ width: 390, height: 844 });
    await p.goto(poveznica);
    await p.getByRole('heading', { name: 'Dobrodošao u uredništvo' }).waitFor();
    await p.getByText('Korisničko ime: marko').waitFor();
    await p.getByLabel('Nova lozinka').fill('zelena gitara pjeva tiho');
    await p.getByLabel('Ponovi lozinku').fill('zelena gitara pjeva tiho');
    await p.getByRole('button', { name: 'Dalje' }).click();
    await p.getByText('Ne mogu skenirati').click();
    const kljucM = (await p.locator('.tajni-kljuc').textContent()).replace(/\s/g, '');
    await p.getByLabel(/Upiši šesteroznamenkasti kod/).fill(kod(kljucM));
    await p.getByRole('button', { name: 'Uključi dvostruku potvrdu' }).click();
    await p.getByLabel(/Spremio sam kodove/).check();
    await p.getByRole('button', { name: 'Otvori uredništvo' }).click();
    await p.getByLabel('Kategorija').waitFor();
    await p.getByRole('button', { name: 'Izbornik' }).click();
    assert.equal(await p.getByRole('button', { name: 'Korisnici' }).count(), 0);
    await c.close();
  });

  test('održavanje: administrator ga uključi u izborniku; posjetitelj vidi "Uskoro se vraćamo", administrator stranicu; isključivanje iz zaglavlja', async () => {
    await page.getByRole('button', { name: 'Izbornik' }).click();
    await page.getByRole('button', { name: 'Održavanje stranice' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Uključi održavanje' }).click();
    await page.getByText('Održavanje je uključeno — posjetitelji').waitFor();
    const oznaka = page.locator('#odrzavanje');
    await oznaka.waitFor();
    await page.screenshot({ path: path.join(OUT, '7-odrzavanje.png') });

    // posjetitelj (bez kolačića pregleda): 503 i poruka s adresama; administratorov preglednik i dalje vidi stranicu
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const v = await c.newPage();
    v.on('pageerror', (e) => problemi.push(`održavanje JS: ${e.message}`));
    v.on('console', (m) => { if (/CSP|Content Security Policy/i.test(m.text())) problemi.push(`održavanje: ${m.text()}`); });
    assert.equal((await v.goto(`${srv.url}/pasta-rhymes`)).status(), 503);
    await v.getByRole('heading', { name: 'Uskoro se vraćamo.' }).waitFor();
    await v.getByText('Ulica Pavla Hatza 5, Zagreb').waitFor();
    assert.equal(await v.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await v.screenshot({ path: path.join(OUT, '8-odrzavanje-posjetitelj.png'), fullPage: true });
    // i administrator po zadanom vidi poruku; pravu stranicu tek na "Pokaži mi stranicu"
    const admin = await ctx.newPage();
    assert.equal((await admin.goto(`${srv.url}/pasta-rhymes`)).status(), 503, 'administrator vidi poruku kao posjetitelji');
    await oznaka.click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Pokaži mi stranicu' }).click();
    await page.getByText('Na ovom uređaju opet vidiš stranicu').waitFor();
    assert.equal((await admin.goto(`${srv.url}/pasta-rhymes`)).status(), 200, 'administrator vidi stranicu');
    await admin.close();

    await oznaka.click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Isključi održavanje' }).click();
    await page.getByText('Održavanje je isključeno').waitFor();
    assert.ok(await oznaka.isHidden());
    assert.equal((await v.goto(`${srv.url}/pasta-rhymes`)).status(), 200, 'posjetitelj opet vidi stranicu');
    await c.close();
  });

  test('mobitel: prijava lozinkom i kodom, kategorije kao izbornik, bez vodoravnog prelijevanja', async () => {
    const { c, p: m } = await novaStranica({ width: 390, height: 844 });
    await m.goto(`${srv.url}/urednistvo`);
    await prijava(m, 'tomislav', 'plava kaseta svira jazz', (p) => p.getByLabel('Šesteroznamenkasti kod iz aplikacije').fill(kod(kljuc, 1)));
    await m.getByLabel('Kategorija').waitFor();
    await m.getByLabel('Kategorija').selectOption('jellyfish-in-space/pica');
    await m.getByRole('heading', { name: 'Pića' }).waitFor();
    await m.locator('.stavka').first().locator('.sazetak').click();
    await m.screenshot({ path: path.join(OUT, '6-mobitel.png') });
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await c.close();
  });

  test('bez JS grešaka i CSP prekršaja u uredništvu', () => {
    assert.deepEqual(problemi, []);
  });
});
