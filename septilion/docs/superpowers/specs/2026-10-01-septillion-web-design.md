# Septillion web — dizajn i stanje izvedbe

Datum: 01.10.2026. · Izvor dizajna: `septillion-prototip-promjene-v4.html` (finaliziran, reproducira se 1:1)
Pravila: `GUIDE.md` + `SKILL-*.md`. Gdje se GUIDE i SKILL-DESIGN razilaze, vrijedi noviji GUIDE.

## 1. Odluke

| Tema | Odluka | Tko |
| --- | --- | --- |
| Stack | Astro 7 (statični izlaz), interakcije prototipa kao vanilla TS moduli, bez Reacta | delegirano developeru ("najbrže, najotpornije, ažurno, s podrškom") |
| Fontovi | TT Lakes Neue zamjenjuje Instrument Sans (osnovni tekst, UI) i Michromu (naslov ulaza → Expanded). Brand fontovi lokala ostaju: Lemon, Don Graffiti, Plex Mono (Pasta), Instrument Serif (Jellyfish) | naručitelj: TT Lakes Neue; raspodjela delegirana |
| Sidrene cijene | Nema ih nigdje (zakon ukinut) | naručitelj |
| Izgled | Točno kao prototip | naručitelj |
| Jellyfish jelovnik | Izvor: `src/data/source/*_jelly_menu.md`; **cijene prema PDF-u** gdje se razlikuju | naručitelj |
| Prikaz jelovnika | Orbita s 10 planeta kao u prototipu: 8 kategorija hrane + Kokteli + Pića; podskupine kao međunaslovi | naručitelj |
| FAQ | Novo pitanje s linkom na PDF jelovnik (Jellyfish) | naručitelj |
| Jezici | hr (bez prefiksa) + en (`/en/…`); engleski prijevod napravio developer — **čeka odobrenje** | naručitelj |
| Mobitel | Sve mora biti pregledno i intuitivno na mobitelu | naručitelj |
| Kaseta (02.10.) | Slika gore (~65 % visine) sa "Strana A", dolje kotačić · naziv jela · kotačić; ostali tekst s kasete uklonjen | naručitelj |
| Orbita (02.10.) | Orbita i jelovnik u jednom bloku stalne visine na svakom uređaju; planeti veći i lijevo; fotka i naslov kategorije u istom redu iznad popisa; popis se skrola iznutra; klik mijenja samo sadržaj | naručitelj |
| Uredništvo (13.10.) | **Vlastiti mali CMS** na `/urednistvo` (ne `/admin`), bez vanjskih računa i servisa: radi lokalno odmah (`npm start`), na server se samo prenese projekt. Tomislav uređuje, dodaje i briše jela (naziv, opis, cijena, fotografija), najbolje sigurnosne prakse. (Prvi plan 12.10. bio je Sanity — odbačen jer traži račun i vanjski servis; rad arhiviran u `private/arhiva/sanity-2026-10-13/`.) | naručitelj |
| Hosting i uredništvo (15.10.) | Hosting je infonet.hr cPanel, paket Standard (Apache + PHP, 512 MB, bez Node.js-a i SSH-a), domena `septillion.com.hr`. Stranica ostaje statična (gradi je GitHub Actions; 15.10. navečer: infonet pušta FTP samo s ručno dopuštenih IP adresa, pa hosting sam preuzima gotov paket — artefakt — istim GitHub tokenom, bez FTP-a; Cron Job svakih 5 min za promjene koda); uredništvo na hostingu radi u **PHP-u** (isto sučelje i API), **bez baze** (jelovnik = JSON, fotografije = datoteke). Uvijek na `/urednistvo`; QR se skenira jednom, prijava lozinkom + kodom. Odbačeno: Managed VPS (od 58,56 €/mj), VPS drugdje (novi račun, održavanje). | naručitelj |
| Kursor (12.10.) | Cijeli ulaz je klikabilan (klik bilo gdje na strani vodi u lokal), pa pokazuje ruku | naručitelj |
| Spraylist (12.10.) | Desktop: lijevi stupac (naslov + popis) spušten i poravnat s desnim (uvod + kaseta): isti gornji i donji rub; mobitel i tablet nepromijenjeni | naručitelj |

## 2. Arhitektura

- 6 pre-renderiranih stranica (hr/en × ulaz, Pasta, Jellyfish) + 404 + `robots.txt` + sitemap s hreflangom.
  Svaka stranica sadrži samo svoj lokal (bez dupliciranog sadržaja).
