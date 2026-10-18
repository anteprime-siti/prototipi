// Lupus slavo · HOST: il narratore. Tiene lo stato della partita, guida notte e giorno, manda a ogni telefono solo ciò che può sapere.
(() => {
  const $ = s => document.querySelector(s);
  const { esc, avatar, logo, store, shuffle, glyph, ICON_KEYS, ROLES, roleIcon, say } = FT;
  const root = $('#app');
  const MAXP = 20, MINP = 4;
  const KEY = 'ls1-host', PKEY = 'ls1-photos';

  const DEF = { autoWolves: true, wolves: 1, seer: true, healer: true, hunter: true, reveal: true, dayTime: 0, voice: true, firstKill: true };
  const PRESETS = [
    { id: 'classica', t: 'Classica', d: 'Lupi in automatico, veggente e guaritore', v: { autoWolves: true, seer: true, healer: true, hunter: false, reveal: true, dayTime: 0, firstKill: true } },
    { id: 'completa', t: 'Completa', d: 'Tutti i ruoli: veggente, guaritore e cacciatore', v: { autoWolves: true, seer: true, healer: true, hunter: true, reveal: true, dayTime: 0, firstKill: true } },
    { id: 'buio', t: 'Al buio', d: 'Nessuno sa che ruolo aveva chi muore', v: { autoWolves: true, seer: true, healer: true, hunter: true, reveal: false, dayTime: 0, firstKill: true } },
    { id: 'veloce', t: 'Veloce', d: '2 minuti di discussione al giorno', v: { autoWolves: true, seer: true, healer: true, hunter: false, reveal: true, dayTime: 120, firstKill: true } },
    { id: 'tranquilla', t: 'Prima notte tranquilla', d: 'La prima notte i lupi si riconoscono e basta', v: { autoWolves: true, seer: true, healer: true, hunter: true, reveal: true, dayTime: 0, firstKill: false } }
  ];
  const presetOn = s => (PRESETS.find(p => Object.entries(p.v).every(([k, v]) => s[k] === v)) || {}).id;
  const autoWolves = n => n <= 6 ? 1 : n <= 11 ? 2 : n <= 16 ? 3 : 4;
  const maxWolves = n => Math.max(1, Math.floor((n - 1) / 3));
  const genCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
  const fresh = () => ({ code: genCode(), phase: 'lobby', players: [], settings: { ...DEF }, game: null, n: 0, localId: null });

  let S = null, saved = null;
  try { saved = JSON.parse(store.get(KEY) || 'null'); } catch (e) {}
  function prepare(st) {
    S = st && st.code ? st : fresh();
    S.settings = { ...DEF, ...S.settings };
    S.players.forEach(p => p.online = !!p.local);
    try { Object.assign(FT.photos, JSON.parse(store.get(PKEY) || '{}')); } catch (e) {}
    FT.setVoice(S.settings.voice);
  }

  const conns = new Map();
  let peer = null, peerState = 'connecting', idRetries = 0, sheet = null, tab = 'table', localUI = null;
  let nightT = null, flashT = null, dayTick = null;

  const save = () => { if (S) { S.ts = Date.now(); store.set(KEY, JSON.stringify(S)); } };
  const savePhotos = () => store.set(PKEY, JSON.stringify(FT.photos));
  const P = id => S.players.find(p => p.id === id);
  const G = () => S && S.game;
  const role = id => G() && G().roles[id];
  const alive = () => G() ? G().ids.filter(id => G().alive[id]) : [];
  const aliveRole = r => alive().filter(id => role(id) === r);
  const isWolf = id => role(id) === 'lupo';
  const joinUrl = () => { const u = new URL('gioca.html', location.href); u.search = `?r=${S.code}${FT.phParam()}`; return u.toString(); };
  const homeUrl = () => new URL('./', location.href).toString().replace(/^https?:\/\//, '').replace(/\/$/, '');
  function flash(text) { S.flash = { text, until: Date.now() + 4500 }; clearTimeout(flashT); flashT = setTimeout(() => { S.flash = null; update(); }, 4600); }
  const narrate = t => { if (S.settings.voice) say(t); };

  // ---------------- rete (come Fuori Tono) ----------------
  function startPeer() {
    peerState = 'connecting'; render();
    peer = new Peer(FT.PREFIX + S.code, FT.peerOpts());
    peer.on('open', () => { peerState = 'on'; idRetries = 0; render(); });
    peer.on('connection', c => { c.on('data', d => onData(c, d)); c.on('close', () => onClose(c)); c.on('error', () => onClose(c)); });
    peer.on('disconnected', () => { peerState = 'off'; render(); setTimeout(() => { if (peer && !peer.destroyed) peer.reconnect(); }, 2000); });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') {
        peer.destroy(); peerState = 'busy'; render();
        if (idRetries++ < 20) setTimeout(startPeer, 3000); else { S.code = genCode(); save(); idRetries = 0; startPeer(); }
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
        peerState = 'off'; render(); setTimeout(() => { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); }, 3000);
      }
    });
  }
  setInterval(() => { for (const [, c] of conns) { if (!c.local && c.open) { try { c.send({ t: 'ping' }); } catch (e) {} } } }, 3000);

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
  function sendPhotos(map, only) { (only ? [only] : [...conns.values()]).forEach(c => { try { c.open && c.send({ t: 'photos', map }); } catch (e) {} }); }

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
      const old = conns.get(p.id); if (old && old !== c && !old.local) { try { old.close(); } catch (e) {} }
      conns.set(p.id, c); c._pid = p.id; p.online = true;
      const all = {}; S.players.forEach(x => { if (FT.photos[x.id]) all[x.id] = FT.photos[x.id]; }); sendPhotos(all, c);
      return update();
    }
    const pid = c._pid, p = pid && P(pid), g = G();
    if (!p) return;
    switch (d.t) {
      case 'profile': p.name = cleanName(d.name, pid); if (ICON_KEYS.includes(d.icon)) p.icon = d.icon; setPhoto(p, d.photo); update(); break;
      case 'seen': if (S.phase === 'roles' && g && g.ids.includes(pid)) { g.seen[pid] = true; update(); checkRoles(); } break;
      case 'night': if (S.phase === 'night' && g.alive[pid]) nightAction(pid, d); break;
      case 'shoot': if (S.phase === 'hunter' && g.hunter && g.hunter.id === pid && g.alive[d.target] && d.target !== pid) { g.hunter.target = d.target; hunterShot(); } break;
      case 'vote': if (S.phase === 'vote' && g.alive[pid] && candidates().includes(d.target) && d.target !== pid) { g.votes[pid] = d.target; update(); checkVotes(); } break;
      case 'unvote': if (S.phase === 'vote' && g.votes[pid]) { delete g.votes[pid]; update(); } break;
      case 'leave': removePlayer(pid, true); break;
    }
  }
  function onClose(c) { const pid = c._pid; if (pid && conns.get(pid) === c) { conns.delete(pid); const p = P(pid); if (p) p.online = false; update(); checkRoles(); checkNight(); checkVotes(); } }

  function removePlayer(id, self) {
    const who = P(id), g = G();
    if (who) flash(S.phase === 'lobby' ? `${who.name} ha lasciato la stanza` : self ? `${who.name} ha lasciato la partita` : `L’host ha tolto ${who.name} dalla partita`);
    const c = conns.get(id);
    if (c && !c.local) { if (!self) { try { c.send({ t: 'kicked' }); } catch (e) {} } setTimeout(() => { try { c.close(); } catch (e) {} }, 300); }
    conns.delete(id);
    if (id === S.localId) { S.localId = null; tab = 'table'; localUI = null; }
    if (g && g.ids.includes(id) && g.alive[id] && S.phase !== 'end') { g.alive[id] = false; g.deaths.push({ id, name: who ? who.name : '?', cause: 'uscito', day: g.day, role: g.roles[id] }); }
    S.players = S.players.filter(p => p.id !== id);
    delete FT.photos[id]; savePhotos();
    if (g && S.phase !== 'end' && S.phase !== 'lobby' && winner()) return finish(winner());
    update(); checkRoles(); checkNight(); checkVotes();
  }

  // ---------------- cosa vede ogni telefono ----------------
  const pub = pl => ({ id: pl.id, name: pl.name, icon: pl.icon, color: pl.color, photo: pl.photo || 0, online: !!pl.online, score: pl.score, alive: G() ? G().alive[pl.id] !== false : true });
  function deathsPublic() {
    const g = G(); if (!g) return [];
    return g.deaths.map(x => ({ id: x.id, name: x.name, cause: x.cause, day: x.day, role: S.settings.reveal || S.phase === 'end' ? x.role : null }));
  }
  function view(p) {
    const g = G();
    const v = { phase: S.phase, code: S.code, n: S.n, flash: S.flash && S.flash.until > Date.now() ? S.flash.text : null,
      me: { ...pub(p), waiting: !!p.waiting }, players: S.players.map(pub) };
    if (!g || S.phase === 'lobby') return v;
    const inG = g.ids.includes(p.id);
    if (!inG) { v.me.waiting = true; return v; }
    const r = g.roles[p.id];
    Object.assign(v, { role: r, night: g.night, day: g.day, alive: alive(), deaths: deathsPublic(), seenRole: !!g.seen[p.id], reveal: S.settings.reveal });
    if (r === 'lupo') v.wolves = g.ids.filter(isWolf);
    if (r === 'veggente') v.visions = g.visions.filter(x => x.by === p.id).map(x => ({ target: x.target, wolf: x.wolf, night: x.night }));
    if (S.phase === 'night') {
      const a = g.act;
      v.nightTask = !g.alive[p.id] ? 'ghost' : r === 'lupo' ? (g.night === 1 && !S.settings.firstKill ? 'meet' : 'kill') : r === 'veggente' ? 'see' : r === 'guaritore' ? 'heal' : 'dream';
      v.done = !!a.done[p.id];
      if (r === 'lupo') v.wolfPicks = a.wolf;
      if (r === 'guaritore') v.noHeal = g.lastHeal;
      if (r === 'veggente' && a.seer) v.vision = g.visions.find(x => x.by === p.id && x.night === g.night) || null;
    }
    if (S.phase === 'dawn') v.dawn = { ...g.dawn, role: S.settings.reveal ? g.dawn.role : null };
    if (S.phase === 'hunter') v.hunter = { id: g.hunter.id, target: g.hunter.target || null };
    if (S.phase === 'day') v.dayLeft = g.dayEnd ? Math.max(0, g.dayEnd - Date.now()) : null;
    if (S.phase === 'vote') Object.assign(v, { candidates: candidates(), myVote: g.votes[p.id] || null, runoff: !!g.runoff, voted: Object.keys(g.votes).length, voters: voters().length });
    if (S.phase === 'result') v.result = { ...g.result, role: S.settings.reveal ? g.result.role : null };
    if (S.phase === 'end') v.end = { winner: g.winner, roles: g.roles, gained: g.gained || {} };
    return v;
  }
  function broadcast() { for (const [id, c] of conns) { const p = P(id); if (p && c.open) { try { c.send({ t: 'state', s: view(p) }); } catch (e) {} } } }
  function update() { save(); broadcast(); render(); }

  // ---------------- regole ----------------
  const online = () => S.players.filter(p => p.online);
  const canStart = () => online().length < MINP ? `Servono almeno ${MINP} giocatori collegati` : '';
  function deal(ids) {
    const n = ids.length, s = S.settings;
    let w = s.autoWolves ? autoWolves(n) : Math.min(s.wolves, maxWolves(n));
    const specials = [s.seer && 'veggente', s.healer && 'guaritore', s.hunter && 'cacciatore'].filter(Boolean);
    while (w + specials.length > n - 1 && specials.length) specials.pop();   // serve almeno un abitante semplice
    const deck = [...Array(w).fill('lupo'), ...specials]; while (deck.length < n) deck.push('abitante');
    const sh = shuffle(deck), roles = {}; ids.forEach((id, i) => roles[id] = sh[i]); return roles;
  }
  function startGame() {
    if (canStart()) return toast(canStart());
    clearTimers(); sheet = null;
    S.players.forEach(p => p.waiting = false);
    const ids = online().map(p => p.id);
    S.n++;
    S.game = { ids, roles: deal(ids), alive: Object.fromEntries(ids.map(id => [id, true])), seen: {}, night: 0, day: 0,
      act: null, visions: [], lastHeal: null, dawn: null, hunter: null, votes: {}, runoff: null, result: null, deaths: [], winner: null, dayEnd: null, after: null };
    S.phase = 'roles'; S.flash = null;
    narrate('Benvenuti nel villaggio. Guardate il telefono e scoprite chi siete. In silenzio.');
    update();
  }
  function checkRoles() {
    if (S.phase !== 'roles') return; const g = G();
    const need = g.ids.filter(id => P(id) && P(id).online);
    if (need.length && need.every(id => g.seen[id])) { clearTimeout(nightT); nightT = setTimeout(() => { if (S.phase === 'roles') startNight(); }, 1800); render(); }
  }
  function startNight() {
    const g = G(); clearTimers();
    g.night++; g.act = { wolf: {}, seer: null, heal: null, done: {} };
    S.phase = 'night';
    narrate(g.night === 1 ? 'Cala la notte sul villaggio. Tutti prendono il telefono e fanno la loro scelta. I lupi si svegliano.' : 'Cala di nuovo la notte. Il villaggio dorme, i lupi no.');
    update();
  }
  const wolfTask = () => !(G().night === 1 && !S.settings.firstKill);
  function wolfTarget() {
    const picks = aliveRole('lupo').map(id => G().act.wolf[id]).filter(Boolean);
    if (!picks.length) return null;
    const c = {}; picks.forEach(t => c[t] = (c[t] || 0) + 1);
    const top = Math.max(...Object.values(c)), best = Object.keys(c).filter(t => c[t] === top);
    return best[Math.floor(Math.random() * best.length)];
  }
  function nightAction(pid, d) {
    const g = G(), a = g.act, r = role(pid), t = d.target;
    if (a.done[pid] && r !== 'lupo') return;
    const okT = t && g.alive[t];
    if (r === 'lupo') {
      if (!wolfTask()) { a.done[pid] = true; }
      else if (d.pick !== undefined) { if (okT && !isWolf(t)) a.wolf[pid] = t; else delete a.wolf[pid]; a.done[pid] = false; }
      else if (d.ok && a.wolf[pid]) a.done[pid] = true;
    } else if (r === 'veggente') {
      if (!a.seer && okT && t !== pid) { a.seer = t; g.visions.push({ by: pid, target: t, wolf: isWolf(t), night: g.night }); }
      else if (d.ok && a.seer) a.done[pid] = true;
    } else if (r === 'guaritore') {
      if (okT && t !== g.lastHeal) { a.heal = t; a.done[pid] = true; }
    } else { if (okT || d.ok) a.done[pid] = true; }
    update(); checkNight();
  }
  function nightNeeds() { const g = G(); return alive().filter(id => P(id) && P(id).online); }
  function checkNight() {
    if (S.phase !== 'night') return; const g = G();
    // i lupi devono essere d'accordo: tutti confermati sulla stessa persona
    const wolves = aliveRole('lupo').filter(id => P(id) && P(id).online);
    const wolfOk = !wolfTask() || !wolves.length || (wolves.every(id => g.act.done[id]) && new Set(wolves.map(id => g.act.wolf[id])).size === 1);
    if (nightNeeds().every(id => isWolf(id) ? wolfOk : g.act.done[id])) { clearTimeout(nightT); nightT = setTimeout(() => { if (S.phase === 'night') endNight(); }, 1600); }
  }
  function kill(id, cause) { const g = G(); if (!g.alive[id]) return; g.alive[id] = false; g.deaths.push({ id, name: P(id) ? P(id).name : '?', cause, day: g.day, night: g.night, role: g.roles[id] }); }
  function endNight() {
    const g = G(), a = g.act; clearTimers();
    const victim = wolfTask() ? wolfTarget() : null, saved = !!(victim && a.heal === victim);
    g.lastHeal = a.heal || null;
    g.day++;
    if (victim && !saved) kill(victim, 'lupi');
    g.dawn = { victim: victim && !saved ? victim : null, saved, role: victim && !saved ? g.roles[victim] : null, quiet: !wolfTask() };
    S.phase = 'dawn';
    const v = g.dawn.victim && P(g.dawn.victim);
    narrate(v ? `Sorge il sole. Stanotte i lupi hanno colpito. ${v.name} non c’è più.` : g.dawn.quiet ? 'Sorge il sole. La prima notte è passata tranquilla: i lupi si sono solo riconosciuti.' : 'Sorge il sole. Stanotte nessuno è morto.');
    update();
  }
  function afterDeath(next) {   // se è morto il cacciatore, prima spara
    const g = G(), h = g.deaths.slice().reverse().find(x => x.role === 'cacciatore' && !x.shot && x.cause !== 'uscito');
    if (h && !g.hunterDone?.[h.id] && alive().length > 1) { h.shot = true; g.hunter = { id: h.id, target: null }; g.after = next; S.phase = 'hunter'; narrate(`${P(h.id) ? P(h.id).name : 'Il cacciatore'} era il cacciatore. Ha ancora una freccia.`); return update(); }
    if (winner()) return finish(winner());
    next === 'night' ? startNight() : startDay();
  }
  function hunterShot() {
    const g = G(), t = g.hunter.target; if (!t) return;
    kill(t, 'cacciatore'); g.hunter.done = true;
    narrate(`La freccia colpisce ${P(t) ? P(t).name : ''}.`);
    S.phase = 'shot'; update();
  }
  function startDay() {
    const g = G(); clearTimers(); g.votes = {}; g.runoff = null;
    g.dayEnd = S.settings.dayTime ? Date.now() + S.settings.dayTime * 1000 : null;
    S.phase = 'day'; narrate(`Giorno ${g.day}. Discutete: chi di voi è un lupo?`); update();
  }
  const candidates = () => G().runoff ? G().runoff.filter(id => G().alive[id]) : alive();
  const voters = () => alive().filter(id => P(id) && P(id).online);
  function startVote(runoff) { const g = G(); g.votes = {}; g.runoff = runoff || null; g.dayEnd = null; S.phase = 'vote'; narrate(runoff ? 'Pareggio. Si vota di nuovo, solo tra loro.' : 'Il villaggio vota.'); update(); }
  let voteT = null;
  function checkVotes() {
    if (S.phase !== 'vote') return; const g = G(), need = voters();
    if (need.length && need.every(id => g.votes[id])) { clearTimeout(voteT); voteT = setTimeout(() => { if (S.phase === 'vote' && voters().every(id => G().votes[id])) tally(); }, 1500); }
  }
  function tally() {
    const g = G(); clearTimeout(voteT);
    const counts = {}; candidates().forEach(id => counts[id] = 0);
    Object.values(g.votes).forEach(t => { if (t in counts) counts[t]++; });
    const top = Math.max(0, ...Object.values(counts)), tied = Object.keys(counts).filter(id => counts[id] === top && top > 0);
    if (tied.length > 1 && !g.runoff) return startVote(tied);
    const elim = tied.length === 1 ? tied[0] : null;
    if (elim) kill(elim, 'voto');
    g.result = { counts, elim, role: elim ? g.roles[elim] : null, tie: !elim, votes: { ...g.votes } };
    g.runoff = null; S.phase = 'result';
    const e = elim && P(elim);
    narrate(e ? (S.settings.reveal ? `Il villaggio ha deciso: ${e.name} viene cacciato. Era ${ROLES[g.roles[elim]].t === 'Abitante' ? 'un abitante' : ROLES[g.roles[elim]].t === 'Lupo' ? 'un lupo' : 'il ' + ROLES[g.roles[elim]].t.toLowerCase()}.` : `Il villaggio ha deciso: ${e.name} viene cacciato.`) : 'Nessuna decisione. Nessuno viene cacciato.');
    update();
  }
  function winner() {
    const g = G(); if (!g) return null;
    const w = aliveRole('lupo').length, o = alive().length - w;
    if (w === 0) return 'villaggio';
    if (w >= o) return 'lupi';
    return null;
  }
  function finish(win) {
    const g = G(); clearTimers(); g.winner = win; g.gained = {};
    g.ids.forEach(id => { const p = P(id); if (!p) return; const team = ROLES[g.roles[id]].team, pts = team === win ? 1 : 0; p.score += pts; g.gained[id] = pts; });
    S.phase = 'end';
    narrate(win === 'lupi' ? 'I lupi hanno preso il villaggio.' : 'L’ultimo lupo è stato scacciato. Il villaggio è salvo.');
    update();
  }
  function toLobby(msg) { clearTimers(); S.phase = 'lobby'; S.game = null; S.players.forEach(p => p.waiting = false); if (msg) flash(msg); update(); }
  function closeRoom() {
    for (const [, c] of conns) { if (!c.local) { try { c.send({ t: 'closed' }); } catch (e) {} } }
    store.del(KEY); store.del(PKEY);
    setTimeout(() => { try { peer && peer.destroy(); } catch (e) {} location.href = './'; }, 400);
  }
  function clearTimers() { clearTimeout(nightT); clearTimeout(voteT); }

  setInterval(() => {
    if (!S || S.phase !== 'day' || !G().dayEnd) return;
    const left = G().dayEnd - Date.now();
    if (left <= 0) return startVote();
    const el = $('#tbar'); if (el) el.style.transform = `scaleX(${Math.max(0, left / (S.settings.dayTime * 1000))})`;
    const t = $('#tleft'); if (t) t.textContent = fmt(left);
  }, 250);
  const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // ---------------- l'host gioca anche lui ----------------
  function addLocal(p) {
    const id = FT.profile.load().id; let pl = P(id);
    if (!pl) { pl = { id, name: cleanName(p.name, id), icon: p.icon, color: freeColor(), photo: 0, score: 0, waiting: S.phase !== 'lobby', local: true }; S.players.push(pl); }
    else { pl.name = cleanName(p.name, id); pl.icon = p.icon; pl.local = true; }
    pl.online = true; S.localId = id; setPhoto(pl, p.photo); attachLocal(); update();
  }
  function attachLocal() {
    if (!S.localId || !P(S.localId)) return;
    const host = document.createElement('div');
    localUI = FT.PlayerUI(host, { header: false, send: m => onData(localConn, m), onExit: () => {}, onProfile: p => FT.profile.save({ ...FT.profile.load(), ...p }) });
    const localConn = { local: true, open: true, _pid: S.localId, send: m => { localUI && localUI.receive(m); if (tab === 'me') mountLocal(); }, close() {} };
    conns.set(S.localId, localConn); P(S.localId).online = true;
  }
  function mountLocal() { const slot = $('#meslot'); if (slot && localUI && localUI.el.parentNode !== slot) { slot.innerHTML = ''; slot.appendChild(localUI.el); } }

  // ---------------- interfaccia ----------------
  const icon = {
    full: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    voice: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9Z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12"/></svg>'
  };
  const status = () => `<span class="status ${peerState}"><i></i>${peerState === 'on' ? 'In onda' : peerState === 'off' ? 'Riconnessione…' : peerState === 'busy' ? 'Riapro la stanza…' : 'Apro la stanza…'}</span>`;
  const card = (p, extra = '', opt = {}) => `<div class="suspect ${p.online === false ? 'off' : ''}" ${opt.act ? `data-a="${opt.act}" data-id="${p.id}" role="button" tabindex="0"` : ''}>
      <div class="avw">${avatar(p, opt.av || {})}${extra}</div><p class="nm">${esc(p.name)}</p>${opt.under || ''}</div>`;
  const rtag = r => r ? `<span class="roletag" style="color:${ROLES[r].c}">${roleIcon(r, 14)}${esc(ROLES[r].t)}</span>` : '';
  const causeTxt = { lupi: 'sbranato dai lupi', voto: 'cacciato dal villaggio', cacciatore: 'colpito dal cacciatore', uscito: 'ha lasciato' };
  const graveyard = () => {
    const d = deathsPublic(); if (!d.length) return '';
    return `<div class="outstrip"><span class="mono dim">CIMITERO</span>${d.map(x => `<span class="outp"><span class="avw">${avatar(P(x.id) || { name: x.name, icon: 'maschera', color: '#555' }, { dead: true })}</span><span><b>${esc(x.name)}</b><i>${esc(causeTxt[x.cause])}${x.role ? ' · ' + esc(ROLES[x.role].t) : ''}</i></span></span>`).join('')}</div>`;
  };
  const summary = () => {
    const s = S.settings, pr = PRESETS.find(p => p.id === presetOn(s)), n = Math.max(MINP, online().length);
    return [pr ? 'Combo · ' + pr.t : '', s.autoWolves ? `Lupi: ${autoWolves(n)} (auto)` : `${s.wolves} lup${s.wolves > 1 ? 'i' : 'o'}`, s.seer ? 'Veggente' : '', s.healer ? 'Guaritore' : '', s.hunter ? 'Cacciatore' : '',
      s.reveal ? 'Ruoli svelati' : 'Ruoli nascosti', s.dayTime ? `${s.dayTime / 60} min di giorno` : ''].filter(Boolean).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  };

  function render() {
    if (!S) return;
    const g = G();
    const tabs = S.localId ? `<div class="seg tabs" role="tablist"><button role="tab" data-a="tab" data-v="table" aria-selected="${tab === 'table'}" class="${tab === 'table' ? 'on' : ''}">Villaggio</button><button role="tab" data-a="tab" data-v="me" aria-selected="${tab === 'me'}" class="${tab === 'me' ? 'on' : ''}">Il mio ruolo</button></div>` : '';
    const top = `<header class="h-top">${logo()}<div class="h-tools">${tabs}<span class="chip roomcode">STANZA ${S.code}</span>${status()}
      <button class="iconbtn voicebtn ${S.settings.voice ? '' : 'off'}" data-a="voice" aria-pressed="${S.settings.voice}" aria-label="Voce del narratore" title="Voce del narratore">${icon.voice}</button>
      <button class="iconbtn" data-a="full" aria-label="Schermo intero" title="Schermo intero">${icon.full}</button>
      <button class="iconbtn" data-a="quit" aria-label="${S.phase === 'lobby' ? 'Chiudi la stanza' : 'Termina la partita'}" title="${S.phase === 'lobby' ? 'Chiudi la stanza' : 'Termina la partita'}">${icon.x}</button></div></header>`;
    const fl = S.flash && S.flash.until > Date.now() ? `<div class="flash" role="status">${esc(S.flash.text)}</div>` : '';
    let h = '';
    const needOn = ids => ids.filter(id => P(id) && P(id).online);
    if (tab === 'me' && S.localId) h = `<div class="mewrap"><div id="meslot"></div><p class="mono dim center small">Questa schermata è privata: non mostrarla agli altri.</p></div>`;
    else if (S.phase === 'lobby') h = lobby();
    else if (S.phase === 'roles') {
      const all = needOn(g.ids).every(id => g.seen[id]);
      h = `<section class="stage"><div class="night-sky"></div><p class="kicker gold">Partita ${S.n} · ${g.ids.length} abitanti · ${g.ids.filter(isWolf).length} lup${g.ids.filter(isWolf).length > 1 ? 'i' : 'o'} tra voi</p>
        <h1 class="big">${all ? 'Tutti pronti' : 'Chi sei davvero?'}</h1><p class="sub">${all ? 'Sta per calare la notte.' : 'Tieni premuta la carta sul telefono per scoprire il tuo ruolo. Non mostrarla a nessuno.'}</p>
        <div class="grid">${g.ids.filter(P).map(id => card(P(id), '', { under: `<p class="tag ${g.seen[id] ? 'ok' : ''}">${g.seen[id] ? 'LETTO' : 'IN ATTESA'}</p>` })).join('')}</div></section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn ghost" data-a="lobby">Annulla</button><button class="btn primary" data-a="night">Cala la notte</button></div></footer>`;
    } else if (S.phase === 'night') {
      const need = needOn(alive()), done = need.filter(id => g.act.done[id] || (isWolf(id) && g.act.done[id])).length;
      h = `<section class="stage"><div class="night-sky"></div><div class="forest"></div><div class="moon wane"></div>
        <p class="kicker gold">Notte ${g.night}</p><h1 class="big">Il villaggio dorme</h1>
        <p class="sub">Ognuno fa la sua scelta sul telefono, in silenzio. Coprite lo schermo.</p>
        <div class="progress-dots" aria-label="${done} su ${need.length}">${need.map((id, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}</div>
        <p class="mono dim">${done}/${need.length} hanno scelto</p></section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn ghost" data-a="dawn">Fai sorgere il sole</button></div></footer>`;
    } else if (S.phase === 'dawn') {
      const d = g.dawn, v = d.victim && P(d.victim);
      h = `<section class="stage day-bg">${v ? '' : '<div class="moon"></div>'}<p class="kicker gold">Alba del giorno ${g.day}</p>
        ${v ? `<div class="avxl enter">${avatar(v, { dead: true })}</div><h1 class="big rise">${esc(v.name)} non c’è più</h1><p class="sub">Sbranato dai lupi durante la notte.</p>${d.role && S.settings.reveal ? `<p class="stampbig late" style="color:${ROLES[d.role].c}">${esc(ROLES[d.role].t)}</p>` : ''}`
          : `<h1 class="big rise">${d.quiet ? 'Notte tranquilla' : 'Nessun morto'}</h1><p class="sub">${d.quiet ? 'I lupi si sono solo riconosciuti. Da domani si fa sul serio.' : d.saved ? 'I lupi hanno attaccato, ma qualcuno è stato protetto.' : 'Stanotte i lupi non hanno colpito.'}</p>`}
        ${graveyard()}</section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn primary" data-a="afterdawn">Continua</button></div></footer>`;
    } else if (S.phase === 'hunter' || S.phase === 'shot') {
      const hu = P(g.hunter.id), t = g.hunter.target && P(g.hunter.target);
      h = `<section class="stage"><p class="kicker gold">L’ultima freccia</p><div class="avxl">${avatar(hu || { name: '?', icon: 'maschera' }, { dead: true })}</div>
        <h1 class="big">${t ? `${esc(hu ? hu.name : 'Il cacciatore')} colpisce ${esc(t.name)}` : `${esc(hu ? hu.name : 'Il cacciatore')} prende la mira`}</h1>
        ${t ? (S.settings.reveal ? `<p class="stampbig late" style="color:${ROLES[g.roles[t.id]].c}">${esc(ROLES[g.roles[t.id]].t)}</p>` : '') : '<p class="sub">Il cacciatore sceglie dal suo telefono chi portare con sé.</p>'}</section>
        <footer class="h-bar"><div></div><div class="acts">${t ? '<button class="btn primary" data-a="aftershot">Continua</button>' : '<button class="btn ghost" data-a="skipshot">Salta</button>'}</div></footer>`;
    } else if (S.phase === 'day') {
      h = `<section class="stage day-bg"><p class="kicker gold">Giorno ${g.day} · ${alive().length} vivi</p><h1 class="big">Chi è il lupo?</h1>
        ${g.dayEnd ? `<p class="count" id="tleft">${fmt(g.dayEnd - Date.now())}</p><div class="tbar"><i id="tbar"></i></div>` : '<p class="sub">Discutete ad alta voce. Quando siete pronti, si vota.</p>'}
        <div class="grid">${alive().filter(P).map(id => card(P(id))).join('')}</div>${graveyard()}</section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn primary" data-a="vote">Si vota</button></div></footer>`;
    } else if (S.phase === 'vote') {
      const cand = candidates(), need = voters(), done = need.filter(id => g.votes[id]).length;
      h = `<section class="stage"><p class="kicker red">${g.runoff ? 'Pareggio · ballottaggio' : 'Votazione aperta'}</p><h1 class="big">Chi cacciamo?</h1>
        <p class="sub">Votate dal telefono e confermate. Si può cambiare idea finché il voto è aperto.</p>
        <div class="grid">${cand.map(id => card(P(id))).join('')}</div>
        <div class="voters"><span class="mono">${done}/${need.length} VOTI</span>${need.map(id => `<span class="dot ${g.votes[id] ? 'on' : ''}" title="${esc(P(id).name)}"></span>`).join('')}</div>${graveyard()}</section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn danger" data-a="tally">Chiudi votazione</button></div></footer>`;
    } else if (S.phase === 'result') {
      const r = g.result, e = r.elim && P(r.elim);
      const by = id => Object.keys(r.votes).filter(v => r.votes[v] === id && P(v)).map(v => `<span class="vby" title="${esc(P(v).name)}">${avatar(P(v))}</span>`).join('');
      h = `<section class="stage"><div class="grid">${Object.keys(r.counts).filter(P).map(id => card(P(id), `<span class="votes">${r.counts[id]}</span>`, { av: { dead: id === r.elim }, under: `<div class="vbys">${by(id)}</div>` })).join('')}</div>
        ${e ? `<h1 class="big rise">${esc(e.name)} viene cacciato</h1>${S.settings.reveal ? `<p class="stampbig late" style="color:${ROLES[r.role].c}">${r.role === 'lupo' ? 'ERA UN LUPO' : 'ERA ' + esc(ROLES[r.role].t)}</p>` : ''}`
          : '<h1 class="big rise">Nessuna decisione</h1><p class="sub">Il villaggio non si mette d’accordo: nessuno viene cacciato.</p>'}</section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn primary" data-a="afterresult">Continua</button></div></footer>`;
    } else if (S.phase === 'end') {
      const v = g.winner === 'villaggio';
      h = `<section class="stage ${v ? 'day-bg' : ''}">${v ? '<div class="moon"></div>' : '<div class="night-sky"></div><div class="forest"></div>'}
        <p class="kicker ${v ? 'gold' : 'red'}">Fine della partita</p><h1 class="big">${v ? 'Vince il villaggio' : 'Vincono i lupi'}</h1>
        <div class="grid">${g.ids.filter(P).map(id => card(P(id), '', { av: { dead: !g.alive[id] }, under: `${rtag(g.roles[id])}<p class="mono dim small">+${g.gained[id] || 0} · ${P(id).score} pt</p>` })).join('')}</div></section>
        <footer class="h-bar"><div></div><div class="acts"><button class="btn ghost" data-a="lobby">Sala d’attesa</button><button class="btn primary" data-a="start">Nuova partita</button></div></footer>`;
    }
    root.innerHTML = top + fl + `<div class="h-body">${h}</div>` + renderSheet();
    if (tab === 'me') mountLocal();
    if (S.phase === 'lobby' && tab === 'table') drawQR();
    if (sheet === 'join') mountJoinForm();
    if (sheet && sheet.edit) mountEdit();
  }

  function lobby() {
    const err = canStart(), ps = S.players, scored = ps.some(p => p.score > 0);
    return `<section class="lobby">
      <div class="joincard"><p class="kicker">Inquadra per entrare</p><div class="qr" id="qr"></div>
        <p class="kicker">oppure apri <b>${esc(homeUrl())}</b> e scrivi</p><p class="code">${S.code}</p></div>
      <div class="roster"><div class="roster-h"><h2>Abitanti <span class="mono dim">${ps.length}/${MAXP}</span></h2>
        ${S.localId ? '' : '<button class="btn ghost sm" data-a="joinme">+ Gioco anch’io</button>'}</div>
        ${ps.length ? `<div class="grid left">${ps.map(p => card(p, p.local ? '<span class="you">TU</span>' : '', { act: 'edit', under: scored ? `<p class="mono dim small">${p.score} pt</p>` : '' })).join('')}</div>
          <p class="mono dim small">Tocca un abitante per rinominarlo, cambiargli il simbolo o toglierlo.</p>`
          : `<div class="empty"><p>Il villaggio è vuoto.</p><p class="dim">Inquadrate il QR con il telefono: servono almeno ${MINP} giocatori, meglio 6 o più.</p></div>`}
        <ol class="howto"><li><b>Di notte</b><span>Ognuno sceglie sul telefono. I lupi cacciano, la veggente indaga, il guaritore protegge.</span></li>
          <li><b>All’alba</b><span>Il narratore svela chi non c’è più.</span></li>
          <li><b>Di giorno</b><span>Discutete e votate chi cacciare. Vince chi resta.</span></li></ol></div></section>
      <footer class="h-bar"><div class="chips">${summary()}</div><div class="acts">
        <button class="btn ghost" data-a="settings">${icon.gear} Impostazioni</button>
        <button class="btn primary" data-a="start" ${err ? 'disabled' : ''} title="${esc(err)}">Inizia</button></div></footer>`;
  }

  function renderSheet() {
    if (!sheet) return '';
    let inner = '';
    if (sheet === 'settings') inner = settingsPanel();
    else if (sheet === 'quit') inner = `<header><h3>${S.phase === 'lobby' ? 'Chiudi la stanza' : 'Termina la partita'}</h3><button class="btn ghost sm" data-a="close">Annulla</button></header><div class="body quit">
      ${S.phase !== 'lobby' ? '<button class="opt" data-a="abort"><b>Interrompi la partita</b><span>Si torna nella sala d’attesa con gli stessi giocatori. Questa partita non dà punti.</span></button>' : ''}
      <button class="opt danger" data-a="closeroom"><b>Chiudi la stanza</b><span>Tutti escono, punti e giocatori si cancellano. Poi puoi aprire una stanza nuova.</span></button></div>`;
    else if (sheet === 'join') inner = `<header><h3>Gioco anch’io</h3><button class="btn ghost sm" data-a="close">Chiudi</button></header><div class="body"><p class="dim">Entri da questo dispositivo. Di notte passa alla scheda «Il mio ruolo» e copri lo schermo: gli altri non devono vedere.</p><div id="joinform"></div></div>`;
    else if (sheet.edit) inner = `<header><h3>Abitante</h3><button class="btn ghost sm" data-a="close">Chiudi</button></header><div class="body" id="editbody"></div>`;
    return `<div class="scrim" data-a="close"></div><aside class="sheet" role="dialog" aria-modal="true">${inner}</aside>`;
  }
  function mountJoinForm() { const el = $('#joinform'); if (!el || el.dataset.on) return; el.dataset.on = 1; FT.ProfileForm(el, { profile: FT.profile.load(), color: freeColor(), saveLabel: 'Entra nel villaggio', onSave: p => { FT.profile.save({ ...FT.profile.load(), ...p }); sheet = null; addLocal(p); } }); }
  function mountEdit() {
    const el = $('#editbody'), p = P(sheet.edit); if (!el) return; if (!p) { sheet = null; return render(); }
    el.innerHTML = `<div class="pf-head"><div class="pf-av">${avatar(p)}</div><div><p class="word sm">${esc(p.name)}</p><p class="mono dim small">${p.online ? 'collegato' : 'non collegato'}${p.local ? ' · questo dispositivo' : ''}</p></div></div>
      <div class="field"><label for="ed-name">Nome</label><div class="row2"><input id="ed-name" maxlength="16" value="${esc(p.name)}"><button class="btn ghost" data-a="ed-name">Rinomina</button></div></div>
      ${p.photo ? '<div class="field"><span class="lbl">Foto</span><button class="btn ghost" data-a="ed-nophoto">Togli la foto</button></div>' : ''}
      <div class="field"><span class="lbl">Simbolo</span><div class="icons">${ICON_KEYS.map(k => `<button class="ic ${p.icon === k ? 'on' : ''}" data-a="ed-icon" data-k="${k}" aria-label="${k}">${glyph(k, p.icon === k ? '#0A0F1F' : '#F3EBDD', 22)}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Colore</span><div class="icons">${FT.COLORS.map(c => `<button class="ic sw ${p.color === c ? 'on' : ''}" data-a="ed-color" data-c="${c}" style="--c:${c}" aria-label="colore ${c}"></button>`).join('')}</div></div>
      <button class="btn danger wide" data-a="ed-remove">Togli dalla ${S.phase === 'lobby' ? 'stanza' : 'partita'}</button>`;
  }
  function settingsPanel() {
    const s = S.settings, n = Math.max(MINP, online().length);
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-a="set" data-k="${key}" data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const sw = (key, label) => `<button class="switch ${s[key] ? 'on' : ''}" data-a="toggle" data-k="${key}" aria-pressed="${!!s[key]}"><i></i>${label}</button>`;
    const rolesw = (key, r) => `<button class="switch ${s[key] ? 'on' : ''}" data-a="toggle" data-k="${key}" aria-pressed="${!!s[key]}"><i></i><span>${roleIcon(r, 18)} <b>${ROLES[r].t}</b> <span class="dim">· ${esc(ROLES[r].uk)}</span></span></button>`;
    return `<header><h3>Impostazioni</h3><button class="btn primary sm" data-a="close">Fatto</button></header><div class="body">
      <div class="sec"><h4>Combo pronte</h4><p class="h">Un tocco e cambiano ruoli e regole insieme. Poi puoi ritoccare tutto qui sotto.</p>
        <div class="opts presets">${PRESETS.map(p => `<button class="opt ${presetOn(s) === p.id ? 'on' : ''}" data-a="preset" data-id="${p.id}"><b>${p.t}</b><span>${p.d}</span></button>`).join('')}</div></div>
      <div class="sec"><h4>Lupi</h4><p class="h">Con ${n} giocatori: in automatico ${autoWolves(n)}, al massimo ${maxWolves(n)}.</p>
        <div class="rowc">${sw('autoWolves', 'Numero automatico')}${s.autoWolves ? '' : `<div class="stepper"><button class="iconbtn" data-a="wolves" data-d="-1" aria-label="Un lupo in meno">−</button><b>${s.wolves}</b><button class="iconbtn" data-a="wolves" data-d="1" aria-label="Un lupo in più">+</button></div>`}</div></div>
      <div class="sec col"><h4>Ruoli speciali</h4>${rolesw('seer', 'veggente')}${rolesw('healer', 'guaritore')}${rolesw('hunter', 'cacciatore')}
        <p class="h">Se i giocatori sono pochi, i ruoli speciali si tolgono da soli partendo dal cacciatore: resta sempre almeno un abitante.</p></div>
      <div class="sec"><h4>Tempo per discutere di giorno</h4>${seg('dayTime', [[0, 'Libero'], [120, '2 min'], [180, '3 min'], [300, '5 min']])}</div>
      <div class="sec col"><h4>Altre regole</h4>${sw('reveal', 'Svela il ruolo di chi muore')}${sw('firstKill', 'I lupi uccidono già la prima notte')}${sw('voice', 'Voce del narratore sullo schermo')}</div>
    </div>`;
  }
  function drawQR() { const el = $('#qr'); if (!el || typeof qrcode === 'undefined') return; const q = qrcode(0, 'M'); q.addData(joinUrl()); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

  root.addEventListener('click', e => {
    if (!e.target.isConnected || e.target.closest('#meslot')) return;
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, s = S.settings, g = G();
    switch (a) {
      case 'full': if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); break;
      case 'voice': s.voice = !s.voice; FT.setVoice(s.voice); if (s.voice) say('Il narratore è con voi.'); update(); break;
      case 'tab': tab = b.dataset.v; render(); break;
      case 'settings': sheet = 'settings'; render(); break;
      case 'joinme': sheet = 'join'; render(); break;
      case 'edit': sheet = { edit: b.dataset.id }; render(); break;
      case 'close': if (sheet === 'settings') save(); sheet = null; render(); break;
      case 'quit': sheet = 'quit'; render(); break;
      case 'abort': sheet = null; toLobby('Partita interrotta dall’host'); break;
      case 'closeroom': sheet = null; closeRoom(); break;
      case 'start': startGame(); break;
      case 'lobby': toLobby(); break;
      case 'night': clearTimeout(nightT); startNight(); break;
      case 'dawn': endNight(); break;
      case 'afterdawn': afterDeath('day'); break;
      case 'skipshot': g.hunter.done = true; S.phase = 'shot'; g.hunter.target = null; afterShot(); break;
      case 'aftershot': afterShot(); break;
      case 'vote': startVote(); break;
      case 'tally': tally(); break;
      case 'afterresult': afterDeath('night'); break;
      case 'preset': { const pr = PRESETS.find(p => p.id === b.dataset.id); if (pr) { Object.assign(s, pr.v); update(); toast('Combo ' + pr.t); } break; }
      case 'wolves': { const n = Math.max(MINP, online().length); s.wolves = Math.max(1, Math.min(maxWolves(n), s.wolves + +b.dataset.d)); update(); break; }
      case 'toggle': s[b.dataset.k] = !s[b.dataset.k]; if (b.dataset.k === 'voice') FT.setVoice(s.voice); update(); break;
      case 'set': { const v = b.dataset.v; s[b.dataset.k] = isNaN(+v) ? v : +v; update(); break; }
      case 'ed-name': { const p = P(sheet.edit), v = $('#ed-name').value; if (p && v.trim()) { p.name = cleanName(v, p.id); update(); } break; }
      case 'ed-icon': { const p = P(sheet.edit); if (p) { p.icon = b.dataset.k; if (p.photo) setPhoto(p, ''); update(); } break; }
      case 'ed-nophoto': { const p = P(sheet.edit); if (p) { setPhoto(p, ''); update(); } break; }
      case 'ed-color': { const p = P(sheet.edit), other = S.players.find(x => x.color === b.dataset.c && x !== p); if (p) { if (other) other.color = p.color; p.color = b.dataset.c; update(); } break; }
      case 'ed-remove': { const id = sheet.edit; sheet = null; removePlayer(id); break; }
    }
  });
  function afterShot() { const g = G(); const next = g.after || 'day'; g.hunter = null; if (winner()) return finish(winner()); next === 'night' ? startNight() : startDay(); }
  root.addEventListener('keydown', e => { if (e.target.closest('#meslot')) return; if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.suspect[data-a]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('keydown', e => { if (!S || e.target.matches('input,textarea')) return; if (e.key === 'Escape' && sheet) { sheet = null; render(); } });
  const _render = render;
  render = function () { const a = document.activeElement; if (a && (a.id === 'ed-name' || (a.closest && a.closest('#joinform')))) return; _render(); };
  root.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches('input,textarea')) _render(); }, 50));
  window.addEventListener('beforeunload', () => { save(); try { peer && peer.destroy(); } catch (e) {} });

  function boot(st) { prepare(st); store.set('ls1-live', S.code, true); S.flash = null; if (S.localId) attachLocal(); render(); startPeer(); FT.keepAwake(); }
  const qs = new URLSearchParams(location.search);
  const pending = saved && saved.code && ((saved.players || []).length || saved.game) && Date.now() - (saved.ts || 0) < 24 * 3600e3;
  if (qs.has('nuova')) { store.del(KEY); store.del(PKEY); boot(null); }
  else if (pending && !qs.has('riprendi') && store.get('ls1-live', true) !== saved.code) {
    const ph = { lobby: 'sala d’attesa', roles: 'lettura dei ruoli', night: 'notte', dawn: 'alba', hunter: 'cacciatore', shot: 'cacciatore', day: 'giorno', vote: 'votazione', result: 'risultato', end: 'fine partita' }[saved.phase] || '';
    const ago = Math.max(1, Math.round((Date.now() - (saved.ts || Date.now())) / 60000));
    root.innerHTML = `<header class="h-top">${logo()}</header><div class="h-body"><section class="stage resume"><div class="night-sky"></div>
      <p class="kicker gold">Partita in sospeso</p><h1 class="big">Stanza ${esc(saved.code)}</h1>
      <p class="sub">${(saved.players || []).length} abitanti · ${esc(ph)}${saved.n ? ` · partita ${saved.n}` : ''} · ${ago < 60 ? ago + ' min fa' : Math.round(ago / 60) + ' ore fa'}</p>
      <div class="grid">${(saved.players || []).slice(0, 12).map(p => `<div class="suspect"><div class="avw">${avatar(p)}</div><p class="nm">${esc(p.name)}</p></div>`).join('')}</div>
      <div class="acts center"><button class="btn ghost" id="r-new">Apri una stanza nuova</button><button class="btn primary" id="r-go">Riprendi la partita</button></div>
      <p class="mono dim small">Riprendendo, i giocatori rientrano da soli con lo stesso codice.</p></section></div>`;
    $('#r-go').onclick = () => { history.replaceState(null, '', location.pathname + '?riprendi=1' + FT.phParam()); boot(saved); };
    $('#r-new').onclick = () => { store.del(KEY); store.del(PKEY); FT.photos = {}; boot(null); };
  } else boot(pending ? saved : null);
  window.__LS_HOST = { get S() { return S; } };
})();
