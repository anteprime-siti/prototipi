// MONITOR: crea la stanza, tiene lo stato della partita e lo manda ai telefoni
(() => {
  const $ = s => document.querySelector(s);
  const { esc, avatar, logo, store, shuffle, norm } = FT;
  const app = $('#app');
  const PACKS = window.FT_PACKS;
  const MAXP = 20;

  const DEF = { cats: ['cibo', 'luoghi', 'animali', 'oggetti', 'colori', 'film'], impostors: 1, randomImp: false,
    impMode: 'category', showCat: false, clueRounds: 2, turnTime: 0, revealOnce: true, lastChance: true,
    endMode: 'survival', custom: '' };

  const genCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

  let S;
  try { S = JSON.parse(store.get('ft-host', true) || 'null'); } catch (e) { S = null; }
  if (!S || !S.code) S = { code: genCode(), phase: 'lobby', players: [], settings: { ...DEF }, game: null, recent: [], n: 0 };
  S.settings = { ...DEF, ...S.settings };
  S.players.forEach(p => p.online = false);

  const conns = new Map();
  let peer = null, peerState = 'connecting', idRetries = 0, panelOpen = false, voteTimer = null, seenTimer = null;

  const save = () => store.set('ft-host', JSON.stringify(S), true);
  const P = id => S.players.find(p => p.id === id);
  const G = () => S.game;
  const inGame = p => G() && G().ids.includes(p.id);
  const alive = () => G() ? G().ids.filter(id => G().alive[id]) : [];
  const isImp = id => G() && G().imps.includes(id);
  const joinUrl = () => {
    const u = new URL('gioca.html', location.href);
    u.search = '';
    u.searchParams.set('r', S.code);
    const ph = new URLSearchParams(location.search).get('ph');
    if (ph) u.searchParams.set('ph', ph);
    return u.toString();
  };

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
        peer.destroy();
        if (idRetries++ < 2) setTimeout(startPeer, 4000);
        else { S.code = genCode(); save(); idRetries = 0; startPeer(); }
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
        peerState = 'off'; render();
        setTimeout(() => { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); }, 3000);
      }
    });
  }

  function uniqueName(name, id) {
    let base = (name || 'Giocatore').trim().replace(/\s+/g, ' ').slice(0, 16) || 'Giocatore', n = base, i = 2;
    while (S.players.some(p => p.id !== id && p.name.toLowerCase() === n.toLowerCase())) n = base.slice(0, 13) + ' ' + i++;
    return n;
  }
  function nextLook() {
    const used = new Set(S.players.map(p => p.color));
    const color = FT.COLORS.find(c => !used.has(c)) || FT.COLORS[S.players.length % FT.COLORS.length];
    const shape = FT.SHAPES[S.players.length % FT.SHAPES.length];
    return { color, shape };
  }

  function onData(c, d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'hello') {
      if (typeof d.id !== 'string' || d.id.length > 40) return;
      let p = P(d.id);
      if (!p) {
        if (S.players.length >= MAXP) { c.send({ t: 'full' }); return; }
        p = { id: d.id, name: uniqueName(d.name, d.id), ...nextLook(), score: 0, waiting: S.phase !== 'lobby' };
        S.players.push(p);
      } else if (S.phase === 'lobby' && d.name) p.name = uniqueName(d.name, p.id);
      const old = conns.get(p.id);
      if (old && old !== c) { try { old.close(); } catch (e) {} }
      conns.set(p.id, c); c._pid = p.id; p.online = true;
      return update();
    }
    const pid = c._pid, p = pid && P(pid), g = G();
    if (!p) return;
    if (d.t === 'seen' && g && S.phase !== 'lobby') {
      if (!g.seen[pid]) { g.seen[pid] = true; update(); checkAllSeen(); }
    } else if (d.t === 'vote' && S.phase === 'vote' && g.alive[pid] && inGame(p)) {
      const cand = candidates();
      if (cand.includes(d.target) && d.target !== pid) { g.votes[pid] = d.target; update(); checkAllVoted(); }
    } else if (d.t === 'guess' && S.phase === 'guess' && pid === g.guesser && !g.guessText) {
      g.guessText = String(d.text || '').slice(0, 40); update();
    } else if (d.t === 'leave' && S.phase === 'lobby') {
      removePlayer(pid);
    }
  }
  function onClose(c) {
    const pid = c._pid;
    if (pid && conns.get(pid) === c) { conns.delete(pid); const p = P(pid); if (p) p.online = false; update(); checkAllSeen(); checkAllVoted(); }
  }
  function removePlayer(id) {
    const c = conns.get(id);
    if (c) { try { c.send({ t: 'kicked' }); setTimeout(() => c.close(), 300); } catch (e) {} conns.delete(id); }
    S.players = S.players.filter(p => p.id !== id);
    update();
  }

  // ---------------- vista per ogni telefono ----------------
  function view(p) {
    const g = G();
    const v = {
      phase: S.phase, code: S.code, n: S.n,
      me: { id: p.id, name: p.name, color: p.color, shape: p.shape, score: p.score, waiting: !!p.waiting || (g && !inGame(p) && S.phase !== 'lobby'), alive: g ? !!g.alive[p.id] : true },
      players: S.players.map(pl => ({ id: pl.id, name: pl.name, color: pl.color, shape: pl.shape, online: !!pl.online, score: pl.score, alive: g ? !!g.alive[pl.id] : true, inGame: g ? g.ids.includes(pl.id) : false })),
      revealOnce: S.settings.revealOnce
    };
    if (!g || S.phase === 'lobby') return v;
    v.order = g.order; v.turnIdx = g.turnIdx; v.round = g.round; v.clueRounds = S.settings.clueRounds;
    v.speaker = S.phase === 'clues' ? g.order[g.turnIdx] : null;
    v.timerLeft = S.phase === 'clues' && g.turnEnd ? Math.max(0, g.turnEnd - Date.now()) : null;
    v.cat = S.settings.showCat ? g.cat : null;
    v.seen = !!g.seen[p.id];
    if (S.phase === 'vote') { v.candidates = candidates(); v.myVote = g.votes[p.id] || null; v.runoff = !!g.runoff; v.voted = Object.keys(g.votes).length; v.voters = votersNeeded().length; }
    if (S.phase === 'result' || S.phase === 'guess') v.result = g.result;
    if (S.phase === 'guess') { v.guesser = g.guesser; v.guessText = g.guessText || null; }
    if (inGame(p)) {
      const hidden = S.settings.revealOnce && g.seen[p.id] && S.phase !== 'end';
      v.secret = hidden ? { type: 'hidden' } : secretFor(p.id);
    }
    if (S.phase === 'end') {
      v.end = { winner: g.winner, stolen: !!g.stolen, word: g.word, wordColor: g.color, sim: g.sim, simColor: g.simColor, cat: g.cat,
        imps: g.imps, mode: g.mode, gained: g.gained || {} };
    }
    return v;
  }
  function secretFor(id) {
    const g = G();
    if (!isImp(id)) return { type: 'word', text: g.word, color: g.color, cat: g.cat };
    switch (g.mode) {
      case 'nothing': return { type: 'imp' };
      case 'category': return { type: 'imp', cat: g.cat };
      case 'hint': return { type: 'imp', hint: g.sim, color: g.simColor, cat: g.cat };
      default: return { type: 'word', text: g.sim, color: g.simColor, cat: g.cat };
    }
  }
  function broadcast() {
    for (const [id, c] of conns) {
      const p = P(id);
      if (!p || !c.open) continue;
      try { c.send({ t: 'state', s: view(p) }); } catch (e) {}
    }
  }
  function update() { save(); broadcast(); render(); }

  // ---------------- regole ----------------
  function wordPool() {
    const pool = [];
    PACKS.filter(pk => S.settings.cats.includes(pk.id)).forEach(pk => pk.items.forEach(it => {
      pool.push(pk.colors ? { cat: pk.name, word: it[0], color: it[1], sim: it[2], simColor: it[3] } : { cat: pk.name, word: it[0], sim: it[1] });
    }));
    const lines = S.settings.custom.split('\n').map(l => l.split(/[,;]/).map(x => x.trim()).filter(Boolean)).filter(l => l.length);
    lines.forEach((l, i) => {
      const other = lines.length > 1 ? lines[(i + 1) % lines.length][0] : '';
      pool.push({ cat: 'Le vostre parole', word: l[0], sim: l[1] || other || l[0] });
    });
    return pool;
  }
  const maxImps = n => Math.max(1, Math.floor((n - 1) / 2));
  function canStart() {
    const ready = S.players.filter(p => p.online);
    if (ready.length < 3) return 'Servono almeno 3 giocatori collegati';
    if (!wordPool().length) return 'Scegli almeno un tema nelle impostazioni';
    return '';
  }
  function startGame() {
    if (canStart()) return toast(canStart());
    clearTimers();
    const pool = wordPool();
    let fresh = pool.filter(x => !S.recent.includes(x.word));
    if (!fresh.length) { S.recent = []; fresh = pool; }
    const pick = fresh[Math.floor(Math.random() * fresh.length)];
    S.recent = [...S.recent, pick.word].slice(-60);
    S.players.forEach(p => p.waiting = false);
    const ids = S.players.filter(p => p.online).map(p => p.id);
    const max = maxImps(ids.length);
    const k = S.settings.randomImp ? 1 + Math.floor(Math.random() * max) : Math.min(S.settings.impostors, max);
    const imps = shuffle(ids).slice(0, k);
    let order = shuffle(ids);
    if (S.settings.impMode !== 'undercover') { // chi non conosce la parola non apre il giro
      const first = order.findIndex(id => !imps.includes(id));
      if (first > 0) order = order.slice(first).concat(order.slice(0, first));
    }
    S.n++;
    S.game = { ids, imps, mode: S.settings.impMode, cat: pick.cat, word: pick.word, sim: pick.sim, color: pick.color || null, simColor: pick.simColor || null,
      alive: Object.fromEntries(ids.map(id => [id, true])), seen: {}, order, turnIdx: 0, round: 1, turnEnd: null, votes: {}, runoff: null,
      result: null, guesser: null, guessText: null, winner: null, impCount: k, voteRound: 1 };
    S.phase = 'reveal';
    update();
  }
  function checkAllSeen() {
    if (S.phase !== 'reveal') return;
    const g = G();
    const need = g.ids.filter(id => P(id) && P(id).online);
    if (need.length && need.every(id => g.seen[id])) {
      clearTimeout(seenTimer);
      seenTimer = setTimeout(() => { if (S.phase === 'reveal') startClues(); }, 1800);
      render();
    }
  }
  function startClues() {
    const g = G();
    g.order = g.order.filter(id => g.alive[id]);
    g.turnIdx = 0; g.round = 1;
    S.phase = 'clues';
    setTurnTimer();
    update();
  }
  function setTurnTimer() { const g = G(); g.turnEnd = S.settings.turnTime ? Date.now() + S.settings.turnTime * 1000 : null; }
  function nextTurn() {
    const g = G();
    if (S.phase !== 'clues') return;
    g.turnIdx++;
    if (g.turnIdx >= g.order.length) {
      g.round++; g.turnIdx = 0;
      if (g.round > S.settings.clueRounds) return startVote();
    }
    setTurnTimer(); update();
  }
  function startVote(runoff) {
    const g = G();
    g.votes = {}; g.runoff = runoff || null; g.turnEnd = null;
    S.phase = 'vote'; update();
  }
  const candidates = () => G().runoff ? G().runoff.filter(id => G().alive[id]) : alive();
  const votersNeeded = () => alive().filter(id => P(id) && P(id).online);
  function checkAllVoted() {
    if (S.phase !== 'vote') return;
    const g = G(), need = votersNeeded();
    if (need.length && need.every(id => g.votes[id])) {
      clearTimeout(voteTimer);
      voteTimer = setTimeout(() => { if (S.phase === 'vote') tally(); }, 1200);
    }
  }
  function tally() {
    const g = G(); clearTimeout(voteTimer);
    const counts = {};
    candidates().forEach(id => counts[id] = 0);
    Object.values(g.votes).forEach(t => { if (t in counts) counts[t]++; });
    const top = Math.max(0, ...Object.values(counts));
    const tied = Object.keys(counts).filter(id => counts[id] === top && top > 0);
    if (tied.length > 1 && !g.runoff) { g.lastCounts = counts; return startVote(tied); }
    const elim = tied.length === 1 ? tied[0] : null;
    if (elim) g.alive[elim] = false;
    g.result = { counts, elim, wasImp: elim ? isImp(elim) : false, tie: !elim, runoff: !!g.runoff };
    g.runoff = null;
    S.phase = 'result'; update();
  }
  function afterResult() {
    const g = G(), r = g.result;
    if (r.elim && r.wasImp && S.settings.lastChance && g.mode !== 'undercover') {
      g.guesser = r.elim; g.guessText = null; S.phase = 'guess'; return update();
    }
    resolve();
  }
  function judgeGuess(ok) {
    const g = G();
    if (ok) { g.stolen = true; return finish('imp'); }
    resolve();
  }
  function resolve() {
    const g = G(), r = g.result;
    const aImp = alive().filter(isImp).length, aCiv = alive().filter(id => !isImp(id)).length;
    if (S.settings.endMode === 'single') return finish(r.elim && r.wasImp ? 'civ' : 'imp');
    if (aImp === 0) return finish('civ');
    if (aImp >= aCiv) return finish('imp');
    g.order = g.order.filter(id => g.alive[id]);
    g.result = null; g.guesser = null; g.guessText = null; g.voteRound++;
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
  function toLobby() { clearTimers(); S.phase = 'lobby'; S.game = null; S.players.forEach(p => p.waiting = false); S.players = S.players.filter(p => p.online || p.score > 0); update(); }
  function clearTimers() { clearTimeout(voteTimer); clearTimeout(seenTimer); }

  // timer dei turni
  setInterval(() => {
    const g = G();
    if (S.phase === 'clues' && g && g.turnEnd) {
      const left = g.turnEnd - Date.now();
      if (left <= 0) return nextTurn();
      const el = $('#tring'); if (el) drawTimer(el, left);
    }
  }, 200);

  // ---------------- interfaccia ----------------
  const plCard = (p, extra = '', opt = {}) => `
    <div class="pl ${p.online === false ? 'off' : ''} ${opt.cls || ''}">
      <div class="avw ${opt.anim ? 'pop' : ''}">${avatar(p.color, p.shape, opt.av || {})}${extra}</div>
      <div class="nm">${esc(p.name)}</div>${opt.under || ''}
    </div>`;
  const settingsSummary = () => {
    const s = S.settings;
    const imps = s.randomImp ? 'Impostori a sorpresa' : `${s.impostors} impostor${s.impostors > 1 ? 'i' : 'e'}`;
    return [imps, FT.IMP_MODES[s.impMode].t, `${s.clueRounds} gir${s.clueRounds > 1 ? 'i' : 'o'} di indizi`, s.endMode === 'single' ? 'Votazione unica' : 'Fino all’ultimo',
      `${s.cats.length + (s.custom.trim() ? 1 : 0)} temi`].map(t => `<span class="chip">${esc(t)}</span>`).join('');
  };
  const statusHtml = () => `<span class="status ${peerState}"><i></i>${peerState === 'on' ? 'Stanza aperta' : peerState === 'off' ? 'Connessione persa, riprovo…' : 'Apro la stanza…'}</span>`;
  const icon = {
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>'
  };
  const top = (extra = '') => `<div class="top">${logo()}<div class="right">${extra}${statusHtml()}
    <button class="iconbtn" data-act="full" aria-label="Schermo intero" title="Schermo intero">${icon.full}</button></div></div>`;
  const catChip = () => G() && S.settings.showCat ? `<span class="chip"><span class="d" style="background:${catColor(G().cat)}"></span>Categoria: ${esc(G().cat)}</span>` : '';
  const catColor = name => (PACKS.find(p => p.name === name) || { color: '#FFB800' }).color;
  const impLine = () => S.settings.randomImp ? 'Quanti impostori? Nessuno lo sa.' : `Tra voi ${G().impCount > 1 ? `ci sono ${G().impCount} impostori` : 'c’è un impostore'}.`;

  let lastPhase = null, lastPlayers = 0;
  function render() {
    const g = G();
    const anim = S.phase !== lastPhase;
    let h = '';
    if (S.phase === 'lobby') h = renderLobby();
    else if (S.phase === 'reveal') {
      const need = g.ids.filter(id => P(id));
      const all = need.filter(id => P(id).online).every(id => g.seen[id]);
      h = top() + `<div class="stage">
        <div class="kicker">Partita ${S.n}</div>
        <h1 class="h-title">${all ? 'Tutti pronti!' : 'Guardate il telefono'}</h1>
        <p class="h-sub">${all ? 'Si comincia…' : `Tocca la carta per scoprire la tua parola. ${S.settings.revealOnce ? 'La vedrai una volta sola: memorizzala.' : ''}`}</p>
        <div class="chips" style="justify-content:center">${catChip()}<span class="chip">${impLine()}</span></div>
        <div class="ring">${need.map(id => plCard(P(id), `<span class="badge ${g.seen[id] ? 'ok' : 'wait'}">${g.seen[id] ? '✓' : '…'}</span>`)).join('')}</div>
      </div><div class="bar"><div class="left"></div><div class="acts">
        <button class="btn" data-act="lobby">Annulla partita</button>
        <button class="btn primary big" data-act="clues">Iniziamo</button></div></div>`;
    } else if (S.phase === 'clues') {
      const sp = P(g.order[g.turnIdx]);
      h = top() + `<div class="stage">
        <div class="kicker">Giro ${g.round} di ${S.settings.clueRounds}${g.voteRound > 1 ? ` · votazione ${g.voteRound}` : ''}</div>
        <div class="speaker">
          <div class="avw ${anim || true ? 'pop' : ''}" style="position:relative">${avatar(sp.color, sp.shape)}${g.turnEnd ? '<svg class="timer" id="tring" viewBox="0 0 100 100"></svg>' : ''}</div>
          <div class="tt">Tocca a ${esc(sp.name)}</div>
          <p class="h-sub">Di’ una parola che c’entra. Ma non troppo.</p>
        </div>
        <div class="order">${g.order.map((id, i) => { const p = P(id); return `<div class="o ${i < g.turnIdx ? 'done' : i === g.turnIdx ? 'now' : ''}"><div class="avw">${avatar(p.color, p.shape)}</div><div class="nm">${esc(p.name)}</div></div>`; }).join('')}</div>
      </div><div class="bar"><div class="left">${catChip()}</div><div class="acts">
        <button class="btn" data-act="vote">Vai al voto</button>
        <button class="btn primary big" data-act="next">Avanti →</button></div></div>`;
    } else if (S.phase === 'vote') {
      const cand = candidates(), need = votersNeeded(), done = need.filter(id => g.votes[id]).length;
      h = top() + `<div class="stage">
        <div class="kicker">${g.runoff ? 'Pareggio: ballottaggio' : 'Votazione'}</div>
        <h1 class="h-title">Chi è fuori tono?</h1>
        <p class="h-sub">${g.runoff ? 'Si vota di nuovo, solo tra loro.' : 'Votate dal telefono. Potete cambiare idea finché il voto è aperto.'}</p>
        <div class="ring">${cand.map(id => plCard(P(id))).join('')}</div>
        <div class="kicker" style="margin-top:.6rem">Hanno votato ${done} su ${need.length}</div>
        <div class="ring" style="gap:.6rem">${need.map(id => `<div style="width:2.6rem;opacity:${g.votes[id] ? 1 : .3}">${avatar(P(id).color, P(id).shape)}</div>`).join('')}</div>
      </div><div class="bar"><div class="left">${catChip()}</div><div class="acts">
        <button class="btn primary big" data-act="tally">Chiudi votazione</button></div></div>`;
    } else if (S.phase === 'result') {
      const r = g.result, e = r.elim && P(r.elim);
      h = top() + `<div class="stage">
        <div class="ring">${Object.keys(r.counts).map(id => plCard(P(id), `<span class="votes">${r.counts[id]}</span>`, { av: { dead: id === r.elim } })).join('')}</div>
        ${e ? `<h1 class="h-title fadeup" style="animation-delay:.3s">${esc(e.name)} è fuori.</h1>
          <div class="verdict suspense ${r.wasImp ? 'imp' : ''}">${r.wasImp ? 'Era l’impostore!' : 'Era innocente.'}</div>`
          : `<h1 class="h-title fadeup">Pareggio!</h1><p class="h-sub">Nessuno viene eliminato.</p>`}
      </div><div class="bar"><div class="left"></div><div class="acts"><button class="btn primary big" data-act="after">Continua</button></div></div>`;
    } else if (S.phase === 'guess') {
      const e = P(g.guesser);
      const match = g.guessText && norm(g.guessText) === norm(g.word);
      h = top() + `<div class="stage">
        <div class="kicker">Ultima chance</div>
        <div style="width:9rem">${avatar(e.color, e.shape, { sus: true })}</div>
        <h1 class="h-title">${esc(e.name)} prova a indovinare la parola</h1>
        ${g.guessText ? `<div class="chips" style="gap:2rem;align-items:center;justify-content:center">
            <div><div class="kicker">Ha scritto</div><div class="wordbox card">${esc(g.guessText)}</div></div>
            <div><div class="kicker">La parola era</div><div class="wordbox card">${g.color ? `<span class="sw" style="background:${g.color}"></span>` : ''}${esc(g.word)}</div></div></div>
            <p class="h-sub">${match ? 'Sembra proprio giusta!' : 'Decidete voi: è giusta?'}</p>`
          : '<p class="h-sub">Se indovina, ruba la vittoria.</p>'}
      </div><div class="bar"><div class="left"></div><div class="acts">
        ${g.guessText ? '<button class="btn big" data-act="wrong">Sbagliata</button><button class="btn primary big" data-act="right">Giusta!</button>'
          : '<button class="btn" data-act="wrong">Salta</button>'}</div></div>`;
    } else if (S.phase === 'end') {
      const civ = g.winner === 'civ';
      h = top() + `<div class="stage">
        <div class="kicker">${g.stolen ? 'Parola indovinata!' : 'Fine partita'}</div>
        <h1 class="h-title">${civ ? 'Vincono gli innocenti!' : g.imps.length > 1 ? 'Vincono gli impostori!' : 'Vince l’impostore!'}</h1>
        <div class="chips" style="gap:1.6rem;justify-content:center;align-items:flex-end">
          <div><div class="kicker">La parola era</div><div class="wordbox card">${g.color ? `<span class="sw" style="background:${g.color}"></span>` : ''}${esc(g.word)}</div></div>
          ${g.mode === 'hint' || g.mode === 'undercover' ? `<div><div class="kicker">${g.mode === 'undercover' ? 'Gli impostori avevano' : 'Indizio impostori'}</div><div class="wordbox card">${g.simColor ? `<span class="sw" style="background:${g.simColor}"></span>` : ''}${esc(g.sim)}</div></div>` : ''}
        </div>
        <div class="roles">${g.ids.filter(P).map(id => plCard(P(id), '', { av: { sus: isImp(id), dead: !g.alive[id] && !isImp(id) }, under: `${isImp(id) ? '<span class="tag imp">IMPOSTORE</span>' : ''}<div class="sc">+${g.gained[id] || 0} · ${P(id).score} pt</div>` })).join('')}</div>
      </div><div class="bar"><div class="left"><span class="chip">${esc(g.cat)}</span></div><div class="acts">
        <button class="btn" data-act="lobby">Torna alla lobby</button>
        <button class="btn primary big" data-act="start">Nuova partita</button></div></div>`;
    }
    const ta = document.activeElement && document.activeElement.id === 'custom' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    app.innerHTML = h + (panelOpen ? renderPanel() : '');
    if (ta) { const el = $('#custom'); if (el) { el.focus(); el.setSelectionRange(ta[0], ta[1]); } }
    if (S.phase === 'end' && anim) confetti();
    if (S.phase === 'clues' && g.turnEnd) { const el = $('#tring'); if (el) drawTimer(el, g.turnEnd - Date.now()); }
    if (S.phase === 'lobby') drawQR();
    lastPhase = S.phase; lastPlayers = S.players.length;
  }

  function renderLobby() {
    const err = canStart();
    const ps = S.players;
    const scored = ps.some(p => p.score > 0);
    return top() + `<div class="lobby">
      <div class="card joincard">
        <div class="kicker">Inquadra per entrare</div>
        <div class="qr" id="qr"></div>
        <div><div class="kicker">oppure codice</div><div class="code">${S.code}</div></div>
        <div class="joinurl">${esc(joinUrl().replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</div>
      </div>
      <div class="players">
        <h2>Giocatori <span>${ps.length}/${MAXP}</span></h2>
        ${ps.length ? `<div class="pgrid">${ps.map((p, i) => plCard(p, `<button class="x" data-act="kick" data-id="${p.id}" aria-label="Rimuovi ${esc(p.name)}">×</button>`, { anim: i >= lastPlayers - 0 && lastPhase === 'lobby', under: scored ? `<div class="sc">${p.score} pt</div>` : '' })).join('')}</div>`
          : `<div class="empty">Nessuno ancora.<br>Inquadrate il QR con il telefono: servono almeno 3 giocatori.</div>`}
        <div class="howto">${[['Scopri la carta', 'Sul telefono c’è la parola segreta. Una sola persona non ce l’ha.'], ['Di’ una parola', 'A turno, ad alta voce: abbastanza per farti riconoscere, non abbastanza da svelarla.'], ['Vota', 'Chi è fuori tono? Scovate l’impostore prima che indovini.']]
          .map(([t, d], i) => `<div class="step"><b><span class="n">${i + 1}</span>${t}</b><span>${d}</span></div>`).join('')}</div>
      </div></div>
      <div class="bar"><div class="left">${settingsSummary()}</div><div class="acts">
        <button class="btn" data-act="settings">${icon.gear.replace('<svg', '<svg width="20" height="20"')} Impostazioni</button>
        <button class="btn primary big" data-act="start" ${err ? 'disabled' : ''} title="${esc(err)}">Inizia partita</button></div></div>`;
  }

  function renderPanel() {
    const s = S.settings, n = Math.max(3, S.players.filter(p => p.online).length);
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-k="${key}" data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const sw = (key, label) => `<button class="switch ${s[key] ? 'on' : ''}" data-act="toggle" data-k="${key}"><i></i>${label}</button>`;
    return `<div class="panelbg" data-act="close"></div><aside class="panel" role="dialog" aria-label="Impostazioni">
      <header><h3>Impostazioni</h3><button class="btn dark" data-act="close">Fatto</button></header>
      <div class="body">
        <div class="sec"><h4>Temi</h4><p class="h">La parola segreta esce a caso dai temi accesi.</p>
          <div class="chips">${PACKS.map(pk => `<button class="chip tog ${s.cats.includes(pk.id) ? 'on' : ''}" data-act="cat" data-id="${pk.id}"><span class="d" style="background:${pk.color}"></span>${esc(pk.name)}</button>`).join('')}</div>
          <div class="chips" style="margin-top:.7rem"><button class="chip" data-act="cats-all">Tutti</button><button class="chip" data-act="cats-none">Nessuno</button></div></div>
        <div class="sec"><h4>Le vostre parole</h4><p class="h">Una per riga. Aggiungi una virgola per la parola simile: <b>Pizza, Focaccia</b></p>
          <textarea class="custom" id="custom" placeholder="Prof Fumagalli, Relatrice">${esc(s.custom)}</textarea></div>
        <div class="sec"><h4>Impostori</h4><p class="h">Con ${n} giocatori puoi averne fino a ${maxImps(n)}.</p>
          <div style="display:flex;gap:1.6rem;align-items:center;flex-wrap:wrap">
          <div class="stepper"><button class="iconbtn" data-act="imp" data-d="-1" aria-label="Meno">−</button><b>${s.impostors}</b><button class="iconbtn" data-act="imp" data-d="1" aria-label="Più">+</button></div>
          ${sw('randomImp', 'Numero a sorpresa')}</div></div>
        <div class="sec"><h4>Cosa vede l’impostore</h4>
          <div class="opts">${Object.entries(FT.IMP_MODES).map(([k, m]) => `<button class="opt ${s.impMode === k ? 'on' : ''}" data-act="set" data-k="impMode" data-v="${k}"><b>${m.t}</b><span>${m.d}</span></button>`).join('')}</div></div>
        <div class="sec"><h4>Giri di indizi prima del voto</h4>${seg('clueRounds', [[1, '1'], [2, '2'], [3, '3']])}</div>
        <div class="sec"><h4>Tempo per ogni turno</h4>${seg('turnTime', [[0, 'Libero'], [15, '15 s'], [30, '30 s'], [45, '45 s']])}</div>
        <div class="sec"><h4>Fine partita</h4>${seg('endMode', [['survival', 'Fino all’ultimo'], ['single', 'Votazione unica']])}
          <p class="h" style="margin-top:.6rem">${s.endMode === 'single' ? 'Si vota una volta: se esce un impostore vincono gli innocenti.' : 'Si continua a votare finché gli impostori sono fuori o diventano la metà.'}</p></div>
        <div class="sec" style="display:flex;flex-direction:column;gap:1rem"><h4>Altre regole</h4>
          ${sw('revealOnce', 'La parola si vede una volta sola')}
          ${sw('showCat', 'Mostra la categoria sul monitor')}
          ${sw('lastChance', 'L’impostore scoperto può indovinare la parola')}</div>
      </div></aside>`;
  }

  function drawQR() {
    const el = $('#qr'); if (!el || typeof qrcode === 'undefined') return;
    const q = qrcode(0, 'M'); q.addData(joinUrl()); q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  function drawTimer(el, left) {
    const tot = S.settings.turnTime * 1000, f = Math.max(0, Math.min(1, left / tot)), C = 2 * Math.PI * 47;
    el.innerHTML = `<circle cx="50" cy="50" r="47" stroke="#E9DCC8"/><circle cx="50" cy="50" r="47" stroke="${f < .25 ? '#FF5B3A' : '#1D1A2B'}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 50 50)"/>`;
  }
  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = FT.COLORS[i % 9];
      c.style.borderRadius = i % 3 ? '50%' : '4px';
      c.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
      c.style.animationDelay = Math.random() * .8 + 's';
      box.appendChild(c);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 6000);
  }
  function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, s = S.settings;
    switch (a) {
      case 'full': if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); break;
      case 'settings': panelOpen = true; render(); break;
      case 'close': panelOpen = false; render(); break;
      case 'start': panelOpen = false; startGame(); break;
      case 'kick': removePlayer(b.dataset.id); break;
      case 'clues': clearTimeout(seenTimer); startClues(); break;
      case 'next': nextTurn(); break;
      case 'vote': startVote(); break;
      case 'tally': tally(); break;
      case 'after': afterResult(); break;
      case 'right': judgeGuess(true); break;
      case 'wrong': judgeGuess(false); break;
      case 'lobby': toLobby(); break;
      case 'cat': s.cats = s.cats.includes(b.dataset.id) ? s.cats.filter(x => x !== b.dataset.id) : [...s.cats, b.dataset.id]; update(); break;
      case 'cats-all': s.cats = PACKS.map(p => p.id); update(); break;
      case 'cats-none': s.cats = []; update(); break;
      case 'imp': { const n = Math.max(3, S.players.filter(p => p.online).length); s.impostors = Math.max(1, Math.min(maxImps(n), s.impostors + +b.dataset.d)); update(); break; }
      case 'toggle': s[b.dataset.k] = !s[b.dataset.k]; update(); break;
      case 'set': { const v = b.dataset.v; s[b.dataset.k] = isNaN(+v) ? v : +v; update(); break; }
    }
  });
  app.addEventListener('input', e => { if (e.target.id === 'custom') { S.settings.custom = e.target.value; save(); } });
  app.addEventListener('focusout', e => { if (e.target.id === 'custom') update(); });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea')) return;
    if (e.key === 'Escape' && panelOpen) { panelOpen = false; render(); }
    if ((e.key === ' ' || e.key === 'ArrowRight') && S.phase === 'clues') { e.preventDefault(); nextTurn(); }
  });

  // decorazioni di sfondo
  const deco = document.querySelector('.bgdeco');
  if (deco) deco.innerHTML = [
    ['-9vmin', '58vh', '22vmin', '#FFB800', '50%'], ['93vw', '42vh', '18vmin', '#FF6FB1', '50%'],
    ['58vw', '-9vmin', '15vmin', '#3B82F6', '30%'], ['34vw', '95vh', '10vmin', '#22C08A', '24%']
  ].map(([l, t, s, c, r]) => `<i style="left:${l};top:${t};width:${s};height:${s};background:${c};border-radius:${r};transform:rotate(${Math.random() * 40 - 20}deg)"></i>`).join('');

  window.addEventListener('beforeunload', () => { save(); try { peer && peer.destroy(); } catch (e) {} });
  render();
  startPeer();
  window.__FT_HOST = { get S() { return S; } };
})();