- Prijelazi iz prototipa (val između lokala, "poplava" s ulaza, povratak na ulaz) rade preko pravih putanja:
  stara stranica odigra prvu polovicu i zapiše zastavicu (`sessionStorage`), inline boot skripta na novoj
  stranici odmah prekrije ekran, `core/nav.ts` odigra drugu polovicu. Bez JS-a: obične poveznice.
  Pokrivač sam nestaje nakon 1,6 s ako JS ne krene; bfcache "natrag" se čisti.
- JS po stranici: 17–24 KB (nekomprimirano), jedna rAF petlja, poslovi izvan ekrana miruju.
- CSS: `prototype.css` je CSS prototipa bez izmjena osim fontova (provjerljivo diffom); sve novo je u `additions.css`.
- Slike: AVIF + WebP u više veličina (`<picture>` s `display:contents`, da raspored prototipa ostane isti).
- Podaci: Jellyfish jelovnik se generira (`npm run menu`) i validira shemom pri buildu; JSON-LD
  (Organization, Restaurant/BarOrPub, Menu sa svim stavkama, FAQPage) gradi se iz istih podataka.
- Sigurnost: CSP bez `unsafe-inline` za skripte (jedina inline skripta ide s SHA-256 hashom, generira se pri buildu),
  HSTS, nosniff, frame-ancestors, Permissions-Policy — u `<meta>`, `.htaccess` (Apache) i `_headers` (Netlify/Cloudflare).

### Uredništvo — arhitektura

- Dvije pozadine, isto sučelje (`urednistvo/sucelje/`) i isti API: **PHP** na hostingu (`urednistvo/php/`, samo
  ugrađene funkcije, PHP 8.1+) i **Node** za lokalni rad (`npm start`). Isti testovi (`tests/urednistvo/`) vrte se na
  obje. Bez baze: `jelovnik.json` (atomarno spremanje, verzija za istovremene izmjene, povijest 60 verzija),
  fotografije, korisnici, sesije (na disku — preživljavaju ponovno pokretanje), dnevnik. Na hostingu u
  `/home/<korisnik>/septillion-podaci/`, izvan `public_html`.
- Objava s hostinga: jelovnik + nove fotografije u jedan commit na granu `sadrzaj` (GitHub Git Data API; ujedno
  sigurnosna kopija s poviješću), zatim `repository_dispatch` -> `.github/workflows/objava.yml` (kod s `main`):
  `npm run build` -> `npm run paket` -> artefakt `hosting`; uredništvo ga preuzme (bez tokena na adresi spremišta) i postavi u `public_html` (redom: nove datoteke, uredništvo, HTML, .htaccess; `lib/instalacija.php`), a `/urednistvo/api/osvjezi` (cPanel Cron Job) postavlja izgradnje koda s `main`. Lokalno:
  `astro build` u `izdanja/<vrijeme>/`. Izgradnja i poslužitelj koriste ista pravila provjere (`src/data/sadrzaj.mjs`,
  PHP: `lib/sadrzaj.php`); neuspjela objava ostavlja zadnju ispravnu stranicu.
  Fotografije iz uredništva se optimiziraju kao lokalne (AVIF/WebP). Bez `jelovnik.json` build koristi lokalne podatke;
  HTML iz početnog sadržaja uredništva identičan je lokalnom (provjereno).
- Model: kategorija (ključ i vidljiva polja postavlja developer u `src/data/lokali.mjs`) -> ravan popis jela s
  naslovima skupina između njih (kao na stranici). Jelo: naziv i opis (hr; en pada na hr), cijena + druga cijena s
  količinom (pića), porcija, preporuka, fotografija i boja naljepnice (Strana A), "prikaži u galeriji". Kategorije se
  ne mogu brisati ni dodavati (orbita i kaseta računaju na njih).
- Sučelje: vanilla JS bez ovisnosti (QR crta preglednik, MIT qrcode-generator), hrvatski, mobitel i desktop.
  Prvo postavljanje izravno na `/urednistvo` (na hostingu uz stalni kod iz `PRVO-POSTAVLJANJE.txt`); prvi račun je
  administrator i poziva ostale iz uredništva (pozivnica, nova pozivnica, uklanjanje). Prijava lozinkom + TOTP +
  rezervni kodovi; prijava traje dok korisnik radi, istječe nakon 30 min bez aktivnosti s točnim razlogom.
  Fotografije: klik ili povlačenje, preglednik ih smanji na 2400 px prije slanja.
- Upute i sigurnost: README -> Uredništvo.

## 3. Namjerne razlike u odnosu na prototip

- Fontovi (odluka iznad). Mjera teksta u `ch` se malo mijenja (npr. uvod Orbite stane u jedan redak).
- Novi jelovnik: 258 stavki, planeti Predjela, Glavna jela, Jelly Bowl, Plate, Jelly Sushi, Sushi, Prilozi, Desert, Kokteli, Pića.
  Dugi popisi (Kokteli 45, Pića 127) imaju red skupina za skok na međunaslov; volumen pića sitno ispod cijene;
  porcije kao oznaka; preporuke vina kao redak ispod opisa; pravna napomena iz PDF-a ispod jelovnika.
