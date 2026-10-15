# Septillion — Pasta Rhymes & Jellyfish in Space

Statična web stranica (Astro 7) koja 1:1 reproducira dizajn prototipa `septillion-prototip-promjene-v4.html`,
s vlastitim malim uredništvom na `/urednistvo` (bez baze, bez vanjskih servisa za uređivanje).
Odluke i otvorene stavke: [docs/superpowers/specs/2026-10-01-septillion-web-design.md](docs/superpowers/specs/2026-10-01-septillion-web-design.md).

## Rute

| hr | en |
| --- | --- |
| `/` Septillion ulaz | `/en` |
| `/pasta-rhymes` | `/en/pasta-rhymes` |
| `/jellyfish-in-space` | `/en/jellyfish-in-space` |
| `/urednistvo` uredništvo (ne oglašava se) | — |

Svaka ruta je gotov HTML (pre-render). Prijelazi između lokala (val, "poplava" s ulaza) rade preko pravih
putanja: stara stranica odigra prvu polovicu, nova drugu (`src/scripts/core/nav.ts` + inline boot skripta).

## Naredbe

```bash
npm install
npm start          # stranica + uredništvo na http://localhost:3000 (prvi put: postavi račun na /urednistvo)
npm run dev        # razvoj dizajna (http://localhost:4321), bez uredništva
npm run build      # samo statična stranica u dist/ (prije builda se generiraju fontovi)
npm run paket      # nakon builda: hosting/ i hosting.zip = sadržaj za public_html (stranica + PHP uredništvo)
npm test           # build mora postojati; pokrene preview i 40+ provjera u Chromiumu (Playwright)
npm run test:urednistvo   # uredništvo, obje pozadine (Node i PHP): sigurnost, API, objava, sučelje u pregledniku
npm run check      # TypeScript / Astro provjera
npm run menu       # .md jelovnik -> src/data/jelly-menu.json (s ispravkama iz PDF-a)
npm run pdf -- "putanja/do/jelovnika.pdf"   # web verzija PDF jelovnika u public/jelovnik/
```

Prvi put: `npx playwright install chromium` (za testove). PHP testovi traže PHP 8.1+ (`PHP_BINARY=…` ili `php` u
PATH-u); bez njega se preskaču (na GitHubu se uvijek vrte).

## Gdje je što

```
src/pages/            6 ruta (+ 404, robots.txt) — tanke, samo pozivaju poglede
src/components/       gate/, pasta/, jelly/ (markup prototipa), Faq, Pic (AVIF+WebP), Topbar
src/scripts/          interakcije prototipa kao TS moduli (jedna rAF petlja, samo ono što stranica koristi)
src/styles/           prototype.css (CSS prototipa, netaknut osim fontova) + additions.css (sve novo)
src/i18n/ui.ts        svi tekstovi sučelja, hr i en
src/data/             jelovnici: lokalni početni podaci, sadrzaj.mjs (pravila i pretvorba sadržaja uredništva),
                      lokali.mjs (lokali, kategorije, polja, boje naljepnica), FAQ
src/site.config.mjs   domena, Wolt/rezervacije/Instagram/telefon, put do PDF-a — jedino mjesto za te podatke
urednistvo/sucelje/   uredništvo u pregledniku (HTML, CSS, JS bez ovisnosti) — isto za obje pozadine
urednistvo/php/       pozadina za hosting (Apache + PHP 8.1+): index.php, lib/, .htaccess, pripremi.mjs
urednistvo/*.mjs, lib/  pozadina za lokalni rad (Node, npm start) i naredbe (cli.mjs)
scripts/              build-fonts, paket-hosting, menu/convert (+ corrections), pdf/compress-menu
tests/                smoke.mjs (npm test), urednistvo/ (node:test + Playwright, obje pozadine)
../.github/          u KORIJENU repozitorija (mapa iznad ove): workflows/objava.yml (provjere + objava FTPS-om), dependabot.yml
podaci/, izdanja/     NE idu u git: lokalni podaci uredništva i izgrađene verzije (npm start)
private/              NE ide u git: fontovi pod licencom, originalne fotografije
```

## Promjena cijena / jelovnika

Jela, cijene, opise, nazive i fotografije mijenja **Tomislav na `/urednistvo`**
(upute: [docs/urednistvo-vodic.md](docs/urednistvo-vodic.md)).

