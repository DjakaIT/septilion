// Pasta Rhymes: lokalni jelovnik (Wolt jelovnik iz prototipa v4, cijene nepromijenjene — GUIDE.md).
// Koristi se kad uredništvo još nema sadržaj (podaci/jelovnik.json) i kao njegov početni sadržaj.
// Čisti JS (JSDoc tipovi), pa ga čita i poslužitelj uredništva bez prevođenja.

/** @typedef {{ hr: string, en: string }} L */
/** @typedef {{ name: string, nameEn?: string, desc: L, price: number, img?: string, color?: string, ink?: string, gallery?: boolean }} PastaItem */

// Strana A — paste (boje naljepnica kaseta iz prototipa); Arrabiata nije u galeriji (kao u prototipu)
/** @type {PastaItem[]} */
export const LOCAL_SIDE_A = [
  { name: "Grab ya phone, it's shrimp and provolone", price: 19, img: 'pr_shrimp', color: '#FFCE53', ink: '#000',
    desc: { hr: 'Domaće conchigliette, umak tri vrste sira i kozice', en: 'Homemade conchigliette, three-cheese sauce and prawns' } },
  { name: 'Pasta alla busara', price: 18, img: 'pr_busara', color: '#FF8800', ink: '#000',
    desc: { hr: 'Domaće tagliatelle, kozice, ulje kozica, cherry rajčice, bijelo vino, rajčica umak', en: 'Homemade tagliatelle, prawns, prawn oil, cherry tomatoes, white wine, tomato sauce' } },
  { name: 'La crema di peperoni e guanciale', price: 16, img: 'pr_rigatoni', color: '#63CFFE', ink: '#000',
    desc: { hr: 'Domaći rigatoni, guanciale (talijanska panceta od svinjskih obraza), krema od paprike, chili, parmezan, ulje vlasca', en: 'Homemade rigatoni, guanciale (Italian cured pork cheek), pepper cream, chili, parmesan, chive oil' } },
  { name: "'nduja e salsiccia", price: 16, img: 'pr_nduja', color: '#108A11', ink: '#000',
    desc: { hr: "Domaći fusili, luk, 'nduja, salsiccia (talijanska kobasica), bijelo vino, rajčica umak, parmezan", en: "Homemade fusilli, onion, 'nduja, salsiccia (Italian sausage), white wine, tomato sauce, parmesan" } },
  { name: 'Ragu bianco', price: 13, img: 'pr_ragu', color: '#F5EAD4', ink: '#000',
    desc: { hr: 'Domaće tagliatelle, mljevena junetina, salsiccia (talijanska kobasica), panceta, bijelo vino, parmezan', en: 'Homemade tagliatelle, minced beef, salsiccia (Italian sausage), pancetta, white wine, parmesan' } },
  { name: 'Boscaiola', price: 11, img: 'pr_boscaiola', color: '#8B3A96', ink: '#fff',
    desc: { hr: 'Domaće conchiglie, panceta, šampinjoni, krema od tikvica, parmezan', en: 'Homemade conchiglie, pancetta, button mushrooms, courgette cream, parmesan' } },
  { name: 'Arrabiata', price: 9, img: 'pr_arrabbiata', color: '#FE0000', ink: '#000', gallery: false,
    desc: { hr: 'Domaći rigatoni, češnjak, chili, rajčica umak, peršin', en: 'Homemade rigatoni, garlic, chili, tomato sauce, parsley' } },
  { name: 'Aglio olio e peperoncino', price: 8.9, img: 'pr_aglio', color: '#FFCE53', ink: '#000',
    desc: { hr: 'Domaći spaghetti, češnjak, chili, peršin, parmezan', en: 'Homemade spaghetti, garlic, chili, parsley, parmesan' } },
];

// Strana B — salate i prilozi
/** @type {(PastaItem & { nameEn: string })[]} */
export const LOCAL_SALADS = [
  { name: 'Salata Sicilianna', nameEn: 'Sicilianna salad', price: 12,
    desc: { hr: 'Rukola, komorač, paprika, naranča, piletina, umak od maslina i aromatičnog bilja', en: 'Rocket, fennel, peppers, orange, chicken, olive and herb dressing' } },
  { name: 'Tricolore salata', nameEn: 'Tricolore salad', price: 11,
    desc: { hr: 'Rukola, cherry rajčice, parmezan, pinjoli, senf/med umak', en: 'Rocket, cherry tomatoes, parmesan, pine nuts, honey-mustard dressing' } },
  { name: 'Salata Caprino', nameEn: 'Caprino salad', price: 10,
    desc: { hr: 'Baby špinat, cikla, kozji sir, orasi, zaslađene breskve, senf/med umak', en: 'Baby spinach, beetroot, goat cheese, walnuts, candied peaches, honey-mustard dressing' } },
  { name: 'Primavera salata', nameEn: 'Primavera salad', price: 9,
    desc: { hr: 'Njoke, paprika, marinirani luk, cherry rajčice, sušene rajčice, kapari, mozzarella, masline, rukola, pesto umak', en: 'Gnocchi, peppers, marinated onion, cherry tomatoes, sun-dried tomatoes, capers, mozzarella, olives, rocket, pesto' } },
];
/** @type {(PastaItem & { nameEn: string })[]} */
export const LOCAL_SIDES = [
  { name: 'Focaccia', nameEn: 'Focaccia', price: 2, desc: { hr: 'Domaća focaccia, 1 komad', en: 'Homemade focaccia, 1 piece' } },
];