- `/en` i poveznica na drugi jezik (gornja traka, ulaz, podnožje).
- Uklonjeno "Prototip — Perasma" iz podnožja.
- "Ostavi recenziju" vodi na Google Maps pretragu lokala (u prototipu `#`).
- Popravljene greške prototipa: Jellyfish se na mobitelu pri učitavanju sam skrolao do orbite;
  "PastaRhymes"/"Jellyfishin Space" bez razmaka u gornjoj traci; Wolt gumb u donjoj traci nije imao adresu;
  natpisi planeta rezani rubom kruga; `acceptsReservations` u JSON-LD-u (sada link na rezervacije).
- `prefers-reduced-motion` sada gasi i platna (meduze, šav, marquee, kokteli), ne samo CSS animacije.
- Ulaz: prilagodljiva kvaliteta WebGL šava na softverskom/sporom renderiranju (na pravom GPU-u isto kao prototip).
- Pristupačnost: popisi jelovnika kao tabpaneli s ispravnom semantikom, popis koji se skrola dostupan tipkovnicom,
  naslovi u podnožju h3, tipkovnica za radio-grupu ploča i tablist kategorija.
- **Kaseta (zahtjev 02.10.)**: slika gore (~65 % visine) s oznakom "Strana A · NN" u boji jela; donja traka u boji jela
  s dva kotačića i nazivom jela između njih (veličina prati širinu kasete, min. 19 px). "Pasta Rhymes®" i
  "Svježa domaća tjestenina" uklonjeni s kasete.
- **Orbita (zahtjev 02.10.)**: blok stalne visine (desktop: orbita lijevo, jelovnik desno; mobitel/tablet: orbita,
  kategorije, jelovnik jedno ispod drugog) stane u ekran između gornje i donje trake. Planeti veći, orbita pomaknuta
  lijevo; natpisi planeta kao pločice (odabrana svijetla) — nikad odrezani. Zaglavlje: fotka + naslov + broj stavki
  u istom redu; popis se skrola iznutra i nakon odabira kreće od vrha; skupine skaču unutar popisa. Napomena
  kategorije (Plate) je prvi redak popisa; pravna napomena ispod bloka. Na mobitelu kategorije više nisu zalijepljene,
  strelice orbite su u donjim kutovima orbite. Bez JS-a sve teče kao prije.
- **Popravci 02.10. (2. krug)**: (1) brojač Pasta galerije stao je na 08/09 (mobitel) odnosno 06/09 (tablet, desktop)
  jer se zadnje fotke ne mogu poravnati uz lijevi rub trake — sada prati trenutnu fotku: na kraju trake ide razmjerno
  pomaku do 09, strelice prolaze svaku fotku. (2) Mobitel: kaseta je bila suzena na 320 px (prototip), sada je jednako
  široka kao omot s popisom. (3) Desktop: naslov "Orbita" s uvodom je u lijevom stupcu bloka, u ravnini s fotkom
  kategorije (blok = rešetka cijele sekcije); mobitel nepromijenjen.

## 4. Ispravke podataka (Jellyfish) — `scripts/menu/corrections.mjs`

- **Cijene vina** (bijela, crvena) prema PDF-u str. 17 — `.md` je imao drukčije cijene boca (npr. Jakovac Graševina 50 € → 30 €).
- Rainbow, Crispy losos, Mango, Karage, Tuna olive roll i Tuna sushi taquitos premješteni iz Sushi u Jelly Sushi (kao u PDF-u).
- Preporuke vina: Salmon Fig dobiva "Puhelek Sauvignon, Jakovac Mystique Chardonnay"; skupne preporuke za Jelly Sushi i Nigiri.
- Tipfeleri (prisutni i u PDF-u), ispravljeni — **čeka potvrdu naručitelja**: Avokado uss → mus, Mladil → Mladi, osos → losos,
  Souvignon/Sauvgnon → Sauvignon, Cocktaill → Cocktail, CocaCcola → Coca-Cola, Hennesy → Hennessy, Prosseco → Prosecco,
  Lavander → Lavender, Jagermaister → Jägermeister, Cherry Yam → Cherry Jam, ´S → 's, Y0 → YO, Mistique → Mystique.
- Svi nazivi jela pretvoreni iz VELIKIH slova u rečenični oblik (kao u prototipu).

## 5. Provjereno

