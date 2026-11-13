// Fuori Tono · funzioni condivise
window.FT = (() => {
  const PREFIX = 'fuoritono-v2-';
  const COLORS = ['#FFD60A', '#32D74B', '#64D2FF', '#BF5AF2', '#FF9F0A', '#FF6B9A', '#5E5CE6', '#66FFCC',
    '#A3E635', '#F472B6', '#22D3EE', '#FB923C', '#C084FC', '#4ADE80', '#FACC15', '#60A5FA', '#E879F9', '#2DD4BF', '#FDBA74', '#93C5FD'];

  // Icone dei personaggi (24x24). f = riempita
  const ICONS = {
    maschera: { d: 'M2.5 8.5c3.2-1.3 6.3-1 9.5 1 3.2-2 6.3-2.3 9.5-1-.2 5.2-3 8.5-6.3 8.5-1.6 0-2.5-1-3.2-2.2-.7 1.2-1.6 2.2-3.2 2.2-3.3 0-6.1-3.3-6.3-8.5Z M7.5 11.6h2.2 M14.3 11.6h2.2' },
    occhio: { d: 'M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z' },
    cappello: { d: 'M2.5 15.5c3.5 2.3 15.5 2.3 19 0 M5.5 15.3 7 8.2c.3-1.4 1.7-2.1 3-1.6l2 .7 2-.7c1.3-.5 2.7.2 3 1.6l1.5 7.1 M6.6 12.6c3.4 1 7.4 1 10.8 0' },
    luna: { d: 'M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6Z' },
    stella: { d: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z' },
    fulmine: { d: 'M13.5 2 4.5 14h7l-1 8 9-12h-7Z' },
    chiave: { d: 'M8 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M10.9 12.1 20 3 M17 6l3 3 M14.6 8.4l2 2' },
    picche: { f: 1, d: 'M12 2.5C9 6.8 4 8.8 4 13a4 4 0 0 0 7 2.6v1.2L9.2 21h5.6L13 16.8v-1.2A4 4 0 0 0 20 13c0-4.2-5-6.2-8-10.5Z' },
    cuori: { f: 1, d: 'M12 20.5s-8.5-5.1-8.5-11.2A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.7c0 6.1-8.5 11.2-8.5 11.2Z' },
    quadri: { f: 1, d: 'm12 2 7 10-7 10-7-10Z' },
    fiori: { f: 1, d: 'M12 2.5a3.6 3.6 0 0 1 3.5 4.5 3.6 3.6 0 1 1-2.6 6.6l1.1 7.4h-4l1.1-7.4A3.6 3.6 0 1 1 8.5 7 3.6 3.6 0 0 1 12 2.5Z' },
    corona: { d: 'm3 8 4.2 4.2L12 5l4.8 7.2L21 8l-2 11H5Z M5.6 15.5h12.8' },
    fiamma: { d: 'M12 22c4.1 0 7-2.9 7-6.8 0-4.8-3.9-7.2-5-12.2-2.9 2-4 5.1-4 7.3-1.1-.9-2-2.2-2.1-4-2 2.2-2.9 5-2.9 8.9C5 19.1 7.9 22 12 22Z' },
    occhiali: { d: 'M2 9.5h20 M3.7 9.5l1 4.3a3 3 0 0 0 5.9-.3l.4-2.4h2l.4 2.4a3 3 0 0 0 5.9.3l1-4.3' },
    gatto: { d: 'M4.5 3.5 8.5 8h7l4-4.5V13a7.5 7.5 0 0 1-15 0Z M9 12.5v1 M15 12.5v1 M10.8 16h2.4' },
    dado: { d: 'M5 3.5h14A1.5 1.5 0 0 1 20.5 5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z M8.2 8.2h.01 M15.8 8.2h.01 M12 12h.01 M8.2 15.8h.01 M15.8 15.8h.01' }
  };
  const ICON_KEYS = Object.keys(ICONS);

  const glyph = (key, color, size = 24) => {
    const ic = ICONS[key] || ICONS.maschera;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${ic.d}" fill="${ic.f ? color : 'none'}" stroke="${color}" stroke-width="${ic.f ? 0 : 1.7}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };

  // Avatar: cerchio scuro con anello del colore del giocatore; icona o foto
  function avatar(p, opt = {}) {
    const { dead = false, imp = false, cls = '' } = opt;
    const color = imp ? '#FF3B30' : dead ? '#4A4852' : (p.color || '#FFD60A');
    const photo = p.photo && FT.photos[p.id] ? FT.photos[p.id] : (p.photoData || null);
    const inner = photo
      ? `<image href="${photo}" x="6" y="6" width="88" height="88" clip-path="circle(44px at 50px 50px)" preserveAspectRatio="xMidYMid slice"/>`
      : `<g transform="translate(26 26) scale(2)">${glyph(p.icon, dead ? '#6B6874' : color).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`;
    const strike = dead ? '<path d="M22 22 78 78" stroke="#FF3B30" stroke-width="6" stroke-linecap="round"/>' : '';
    return `<svg class="av ${dead ? 'dead' : ''} ${cls}" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="#141418"/>${inner}
      <circle cx="50" cy="50" r="46" fill="none" stroke="${color}" stroke-width="5"/>${strike}</svg>`;
  }

  const logo = (cls = '') => `<span class="logo ${cls}" aria-label="Fuori Tono">FUORI&nbsp;T<span class="lo">O</span>NO</span>`;

  function peerOpts() {
    const q = new URLSearchParams(location.search);
    const ph = q.get('ph');
    const o = { debug: 1, config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' },
      // relay gratuiti di PeerJS: servono quando i telefoni sono su reti diverse (4G, Wi-Fi chiusi)
      { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
    ] } };
    if (ph) { const [h, p] = ph.split(':'); Object.assign(o, { host: h, port: +p || 9000, path: '/', secure: false }); }
    return o;
  }
  const phParam = () => { const ph = new URLSearchParams(location.search).get('ph'); return ph ? '&ph=' + encodeURIComponent(ph) : ''; };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const store = {
    get(k, ses) { try { return (ses ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, ses) { try { (ses ? sessionStorage : localStorage).setItem(k, v); return true; } catch (e) { return false; } },
    del(k, ses) { try { (ses ? sessionStorage : localStorage).removeItem(k); } catch (e) {} }
  };
  const rid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Profilo salvato sul dispositivo
  const profile = {
    load() {
      let id = store.get('ft-id'); if (!id) { id = rid(12); store.set('ft-id', id); }
      return { id, name: store.get('ft-name') || '', icon: store.get('ft-icon') || ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)], photo: store.get('ft-photo') || '' };
    },
    save(p) { store.set('ft-name', p.name); store.set('ft-icon', p.icon); if (p.photo) store.set('ft-photo', p.photo); else store.del('ft-photo'); }
  };

  // Riduce una foto a un quadrato 160px (JPEG ~10 KB)
  function shrinkPhoto(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.width, img.height), c = document.createElement('canvas');
        c.width = c.height = 160;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  }

  // Tiene lo schermo acceso durante la partita (dove il browser lo permette)
  let lock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !lock && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, keepAwake, { passive: true }));

  const IMP_MODES = {
    nothing: { t: 'Nessun indizio', d: 'Sa di essere l’impostore e non vede niente.' },
    category: { t: 'Solo la categoria', d: 'Sa di essere l’impostore e conosce solo il tema.' },
    hint: { t: 'Parola simile', d: 'Sa di essere l’impostore e riceve una parola vicina come indizio.' }
  };

  return { PREFIX, COLORS, ICONS, ICON_KEYS, glyph, avatar, logo, peerOpts, phParam, esc, norm, store, rid, shuffle, profile, shrinkPhoto, IMP_MODES, keepAwake, photos: {} };
})();