Lokalni podaci su početni sadržaj uredništva i izvor za `npm run build` dok uredništvo nema svoj jelovnik:

- **Jellyfish**: `src/data/source/hrvatski_jelly_menu.md` i `english_jelly_menu.md` (moraju ostati poravnati
  redak po redak), pa `npm run menu`. Ispravke prema PDF-u su u `scripts/menu/corrections.mjs`.
- **Pasta Rhymes**: `src/data/pasta-local.mjs`.
- JSON-LD (Restaurant, Menu, FAQPage) se gradi iz istih podataka — ne uređuje se ručno.

## Uredništvo (`/urednistvo`)

Isto sučelje i isti API, dvije pozadine — bez baze (jelovnik je jedna JSON datoteka, fotografije su datoteke):

| | lokalno (`npm start`) | hosting (infonet cPanel) |
| --- | --- | --- |
| pozadina | Node (`urednistvo/posluzitelj.mjs`) | PHP (`urednistvo/php/`) |
| podaci | `podaci/` u projektu | `/home/<korisnik>/septillion-podaci/` (izvan `public_html`) |
| objava nakon spremanja | `astro build` na računalu, ~5 s | jelovnik + nove fotografije -> GitHub (grana `sadrzaj`) -> GitHub Actions izgradi stranicu i prenese je FTPS-om, 1–2 min |

```
Tomislav -> /urednistvo -> Spremi i objavi
  -> provjera sadržaja (ista pravila kao izgradnja stranice) -> jelovnik.json (+ 60 verzija povijesti)
  -> objava; ako ne uspije, stranica ostaje zadnja ispravna
```

### Lokalno

```bash
npm install
npm start
```

Otvori `http://localhost:3000/urednistvo` — prvi put se odmah postavlja račun (korisničko ime, lozinka, QR kod u
aplikaciji Google/Microsoft Authenticator, rezervni kodovi). Poslije se prijavljuješ na istoj adresi. Stranica je na
`http://localhost:3000` (prvih nekoliko sekundi nakon starta se gradi).

`npm run dev` (4321) je samo za dizajn i nema uredništva; `/urednistvo` tamo objašnjava gdje ga naći.

### Na hosting (infonet cPanel, jednom)

Hosting (paket Standard, poslužitelj `cp29.infonet.hr`) ima Apache i PHP, nema Node.js — zato stranicu gradi GitHub
Actions, a uredništvo na hostingu radi u PHP-u. Pravila iz `.htaccess` i uredništvo provjereni su u Apacheu 2.4 s PHP-om.

1. **PHP** — cPanel → *Select PHP Version* (ili *MultiPHP Manager*): PHP **8.3 ili 8.4** (oba provjerena testovima) za septillion.com.hr, uključena
   proširenja `mbstring`, `gd`, `curl` (i `exif`, za okretanje fotografija s mobitela).
2. **FTP račun samo za objavu** — cPanel → *FTP Accounts*: npr. `objava`, *Directory* = `public_html`, jaka lozinka.
   Objava se spaja na **`cp29.infonet.hr`**, port 21, FTPS: certifikat FTP poslužitelja glasi na `*.infonet.hr`, pa
   `ftp.septillion.com.hr` ne bi prošao provjeru. Ako je u cPanelu → *FTP Allow* uključeno ograničenje po IP adresama,
   GitHub se ne može spojiti — ograničenje mora biti isključeno (ili objava ručno, korak 4).
3. **GitHub** — kod na `main` (zadana grana) repozitorija `DjakaIT/septilion`. Settings → Environments → novi
   `produkcija`:
   - tajne: `FTP_HOST` = `cp29.infonet.hr`, `FTP_KORISNIK` (npr. `objava@septillion.com.hr`), `FTP_LOZINKA`;
     po želji `FONTOVI_ZIP_B64` (licencirani TT Lakes Neue: `base64 -w0 fontovi.zip`)
   - varijabla **repozitorija** (Settings → Secrets and variables → Actions → *Variables*, ne u environmentu, jer je
     čita uvjet posla prije ulaska u environment): `OBJAVA_UKLJUCENA` = `da` (i `FTP_MAPA` samo ako korijen FTP
     računa nije `public_html`)