- Vizualna usporedba s prototipom sekciju po sekciju (390 px i 1440 px): poklapa se osim namjernih razlika.
- `npm test`: 44 provjere, neovisne o sadržaju jelovnika (prijelazi, bfcache, orbita i skupine, blok orbite cijeli na
  ekranu i iste visine, mobitel 360/390 px bez prelijevanja, kasete i raspored kasete, brojači galerija od prve do
  zadnje fotke, Spraylist stupci poravnati (1024, 1525 px), ruka na ulazu, puni prikaz tipkovnicom, smanjeno kretanje,
  bez JS-a, engleski, CSP hashevi) — sve prolaze (13.10.).
- Uredništvo (15.10.), `npm run test:urednistvo` — 63 testa, 60 prolazi, 3 namjerno preskočena (Apache stranica i
  terminal na hostingu, GitHub lokalno). Iste provjere za Node i PHP: zaglavlja/CSP, prvo postavljanje (lokalno bez
  koda, na hostingu sa stalnim kodom), 2FA i rezervni kodovi, ponovljeni TOTP odbijen, CSRF/Origin/`Sec-Fetch-Site`,
  sesije preživljavaju ponovno pokretanje, istek s razlogom, pozadinske provjere ne produljuju prijavu, 409/422 (cijena,
  duljina, ključ slike, nepoznato polje, boja), objava do stranice s escapeanim HTML-om, fotografije (EXIF/GPS uklonjen,
  uspravljeno, nasumično ime), povijest, korisnici i uloge, promjena lozinke, 429, produkcija (`__Host-`, HSTS, 421).
  PHP: lažni GitHub prima commit i `repository_dispatch`, a zatim stvarno izgradi stranicu iz poslanog jelovnika.
  Sučelje u Chromiumu na obje pozadine: postavljanje, cijena do stranice, ponovno pokretanje usred rada bez odjave,
  novo jelo i pasta s fotografijom, povučena velika fotografija smanjena na ≤ 2400 px, brisanje i redoslijed, 30 min
  neaktivnosti s točnom porukom bez gubitka promjena, poziv urednika, mobitel, bez JS grešaka i CSP prekršaja.
- axe na 12 + 6 ekrana uredništva (uključujući postavljanje, korisnike i objavu, Node i PHP): 0 povreda.
- Lokalni build nakon uredništva: svih 7 HTML stranica identično prijašnjima (osim imena JS datoteka).
- axe (najnovija verzija, 13.10.): 0 povreda; nova verzija je otkrila da oznaka jezika ("EN") nije u pristupačnom
  imenu poveznice (WCAG 2.5.3) — ispravljeno ("EN – English version").
- `npm audit`: 0 (produkcija i razvoj); pdfjs-dist nadograđen na 6.
- axe (WCAG 2.2 AA + best practice): 0 povreda na svim stranicama, mobitel i desktop.
- Lighthouse mobitel (lokalno): ulaz 91 / Pasta 99 / Jellyfish 100 performanse; pristupačnost, najbolje prakse i SEO 100.
- `astro check`: 0 grešaka.
- Web PDF jelovnika: 9,9 MB → 2,9 MB, tekst netaknut, boje provjerene usporedbom.

## 6. Otvoreno / blokira objavu

1. **Licencirane TT Lakes Neue web datoteke** — sada su u upotrebi TRIAL datoteke (EULA zabranjuje javnu stranicu).
2. Licenca za Lemon i Don Graffiti (Pasta brand fontovi) — potvrditi da web upotreba pokriva.
3. Odobrenje engleskog prijevoda i ispravki tipfelera.
4. Postavljanje hostinga (jednom, README -> Uredništvo -> Na hosting): PHP 8.3 u cPanelu, FTP račun za objavu, GitHub
   okruženje `produkcija` (tajne FTP, `OBJAVA_UKLJUCENA`), prvi račun i token za objavu, pozivnica Tomislavu.
5. Originalne fotografije s Drivea lokalno (konektor ne može prenijeti datoteke od 6–35 MB); zamjena istih imena u `src/assets/img/`.
6. Google recenzije: ocjena je "—,—" kao u prototipu; za pravu ocjenu i direktni link "ostavi recenziju" trebaju Google Place ID-jevi.
7. Radno vrijeme lokala nije nigdje navedeno (bitno za AEO/`openingHours`) — ne izmišlja se.
8. GitHub token za objavu (fine-grained) traje najviše godinu dana — obnoviti prije isteka (uredništvo pokazuje datum).
9. 301 preusmjeravanja sa stare Jellyfish stranice — treba popis starih adresa.
10. Treći jezik.
11. Stare datoteke React kostura (`src/App.jsx`, `src/main.jsx`, `src/*.css`, `index.html`, `vite.config.js`,
    `eslint.config.js`, `public/favicon.svg`, `public/icons.svg`) nisu korištene — obrisati ručno.
