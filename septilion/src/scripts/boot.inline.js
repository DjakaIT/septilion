/* Septillion — pokreće se sinkrono u <head> (prije iscrtavanja).
   1) oznaka "js" (bez JS-a sadržaj ostaje vidljiv)
   2) ako je prethodna stranica započela prijelaz, odmah prekrij ekran da nema bljeska */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var s = sessionStorage.getItem('sx-nav');
    if (!s) return;
    var f = JSON.parse(s);
    var p = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1') || '/';
    if (Date.now() - f.t > 4000 || f.to !== p || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (f.kind === 'wipe') { d.classList.add('sx-cover'); d.style.setProperty('--sx-cover', f.color); }
    else d.classList.add('sx-fade');
  } catch (e) { /* bez prijelaza */ }
})();
