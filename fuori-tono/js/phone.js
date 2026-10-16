// TELEFONO: entra nella stanza, mostra la parola segreta, vota
(() => {
  const $ = s => document.querySelector(s);
  const { esc, avatar, logo, store } = FT;
  const app = $('#app');
  const q = new URLSearchParams(location.search);

  let code = (q.get('r') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  let myId = store.get('ft-id'); if (!myId) { myId = FT.rid(12); store.set('ft-id', myId); }
  let myName = store.get('ft-name') || '';
  let peer = null, conn = null, st = null, screen = 'join', joinErr = '', joined = false, retryT = null;
  let open = false, openN = -1, pick = null, guessSent = false, timerBase = null, lastSpeaker = null;

  // ---------------- rete ----------------
  function connect() {
    clearTimeout(retryT);
    if (!peer || peer.destroyed) {
      peer = new Peer(undefined, FT.peerOpts());
      peer.on('open', dial);
      peer.on('error', e => {
        if (e.type === 'peer-unavailable') {
          if (!joined) { screen = 'join'; joinErr = 'Stanza non trovata. Controlla il codice e che il monitor sia aperto.'; render(); }
          else retry();
        } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(e.type)) retry();
      });
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
    } else if (peer.open) dial();
  }
  function dial() {
    try { conn && conn.close(); } catch (e) {}
    conn = peer.connect(FT.PREFIX + code, { reliable: true });
    const c = conn;
    c.on('open', () => c.send({ t: 'hello', id: myId, name: myName }));
    c.on('data', onMsg);
    c.on('close', () => { if (c === conn) retry(); });
    c.on('error', () => { if (c === conn) retry(); });
    setTimeout(() => { if (c === conn && !c.open) retry(); }, 9000);
  }
  function retry() {
    if (screen === 'kicked') return;
    render();
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (!conn || !conn.open) connect(); }, 2500);
  }
  function send(m) { if (conn && conn.open) conn.send(m); }
  function onMsg(d) {
    if (!d) return;
    if (d.t === 'state') {
      const prev = st; st = d.s; joined = true; screen = 'game'; joinErr = '';
      if (st.n !== openN) { open = false; openN = st.n; guessSent = false; }
      if (st.phase !== 'vote') pick = null;
      timerBase = st.timerLeft != null ? Date.now() + st.timerLeft : null;
      if (st.phase === 'clues' && st.speaker === myId && lastSpeaker !== myId) buzz([60, 60, 120]);
      lastSpeaker = st.speaker;
      if (prev && prev.phase !== st.phase && st.phase === 'reveal') buzz(80);
      render();
    } else if (d.t === 'full') { screen = 'join'; joinErr = 'La stanza è piena (massimo 20).'; render(); }
    else if (d.t === 'kicked') { screen = 'kicked'; try { conn.close(); } catch (e) {} render(); }
  }
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && joined && (!conn || !conn.open)) connect(); });

  // ---------------- interfaccia ----------------
  const P = id => st && st.players.find(p => p.id === id);
  const head = () => `<div class="ph-top">${logo()}${st ? `<div class="me"><div class="avw">${avatar(st.me.color, st.me.shape, { dead: !st.me.alive })}</div><span>${esc(st.me.name)}</span></div>` : ''}</div>`;
  const offline = () => joined && (!conn || !conn.open) ? '<div class="banner">Connessione persa, mi ricollego…</div>' : '';

  function render() {
    let h = '';
    if (screen === 'join') h = renderJoin();
    else if (screen === 'connecting') h = head() + `<div class="ph-main"><div class="bigav bob">${avatar('#FFB800', 'blob')}</div><div class="ph-title">Entro…</div><p class="ph-sub">Mi collego alla stanza ${esc(code)}.</p></div>`;
    else if (screen === 'kicked') h = head() + `<div class="ph-main"><div class="ph-title">Sei stato tolto dalla stanza</div><button class="btn primary" data-act="rejoin">Rientra</button></div>`;
    else h = offline() + head() + `<div class="ph-main">${renderGame()}</div>`;
    const keep = document.activeElement && document.activeElement.id === 'guess' ? document.activeElement.value : null;
    app.innerHTML = h;
    if (keep != null) { const el = $('#guess'); if (el) { el.value = keep; el.focus(); } }
  }

  function renderJoin() {
    return `<div class="ph-top">${logo()}</div><form class="ph-main" id="joinform" novalidate>
      <div class="bigav bob">${avatar('#FF5B3A', 'ghost')}</div>
      <div class="ph-title">Entra in partita</div>
      ${q.get('r') ? `<p class="ph-sub">Stanza <b>${esc(code)}</b></p>` : `<div class="field"><label for="code">Codice della stanza</label>
        <input id="code" autocomplete="off" autocapitalize="characters" maxlength="4" value="${esc(code)}" placeholder="ABCD" inputmode="text"></div>`}
      <div class="field"><label for="name">Il tuo nome</label><input id="name" maxlength="16" autocomplete="nickname" value="${esc(myName)}" placeholder="Come ti chiamano?"></div>
      ${joinErr ? `<div class="field"><span class="err">${esc(joinErr)}</span></div>` : ''}
      <button class="btn primary" type="submit">Entra</button></form>`;
  }

  function secretCard(sec) {
    if (sec.type === 'hidden') return `<div class="used">Hai già visto la tua carta.<br>Se non te la ricordi… fai finta di niente.</div>`;
    let back;
    if (sec.type === 'imp') {
      back = `<div class="f back imp"><div style="width:42%">${avatar('#FFFFFF', 'ghost', { sus: true })}</div>
        <div class="kicker" style="color:#fff">Sei</div><div class="w">L’IMPOSTORE</div>
        ${sec.hint ? `<div>Indizio: <b>${esc(sec.hint)}</b></div>` : ''}${sec.cat ? `<div>Categoria: <b>${esc(sec.cat)}</b></div>` : ''}
        ${!sec.hint && !sec.cat ? '<div>Nessun indizio. Ascolta e bluffa.</div>' : ''}</div>`;
    } else {
      back = `<div class="f back">${sec.color ? `<div class="swbig" style="background:${sec.color}"></div>` : ''}
        <div class="kicker">${sec.cat ? esc(sec.cat) : 'La tua parola'}</div><div class="w">${esc(sec.text)}</div></div>`;
    }
    return `<div class="secret ${open ? 'open' : ''}" data-act="flip" role="button" aria-label="Scopri la carta">
      <div class="in"><div class="f front"><div class="pattern"></div>${logo()}<b>Tocca per scoprire</b><span style="position:relative;opacity:.7">Copri lo schermo agli altri</span></div>${back}</div></div>
      ${open ? `<button class="btn dark" data-act="hide">${st.revealOnce ? 'Ho memorizzato, nascondi' : 'Nascondi'}</button>` : ''}`;
  }

  function renderGame() {
    const s = st, me = s.me;
    if (s.phase === 'lobby' || me.waiting) {
      return `<div class="bigav pop">${avatar(me.color, me.shape)}</div>
        <div class="ph-title">${me.waiting ? 'Partita in corso' : `Ciao ${esc(me.name)}!`}</div>
        <p class="ph-sub">${me.waiting ? 'Entrerai dalla prossima partita. Intanto guarda il monitor.' : `Sei dentro. Siete in ${s.players.length}: quando ci siete tutti, si parte dal monitor.`}</p>
        ${me.score ? `<p class="ph-sub"><b>${me.score} punt${me.score === 1 ? 'o' : 'i'}</b></p>` : ''}`;
    }
    if (s.phase === 'reveal') return `<p class="ph-sub">${s.seen && s.revealOnce ? 'Aspetta gli altri…' : 'La tua carta segreta'}</p>` + secretCard(s.secret);
    if (!me.alive && s.phase !== 'end' && s.phase !== 'result' && !(s.phase === 'guess' && s.guesser === me.id)) {
      return `<div class="bigav">${avatar(me.color, me.shape, { dead: true })}</div><div class="ph-title">Sei fuori</div><p class="ph-sub">Guarda il monitor e non suggerire niente.</p>`;
    }
    if (s.phase === 'clues') {
      const sp = P(s.speaker), mine = s.speaker === me.id;
      const left = timerBase ? Math.max(0, Math.ceil((timerBase - Date.now()) / 1000)) : null;
      return (mine ? `<div class="turn pop"><div class="ph-title">Tocca a te!</div><p class="ph-sub" style="color:var(--ink)">Di’ una parola ad alta voce.</p>${left != null ? `<div class="ph-title mono" id="left">${left}</div>` : ''}</div>`
        : `<div style="width:7rem;margin:0 auto">${avatar(sp.color, sp.shape)}</div><div class="ph-title">Parla ${esc(sp.name)}</div><p class="ph-sub">Giro ${s.round} di ${s.clueRounds}</p>`)
        + `<div class="chips" style="justify-content:center">${s.order.map((id, i) => `<span class="chip" style="opacity:${i < s.turnIdx ? .35 : 1};${i === s.turnIdx ? 'background:var(--sun)' : ''}">${esc(P(id).name)}</span>`).join('')}</div>`
        + peekBtn();
    }
    if (s.phase === 'vote') {
      if (s.myVote && pick === null) {
        return `<div class="ph-title">Voto inviato</div><p class="ph-sub">Hai votato <b>${esc(P(s.myVote).name)}</b>. Puoi cambiarlo finché la votazione è aperta.</p>
          <p class="ph-sub">${s.voted} su ${s.voters} hanno votato</p><button class="btn" data-act="change">Cambia voto</button>`;
      }
      const list = s.candidates.filter(id => id !== me.id);
      return `<div class="ph-title">${s.runoff ? 'Ballottaggio' : 'Chi è fuori tono?'}</div>
        <div class="vlist">${list.map(id => { const p = P(id); return `<button class="vbtn ${pick === id ? 'on' : ''}" data-act="pick" data-id="${id}"><div class="avw">${avatar(p.color, p.shape)}</div><span>${esc(p.name)}</span></button>`; }).join('')}</div>
        <button class="btn primary" data-act="vote" ${pick ? '' : 'disabled'}>${pick ? `Vota ${esc(P(pick).name)}` : 'Scegli qualcuno'}</button>`;
    }
    if (s.phase === 'result') {
      const r = s.result, e = r.elim && P(r.elim);
      if (!e) return `<div class="ph-title">Pareggio</div><p class="ph-sub">Nessuno è stato eliminato. Guarda il monitor.</p>`;
      if (r.elim === me.id) return `<div class="bigav">${avatar(me.color, me.shape, { dead: true })}</div><div class="ph-title">Ti hanno votato!</div><p class="ph-sub">Guarda il monitor.</p>`;
      return `<div class="bigav">${avatar(e.color, e.shape, { dead: true })}</div><div class="ph-title">${esc(e.name)} è fuori</div><p class="ph-sub">Guarda il monitor per scoprire chi era.</p>`;
    }
    if (s.phase === 'guess') {
      if (s.guesser === me.id) {
        if (s.guessText || guessSent) return `<div class="ph-title">Risposta inviata</div><p class="ph-sub">Hai scritto «${esc(s.guessText || '')}». Il gruppo decide se è giusta.</p>`;
        return `<div class="ph-title">Ultima chance</div><p class="ph-sub">Ti hanno scoperto. Se indovini la parola segreta, vinci tu.</p>
          <form id="guessform" class="field" style="gap:.8rem"><label for="guess">La parola segreta è…</label><input id="guess" maxlength="40" autocomplete="off">
          <button class="btn primary" type="submit">Invia</button></form>`;
      }
      return `<div class="ph-title">Ultima chance</div><p class="ph-sub">${esc(P(s.guesser).name)} prova a indovinare la parola. Silenzio!</p>`;
    }
    if (s.phase === 'end') {
      const e = s.end, imp = e.imps.includes(me.id), won = (e.winner === 'imp') === imp;
      return `<div class="bigav pop">${avatar(me.color, me.shape, { sus: imp })}</div>
        <div class="ph-title">${won ? 'Hai vinto!' : 'Hai perso'}</div>
        <p class="ph-sub">${imp ? 'Eri l’impostore.' : 'Eri innocente.'} ${e.gained[me.id] ? `<b>+${e.gained[me.id]} punt${e.gained[me.id] === 1 ? 'o' : 'i'}</b>` : ''}</p>
        <div class="card" style="padding:1.2rem"><div class="kicker">La parola era</div><div class="ph-title" style="font-size:2rem;margin-top:.3rem">${esc(e.word)}</div>
        ${e.mode === 'hint' || e.mode === 'undercover' ? `<p class="ph-sub" style="margin-top:.4rem">Impostori: ${esc(e.sim)}</p>` : ''}</div>
        <p class="ph-sub">Totale: <b>${me.score} punt${me.score === 1 ? 'o' : 'i'}</b></p>`;
    }
    return '';
  }
  function peekBtn() {
    if (st.revealOnce || !st.secret) return '';
    return open ? secretCard(st.secret) : `<button class="btn peek" data-act="peek">Rivedi la tua carta</button>`;
  }

  // timer locale
  setInterval(() => { const el = $('#left'); if (el && timerBase) el.textContent = Math.max(0, Math.ceil((timerBase - Date.now()) / 1000)); }, 250);

  app.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'joinform') {
      const c = $('#code'); if (c) code = c.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      myName = $('#name').value.trim().slice(0, 16);
      if (code.length !== 4) { joinErr = 'Il codice ha 4 lettere: lo trovi sul monitor.'; return render(); }
      if (!myName) { joinErr = 'Scrivi un nome, così gli altri ti riconoscono.'; return render(); }
      store.set('ft-name', myName);
      if (!q.get('r')) history.replaceState(null, '', `?r=${code}${q.get('ph') ? '&ph=' + q.get('ph') : ''}`);
      screen = 'connecting'; joinErr = ''; render(); connect();
    } else if (e.target.id === 'guessform') {
      const v = $('#guess').value.trim(); if (!v) return;
      guessSent = true; send({ t: 'guess', text: v }); render();
    }
  });
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    switch (b.dataset.act) {
      case 'flip': if (!open) { open = true; buzz(30); render(); } break;
      case 'hide': open = false; if (!st.seen) send({ t: 'seen' }); render(); break;
      case 'peek': open = true; render(); break;
      case 'pick': pick = b.dataset.id; render(); break;
      case 'vote': if (pick) { send({ t: 'vote', target: pick }); pick = null; buzz(40); } break;
      case 'change': pick = st.myVote; render(); break;
      case 'rejoin': screen = 'connecting'; render(); connect(); break;
    }
  });

  // se il nome è già salvato e c'è il codice nel link, entra subito
  if (code.length === 4 && myName && q.get('r')) { screen = 'connecting'; connect(); }
  render();
})();
