# GUIDE.md

Septillion — Pasta Rhymes & Jellyfish in Space
Zadnje ažuriranje: 01.10.2026. (3)

---

## Odluke

|             |                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Domena      | Nova zajednička Septillion domena                                                                        |
| Struktura   | `/` Septillion ulaz → `/[lokal]` po lokalu                                                               |
| Predložak   | Jedan, brend dolazi iz CMS-a kao podatak                                                                 |
| Jezici      | hr (bez prefiksa), en, treći — čeka odluku                                                               |
| Tipografija | TT Lakes Neue (TypeType), web licenca potvrđena                                                          |
| Hosting     | Postojeći, naručiteljev                                                                                  |
| Rok         | 3–4 tjedna od materijala                                                                                 |
| Cijena      | 1.450 €, 40 / 60                                                                                         |
| Dizajn      | **Finaliziran** — v4 HTML prototip, statičan referentni build. Frontend ga mora reproducirati identično. |

## Stack

**⚠️ NERIJEŠENO — sukob odluka.** Prvotni plan niže (Astro 6 + React otoci +
Sanity) je ono za što je dizajn i SEO/AEO pristup u ovom dokumentu pisan.
Developer je repozitorij pokrenuo s **čistim React + Vite** postavom, bez
Astrova SSG/islands sloja. Dok se ovo ne riješi, ne zna se:

- Renderira li se stranica na serveru/buildu (SSG/SSR) ili samo u pregledniku (CSR).
  Čisti Vite + React SPA je **CSR po defaultu** — loše za SEO i posebno loše za
  AEO/GEO (AI crawleri očekuju gotov HTML, ne JS koji se izvršava). Ako ostaje
  React + Vite, treba dodati prerender/SSG sloj (npr. `vite-plugin-ssr` /
  `vite-react-ssg`) ili statički export po ruti prije deploya.
- Gdje živi sadržaj (CMS Sanity ili hardkodirani podaci u repozitoriju).
- Treba li three.js uopće (trenutni dizajn nema 3D scenu, orbita i kaseta su
  2D/CSS+JS).

Dok se ne odluči: razvoj ide na **React 18 + Vite + TypeScript**, s **prerenderom
po ruti** (plan: `vite-react-ssg` ili ekvivalent) kao privremenim rješenjem da
SEO/AEO ne trpi dok se ne potvrdi konačni stack.

## Repozitorij

Repozitorij je developer već kreirao (React + Vite). Struktura niže iz
prvotnog Astro plana **ne vrijedi dok se stack ne potvrdi** — ostavljena je
kao referenca dok traje odluka:

```
septillion/
├─ packages/sanity-ugostiteljstvo/   ← prenosiv CMS paket (ako CMS ostaje)
├─ apps/web/                          ← frontend
└─ apps/studio/                       ← Sanity Studio (ako CMS ostaje)
```

CMS je zaseban paket jer ide u sljedeće klijente. Pravila u SKILL-CODE.md.

## Rute

```
/                        Septillion
/[lokal]                 Pasta Rhymes, Jellyfish
/en/, /en/[lokal]
/xx/, /xx/[lokal]
```

Prijelaz između lokala ide preko client-side routera (trenutni prototip
koristi hash rute `#/`, `#/pasta-rhymes`, `#/jellyfish-in-space` — u
produkciji ide na prave path rute s prerenderom, ne hash, radi SEO-a).

## Cijene — sidrene cijene UKINUTE

Zakon o obveznom isticanju sidrene cijene (od 01.10.2026.) je **ukinut**.
Sidrene cijene se **ne implementiraju nigdje** na stranici — ni u podatkovnom
modelu, ni u UI-ju, ni u strukturiranim podacima (schema.org). Stari dizajn ih
je imao i sve je uklonjeno; ne vraćati ih ni u jednom budućem retrou.

**Stanje po lokalu:**

- **Pasta Rhymes** — cijene nepromijenjene, izvor Wolt jelovnik (CSV/popis
  već postoji iz prototipa, 8 pašti + strana B).
