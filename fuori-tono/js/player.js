// Fuori Tono · interfaccia del giocatore (usata dal telefono e dall'host che gioca)
(() => {
  const { esc, avatar, logo, glyph, ICON_KEYS } = FT;

  // ---------- Editor del profilo: nome, icona, foto ----------
  FT.ProfileForm = function (root, opts) {
    const p = { ...opts.profile };
    let err = '';
    function render() {
      const prev = { id: '_me', name: p.name, icon: p.icon, color: opts.color || '#FFD60A', photoData: p.photo || null };
      root.innerHTML = `<form class="pform" novalidate>
        <div class="pf-head"><div class="pf-av">${avatar(prev)}</div>
          <div class="pf-photo">
            <label class="btn ghost sm" for="pf-file">${p.photo ? 'Cambia foto' : 'Usa una tua foto'}</label>
            <input id="pf-file" type="file" accept="image/*" class="sr">
            ${p.photo ? '<button type="button" class="btn ghost sm" data-pf="nophoto">Togli foto</button>' : ''}
          </div></div>
        ${opts.askCode ? `<div class="field"><label for="pf-code">Codice della stanza</label>
          <input id="pf-code" maxlength="4" autocomplete="off" autocapitalize="characters" value="${esc(opts.code || '')}" placeholder="ABCD"></div>` : ''}
        <div class="field"><label for="pf-name">Il tuo nome</label>
          <input id="pf-name" maxlength="16" autocomplete="nickname" value="${esc(p.name)}" placeholder="Come ti chiamano?"></div>
        ${p.photo ? '' : `<div class="field"><span class="lbl">Il tuo simbolo</span><div class="icons">${ICON_KEYS.map(k =>
          `<button type="button" class="ic ${p.icon === k ? 'on' : ''}" data-pf="icon" data-k="${k}" aria-label="${k}" aria-pressed="${p.icon === k}">${glyph(k, p.icon === k ? '#0B0B0D' : '#F4F1EA', 22)}</button>`).join('')}</div></div>`}
        ${err ? `<p class="err">${esc(err)}</p>` : ''}
        <div class="pf-acts">${opts.cancel ? '<button type="button" class="btn ghost" data-pf="cancel">Annulla</button>' : ''}
          <button class="btn primary" type="submit">${esc(opts.saveLabel || 'Salva')}</button></div>
      </form>`;
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-pf]'); if (!b) return;
      const a = b.dataset.pf;
      if (a === 'icon') { p.name = root.querySelector('#pf-name').value; p.icon = b.dataset.k; render(); }
      if (a === 'nophoto') { p.name = root.querySelector('#pf-name').value; p.photo = ''; render(); }
      if (a === 'cancel') opts.onCancel && opts.onCancel();
    });
    root.addEventListener('change', async e => {
      if (e.target.id !== 'pf-file' || !e.target.files[0]) return;
      p.name = root.querySelector('#pf-name').value;
      try { p.photo = await FT.shrinkPhoto(e.target.files[0]); err = ''; } catch (x) { err = 'Non riesco a leggere questa immagine. Provane un’altra.'; }
      render();
    });
    root.addEventListener('submit', e => {
      e.preventDefault();
      p.name = root.querySelector('#pf-name').value.trim().slice(0, 16);
      const codeEl = root.querySelector('#pf-code');
      const code = codeEl ? codeEl.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : null;
      if (codeEl && code.length !== 4) { err = 'Il codice ha 4 lettere: lo trovi sullo schermo dell’host.'; return render(); }
      if (!p.name) { err = 'Scrivi un nome, così gli altri ti riconoscono.'; return render(); }
      err = '';
      opts.onSave({ ...p }, code);
    });
    render();
    return { render };
  };

  // ---------- Schermate di gioco ----------
  FT.PlayerUI = function (root, opts) {
    const send = opts.send;
    let st = null, n = -1, editing = false, pick = null, confirmLeave = false, guessSent = false, timerBase = null, lastSpeaker = null, revealed = false, holding = false;
    const P = id => st && st.players.find(p => p.id === id);
    const toast = t => { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3200); };
    const outLine = () => st.out && st.out.length ? `<p class="mono dim center small outline">FUORI: ${st.out.map(o => esc(o.name)).join(' · ')}</p>` : '';
    const buzz = v => { try { navigator.vibrate && navigator.vibrate(v); } catch (e) {} };
    const box = document.createElement('div'); box.className = 'pl-app'; root.appendChild(box);

    function receive(m) {
      if (m.t === 'photos') { Object.assign(FT.photos, m.map); return render(); }
      if (m.t !== 'state') return;
      const prev = st; st = m.s;
      if (st.n !== n) { n = st.n; revealed = false; guessSent = false; }
      if (st.phase !== 'vote') pick = null;
      timerBase = st.timerLeft != null ? Date.now() + st.timerLeft : null;
      if (st.phase === 'clues' && st.speaker === st.me.id && lastSpeaker !== st.me.id) buzz([60, 60, 140]);
      lastSpeaker = st.speaker;
      if (prev && prev.phase !== st.phase && st.phase === 'reveal') buzz(90);
      if (st.flash && (!prev || prev.flash !== st.flash)) toast(st.flash);
      if (!holding) render();
    }

    const meChip = () => `<button class="mechip" data-a="${st.phase === 'lobby' || st.me.waiting ? 'edit' : ''}" ${st.phase === 'lobby' || st.me.waiting ? '' : 'tabindex="-1"'}>
      <span class="avw">${avatar(st.me, { dead: !st.me.alive })}</span><span>${esc(st.me.name)}</span></button>`;

    function render() {
      if (!st) { box.innerHTML = `<div class="pl-main"><p class="mono dim">Collegamento…</p></div>`; return; }
      if (editing) return; // l'editor è aperto
      const head = opts.header !== false ? `<header class="pl-top">${logo('sm')}${meChip()}</header>` : '';
      box.innerHTML = head + `<main class="pl-main">${body()}</main>`;
    }

    function dossier(inner, cls = '') { return `<div class="dossier ${cls}">${inner}</div>`; }

    function secretCard(sec) {
      if (sec.type === 'hidden') return dossier(`<p class="stamp">ARCHIVIATO</p><p class="dim">Hai già letto il tuo fascicolo.<br>Se non lo ricordi… improvvisa.</p>`, 'sealed');
      let content;
      if (sec.type === 'imp') {
        content = `<p class="kick red">Ruolo</p><p class="word red">SEI L’IMPOSTORE</p>
          ${sec.hint ? `<p class="hint">Indizio: <b>${esc(sec.hint)}</b></p>` : ''}${sec.cat ? `<p class="hint">Categoria: <b>${esc(sec.cat)}</b></p>` : ''}
          ${!sec.hint && !sec.cat ? '<p class="hint">Nessun indizio. Ascolta e bluffa.</p>' : ''}`;
      } else {
        content = `<p class="kick">${sec.cat ? esc(sec.cat) : 'La parola'}</p>
          ${sec.color ? `<div class="swatch" style="background:${sec.color}"></div>` : ''}<p class="word">${esc(sec.text)}</p>`;
      }
      return `<div class="dossier secret" data-hold role="button" tabindex="0" aria-label="Tieni premuto per leggere">
        <div class="ds-top"><span class="mono">FASCICOLO N.${String(st.n).padStart(3, '0')}</span><span class="mono red">RISERVATO</span></div>
        <div class="ds-body">${content}</div>
        <div class="redact"><span>TIENI PREMUTO PER LEGGERE</span></div>
      </div>
      ${revealed && !st.seen ? `<button class="btn primary wide" data-a="seen">${st.revealOnce ? 'Ho memorizzato' : 'Fatto'}</button>` : ''}
      ${st.seen && !st.revealOnce ? '<p class="dim small">Puoi rileggerla quando vuoi tenendo premuto.</p>' : ''}`;
    }

    function body() {
      const s = st, me = s.me;
      if (s.phase === 'lobby' || me.waiting) {
        if (confirmLeave) return `<h1 class="title">Uscire dalla partita?</h1><p class="dim">Sparirai dalla lista dei giocatori.</p>
          <button class="btn danger wide" data-a="leave">Sì, esci</button><button class="btn ghost wide" data-a="stay">Resto</button>`;
        return dossier(`<div class="ds-top"><span class="mono">SOSPETTATO</span><span class="mono">#${String(s.players.findIndex(p => p.id === me.id) + 1).padStart(2, '0')}</span></div>
          <div class="ds-id"><div class="avbig">${avatar(me)}</div><div><p class="word sm">${esc(me.name)}</p>${me.score ? `<p class="mono dim">${me.score} punt${me.score === 1 ? 'o' : 'i'}</p>` : ''}</div></div>`)
          + `<p class="dim">${me.waiting ? 'Partita in corso: entri dalla prossima.' : `Sei dentro. Siete in ${s.players.length}: si parte dallo schermo dell’host.`}</p>
          <div class="row2"><button class="btn ghost" data-a="edit">Modifica profilo</button><button class="btn ghost" data-a="askleave">Esci</button></div>
          <details class="rules"><summary>Come si gioca</summary><ol>
            <li><b>Leggi la carta.</b> Tieni premuto per vedere la parola segreta, senza farla vedere. L’impostore non la conosce.</li>
            <li><b>Una parola a testa.</b> Quando tocca a te, dilla ad alta voce, poi premi «Ho detto la mia».</li>
            <li><b>Vota.</b> Scegli chi è fuori tono e conferma. Se scoprite l’impostore, può ancora vincere indovinando la parola.</li></ol></details>`;
      }
      if (s.phase === 'reveal') return `<p class="mono dim center">${s.seen && s.revealOnce ? 'In attesa degli altri' : 'La tua carta segreta'}</p>` + secretCard(s.secret);
      if (me.gone) return `<h1 class="title">Sei fuori dalla partita</h1><p class="dim">Rientrerai dalla prossima.</p>`;
      if (!me.alive && !['end', 'result'].includes(s.phase) && !(s.phase === 'guess' && s.guesser === me.id)) {
        return `<div class="avbig mid">${avatar(me, { dead: true })}</div><h1 class="title">Eliminato</h1><p class="dim">Guarda lo schermo e non suggerire niente.</p>`;
      }
      if (s.phase === 'clues') {
        const sp = P(s.speaker), mine = s.speaker === me.id;
        const left = timerBase ? Math.max(0, Math.ceil((timerBase - Date.now()) / 1000)) : null;
        return (mine ? `<div class="spot me"><p class="mono">È IL TUO TURNO</p><h1 class="title xl">Parla tu</h1><p>Di’ una parola ad alta voce.</p>${left != null ? `<p class="count mono" id="left">${left}</p>` : ''}<button class="btn primary wide" data-a="done">Ho detto la mia</button></div>`
          : `<div class="spot"><div class="avbig">${avatar(sp)}</div><p class="mono dim">STA PARLANDO</p><h1 class="title">${esc(sp.name)}</h1></div>`)
          + `<p class="mono dim center">Giro ${s.round} di ${s.clueRounds}</p><ol class="queue">${s.order.map((id, i) => `<li class="${i < s.turnIdx ? 'done' : i === s.turnIdx ? 'now' : ''}">${esc(P(id).name)}</li>`).join('')}</ol>${outLine()}`
          + (!s.revealOnce && s.secret ? `<details class="peek"><summary>Rileggi la tua carta</summary>${secretCard(s.secret)}</details>` : '');
      }
      if (s.phase === 'vote') {
        if (s.myVote && pick === null) {
          const v = P(s.myVote);
          return `<p class="mono dim center">VOTO REGISTRATO</p><div class="avbig mid">${avatar(v)}</div><h1 class="title">Hai votato ${esc(v.name)}</h1>
            <p class="dim center">${s.voted} su ${s.voters} hanno votato</p><button class="btn ghost wide" data-a="change">Cambia voto</button>`;
        }
        const list = s.candidates.filter(id => id !== me.id);
        return `<h1 class="title">${s.runoff ? 'Ballottaggio' : 'Chi è fuori tono?'}</h1><p class="dim center">Tocca un sospettato, poi conferma.</p>
          ${outLine()}<div class="vlist">${list.map(id => { const p = P(id); return `<button class="vbtn ${pick === id ? 'on' : ''}" data-a="pick" data-id="${id}" aria-pressed="${pick === id}"><span class="avw">${avatar(p)}</span><span>${esc(p.name)}</span></button>`; }).join('')}</div>
          ${pick ? `<div class="confirm"><button class="btn ghost" data-a="unpick">Annulla</button><button class="btn danger" data-a="vote">Conferma: ${esc(P(pick).name)}</button></div>` : ''}`;
      }
      if (s.phase === 'result') {
        const r = s.result, e = r.elim && P(r.elim);
        if (!e) return `<h1 class="title">Pareggio</h1><p class="dim center">Nessuno eliminato. Guarda lo schermo.</p>`;
        return `<div class="avbig mid">${avatar(e, { dead: true })}</div><h1 class="title">${r.elim === me.id ? 'Ti hanno votato' : esc(e.name) + ' è fuori'}</h1><p class="dim center">Guarda lo schermo per scoprire chi era.</p>`;
      }
      if (s.phase === 'guess') {
        if (s.guesser === me.id) {
          if (s.guessText || guessSent) return `<h1 class="title">Risposta inviata</h1><p class="dim center">Hai scritto «${esc(s.guessText || '')}». Decide il gruppo.</p>`;
          return `<p class="mono red center">ULTIMA CHANCE</p><h1 class="title">Indovina la parola</h1><p class="dim center">Ti hanno scoperto. Se indovini, vinci tu.</p>
            <form class="field" data-form="guess"><label for="guess">La parola segreta è…</label><input id="guess" maxlength="40" autocomplete="off"><button class="btn primary wide" type="submit">Invia</button></form>`;
        }
        return `<p class="mono red center">ULTIMA CHANCE</p><h1 class="title">${esc(P(s.guesser).name)} prova a indovinare</h1><p class="dim center">Silenzio in sala.</p>`;
      }
      if (s.phase === 'end') {
        const e = s.end, imp = e.imps.includes(me.id), under = (e.unders || []).includes(me.id), won = (e.winner === 'imp') === imp, g = e.gained[me.id] || 0;
        return `<p class="mono center ${won ? '' : 'red'}">${won ? 'VITTORIA' : 'SCONFITTA'}</p><div class="avbig mid">${avatar(me, { imp })}</div>
          <h1 class="title">${won ? 'Hai vinto' : 'Hai perso'}</h1><p class="dim center">${under ? 'Eri undercover: la tua parola era diversa.' : imp ? 'Eri l’impostore.' : 'Eri innocente.'}${g ? ` +${g} punt${g === 1 ? 'o' : 'i'}` : ''}</p>
          ${dossier(`<p class="kick">La parola era</p><p class="word sm">${esc(e.word)}</p>${(e.unders || []).length ? `<p class="hint">Undercover: <b>${esc(e.sim)}</b></p>` : e.mode === 'hint' ? `<p class="hint">Indizio impostori: <b>${esc(e.sim)}</b></p>` : ''}`)}
          <p class="mono dim center">Totale ${me.score} punt${me.score === 1 ? 'o' : 'i'}</p>`;
      }
      return '';
    }

    function openEditor() {
      editing = true;
      box.innerHTML = `<header class="pl-top">${logo('sm')}</header><main class="pl-main"><h1 class="title">Il tuo profilo</h1><div id="pf"></div></main>`;
      FT.ProfileForm(box.querySelector('#pf'), {
        profile: { name: st.me.name, icon: st.me.icon, photo: FT.photos[st.me.id] || '' }, color: st.me.color, saveLabel: 'Salva', cancel: true,
        onCancel: () => { editing = false; render(); },
        onSave: p => { editing = false; opts.onProfile && opts.onProfile(p); send({ t: 'profile', name: p.name, icon: p.icon, photo: p.photo || '' }); render(); }
      });
    }

    // ricevimento eventi
    const hideHold = () => { if (!holding) return; holding = false; const d = box.querySelector('[data-hold]'); if (d) d.classList.remove('open'); render(); };
    box.addEventListener('pointerdown', e => {
      const d = e.target.closest('[data-hold]'); if (!d) return;
      e.preventDefault(); holding = true; d.classList.add('open'); if (!revealed) { revealed = true; buzz(25); }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => box.addEventListener(ev, hideHold));
    box.addEventListener('keydown', e => { const d = e.target.closest && e.target.closest('[data-hold]'); if (d && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); holding = true; revealed = true; d.classList.add('open'); } });
    box.addEventListener('keyup', e => { if (e.target.closest && e.target.closest('[data-hold]')) hideHold(); });
    box.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b || !b.dataset.a) return;
      e.stopPropagation();
      switch (b.dataset.a) {
        case 'seen': send({ t: 'seen' }); break;
        case 'done': send({ t: 'done' }); buzz(30); b.disabled = true; break;
        case 'pick': pick = b.dataset.id; render(); break;
        case 'unpick': pick = null; render(); break;
        case 'vote': if (pick) { send({ t: 'vote', target: pick }); pick = null; buzz(40); } break;
        case 'change': pick = st.myVote; send({ t: 'unvote' }); render(); break;
        case 'edit': openEditor(); break;
        case 'askleave': confirmLeave = true; render(); break;
        case 'stay': confirmLeave = false; render(); break;
        case 'leave': confirmLeave = false; send({ t: 'leave' }); opts.onExit && opts.onExit(); break;
      }
    });
    box.addEventListener('submit', e => {
      if (e.target.dataset.form !== 'guess') return;
      e.preventDefault(); const v = box.querySelector('#guess').value.trim(); if (!v) return;
      guessSent = true; send({ t: 'guess', text: v }); render();
    });
    setInterval(() => { const el = box.querySelector('#left'); if (el && timerBase) el.textContent = Math.max(0, Math.ceil((timerBase - Date.now()) / 1000)); }, 250);

    render();
    return { receive, render, get state() { return st; }, el: box };
  };
})();
