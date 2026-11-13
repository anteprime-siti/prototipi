// Lupus slavo · telefono del giocatore: profilo, collegamento, gioco
(() => {
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const q = new URLSearchParams(location.search);
  let code = (q.get('r') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  let me = FT.profile.load();
  let peer = null, conn = null, ui = null, joined = false, retryT = null, joinErr = '';

  function showJoin() {
    joined = false; ui = null; clearTimeout(retryT);
    const old = conn; conn = null;           // prima azzero, così la chiusura non viene presa per un'interruzione
    try { old && old.close(); } catch (e) {}
    app.innerHTML = `<header class="pl-top">${FT.logo('sm')}<a class="mono dim small" href="./">Indietro</a></header>
      <main class="pl-main"><p class="mono dim center">${code ? `STANZA ${FT.esc(code)}` : 'ENTRA IN PARTITA'}</p><h1 class="title">Chi sei?</h1>
      ${joinErr ? `<p class="err center">${FT.esc(joinErr)}</p>` : ''}<div id="pf"></div></main>`;
    FT.ProfileForm($('#pf'), {
      profile: me, askCode: !code, code, saveLabel: 'Entra',
      onSave: (p, c) => {
        if (c) code = c;
        me = { ...me, ...p }; FT.profile.save(me);
        history.replaceState(null, '', `?r=${code}${FT.phParam()}`);
        joinErr = ''; connecting(); connect();
      }
    });
  }
  function connecting() {
    app.innerHTML = `<header class="pl-top">${FT.logo('sm')}</header><main class="pl-main"><div class="avbig mid pulse">${FT.avatar({ ...me, color: '#F4F1EA', photoData: me.photo })}</div>
      <p class="mono dim center">COLLEGAMENTO ALLA STANZA ${FT.esc(code)}…</p></main>`;
  }
  function banner(on) {
    let b = $('.banner');
    if (on && !b) { b = document.createElement('div'); b.className = 'banner'; b.textContent = 'Connessione persa, mi ricollego…'; document.body.appendChild(b); }
    if (!on && b) b.remove();
  }

  function connect() {
    clearTimeout(retryT);
    if (!peer || peer.destroyed) {
      peer = new Peer(undefined, FT.peerOpts());
      peer.on('open', dial);
      peer.on('error', e => {
        if (e.type === 'peer-unavailable') {
          if (!joined) { joinErr = 'Stanza non trovata: controlla il codice e che lo schermo dell’host sia aperto.'; code = q.get('r') ? code : ''; showJoin(); }
          else retry();
        } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(e.type)) retry();
      });
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
    } else if (peer.open) dial();
  }
  function dial() {
    { const old = conn; conn = null; try { old && old.close(); } catch (e) {} }
    const c = conn = peer.connect(FT.PREFIX + code, { reliable: true });
    c.on('open', () => { banner(false); c.send({ t: 'hello', id: me.id, name: me.name, icon: me.icon, photo: me.photo || '' }); });
    c.on('data', onMsg);
    c.on('close', () => { if (c === conn) retry(); });
    c.on('error', () => { if (c === conn) retry(); });
    setTimeout(() => { if (c === conn && !c.open) retry(); }, 9000);
  }
  function retry() {
    if (!conn && !joined) return;
    if (joined) banner(true);
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (!conn || !conn.open) connect(); }, 2500);
  }
  let lastMsg = 0;
  function onMsg(d) {
    if (!d) return;
    lastMsg = Date.now(); banner(false);
    if (d.t === 'ping') return;
    if (d.t === 'kicked') { joinErr = 'L’host ti ha tolto dalla stanza.'; showJoin(); return; }
    if (d.t === 'full') { joinErr = 'La stanza è piena (massimo 20).'; showJoin(); return; }
    if (d.t === 'closed') { FT.store.del('ls-last'); joinErr = 'L’host ha chiuso la stanza. Grazie per aver giocato!'; code = ''; showJoin(); return; }
    if (!joined) {
      joined = true; app.innerHTML = '';
      FT.store.set('ls-last', JSON.stringify({ code, ts: Date.now() }));
      ui = FT.PlayerUI(app, {
        send: m => { if (conn && conn.open) conn.send(m); },
        onExit: () => { FT.store.del('ls-last'); joinErr = ''; setTimeout(showJoin, 150); },
        onProfile: p => { me = { ...me, ...p }; FT.profile.save(me); }
      });
    }
    ui.receive(d);
  }
  // se l'host tace da troppo, il collegamento è morto anche se il browser non lo dice: ricollegati
  setInterval(() => {
    if (joined && lastMsg && Date.now() - lastMsg > 9000) { lastMsg = Date.now(); banner(true); const old = conn; conn = null; try { old && old.close(); } catch (e) {} conn = { open: false }; connect(); }
  }, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && joined && (!conn || !conn.open)) connect(); });

  if (code && me.name && q.get('r')) { connecting(); connect(); } else showJoin();
  FT.keepAwake();
})();
