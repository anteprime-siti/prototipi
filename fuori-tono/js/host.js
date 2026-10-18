// Fuori Tono · HOST: crea la stanza, tiene lo stato della partita e lo manda ai giocatori
(() => {
  const $ = s => document.querySelector(s);
  const { esc, avatar, logo, store, shuffle, norm, glyph, ICON_KEYS } = FT;
  const root = $('#app');
  const PACKS = window.FT_PACKS;
  const MAXP = 20;

  const DEF = { cats: ['cibo', 'luoghi', 'animali', 'oggetti', 'colori', 'film'], impostors: 1, undercover: 0, randomImp: false,
    impMode: 'category', showCat: false, clueRounds: 2, turnTime: 0, revealOnce: true, lastChance: true, endMode: 'survival', custom: '' };
  // Combo pronte: cambiano più impostazioni insieme
  const PRESETS = [
    { id: 'classica', t: 'Classica', d: '1 impostore che conosce la categoria', v: { impostors: 1, undercover: 0, randomImp: false, impMode: 'category', clueRounds: 2, turnTime: 0, endMode: 'survival' } },
    { id: 'undercover', t: 'Undercover', d: '1 undercover con una parola simile: non sa di esserlo', v: { impostors: 0, undercover: 1, randomImp: false, clueRounds: 2, turnTime: 0, endMode: 'survival' } },
    { id: 'misto', t: 'Misto', d: '1 impostore senza indizi e 1 undercover', v: { impostors: 1, undercover: 1, randomImp: false, impMode: 'nothing', clueRounds: 2, turnTime: 0, endMode: 'survival' } },
    { id: 'caos', t: 'Caos', d: 'Numero e ruoli degli infiltrati a sorpresa', v: { impostors: 1, undercover: 1, randomImp: true, impMode: 'hint', clueRounds: 2, turnTime: 0, endMode: 'survival' } },
    { id: 'veloce', t: 'Veloce', d: '1 giro, 30 secondi a testa, voto unico', v: { impostors: 1, undercover: 0, randomImp: false, impMode: 'category', clueRounds: 1, turnTime: 30, endMode: 'single' } },
    { id: 'esperti', t: 'Esperti', d: 'Impostore senza indizi, 3 giri di parole', v: { impostors: 1, undercover: 0, randomImp: false, impMode: 'nothing', clueRounds: 3, turnTime: 0, endMode: 'survival' } }
  ];
  const presetOn = s => (PRESETS.find(p => Object.entries(p.v).every(([k, v]) => s[k] === v)) || {}).id;
  const genCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

  const KEY = 'ft3-host', PKEY = 'ft3-photos';
  const fresh = () => ({ code: genCode(), phase: 'lobby', players: [], settings: { ...DEF }, game: null, recent: [], n: 0, localId: null });
  let S, saved = null;
  try { saved = JSON.parse(store.get(KEY) || store.get('ft2-host', true) || 'null'); } catch (e) { saved = null; }
  function prepare(st) {
    S = st && st.code ? st : fresh();
    S.settings = { ...DEF, ...S.settings };
    if (S.settings.impMode === 'undercover') { S.settings.undercover = S.settings.impostors; S.settings.impostors = 0; S.settings.impMode = 'category'; }
    S.players.forEach(p => p.online = !!p.local);
    try { Object.assign(FT.photos, JSON.parse(store.get(PKEY) || '{}')); } catch (e) {}
  }

  const conns = new Map();
  let peer = null, peerState = 'connecting', idRetries = 0;
  let sheet = null;            // 'settings' | {edit:id} | 'join'
  let tab = 'table';           // 'table' | 'me' (se l'host gioca)
  let voteTimer = null, seenTimer = null, localUI = null;

  const save = () => { if (S) { S.ts = Date.now(); store.set(KEY, JSON.stringify(S)); } };
  const savePhotos = () => store.set(PKEY, JSON.stringify(FT.photos));
  const P = id => S.players.find(p => p.id === id);
  let flashT = null;
  function flash(text) { S.flash = { text, until: Date.now() + 4500 }; clearTimeout(flashT); flashT = setTimeout(() => { S.flash = null; update(); }, 4600); }
  const G = () => S && S.game;
  const inGame = id => G() && G().ids.includes(id);
  const alive = () => G() ? G().ids.filter(id => G().alive[id]) : [];
  const isImp = id => G() && G().imps.includes(id);
  const joinUrl = () => { const u = new URL('gioca.html', location.href); u.search = `?r=${S.code}${FT.phParam()}`; return u.toString(); };
  const homeUrl = () => new URL('./', location.href).toString().replace(/^https?:\/\//, '').replace(/\/$/, '');

  // ---------------- rete ----------------
  function startPeer() {
    peerState = 'connecting'; render();
    peer = new Peer(FT.PREFIX + S.code, FT.peerOpts());
    peer.on('open', () => { peerState = 'on'; idRetries = 0; render(); });
    peer.on('connection', c => {
      c.on('data', d => onData(c, d));
      c.on('close', () => onClose(c));
      c.on('error', () => onClose(c));
    });
    peer.on('disconnected', () => { peerState = 'off'; render(); setTimeout(() => { if (peer && !peer.destroyed) peer.reconnect(); }, 2000); });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') {
        // il codice è ancora occupato (es. la scheda vecchia non si è chiusa bene): riprova per circa un minuto, poi cambia codice
        peer.destroy(); peerState = 'busy'; render();
        if (idRetries++ < 20) setTimeout(startPeer, 3000);
        else { S.code = genCode(); save(); idRetries = 0; startPeer(); }
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
        peerState = 'off'; render();
        setTimeout(() => { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); }, 3000);
      }
    });
  }

  const cleanName = (name, id) => {
    let base = String(name || 'Giocatore').trim().replace(/\s+/g, ' ').slice(0, 16) || 'Giocatore', n = base, i = 2;
    while (S.players.some(p => p.id !== id && p.name.toLowerCase() === n.toLowerCase())) n = base.slice(0, 13) + ' ' + i++;
    return n;
  };
  const freeColor = () => { const used = new Set(S.players.map(p => p.color)); return FT.COLORS.find(c => !used.has(c)) || FT.COLORS[S.players.length % FT.COLORS.length]; };
  const okPhoto = s => typeof s === 'string' && s.startsWith('data:image/') && s.length < 60000;

  function setPhoto(p, data) {
    if (data && okPhoto(data)) { if (FT.photos[p.id] !== data) { FT.photos[p.id] = data; p.photo = (p.photo || 0) + 1; sendPhotos({ [p.id]: data }); } }
    else if (p.photo) { delete FT.photos[p.id]; p.photo = 0; sendPhotos({ [p.id]: null }); }
    savePhotos();
  }
  function sendPhotos(map, only) {
    const list = only ? [only] : [...conns.values()];
    list.forEach(c => { try { c.open && c.send({ t: 'photos', map }); } catch (e) {} });
  }

  function onData(c, d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'hello') {
      if (typeof d.id !== 'string' || d.id.length > 40) return;
      let p = P(d.id);
      if (!p) {
        if (S.players.length >= MAXP) { c.send({ t: 'full' }); return; }
        p = { id: d.id, name: cleanName(d.name, d.id), icon: ICON_KEYS.includes(d.icon) ? d.icon : 'maschera', color: freeColor(), photo: 0, score: 0, waiting: S.phase !== 'lobby' };
        S.players.push(p);
      } else if (S.phase === 'lobby') { p.name = cleanName(d.name, p.id); if (ICON_KEYS.includes(d.icon)) p.icon = d.icon; }
      if ('photo' in d && (S.phase === 'lobby' || !p.photo)) setPhoto(p, d.photo);
      const old = conns.get(p.id);
      if (old && old !== c && !old.local) { try { old.close(); } catch (e) {} }
      conns.set(p.id, c); c._pid = p.id; p.online = true;
      const all = {}; S.players.forEach(x => { if (FT.photos[x.id]) all[x.id] = FT.photos[x.id]; });
      sendPhotos(all, c);
      return update();
    }
    const pid = c._pid, p = pid && P(pid), g = G();
    if (!p) return;
    switch (d.t) {
      case 'profile':
        p.name = cleanName(d.name, pid); if (ICON_KEYS.includes(d.icon)) p.icon = d.icon; setPhoto(p, d.photo); update(); break;
      case 'seen':
        if (g && S.phase !== 'lobby' && !g.seen[pid]) { g.seen[pid] = true; update(); checkAllSeen(); } break;
      case 'vote':
        if (S.phase === 'vote' && g.alive[pid] && candidates().includes(d.target) && d.target !== pid) { g.votes[pid] = d.target; update(); checkAllVoted(); } break;
      case 'unvote':
        if (S.phase === 'vote' && g.votes[pid]) { delete g.votes[pid]; clearTimeout(voteTimer); update(); } break;
      case 'guess':
        if (S.phase === 'guess' && pid === g.guesser && !g.guessText) { g.guessText = String(d.text || '').slice(0, 40); update(); } break;
      case 'done':
        if (S.phase === 'clues' && g && g.order[g.turnIdx] === pid) nextTurn(); break;
      case 'leave': removePlayer(pid, true); break;
    }
  }
  function onClose(c) {
    const pid = c._pid;
    if (pid && conns.get(pid) === c) { conns.delete(pid); const p = P(pid); if (p) p.online = false; update(); checkAllSeen(); checkAllVoted(); }
  }

  function removePlayer(id, self) {
    const who = P(id), g0 = G();
    if (who && g0 && g0.ids.includes(id) && S.phase !== 'end' && g0.alive[id]) {
      g0.out = g0.out || []; g0.out.push({ id, name: who.name, icon: who.icon, color: who.color, why: self ? 'left' : 'kicked' });
    }
    if (who && S.phase !== 'lobby') flash(self ? `${who.name} ha lasciato la partita` : `L’host ha tolto ${who.name} dalla partita`);
    else if (who && self) flash(`${who.name} ha lasciato la stanza`);
    const c = conns.get(id);
    if (c && !c.local) { if (!self) { try { c.send({ t: 'kicked' }); } catch (e) {} } setTimeout(() => { try { c.close(); } catch (e) {} }, 300); }
    conns.delete(id);
    if (id === S.localId) { S.localId = null; tab = 'table'; localUI = null; }
    S.players = S.players.filter(p => p.id !== id);
    delete FT.photos[id]; savePhotos();
    const g = G();
    if (g && g.ids.includes(id) && S.phase !== 'end') {
      const idx = g.order.indexOf(id);
      g.ids = g.ids.filter(x => x !== id); delete g.alive[id]; delete g.votes[id];
      Object.keys(g.votes).forEach(v => { if (g.votes[v] === id) delete g.votes[v]; });
      g.imps = g.imps.filter(x => x !== id); g.unders = (g.unders || []).filter(x => x !== id);
      if (idx >= 0) { g.order.splice(idx, 1); if (idx < g.turnIdx) g.turnIdx--; if (g.turnIdx >= g.order.length) g.turnIdx = 0; }
      if (g.runoff) g.runoff = g.runoff.filter(x => x !== id);
      if (g.guesser === id) { g.guesser = null; }
      const aImp = alive().filter(isImp).length, aCiv = alive().filter(x => !isImp(x)).length;
      if (aImp === 0) { g.left = true; return finish('civ'); }
      if (aImp >= aCiv) { g.left = true; return finish('imp'); }
      if (S.phase === 'guess') return resolve();
    }
    update(); checkAllSeen(); checkAllVoted();
  }

  // ---------------- vista per ogni giocatore ----------------
  const pub = pl => ({ id: pl.id, name: pl.name, icon: pl.icon, color: pl.color, photo: pl.photo || 0, online: !!pl.online, score: pl.score,
    alive: G() ? !!G().alive[pl.id] : true });
  function view(p) {
    const g = G();
    const v = { phase: S.phase, code: S.code, n: S.n, revealOnce: S.settings.revealOnce, flash: S.flash && S.flash.until > Date.now() ? S.flash.text : null,
      me: { ...pub(p), waiting: !!p.waiting, gone: !!(g && S.phase !== 'lobby' && !g.ids.includes(p.id) && !p.waiting) },
      players: S.players.map(pub) };
    if (g && !inGame(p.id) && S.phase !== 'lobby') v.me.waiting = true;
    if (!g || S.phase === 'lobby') return v;
    Object.assign(v, { order: g.order, turnIdx: g.turnIdx, round: g.round, clueRounds: S.settings.clueRounds,
      speaker: S.phase === 'clues' ? g.order[g.turnIdx] : null,
      timerLeft: S.phase === 'clues' && g.turnEnd ? Math.max(0, g.turnEnd - Date.now()) : null,
      seen: !!g.seen[p.id], out: outList().map(o => ({ name: o.name, why: o.why })) });
    if (S.phase === 'vote') Object.assign(v, { candidates: candidates(), myVote: g.votes[p.id] || null, runoff: !!g.runoff, voted: Object.keys(g.votes).length, voters: votersNeeded().length });
    if (S.phase === 'result' || S.phase === 'guess') v.result = g.result;
    if (S.phase === 'guess') Object.assign(v, { guesser: g.guesser, guessText: g.guessText || null });
    if (inGame(p.id)) v.secret = S.settings.revealOnce && g.seen[p.id] && S.phase !== 'end' ? { type: 'hidden' } : secretFor(p.id);
    if (S.phase === 'end') v.end = { winner: g.winner, stolen: !!g.stolen, word: g.word, sim: g.sim, cat: g.cat, imps: g.imps, unders: g.unders || [], mode: g.mode, gained: g.gained || {} };
    return v;
  }
  const isUnder = id => G() && (G().unders || []).includes(id);
  // chi è fuori: votati (con ruolo già svelato) e chi ha lasciato o è stato tolto
  function outList() {
    const g = G(); if (!g) return [];
    const voted = g.ids.filter(id => !g.alive[id] && P(id)).map(id => ({ id, name: P(id).name, icon: P(id).icon, color: P(id).color, why: isUnder(id) ? 'under' : isImp(id) ? 'imp' : 'civ' }));
    return voted.concat(g.out || []);
  }
  function secretFor(id) {
    const g = G();
    if (isUnder(id)) return { type: 'word', text: g.sim, color: g.simColor, cat: g.cat };
    if (!isImp(id)) return { type: 'word', text: g.word, color: g.color, cat: g.cat };
    if (g.mode === 'nothing') return { type: 'imp' };
    if (g.mode === 'category') return { type: 'imp', cat: g.cat };
    return { type: 'imp', hint: g.sim, cat: g.cat };
  }
  function broadcast() {
    for (const [id, c] of conns) { const p = P(id); if (p && c.open) { try { c.send({ t: 'state', s: view(p) }); } catch (e) {} } }
  }
  function update() { save(); broadcast(); render(); }

  // ---------------- regole ----------------
  function wordPool() {
    const pool = [];
    PACKS.filter(pk => S.settings.cats.includes(pk.id)).forEach(pk => pk.items.forEach(it =>
      pool.push(pk.colors ? { cat: pk.name, word: it[0], color: it[1], sim: it[2], simColor: it[3] } : { cat: pk.name, word: it[0], sim: it[1] })));
    const lines = S.settings.custom.split('\n').map(l => l.split(/[,;]/).map(x => x.trim()).filter(Boolean)).filter(l => l.length);
    lines.forEach((l, i) => pool.push({ cat: 'Le vostre parole', word: l[0], sim: l[1] || (lines.length > 1 ? lines[(i + 1) % lines.length][0] : l[0]) }));
    return pool;
  }
  const maxImps = n => Math.max(1, Math.floor((n - 1) / 2));
  const ready = () => S.players.filter(p => p.online);
  const canStart = () => ready().length < 3 ? 'Servono almeno 3 giocatori collegati' : !wordPool().length ? 'Scegli almeno un tema nelle impostazioni'
    : !S.settings.randomImp && S.settings.impostors + S.settings.undercover < 1 ? 'Serve almeno un impostore o un undercover' : '';
  // quanti impostori consapevoli (a) e undercover (u) per questa partita
  function roleCounts(n) {
    const s = S.settings, max = maxImps(n);
    if (s.randomImp) {
      const k = 1 + Math.floor(Math.random() * max);
      if (s.undercover > 0 && s.impostors > 0) { let u = 0; for (let i = 0; i < k; i++) if (Math.random() < 0.5) u++; return { a: k - u, u }; }
      return s.undercover > 0 ? { a: 0, u: k } : { a: k, u: 0 };
    }
    let a = s.impostors, u = s.undercover;
    while (a + u > max) { if (u > 0 && u >= a) u--; else a--; }
    return { a, u };
  }
  function startGame() {
    if (canStart()) return toast(canStart());
    clearTimers();
    const pool = wordPool();
    let fresh = pool.filter(x => !S.recent.includes(x.word)); if (!fresh.length) { S.recent = []; fresh = pool; }
    const pick = fresh[Math.floor(Math.random() * fresh.length)];
    S.recent = [...S.recent, pick.word].slice(-60);
    S.players.forEach(p => p.waiting = false);
    const ids = ready().map(p => p.id), rc = roleCounts(ids.length), k = rc.a + rc.u;
    const imps = shuffle(ids).slice(0, k), unders = imps.slice(0, rc.u);
    let order = shuffle(ids);
    { const f = order.findIndex(id => !imps.includes(id)); if (f > 0) order = order.slice(f).concat(order.slice(0, f)); }
    S.n++;
    S.game = { ids, imps, unders, aware: rc.a, out: [], mode: S.settings.impMode, cat: pick.cat, word: pick.word, sim: pick.sim, color: pick.color || null, simColor: pick.simColor || null,
      alive: Object.fromEntries(ids.map(id => [id, true])), seen: {}, order, turnIdx: 0, round: 1, turnEnd: null, votes: {}, runoff: null,
      result: null, guesser: null, guessText: null, winner: null, impCount: k, voteRound: 1 };
    S.flash = null;
    S.phase = 'reveal'; sheet = null;
    update();
  }
  function checkAllSeen() {
    if (S.phase !== 'reveal') return;
    const g = G(), need = g.ids.filter(id => P(id) && P(id).online);
    if (need.length && need.every(id => g.seen[id])) { clearTimeout(seenTimer); seenTimer = setTimeout(() => { if (S.phase === 'reveal') startClues(); }, 1800); render(); }
  }
  function startClues() { const g = G(); g.order = g.order.filter(id => g.alive[id]); g.turnIdx = 0; g.round = 1; S.phase = 'clues'; setTurnTimer(); update(); }
  function setTurnTimer() { G().turnEnd = S.settings.turnTime ? Date.now() + S.settings.turnTime * 1000 : null; }
  function nextTurn() {
    const g = G(); if (S.phase !== 'clues') return;
    g.turnIdx++;
    if (g.turnIdx >= g.order.length) { g.round++; g.turnIdx = 0; if (g.round > S.settings.clueRounds) return startVote(); }
    setTurnTimer(); update();
  }
  function startVote(runoff) { const g = G(); g.votes = {}; g.runoff = runoff || null; g.turnEnd = null; S.phase = 'vote'; update(); }
  const candidates = () => G().runoff ? G().runoff.filter(id => G().alive[id]) : alive();
  const votersNeeded = () => alive().filter(id => P(id) && P(id).online);
  function checkAllVoted() {
    if (S.phase !== 'vote') return;
    const g = G(), need = votersNeeded();
    if (need.length && need.every(id => g.votes[id])) { clearTimeout(voteTimer); voteTimer = setTimeout(() => { if (S.phase === 'vote' && votersNeeded().every(id => G().votes[id])) tally(); }, 1500); }
  }
  function tally() {
    const g = G(); clearTimeout(voteTimer);
    const counts = {}; candidates().forEach(id => counts[id] = 0);
    Object.values(g.votes).forEach(t => { if (t in counts) counts[t]++; });
    const top = Math.max(0, ...Object.values(counts));
    const tied = Object.keys(counts).filter(id => counts[id] === top && top > 0);
    if (tied.length > 1 && !g.runoff) return startVote(tied);
    const elim = tied.length === 1 ? tied[0] : null;
    if (elim) g.alive[elim] = false;
    g.result = { counts, elim, wasImp: elim ? isImp(elim) : false, wasUnder: elim ? isUnder(elim) : false, tie: !elim };
    g.runoff = null; S.phase = 'result'; update();
  }
  function afterResult() {
    const g = G(), r = g.result;
    if (r.elim && r.wasImp && !r.wasUnder && S.settings.lastChance && P(r.elim)) { g.guesser = r.elim; g.guessText = null; S.phase = 'guess'; return update(); }
    resolve();
  }
  function resolve() {
    const g = G(), r = g.result || {};
    const aImp = alive().filter(isImp).length, aCiv = alive().filter(id => !isImp(id)).length;
    if (S.settings.endMode === 'single') return finish(r.elim && r.wasImp ? 'civ' : 'imp');
    if (aImp === 0) return finish('civ');
    if (aImp >= aCiv) return finish('imp');
    g.order = g.order.filter(id => g.alive[id]); g.result = null; g.guesser = null; g.guessText = null; g.voteRound++;
    g.turnIdx = 0; g.round = 1; S.phase = 'clues'; setTurnTimer(); update();
  }
  function finish(winner) {
    const g = G(); g.winner = winner; g.gained = {};
    g.ids.forEach(id => {
      const p = P(id); if (!p) return;
      let pts = 0;
      if (winner === 'civ' && !isImp(id)) pts = 1;
      if (winner === 'imp' && isImp(id)) pts = 2 + (g.stolen && id === g.guesser ? 1 : 0);
      p.score += pts; g.gained[id] = pts;
    });
    clearTimers(); S.phase = 'end'; update();
  }
  function toLobby(msg) { clearTimers(); S.phase = 'lobby'; S.game = null; S.players.forEach(p => p.waiting = false); if (msg) flash(msg); update(); }
  function closeRoom() {
    for (const [, c] of conns) { if (!c.local) { try { c.send({ t: 'closed' }); } catch (e) {} } }
    store.del(KEY); store.del(PKEY); store.del('ft2-host', true);
    setTimeout(() => { try { peer && peer.destroy(); } catch (e) {} location.href = './'; }, 400);
  }
  function clearTimers() { clearTimeout(voteTimer); clearTimeout(seenTimer); }

  // segnale di vita: i telefoni capiscono in fretta se lo schermo dell'host è sparito
  setInterval(() => { for (const [, c] of conns) { if (!c.local && c.open) { try { c.send({ t: 'ping' }); } catch (e) {} } } }, 3000);
  setInterval(() => {
    if (!S) return;
    const g = G();
    if (S.phase === 'clues' && g && g.turnEnd) {
      const left = g.turnEnd - Date.now();
      if (left <= 0) return nextTurn();
      const el = $('#tbar'); if (el) el.style.transform = `scaleX(${Math.max(0, left / (S.settings.turnTime * 1000))})`;
    }
  }, 200);

  // ---------------- giocatore locale (l'host gioca anche lui) ----------------
  function addLocal(p) {
    const id = FT.profile.load().id;
    let pl = P(id);
    if (!pl) {
      pl = { id, name: cleanName(p.name, id), icon: p.icon, color: freeColor(), photo: 0, score: 0, waiting: S.phase !== 'lobby', local: true };
      S.players.push(pl);
    } else { pl.name = cleanName(p.name, id); pl.icon = p.icon; pl.local = true; }
    pl.online = true; S.localId = id;
    setPhoto(pl, p.photo);
    attachLocal();
    update();
  }
  function attachLocal() {
    if (!S.localId || !P(S.localId)) return;
    const host = document.createElement('div');
    localUI = FT.PlayerUI(host, {
      header: false,
      send: m => onData(localConn, m),
      onExit: () => {}, onProfile: p => FT.profile.save({ ...FT.profile.load(), ...p })
    });
    const localConn = { local: true, open: true, _pid: S.localId, send: m => { localUI && localUI.receive(m); if (tab === 'me') mountLocal(); }, close() {} };
    conns.set(S.localId, localConn);
    P(S.localId).online = true;
  }
  function mountLocal() {
    const slot = $('#meslot'); if (slot && localUI && localUI.el.parentNode !== slot) { slot.innerHTML = ''; slot.appendChild(localUI.el); }
  }

  // ---------------- interfaccia ----------------
  const icon = {
    full: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>'
  };
  const status = () => `<span class="status ${peerState}"><i></i>${peerState === 'on' ? 'In onda' : peerState === 'off' ? 'Riconnessione…' : peerState === 'busy' ? 'Riapro la stanza…' : 'Apro la stanza…'}</span>`;
  const card = (p, extra = '', opt = {}) => `<div class="suspect ${p.online === false ? 'off' : ''} ${opt.cls || ''}" ${opt.act ? `data-a="${opt.act}" data-id="${p.id}" role="button" tabindex="0"` : ''}>
      <div class="avw">${avatar(p, opt.av || {})}${extra}</div><p class="nm">${esc(p.name)}</p>${opt.under || ''}</div>`;
  const catChip = () => G() && S.settings.showCat ? `<span class="chip">Categoria · ${esc(G().cat)}</span>` : '';
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const impLine = () => {
    if (S.settings.randomImp) return 'Infiltrati: numero segreto';
    const g = G(), u = (g.unders || []).length, a = g.impCount - u;
    return [a ? plural(a, 'impostore', 'impostori') : '', u ? plural(u, 'undercover', 'undercover') : ''].filter(Boolean).join(' e ') + ' tra voi';
  };
  const outStrip = () => {
    const o = outList(); if (!o.length) return '';
    const lab = { civ: 'innocente', imp: 'impostore', under: 'undercover', left: 'ha lasciato', kicked: 'tolto dall’host' };
    return `<div class="outstrip"><span class="mono dim">FUORI DAL GIOCO</span>${o.map(x => `<span class="outp ${x.why}"><span class="avw">${avatar(x, { dead: true })}</span><span><b>${esc(x.name)}</b><i>${lab[x.why]}</i></span></span>`).join('')}</div>`;
  };
  const summary = () => {
    const s = S.settings;
    const pr = PRESETS.find(p => p.id === presetOn(s));
    return [pr ? 'Combo · ' + pr.t : '', s.randomImp ? 'Infiltrati a sorpresa' : [s.impostors ? plural(s.impostors, 'impostore', 'impostori') : '', s.undercover ? plural(s.undercover, 'undercover', 'undercover') : ''].filter(Boolean).join(' + '),
      s.impostors || s.randomImp ? FT.IMP_MODES[s.impMode].t : '',
      `${s.clueRounds} gir${s.clueRounds > 1 ? 'i' : 'o'}`, s.endMode === 'single' ? 'Voto unico' : 'Fino all’ultimo', `${s.cats.length + (s.custom.trim() ? 1 : 0)} temi`]
      .filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  };

  let lastPhase = null;
  function render() {
    if (!S) return;
    const g = G(), anim = S.phase !== lastPhase;
    const tabs = S.localId ? `<div class="seg tabs" role="tablist"><button role="tab" data-a="tab" data-v="table" aria-selected="${tab === 'table'}" class="${tab === 'table' ? 'on' : ''}">Tavolo</button><button role="tab" data-a="tab" data-v="me" aria-selected="${tab === 'me'}" class="${tab === 'me' ? 'on' : ''}">La mia carta</button></div>` : '';
    const top = `<header class="h-top">${logo()}<div class="h-tools">${tabs}<span class="chip roomcode">STANZA ${S.code}</span>${status()}
      <button class="iconbtn" data-a="full" aria-label="Schermo intero" title="Schermo intero">${icon.full}</button>
      <button class="iconbtn" data-a="quit" aria-label="${S.phase === 'lobby' ? 'Chiudi la stanza' : 'Termina la partita'}" title="${S.phase === 'lobby' ? 'Chiudi la stanza' : 'Termina la partita'}">${icon.x}</button></div></header>`;
    const fl = S.flash && S.flash.until > Date.now() ? `<div class="flash" role="status">${esc(S.flash.text)}</div>` : '';
    let h = '';
    if (tab === 'me' && S.localId) h = `<div class="mewrap"><div id="meslot"></div><p class="mono dim center small">Questa schermata è privata: non mostrarla agli altri.</p></div>`;
    else if (S.phase === 'lobby') h = lobby();
    else if (S.phase === 'reveal') {
      const need = g.ids.filter(P), all = need.filter(id => P(id).online).every(id => g.seen[id]);
      h = `<section class="stage"><p class="kicker">Partita ${S.n} · ${impLine()}</p>
        <h1 class="big">${all ? 'Tutti pronti' : 'Guardate il telefono'}</h1>
        <p class="sub">${all ? 'Si comincia.' : 'Tieni premuta la carta per leggerla. Copri lo schermo agli altri.'}</p>${catChip()}
        <div class="grid">${need.map(id => card(P(id), '', { under: `<p class="tag ${g.seen[id] ? 'ok' : ''}">${g.seen[id] ? 'LETTO' : 'IN ATTESA'}</p>` })).join('')}</div></section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn ghost" data-a="lobby">Annulla</button><button class="btn primary" data-a="clues">Iniziamo</button></div></footer>`;
    } else if (S.phase === 'clues') {
      const sp = P(g.order[g.turnIdx]);
      h = `<section class="stage spotlight"><div class="beam" aria-hidden="true"></div>
        <p class="kicker">Giro ${g.round} di ${S.settings.clueRounds}${g.voteRound > 1 ? ` · votazione ${g.voteRound}` : ''}</p>
        <div class="avxl ${anim || true ? 'enter' : ''}">${avatar(sp)}</div>
        <h1 class="big"><span class="dim">Tocca a</span> ${esc(sp.name)}</h1>
        ${g.turnEnd ? '<div class="tbar"><i id="tbar"></i></div>' : '<p class="sub">Una parola, ad alta voce. Abbastanza per farti riconoscere, non abbastanza per svelarla.</p>'}
        <ol class="queue">${g.order.map((id, i) => `<li class="${i < g.turnIdx ? 'done' : i === g.turnIdx ? 'now' : ''}"><span class="avw">${avatar(P(id))}</span><span>${esc(P(id).name)}</span></li>`).join('')}</ol>${outStrip()}</section>
        <footer class="h-bar"><div>${catChip()}</div><div class="acts"><button class="btn ghost" data-a="vote">Vai al voto</button><button class="btn primary" data-a="next">Avanti</button></div></footer>`;
    } else if (S.phase === 'vote') {
      const cand = candidates(), need = votersNeeded(), done = need.filter(id => g.votes[id]).length;
      h = `<section class="stage"><p class="kicker red">${g.runoff ? 'Pareggio · ballottaggio' : 'Votazione aperta'}</p><h1 class="big">Chi è fuori tono?</h1>
        <p class="sub">Votate dal telefono e confermate. Si può cambiare idea finché il voto è aperto.</p>
        <div class="grid">${cand.map(id => card(P(id))).join('')}</div>
        <div class="voters"><span class="mono">${done}/${need.length} VOTI</span>${need.map(id => `<span class="dot ${g.votes[id] ? 'on' : ''}" title="${esc(P(id).name)}"></span>`).join('')}</div>${outStrip()}</section>
        <footer class="h-bar"><div>${catChip()}</div><div class="acts"><button class="btn danger" data-a="tally">Chiudi votazione</button></div></footer>`;
    } else if (S.phase === 'result') {
      const r = g.result, e = r.elim && P(r.elim);
      const by = id => Object.keys(g.votes).filter(v => g.votes[v] === id && P(v)).map(v => `<span class="vby" title="${esc(P(v).name)}">${avatar(P(v))}</span>`).join('');
      h = `<section class="stage"><div class="grid">${Object.keys(r.counts).filter(P).map(id => card(P(id), `<span class="votes">${r.counts[id]}</span>`, { av: { dead: id === r.elim }, under: `<div class="vbys">${by(id)}</div>` })).join('')}</div>
        ${e ? `<h1 class="big rise">${esc(e.name)} è fuori</h1><p class="stampbig ${r.wasImp ? 'red' : ''} late">${r.wasUnder ? 'ERA UNDERCOVER' : r.wasImp ? 'ERA L’IMPOSTORE' : 'ERA INNOCENTE'}</p>`
          : `<h1 class="big rise">Pareggio</h1><p class="sub">Nessuno viene eliminato.</p>`}</section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn primary" data-a="after">Continua</button></div></footer>`;
    } else if (S.phase === 'guess') {
      const e = P(g.guesser), match = g.guessText && norm(g.guessText) === norm(g.word);
      // se restano altri infiltrati in gioco la parola non si mostra: la partita potrebbe continuare
      const others = alive().filter(isImp).length > 0 && S.settings.endMode !== 'single';
      h = `<section class="stage"><p class="kicker red">Ultima chance</p><div class="avxl">${avatar(e, { imp: true })}</div>
        <h1 class="big">${esc(e.name)} prova a indovinare</h1>
        ${!g.guessText ? '<p class="sub">Se indovina, ruba la vittoria.</p>'
          : others ? `<div class="pair"><div><p class="kicker">Ha scritto</p><p class="wordbox">${esc(g.guessText)}</p></div><div><p class="kicker">La parola segreta</p><p class="wordbox secretbox">${match ? 'COMBACIA' : 'NON COMBACIA'}</p></div></div>
            <p class="sub">${match ? 'È la parola giusta.' : 'La parola resta segreta: ci sono ancora infiltrati in gioco.'} Decidete voi se va bene.</p>`
          : `<div class="pair"><div><p class="kicker">Ha scritto</p><p class="wordbox">${esc(g.guessText)}</p></div><div><p class="kicker">La parola era</p><p class="wordbox">${esc(g.word)}</p></div></div>
            <p class="sub">${match ? 'Sembra proprio giusta.' : 'Decidete voi: è giusta?'}</p>`}</section>
        <footer class="h-bar"><div></div><div class="acts">${g.guessText ? '<button class="btn ghost" data-a="wrong">Sbagliata</button><button class="btn primary" data-a="right">Giusta</button>' : '<button class="btn ghost" data-a="wrong">Salta</button>'}</div></footer>`;
    } else if (S.phase === 'end') {
      const civ = g.winner === 'civ';
      h = `<section class="stage"><p class="kicker ${civ ? '' : 'red'}">${g.stolen ? 'Parola indovinata' : g.left ? 'Partita interrotta' : 'Caso chiuso'}</p>
        <h1 class="big">${civ ? 'Vincono gli innocenti' : g.imps.length > 1 ? 'Vincono gli infiltrati' : (g.unders || []).length ? 'Vince l’undercover' : 'Vince l’impostore'}</h1>
        <div class="pair"><div><p class="kicker">La parola era</p><p class="wordbox">${g.color ? `<i class="sw" style="background:${g.color}"></i>` : ''}${esc(g.word)}</p></div>
          ${(g.unders || []).length || (g.mode === 'hint' && g.imps.length > (g.unders || []).length) ? `<div><p class="kicker">${(g.unders || []).length ? 'Parola degli undercover' : 'Indizio impostori'}</p><p class="wordbox">${esc(g.sim)}</p></div>` : ''}</div>
        <div class="grid">${g.ids.filter(P).map(id => card(P(id), '', { av: { imp: isImp(id), dead: !g.alive[id] && !isImp(id) }, under: `${isUnder(id) ? '<p class="tag red">UNDERCOVER</p>' : isImp(id) ? '<p class="tag red">IMPOSTORE</p>' : ''}<p class="mono dim small">+${g.gained[id] || 0} · ${P(id).score} pt</p>` })).join('')}</div></section>
        <footer class="h-bar"><div><span class="chip">${esc(g.cat)}</span></div><div class="acts"><button class="btn ghost" data-a="lobby">Lobby</button><button class="btn primary" data-a="start">Nuova partita</button></div></footer>`;
    }
    root.innerHTML = top + fl + `<div class="h-body">${h}</div>` + renderSheet();
    if (tab === 'me') mountLocal();
    if (S.phase === 'lobby' && tab === 'table') drawQR();
    if (sheet === 'join') mountJoinForm();
    if (sheet && sheet.edit) mountEdit();
    lastPhase = S.phase;
  }

  function lobby() {
    const err = canStart(), ps = S.players, scored = ps.some(p => p.score > 0);
    return `<section class="lobby">
      <div class="joincard"><p class="kicker">Inquadra per entrare</p><div class="qr" id="qr"></div>
        <p class="kicker">oppure apri <b>${esc(homeUrl())}</b> e scrivi</p><p class="code">${S.code}</p></div>
      <div class="roster"><div class="roster-h"><h2>Sospettati <span class="mono dim">${ps.length}/${MAXP}</span></h2>
        ${S.localId ? '' : '<button class="btn ghost sm" data-a="joinme">+ Gioco anch’io</button>'}</div>
        ${ps.length ? `<div class="grid left">${ps.map(p => card(p, p.local ? '<span class="you">TU</span>' : '', { act: 'edit', under: scored ? `<p class="mono dim small">${p.score} pt</p>` : '' })).join('')}</div>
          <p class="mono dim small">Tocca un giocatore per rinominarlo, cambiargli il simbolo o toglierlo.</p>`
          : '<div class="empty"><p>Nessun sospettato.</p><p class="dim">Inquadrate il QR con il telefono: servono almeno 3 giocatori.</p></div>'}
        <ol class="howto"><li><b>Leggi il fascicolo</b><span>Tutti ricevono la parola segreta. L’impostore no.</span></li>
          <li><b>Una parola a testa</b><span>Ad alta voce, a turno. Né troppo chiara né troppo vaga.</span></li>
          <li><b>Vota</b><span>Scovate chi è fuori tono prima che indovini.</span></li></ol></div></section>
      <footer class="h-bar"><div class="chips">${summary()}</div><div class="acts">
        <button class="btn ghost" data-a="settings">${icon.gear} Impostazioni</button>
        <button class="btn primary" data-a="start" ${err ? 'disabled' : ''} title="${esc(err)}">Inizia</button></div></footer>`;
  }

  function renderSheet() {
    if (!sheet) return '';
    let inner = '';
    if (sheet === 'settings') inner = settingsPanel();
    else if (sheet === 'quit') inner = `<header><h3>${S.phase === 'lobby' ? 'Chiudi la stanza' : 'Termina la partita'}</h3><button class="btn ghost sm" data-a="close">Annulla</button></header><div class="body quit">
      ${S.phase !== 'lobby' ? `<button class="opt" data-a="abort"><b>Interrompi la partita</b><span>Si torna nella sala d’attesa con gli stessi giocatori. Questa partita non dà punti.</span></button>` : ''}
      <button class="opt danger" data-a="closeroom"><b>Chiudi la stanza</b><span>Tutti escono, punti e giocatori si cancellano. Poi puoi aprire una stanza nuova.</span></button></div>`;
    else if (sheet === 'join') inner = `<header><h3>Gioco anch’io</h3><button class="btn ghost sm" data-a="close">Chiudi</button></header><div class="body"><p class="dim">Entri nella partita da questo dispositivo. Quando c’è da leggere la carta, passa alla scheda «La mia carta».</p><div id="joinform"></div></div>`;
    else if (sheet.edit) inner = `<header><h3>Giocatore</h3><button class="btn ghost sm" data-a="close">Chiudi</button></header><div class="body" id="editbody"></div>`;
    return `<div class="scrim" data-a="close"></div><aside class="sheet" role="dialog" aria-modal="true">${inner}</aside>`;
  }
  function mountJoinForm() {
    const el = $('#joinform'); if (!el || el.dataset.on) return; el.dataset.on = 1;
    FT.ProfileForm(el, { profile: FT.profile.load(), color: freeColor(), saveLabel: 'Entra in partita', onSave: p => { FT.profile.save({ ...FT.profile.load(), ...p }); sheet = null; addLocal(p); } });
  }
  function mountEdit() {
    const el = $('#editbody'), p = P(sheet.edit); if (!el) return;
    if (!p) { sheet = null; return render(); }
    el.innerHTML = `<div class="pf-head"><div class="pf-av">${avatar(p)}</div><div><p class="word sm">${esc(p.name)}</p><p class="mono dim small">${p.online ? 'collegato' : 'non collegato'}${p.local ? ' · questo dispositivo' : ''}</p></div></div>
      <div class="field"><label for="ed-name">Nome</label><div class="row2"><input id="ed-name" maxlength="16" value="${esc(p.name)}"><button class="btn ghost" data-a="ed-name">Rinomina</button></div></div>
      ${p.photo ? '<div class="field"><span class="lbl">Foto</span><button class="btn ghost" data-a="ed-nophoto">Togli la foto</button></div>' : ''}
      <div class="field"><span class="lbl">Simbolo</span><div class="icons">${ICON_KEYS.map(k => `<button class="ic ${p.icon === k ? 'on' : ''}" data-a="ed-icon" data-k="${k}" aria-label="${k}">${glyph(k, p.icon === k ? '#0B0B0D' : '#F4F1EA', 22)}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Colore</span><div class="icons">${FT.COLORS.map(c => `<button class="ic sw ${p.color === c ? 'on' : ''}" data-a="ed-color" data-c="${c}" style="--c:${c}" aria-label="colore ${c}"></button>`).join('')}</div></div>
      <button class="btn danger wide" data-a="ed-remove">Togli dalla ${S.phase === 'lobby' ? 'stanza' : 'partita'}</button>`;
  }

  function settingsPanel() {
    const s = S.settings, n = Math.max(3, ready().length);
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-a="set" data-k="${key}" data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const sw = (key, label) => `<button class="switch ${s[key] ? 'on' : ''}" data-a="toggle" data-k="${key}" aria-pressed="${!!s[key]}"><i></i>${label}</button>`;
    return `<header><h3>Impostazioni</h3><button class="btn primary sm" data-a="close">Fatto</button></header><div class="body">
      <div class="sec"><h4>Temi</h4><p class="h">La parola segreta esce a caso dai temi accesi.</p>
        <div class="chips">${PACKS.map(pk => `<button class="chip tog ${s.cats.includes(pk.id) ? 'on' : ''}" data-a="cat" data-id="${pk.id}" aria-pressed="${s.cats.includes(pk.id)}">${esc(pk.name)}</button>`).join('')}</div>
        <div class="chips" style="margin-top:10px"><button class="chip" data-a="cats-all">Tutti</button><button class="chip" data-a="cats-none">Nessuno</button></div></div>
      <div class="sec"><h4>Le vostre parole</h4><p class="h">Una per riga. Con la virgola aggiungi la parola simile: <b>Pizza, Focaccia</b></p>
        <textarea class="custom" id="custom" placeholder="Prof Fumagalli, Relatrice">${esc(s.custom)}</textarea></div>
      <div class="sec"><h4>Combo pronte</h4><p class="h">Un tocco e cambiano ruoli, giri e tempo insieme. Poi puoi ritoccare tutto qui sotto.</p>
        <div class="opts presets">${PRESETS.map(p => `<button class="opt ${presetOn(s) === p.id ? 'on' : ''}" data-a="preset" data-id="${p.id}"><b>${p.t}</b><span>${p.d}</span></button>`).join('')}</div></div>
      <div class="sec"><h4>Infiltrati</h4><p class="h">Con ${n} giocatori fino a ${maxImps(n)} in tutto. L’<b>impostore</b> sa di esserlo; l’<b>undercover</b> riceve una parola simile e non lo sa.</p>
        <div class="roles">
          <div class="rolebox"><span class="lbl">Impostori</span><div class="stepper"><button class="iconbtn" data-a="role" data-k="impostors" data-d="-1" aria-label="Un impostore in meno">−</button><b>${s.impostors}</b><button class="iconbtn" data-a="role" data-k="impostors" data-d="1" aria-label="Un impostore in più">+</button></div></div>
          <div class="rolebox"><span class="lbl">Undercover</span><div class="stepper"><button class="iconbtn" data-a="role" data-k="undercover" data-d="-1" aria-label="Un undercover in meno">−</button><b>${s.undercover}</b><button class="iconbtn" data-a="role" data-k="undercover" data-d="1" aria-label="Un undercover in più">+</button></div></div>
        </div>
        <div class="rowc" style="margin-top:12px">${sw('randomImp', 'Numero a sorpresa')}</div>
        ${s.randomImp ? '<p class="h" style="margin-top:8px">Ogni partita esce un numero diverso di infiltrati. Se hai messo sia impostori sia undercover, i ruoli si mescolano.</p>' : ''}</div>
      ${s.impostors || s.randomImp ? `<div class="sec"><h4>Cosa vede l’impostore</h4><div class="opts">${Object.entries(FT.IMP_MODES).map(([k, m]) => `<button class="opt ${s.impMode === k ? 'on' : ''}" data-a="set" data-k="impMode" data-v="${k}"><b>${m.t}</b><span>${m.d}</span></button>`).join('')}</div></div>` : ''}
      <div class="sec"><h4>Giri di indizi prima del voto</h4>${seg('clueRounds', [[1, '1'], [2, '2'], [3, '3']])}</div>
      <div class="sec"><h4>Tempo per turno</h4>${seg('turnTime', [[0, 'Libero'], [15, '15 s'], [30, '30 s'], [45, '45 s']])}</div>
      <div class="sec"><h4>Fine partita</h4>${seg('endMode', [['survival', 'Fino all’ultimo'], ['single', 'Voto unico']])}
        <p class="h" style="margin-top:8px">${s.endMode === 'single' ? 'Si vota una volta: se esce un impostore vincono gli innocenti.' : 'Si vota finché gli impostori sono fuori o diventano la metà.'}</p></div>
      <div class="sec col"><h4>Altre regole</h4>${sw('revealOnce', 'La parola si legge una volta sola')}${sw('showCat', 'Mostra la categoria a tutti')}${sw('lastChance', 'L’impostore scoperto può indovinare la parola')}</div>
    </div>`;
  }

  function drawQR() {
    const el = $('#qr'); if (!el || typeof qrcode === 'undefined') return;
    const q = qrcode(0, 'M'); q.addData(joinUrl()); q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

  root.addEventListener('click', e => {
    if (!e.target.isConnected || e.target.closest('#meslot')) return; // i click nella carta privata li gestisce il giocatore
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, s = S.settings;
    switch (a) {
      case 'full': if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); break;
      case 'tab': tab = b.dataset.v; render(); break;
      case 'settings': sheet = 'settings'; render(); break;
      case 'joinme': sheet = 'join'; render(); break;
      case 'edit': sheet = { edit: b.dataset.id }; render(); break;
      case 'close': if (sheet === 'settings') save(); sheet = null; render(); break;
      case 'start': startGame(); break;
      case 'clues': clearTimeout(seenTimer); startClues(); break;
      case 'next': nextTurn(); break;
      case 'vote': startVote(); break;
      case 'tally': tally(); break;
      case 'after': afterResult(); break;
      case 'right': G().stolen = true; finish('imp'); break;
      case 'wrong': resolve(); break;
      case 'lobby': toLobby(); break;
      case 'cat': s.cats = s.cats.includes(b.dataset.id) ? s.cats.filter(x => x !== b.dataset.id) : [...s.cats, b.dataset.id]; update(); break;
      case 'cats-all': s.cats = PACKS.map(p => p.id); update(); break;
      case 'cats-none': s.cats = []; update(); break;
      case 'role': {
        const n = Math.max(3, ready().length), k = b.dataset.k, o = k === 'impostors' ? 'undercover' : 'impostors';
        const v = Math.max(0, s[k] + +b.dataset.d);
        if (v + s[o] > maxImps(n)) { toast(`Con ${n} giocatori al massimo ${maxImps(n)} infiltrati`); break; }
        if (v + s[o] < 1) { toast('Serve almeno un impostore o un undercover'); break; }
        s[k] = v; update(); break; }
      case 'preset': { const pr = PRESETS.find(p => p.id === b.dataset.id); if (pr) { Object.assign(s, pr.v); update(); toast('Combo ' + pr.t); } break; }
      case 'quit': sheet = 'quit'; render(); break;
      case 'abort': sheet = null; toLobby('Partita interrotta dall’host'); break;
      case 'closeroom': sheet = null; closeRoom(); break;
      case 'toggle': s[b.dataset.k] = !s[b.dataset.k]; update(); break;
      case 'set': { const v = b.dataset.v; s[b.dataset.k] = isNaN(+v) ? v : +v; update(); break; }
      case 'ed-name': { const p = P(sheet.edit), v = $('#ed-name').value; if (p && v.trim()) { p.name = cleanName(v, p.id); update(); } break; }
      case 'ed-icon': { const p = P(sheet.edit); if (p) { p.icon = b.dataset.k; if (p.photo) setPhoto(p, ''); update(); } break; }
      case 'ed-nophoto': { const p = P(sheet.edit); if (p) { setPhoto(p, ''); update(); } break; }
      case 'ed-color': { const p = P(sheet.edit), other = S.players.find(x => x.color === b.dataset.c && x !== p); if (p) { if (other) other.color = p.color; p.color = b.dataset.c; update(); } break; }
      case 'ed-remove': { const id = sheet.edit; sheet = null; removePlayer(id); break; }
    }
  });
  root.addEventListener('keydown', e => { if (e.target.closest('#meslot')) return; if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.suspect[data-a]')) { e.preventDefault(); e.target.click(); } });
  root.addEventListener('input', e => { if (e.target.id === 'custom') { S.settings.custom = e.target.value; save(); } });
  document.addEventListener('keydown', e => {
    if (!S || e.target.matches('input,textarea')) return;
    if (e.key === 'Escape' && sheet) { sheet = null; render(); }
    if ((e.key === ' ' || e.key === 'ArrowRight') && S.phase === 'clues' && tab === 'table' && !sheet) { e.preventDefault(); nextTurn(); }
  });
  // evita che i render cancellino il testo che si sta scrivendo
  const _render = render;
  render = function () {
    const a = document.activeElement;
    if (a && (a.id === 'custom' || a.id === 'ed-name' || (a.closest && a.closest('#joinform')))) { broadcastOnlyRefresh(); return; }
    _render();
  };
  function broadcastOnlyRefresh() { /* ridisegna più tardi, quando si esce dal campo */ clearTimeout(broadcastOnlyRefresh.t); broadcastOnlyRefresh.t = setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches('input,textarea')) _render(); }, 1500); }
  root.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches('input,textarea')) _render(); }, 50));

  window.addEventListener('beforeunload', () => { save(); try { peer && peer.destroy(); } catch (e) {} });
  function boot(st) {
    prepare(st);
    store.set('ft3-live', S.code, true);   // questa scheda tiene la stanza: un ricaricamento la riprende senza chiedere
    if (S.flash) S.flash = null;
    if (S.localId) attachLocal();
    render(); startPeer(); FT.keepAwake();
  }
  // C'è una stanza in sospeso? Chiedi se riprenderla
  const qs = new URLSearchParams(location.search);
  const pending = saved && saved.code && ((saved.players || []).length || saved.game) && Date.now() - (saved.ts || 0) < 24 * 3600e3;
  if (qs.has('nuova')) { store.del(KEY); store.del(PKEY); boot(null); }
  else if (pending && !qs.has('riprendi') && store.get('ft3-live', true) !== saved.code) {
    const ph = { lobby: 'sala d’attesa', reveal: 'lettura delle carte', clues: 'giro di parole', vote: 'votazione', result: 'risultato', guess: 'ultima chance', end: 'fine partita' }[saved.phase] || '';
    const ago = Math.max(1, Math.round((Date.now() - (saved.ts || Date.now())) / 60000));
    root.innerHTML = `<header class="h-top">${logo()}</header><div class="h-body"><section class="stage resume">
      <p class="kicker">Partita in sospeso</p><h1 class="big">Stanza ${esc(saved.code)}</h1>
      <p class="sub">${(saved.players || []).length} giocatori · ${esc(ph)}${saved.n ? ` · partita ${saved.n}` : ''} · ${ago < 60 ? ago + ' min fa' : Math.round(ago / 60) + ' ore fa'}</p>
      <div class="grid">${(saved.players || []).slice(0, 12).map(p => `<div class="suspect"><div class="avw">${avatar(p)}</div><p class="nm">${esc(p.name)}</p></div>`).join('')}</div>
      <div class="acts center"><button class="btn ghost" id="r-new">Apri una stanza nuova</button><button class="btn primary" id="r-go">Riprendi la partita</button></div>
      <p class="mono dim small">Riprendendo, i giocatori rientrano da soli con lo stesso codice.</p></section></div>`;
    $('#r-go').onclick = () => { history.replaceState(null, '', location.pathname + '?riprendi=1' + FT.phParam()); boot(saved); };
    $('#r-new').onclick = () => { store.del(KEY); store.del(PKEY); FT.photos = {}; boot(null); };
  } else boot(pending ? saved : null);
  window.__FT_HOST = { get S() { return S; } };
})();