- **Jellyfish in Space** — **novi cjenik stigao kao PDF** (`09-2026_Menu.pdf`,
  21 str.) i **potpuno mijenja strukturu** jelovnika u odnosu na postojeći
  prototip:
  - Prototip trenutno ima: Predjela, Bowl, Street food, Burrito/wrap, Sushi
    rolice, Nigiri, Uramaki, Jelly Sushi, Prilozi, Alkohol (1 kategorija pića).
  - Novi PDF ima potpuno drugu taksonomiju i mnogo širi raspon: Predjela,
    Glavna jela, Jelly Bowl, Plate/Platters (dijeljenje), Sushi (Nigiri,
    Uramaki, Jelly Sushi), Prilozi/Extras, Desert — **plus cijeli bar meni**
    (Bubbly Cocktails, All Time Favourites, Jelly Jam Sessions, Cocktails,
    Aperitivo, Mocktails, Vina/Wines, Šampanjci, Likeri, Rakije, Vodka, Gin,
    Rum, Whiskey, Tequila, Cognac, topli napici, bezalkoholna pića, voda,
    pivo) — preko 150 stavki ukupno.
  - Ovo nije samo "update cijena", nego **redizajn podatkovnog modela i UI-ja
    za jelovnik** (orbita/kategorije komponenta u prototipu nije građena za
    ovoliko kategorija ni za strukturu pića-po-tipu-alkohola). Treba posebna
    odluka o prikazu bara (vjerojatno zaseban prikaz/filter odvojen od hrane,
    ne u istoj orbiti).
  - PDF ne sadrži sidrene cijene (potvrđuje da je zakon ukinut).
  - Slike u PDF-u (hero planeti, astronaut itd.) su layout/mood slike samog
    PDF-a, **ne nužno** iste slike koje idu na stranicu — provjeriti s
    naručiteljem prije upotrebe.

## Slike / medijska imovina

Dizajn (v4 HTML) koristi slike embedane kao base64 u `img.js` — to **ne ide**
u produkcijski repo (ogroman bundle, 0% caching, loš LCP). Za novi repo:

- Izvor slika: Google Drive (ako je spojen) ili naručiteljev lokalni folder.
- Ako se ne mogu povući automatski: naručitelj ih stavlja ručno u projektni
  folder (npr. `src/assets/originals/`), **taj folder ide u `.gitignore`** —
  ne smije na GitHub u izvornoj (visokoj) rezoluciji.
- Arhitektura dohvata: build-time optimizacija (npr. `vite-imagetools` ili
  `@unpic/vite`/`sharp` pipeline) koja iz originala generira:
  - više veličina (responsive `srcset`), format AVIF/WebP s fallbackom,
  - lazy-loading izvan foldova, `fetchpriority="high"` samo na hero sliku,
  - blur-up/LQIP placeholder dok se slika učitava.
- Nikad ne commitati originalne visoke rezolucije u git povijest.

## Selidba domene

Jellyfish ima postojeću stranicu koja se indeksira. Pri prelasku: popis svih
starih adresa, 301 na svaku, stara domena aktivna barem godinu dana.

## Sigurnosne prakse (repo + build)

- `.env` nikad u git-u; tajne samo kroz hosting-platformine env varijable.
- CSP header (barem `default-src 'self'`, dopustiti samo potrebne fontove/CDN-ove).
- Nikakav `dangerouslySetInnerHTML` bez sanitizacije ako sadržaj dolazi iz CMS-a.
- Ovisnosti: `npm audit` / Dependabot uključen, bez nepotrebnih paketa.
- Sve forme (rezervacije, kontakt) prolaze server-side validaciju, ne samo klijentsku.
- HTTPS/HSTS na hostingu, bez miješanog sadržaja.
- Treće strane (fontovi, analytics) učitavati sa SRI gdje je moguće.

## SEO / AEO / GEO prakse

- **Preduvjet**: stranica mora biti pre-renderirana/statična po ruti (vidi
  "Stack" iznad) — CSR-only React ne daje crawlerima (ni Googleu, ni AI
  agentima za AEO/GEO) gotov sadržaj bez izvršavanja JS-a.
