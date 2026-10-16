// Funzioni condivise tra monitor e telefono
window.FT = (() => {
  const PREFIX = 'fuoritono-v1-';
  const COLORS = ['#FF5B3A','#3B82F6','#22C08A','#FFB800','#8B5CF6','#FF6FB1','#14B8C4','#FF8A1F','#9AD62A','#2B3A8C','#E0218A','#0EA5A4','#A16207','#64748B','#EF4444','#6366F1','#84CC16','#F472B6','#06B6D4','#D97706'];
  const SHAPES = ['circle','squircle','blob','ghost'];
  const SHAPE_PATH = {
    circle: '<circle cx="50" cy="53" r="43"/>',
    squircle: '<rect x="7" y="10" width="86" height="86" rx="30"/>',
    blob: '<path d="M52 6c22 0 41 14 40 38c-1 14 5 22 2 33c-4 15-23 19-44 19S7 88 7 66C7 50 3 40 11 26C19 12 33 6 52 6Z"/>',
    ghost: '<path d="M50 5c25 0 41 18 41 43v41c0 5-5 7-8 4l-7-6-8 7c-2 2-5 2-7 0l-7-7-8 7c-2 2-5 2-7 0l-8-7-7 6c-3 3-8 1-8-4V48C10 23 25 5 50 5Z"/>'
  };

  function avatar(color, shape, opt = {}) {
    const { dead = false, sus = false, cls = '' } = opt;
    const eyes = dead
      ? '<g stroke="#1D1A2B" stroke-width="5" stroke-linecap="round"><path d="M30 41l14 14M44 41L30 55M56 41l14 14M70 41L56 55"/></g>'
      : sus
        ? '<ellipse cx="37" cy="48" rx="10" ry="7" fill="#fff"/><ellipse cx="63" cy="48" rx="10" ry="7" fill="#fff"/><circle cx="41" cy="49" r="4.5" fill="#1D1A2B"/><circle cx="67" cy="49" r="4.5" fill="#1D1A2B"/><path d="M27 37l18 4M73 37l-18 4" stroke="#1D1A2B" stroke-width="4.5" stroke-linecap="round"/>'
        : '<ellipse cx="37" cy="47" rx="9.5" ry="11.5" fill="#fff"/><ellipse cx="63" cy="47" rx="9.5" ry="11.5" fill="#fff"/><circle cx="39" cy="50" r="4.8" fill="#1D1A2B"/><circle cx="65" cy="50" r="4.8" fill="#1D1A2B"/>';
    const fill = dead ? '#CFC6B8' : color;
    return `<svg class="av ${cls}" viewBox="0 0 100 100" aria-hidden="true"><g fill="${fill}" stroke="#1D1A2B" stroke-width="4">${SHAPE_PATH[shape] || SHAPE_PATH.circle}</g>${eyes}</svg>`;
  }

  // Logo: "fuori tono" con le "o" come pallini; l'ultima è fuori posto e fuori colore
  function logo(cls = '') {
    const dot = (c, odd) => `<span class="ldot${odd ? ' odd' : ''}" style="--c:${c}"></span>`;
    return `<span class="logo ${cls}" aria-label="Fuori Tono">fu${dot('#FF5B3A')}ri t${dot('#3B82F6')}n${dot('#22C08A', true)}</span>`;
  }

  function peerOpts() {
    const q = new URLSearchParams(location.search);
    const ph = q.get('ph');
    const o = { debug: 1, config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ] } };
    if (ph) { const [h, p] = ph.split(':'); Object.assign(o, { host: h, port: +p || 9000, path: '/', secure: false }); }
    return o;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const store = {
    get(k, ses) { try { return (ses ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, ses) { try { (ses ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} },
    del(k, ses) { try { (ses ? sessionStorage : localStorage).removeItem(k); } catch (e) {} }
  };
  const rid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Testo leggibile sopra un colore (per i campioni del tema Colori)
  const inkOn = hex => { const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1D1A2B' : '#FFFFFF'; };

  const IMP_MODES = {
    nothing: { t: 'Nessun indizio', d: 'Sa di essere l’impostore e non vede niente.' },
    category: { t: 'Vede la categoria', d: 'Sa di essere l’impostore e conosce solo il tema.' },
    hint: { t: 'Parola simile', d: 'Sa di essere l’impostore e riceve una parola vicina come indizio.' },
    undercover: { t: 'Undercover', d: 'Riceve una parola simile e non sa di essere l’impostore.' }
  };

  return { PREFIX, COLORS, SHAPES, avatar, logo, peerOpts, esc, norm, store, rid, shuffle, inkOn, IMP_MODES };
})();