4. **Prva objava** — Actions → *Objava* → *Run workflow* (ili push na `main`). Bez GitHuba se može i ručno:
   `npm run build && npm run paket`, pa `hosting.zip` u cPanel → File Manager → `public_html` → Upload → Extract.
5. **Prvi račun** — otvori `https://septillion.com.hr/urednistvo`. Traži *kod za postavljanje*: cPanel → File Manager →
   `septillion-podaci/PRVO-POSTAVLJANJE.txt` (mapa je u početnoj mapi, pokraj `public_html`; stvori se pri prvom
   otvaranju). Kod je stalan dok se ne iskoristi. Zatim korisničko ime, lozinka, QR kod, rezervni kodovi. Taj
   račun je administrator.
6. **Veza s GitHubom** — u uredništvu: izbornik ☰ → *Objava stranice*: repozitorij `DjakaIT/septilion`, grana
   `sadrzaj`, token. Token: GitHub → Settings → Developer settings → *Fine-grained tokens* → *Generate*:
   *Repository access* samo `DjakaIT/septilion`; *Permissions*: **Contents: Read and write**, **Actions: Read-only**;
   najdulji rok. *Spremi i provjeri vezu* odmah provjeri token. Dijalog pokazuje do kada token vrijedi —
   prije isteka napravi novi i upiši ga ovdje.
7. **Tomislav** — izbornik ☰ → *Korisnici* → `tomislav` → *Napravi pozivnicu*, poveznicu pošalji osobno. Dalje
   sam, po [vodiču](docs/urednistvo-vodic.md).

**Održavanje** (posjetitelji vide „Uskoro se vraćamo” s adresama, statusom 503; uredništvo radi normalno):
izbornik ☰ → *Održavanje stranice* → *Uključi* / *Isključi* (samo administrator). Na uređaju na kojem ga uključiš
i dalje vidiš pravu stranicu. Bez uredništva: cPanel → File Manager → `public_html` → *+ File* `.odrzavanje`
(prazna datoteka; za skrivene datoteke Settings → *Show Hidden Files*) — brisanjem se isključuje. Objava tu
datoteku ne dira. Lokalno (`npm start`) je oznaka `podaci/odrzavanje.json`.

**Nadogradnja koda:** push na `main` → provjere → objava. Podaci uredništva na hostingu se nikad ne diraju.
**Sigurnosne kopije:** infonet radi dnevne/tjedne/mjesečne kopije hostinga (i `septillion-podaci/`); uz to je svaka
spremljena verzija jelovnika s fotografijama i na GitHubu (grana `sadrzaj`).
**Izgubljen pristup administratora** (mobitel i rezervni kodovi): File Manager → obriši
`septillion-podaci/korisnici.json` → ponovno korak 5 i 7. Jelovnik i fotografije ostaju.

### Korisnici

Na hostingu ih administrator vodi u uredništvu (izbornik → *Korisnici*: pozivnica, nova pozivnica pri
zaboravljenoj lozinci / izgubljenom mobitelu, uklanjanje). Lokalno to može i naredbom:

```bash
npm run urednistvo:pozivnica -- tomislav              # novi korisnik
npm run urednistvo:pozivnica -- tomislav --resetiraj  # nova pozivnica, odjava svugdje
npm run urednistvo:korisnici                          # popis i stanje
npm run urednistvo:obrisi -- tomislav                 # brisanje (odmah gubi pristup)
```

### Sigurnost

- **Prijava:** lozinka (najmanje 12 znakova, odbijaju se uobičajene) + obavezna dvostruka potvrda (TOTP, RFC 6238,
  QR se skenira jednom, kod se ne može iskoristiti dvaput) + 8 jednokratnih rezervnih kodova. Lozinke samo kao
  hash (PHP: Argon2id, Node: scrypt), rezervni kodovi, pozivnice i kod za postavljanje kao SHA-256 / u stalnom
  vremenu. Ista poruka i isto vrijeme odgovora za nepostojećeg korisnika i krivu lozinku.
- **Prvo postavljanje:** samo dok nema nijednog računa; na hostingu uz kod koji vidi samo vlasnik hostinga.
  Pozivnice: jednokratne, 72 h. Uloge: administrator (poziva, uklanja) i urednik.