- Prave path rute (`/pasta-rhymes`, `/jellyfish-in-space`), ne hash rute —
  hash rute (`#/...`) Google i AI crawleri tretiraju kao jednu te istu
  stranicu.
- `<title>`, meta description, Open Graph i Twitter card po ruti/lokalu.
- JSON-LD: `Restaurant`/`FoodEstablishment` shema po lokalu, `Menu`/`MenuSection`/
  `MenuItem` sa stvarnim cijenama (bez sidrene cijene — ukinuto), `FAQPage` iz
  vidljivih FAQ pitanja (princip iz prototipa: generira se iz DOM-a, ne piše
  se ručno duplo).
- `hreflang` ispravan za hr/en/treći jezik, čim se jezici odluče.
- Core Web Vitals: LCP cilj < 2.5s na mobitelu (slike su najveći rizik — vidi
  "Slike" iznad), CLS 0 (nema layout shifta od fontova/animacija), INP < 200ms.
- Sadržaj čitljiv kao tekst u HTML-u (ne samo kao canvas/slika) radi AEO/GEO —
  AI odgovarajući agenti izvlače činjenice (adresa, radno vrijeme, cijene) iz
  teksta, ne iz vizuala.
- `robots.txt` + `sitemap.xml` generirani u buildu, ne ručno održavani.
- Strukturirani podaci provjereni Rich Results Testom za oba lokala prije objave.

## Animacije i mobilni prikaz

- Prototip (v4) ima GSAP-stil animacije i custom orbit/cassette interakcije —
  reproducirati identično, ali provjeriti trošak na mobitelu (throttled CPU
  test, ne samo desktop).
- `prefers-reduced-motion` gasi svu pokretnu animaciju — obavezno, ne opcionalno.
- Animacije koje nisu u viewportu ne smiju trošiti CPU (IntersectionObserver
  gate, kao što je rađeno za orbit/cassette u prototipu).
- touch-prvi UX na mobitelu (orbit drag smjer, cassette tap), ne hover-ovisan.

## Blokira nas

- **Stack**: Astro+Sanity (izvorni plan) vs. React+Vite (stvarno pokrenuto) —
  treba odluku prije ozbiljnog razvoja, vidi "Stack" iznad.
- Pristup repozitoriju (GitHub URL / lokalni folder) za AI asistenta koji piše kod.
- Pristup slikama (Google Drive spojen? ili ručno u projektni folder).
- Treći jezik.
- Je li domena registrirana i koja.
- Odluka o prikazu bar-menija (Jellyfish) — zaseban prikaz ili dio iste orbite.

## Riješeno

- Domena — nova zajednička Septillion
- Font — TT Lakes Neue, web licenca postoji
- Dizajn — finaliziran (v4 HTML), ide u produkciju
- Pasta cijene — Wolt jelovnik, potvrđeno
- Jellyfish cjenik — stigao kao PDF, treba uneseno u novi podatkovni model
- Sidrene cijene — zakon ukinut, ne implementira se
- Datum otvaranja — nema fiksnog, rok ne ovisi o tome
- Septillion identitet — ne postoji knjiga standarda; boje i tipografsku
  skalu izvodimo iz znaka i TT Lakes Neuea, uz odobrenje naručitelja

## Popis za objavu

- [ ] Lighthouse 90+ na mobitelu
- [ ] 301 sa svih starih adresa
- [ ] Stara domena aktivna
- [ ] Schema.org prolazi Rich Results Test za oba lokala
- [ ] Sva tri jezika, hreflang ispravan
- [ ] Klijent sam promijenio cijenu i objavio
- [ ] `prefers-reduced-motion` gasi animacije
- [ ] Testirano na stvarnom iPhoneu i Androidu
- [ ] Stranica je pre-renderirana (provjeriti view-source bez JS-a — tekst mora biti vidljiv)
- [ ] Slike optimizirane (AVIF/WebP, responsive, lazy), original nije u git povijesti
- [ ] Račun za drugu ratu poslan
