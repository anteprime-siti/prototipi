// Pulsante "torna al banco": compare solo nelle anteprime aperte direttamente (non dentro il monitor del banco).
// Alla consegna del sito al cliente basta togliere la riga <script src="../banco.js"> dalla pagina.
(function () {
  if (window.top !== window.self) return;
  var root = new URL('./', document.currentScript.src).href;
  var css = '.banco-pill{position:fixed;left:max(16px,env(safe-area-inset-left,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(20,20,20,.88);color:#f3f3f1;font:500 13px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}'
    + '.banco-pill a{color:inherit;text-decoration:none;padding:9px 12px;border-radius:999px;white-space:nowrap}'
    + '.banco-pill a:hover{background:rgba(255,255,255,.14)}'
    + '.banco-pill a:focus-visible{outline:2px solid #8fa2ff;outline-offset:1px}'
    + '.banco-pill i{width:1px;height:16px;background:rgba(255,255,255,.25)}'
    + '.banco-pill b{font-weight:500;opacity:.6;padding:0 6px 0 10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase}'
    + '.banco-pill .s{display:none}'
    + '@media (max-width:520px){.banco-pill b,.banco-pill .l{display:none}.banco-pill .s{display:inline}}'
    + '@media print{.banco-pill{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var nav = document.createElement('nav');
  nav.className = 'banco-pill'; nav.setAttribute('aria-label', 'Anteprima');
  nav.innerHTML = '<b>Anteprima</b><a href="' + root + '">← <span class="l">Tutte le anteprime</span><span class="s">Anteprime</span></a><i aria-hidden="true"></i><a href="https://profili-cv.github.io/sebastyan-buryas/#laboratorio"><span class="l">Sebastyan Buryas</span><span class="s">Portfolio</span></a>';
  document.body.appendChild(nav);
})();
