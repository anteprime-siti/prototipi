(function () {
  if (window.CSS && CSS.supports && CSS.supports('aspect-ratio', '1')) return;
  var SEL = '.ic, .joincard .qr, .secret .swatch, .moon';
  function square(el) {
    var w = el.getBoundingClientRect().width;
    if (w) el.style.height = w + 'px';
  }
  var ro = window.ResizeObserver ? new ResizeObserver(function (list) {
    list.forEach(function (e) { square(e.target); });
  }) : null;
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  function scan() {
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      square(el);
      if (ro && seen && !seen.has(el)) { seen.add(el); ro.observe(el); }
    }
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', scan);
  document.addEventListener('DOMContentLoaded', scan);
})();