- **Ograničenja pokušaja:** 20 prijava / 15 min po IP-u, 5 neuspjeha / 15 min po korisniku (429).
- **Sesije:** na disku (preživljavaju ponovno pokretanje), datoteka nosi samo SHA-256 256-bitnog id-a; kolačić
  `__Host-` + `Secure; HttpOnly; SameSite=Strict`; istek nakon 30 min bez aktivnosti korisnika (pozadinske provjere
  se ne broje) i najkasnije 12 h, s točnim razlogom u sučelju; nova sesija na svakom koraku prijave; promjena
  lozinke, reset ili uklanjanje odjavljuju sve uređaje.
- **CSRF:** `Origin` mora biti adresa stranice (https), `Sec-Fetch-Site: same-origin`, JSON tijelo i CSRF token u
  zaglavlju. Zahtjevi s tuđim `Host` zaglavljem dobivaju 421 (DNS rebinding).
- **Sadržaj:** stroga shema (nepoznata polja se odbijaju, ograničene duljine, cijene, boje samo iz palete), tekst se
  uvijek escapea; neispravan sadržaj se ne sprema i ne objavljuje. Istovremene izmjene: verzija (409).
- **Fotografije:** preglednik ih smanji na najviše 2400 px; poslužitelj prima najviše 15 MB, samo JPG/PNG/WebP/AVIF,
  svaku iznova kodira u WebP (uklanja EXIF/GPS i sve skriveno u datoteci) i sprema pod nasumičnim imenom.
- **Zaglavlja:** stranica: CSP s hashom inline skripte, HSTS, nosniff, frame-ancestors (`.htaccess`); uredništvo:
  vlastiti strogi CSP (`default-src 'none'`, bez inline koda), `noindex`, `no-store`, COOP/CORP, `no-referrer`.
- **Hosting:** podaci izvan `public_html`; u `public_html/urednistvo` sve ide kroz `index.php` (lib/ i konfiguracija
  nisu dostupni izravno); FTP račun objave vidi samo `public_html`; GitHub token samo za jedan repozitorij, s
  najmanjim pravima, sprema se samo na hostingu; akcije na GitHubu prikvačene na SHA, Dependabot tjedno.
- **Ovisnosti:** stranica `astro`, `@astrojs/sitemap`, `sharp`, `subset-font`; PHP uredništvo samo ugrađene funkcije.

## Fontovi

- TT Lakes Neue (Septillion i zajedničko sučelje): izvor u `private/fonts/tt-lakes-neue/`, `npm run fonts`
  radi woff2 podskup u `public/fonts/tt-lakes-neue/` (oboje izvan gita).
  **Trenutno su to TRIAL datoteke — ne smiju na javnu stranicu.** Za objavu zamijeni ih licenciranim
  web datotekama (TTF/OTF/WOFF2, imena moraju sadržavati širinu i rez, npr. `... Expanded Regular`) i postavi
  tajnu `FONTOVI_ZIP_B64`. U produkciji i u paketu za hosting trial datoteke se preskaču (sistemski font).
- Lemon, Don Graffiti, IBM Plex Mono (Pasta) i Instrument Serif (Jellyfish) su u `src/assets/fonts/`.

## Slike

`src/assets/img/` sadrži slike izvučene iz prototipa (iste koje je naručitelj odobrio). Astro iz njih radi
AVIF/WebP u više veličina, kao i iz fotografija koje Tomislav doda u uredništvu.
Originale visoke razlučivosti čuvaj u `private/` (ne commitati).

## Objava

Na hostingu: `.github/workflows/objava.yml` (gore). Uz stranice idu:
- `.htaccess` (Apache): HTTPS, `www.` → bez `www.`, kanonske adrese bez `.html`, CSP s hashom inline skripte, HSTS, cache.
- `_headers` (Netlify / Cloudflare Pages): ista zaglavlja (ne ide u paket za Apache).

CSP se generira pri buildu iz `src/lib/csp.mjs` (hash inline boot skripte) — ne uređuj ga ručno u `dist/`.
Domena je `https://septillion.com.hr` u `src/site.config.mjs`.

Alternativa bez PHP-a (VPS s Node.js ≥ 22.12): `npm start` iza HTTPS proxyja, `.env` prema `.env.example`
(`NODE_ENV=production`, `UREDNISTVO_ORIGIN=https://…`, `UREDNISTVO_PROXY=1`); prvi račun uz kod iz
`podaci/PRVO-POSTAVLJANJE.txt`.
