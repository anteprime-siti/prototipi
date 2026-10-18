// Lupus slavo · interfaccia del giocatore (telefono, o host che gioca)
(() => {
  const { esc, avatar, logo, glyph, ICON_KEYS, ROLES, roleIcon } = FT;

  // ---------- Editor del profilo ----------
  FT.ProfileForm = function (root, opts) {
    const p = { ...opts.profile };
    let err = '';
    function render() {
      const prev = { id: '_me', name: p.name, icon: p.icon, color: opts.color || '#E8C26A', photoData: p.photo || null };
      root.innerHTML = `<form class="pform" novalidate>
        <div class="pf-head"><div class="pf-av">${avatar(prev)}</div>
          <div class="pf-photo"><label class="btn ghost sm" for="pf-file">${p.photo ? 'Cambia foto' : 'Usa una tua foto'}</label>
            <input id="pf-file" type="file" accept="image/*" class="sr">
            ${p.photo ? '<button type="button" class="btn ghost sm" data-pf="nophoto">Togli foto</button>' : ''}</div></div>
        ${opts.askCode ? `<div class="field"><label for="pf-code">Codice della stanza</label>
          <input id="pf-code" maxlength="4" autocomplete="off" autocapitalize="characters" value="${esc(opts.code || '')}" placeholder="ABCD"></div>` : ''}
        <div class="field"><label for="pf-name">Il tuo nome</label>
          <input id="pf-name" maxlength="16" autocomplete="nickname" value="${esc(p.name)}" placeholder="Come ti chiamano al villaggio?"></div>
        ${p.photo ? '' : `<div class="field"><span class="lbl">Il tuo simbolo</span><div class="icons">${ICON_KEYS.map(k =>
          `<button type="button" class="ic ${p.icon === k ? 'on' : ''}" data-pf="icon" data-k="${k}" aria-label="${k}" aria-pressed="${p.icon === k}">${glyph(k, p.icon === k ? '#0A0F1F' : '#F3EBDD', 22)}</button>`).join('')}</div></div>`}
        ${err ? `<p class="err">${esc(err)}</p>` : ''}
        <div class="pf-acts">${opts.cancel ? '<button type="button" class="btn ghost" data-pf="cancel">Annulla</button>' : ''}
          <button class="btn primary" type="submit">${esc(opts.saveLabel || 'Salva')}</button></div></form>`;
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
      err = ''; opts.onSave({ ...p }, code);
    });
    render();
    return { render };
  };

  // ---------- Schermate di gioco ----------
  const causeTxt = { lupi: 'sbranato dai lupi', voto: 'cacciato dal villaggio', cacciatore: 'colpito dal cacciatore', uscito: 'ha lasciato' };

  FT.PlayerUI = function (root, opts) {
    const send = opts.send;
    let st = null, n = -1, night = -1, editing = false, pick = null, confirmLeave = false, revealed = false, holding = false, dayBase = null;
    const P = id => st && st.players.find(p => p.id === id);
    const toast = t => { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3200); };
    const buzz = v => { try { navigator.vibrate && navigator.vibrate(v); } catch (e) {} };
    const box = document.createElement('div'); box.className = 'pl-app'; root.appendChild(box);

    function receive(m) {
      if (m.t === 'photos') { Object.assign(FT.photos, m.map); return render(); }
      if (m.t !== 'state') return;
      const prev = st; st = m.s;
      if (st.n !== n) { n = st.n; revealed = false; night = -1; }
      if (st.phase === 'night' && st.night !== night) { night = st.night; pick = null; }
      if (prev && prev.phase !== st.phase) { if (st.phase !== 'night') pick = null; if (['night', 'vote'].includes(st.phase) && st.me.alive) buzz([50, 60, 50]); }
      if (st.phase === 'hunter' && st.hunter && st.hunter.id === st.me.id && (!prev || prev.phase !== 'hunter')) buzz([80, 60, 160]);
      dayBase = st.dayLeft != null ? Date.now() + st.dayLeft : null;
      if (st.flash && (!prev || prev.flash !== st.flash)) toast(st.flash);
      if (!holding) render();
    }

    const meChip = () => { const can = st.phase === 'lobby' || st.me.waiting;
      return `<button class="mechip" ${can ? 'data-a="edit"' : 'tabindex="-1"'}><span class="avw">${avatar(st.me, { dead: !st.me.alive })}</span><span>${esc(st.me.name)}</span></button>`; };

    function render() {
      if (!st) { box.innerHTML = `<div class="pl-main"><p class="mono dim">Collegamento…</p></div>`; return; }
      if (editing) return;
      const head = opts.header !== false ? `<header class="pl-top">${logo('sm')}${meChip()}</header>` : '';
      box.innerHTML = head + `<main class="pl-main ${st.phase === 'night' ? 'is-night' : ''}">${body()}</main>`;
    }

    // carta del ruolo: si legge tenendo premuto
    function roleCard() {
      const r = ROLES[st.role], allies = (st.wolves || []).filter(id => id !== st.me.id);
      return `<div class="rolecard" data-hold role="button" tabindex="0" aria-label="Tieni premuto per vedere il tuo ruolo" style="--rc:${r.c}">
        <div class="rc-face"><div class="rc-icon">${roleIcon(st.role, 72)}</div>
          <p class="rc-uk">${esc(r.uk)}</p><p class="rc-name">${esc(r.t)}</p><p class="rc-tr mono">${esc(r.tr)} · ${r.team === 'lupi' ? 'squadra dei lupi' : 'squadra del villaggio'}</p>
          <p class="rc-d">${esc(r.d)}</p>
          ${st.role === 'lupo' ? `<div class="allies"><span class="mono">${allies.length ? 'IL TUO BRANCO' : 'SEI L’UNICO LUPO'}</span>${allies.map(id => P(id) ? `<span class="ally"><span class="avw">${avatar(P(id))}</span>${esc(P(id).name)}</span>` : '').join('')}</div>` : ''}</div>
        <div class="rc-back"><div class="moon"></div><span>TIENI PREMUTO<br>PER SCOPRIRE CHI SEI</span></div></div>`;
    }
    const peekRole = () => st.role ? `<details class="peek"><summary>Rivedi il mio ruolo</summary>${roleCard()}</details>` : '';
    const deaths = () => st.deaths && st.deaths.length ? `<div class="deaths">${st.deaths.map(x => `<span>${esc(x.name)} <i>${esc(causeTxt[x.cause] || '')}${x.role ? ' · ' + esc(ROLES[x.role].t) : ''}</i></span>`).join('')}</div>` : '';

    // lista di nomi + conferma: identica per tutti, così di notte nessuno si tradisce guardando il telefono altrui
    function pickList(ids, { tags = {}, disabled = [], label = 'Conferma', danger = false, act = 'npick' } = {}) {
      return `<div class="vlist">${ids.map(id => { const p = P(id); if (!p) return ''; const off = disabled.includes(id);
        return `<button class="vbtn ${pick === id ? 'on' : ''}" data-a="${act}" data-id="${id}" aria-pressed="${pick === id}" ${off ? 'disabled' : ''}><span class="avw">${avatar(p)}</span><span>${esc(p.name)}${id === st.me.id ? ' (tu)' : ''}</span>${tags[id] ? `<span class="picktag">${tags[id]}</span>` : ''}</button>`; }).join('')}</div>
        ${pick ? `<div class="confirm"><button class="btn ghost" data-a="unpick">Annulla</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="nconfirm">${esc(label)}: ${esc(P(pick) ? P(pick).name : '')}</button></div>` : ''}`;
    }

    function nightBody() {
      const s = st, me = s.me, task = s.nightTask, others = s.alive.filter(id => id !== me.id);
      const head = (t, sub) => `<p class="mono gold center">NOTTE ${s.night}</p><h1 class="title">${t}</h1><p class="dim center">${sub}</p>`;
      if (task === 'ghost') return head('Sei uno spirito', 'Sei morto: guarda in silenzio, senza suggerire niente.') + deaths();
      if (task === 'meet') {
        const allies = (s.wolves || []).filter(id => id !== me.id);
        return head('Il branco si riconosce', 'Stanotte non si caccia. Guardate chi c’è con voi.') + `<div class="allies big">${allies.length ? allies.map(id => `<span class="ally"><span class="avw">${avatar(P(id))}</span>${esc(P(id).name)}</span>`).join('') : '<span class="dim">Sei l’unico lupo.</span>'}</div>`
          + (s.done ? '<p class="mono dim center">FATTO · ASPETTA L’ALBA</p>' : '<button class="btn primary wide" data-a="nok">Ho visto</button>');
      }
      if (task === 'kill') {
        const picks = s.wolfPicks || {}, tags = {};
        Object.entries(picks).forEach(([w, t]) => { if (w !== me.id && P(w)) tags[t] = (tags[t] ? tags[t] + ' ' : '') + esc(P(w).name.split(' ')[0]); });
        const wolves = s.wolves || [], mine = picks[me.id];
        const aliveWolves = wolves.filter(id => s.alive.includes(id));
        const agree = aliveWolves.every(id => picks[id] === mine);
        if (s.done && mine && pick === null) {
          return head('Preda scelta', agree ? 'Il branco è d’accordo. Aspetta l’alba.' : 'Gli altri lupi hanno scelto diversamente: mettetevi d’accordo a gesti.')
            + `<div class="avbig mid">${avatar(P(mine))}</div><h2 class="title sm center">${esc(P(mine).name)}</h2>${Object.keys(tags).length ? pickList([...new Set(Object.values(picks))].filter(id => P(id)), { tags }) : ''}
            <button class="btn ghost wide" data-a="nchange">Cambia preda</button>`;
        }
        return head('Chi sbraniamo?', aliveWolves.length > 1 ? 'Scegli una preda: vedi le scelte degli altri lupi. Dovete essere d’accordo.' : 'Scegli la tua preda.')
          + pickList(others, { tags: { ...tags, ...Object.fromEntries(wolves.filter(id => id !== me.id).map(id => [id, 'LUPO'])) }, disabled: wolves, label: 'Sbrana', danger: true });
      }
      if (task === 'see') {
        if (s.vision) { const t = P(s.vision.target);
          return head('Il fuoco risponde', '') + `<div class="seerres ${s.vision.wolf ? 'wolf' : ''}"><div class="avbig">${avatar(t)}</div><p class="title">${esc(t.name)}</p>
            <p class="word ${s.vision.wolf ? 'red' : 'gold'}">${s.vision.wolf ? 'È UN LUPO' : 'NON È UN LUPO'}</p></div>`
            + (s.done ? '<p class="mono dim center">ASPETTA L’ALBA</p>' : '<button class="btn primary wide" data-a="nok">Ho capito</button>') + visions(true);
        }
        return head('Chi vuoi scrutare?', 'Il fuoco ti dirà se è un lupo.') + pickList(others, { label: 'Guarda' }) + visions();
      }
      if (task === 'heal') {
        if (s.done) return head('Protezione data', 'Aspetta l’alba.');
        return head('Chi proteggi stanotte?', s.noHeal ? `Non puoi proteggere ${esc(P(s.noHeal) ? P(s.noHeal).name : '')} due notti di fila.` : 'Puoi proteggere anche te.')
          + pickList(s.alive, { disabled: s.noHeal ? [s.noHeal] : [], label: 'Proteggi' });
      }
      // abitante (e cacciatore): stessa schermata degli altri, scelta senza effetto
      if (s.done) return head('Dormi', 'Aspetta l’alba con gli occhi chiusi.');
      return head('Di chi sospetti?', 'Scegli qualcuno: non succede nulla, serve solo a non far capire chi ha un potere.') + pickList(others, { label: 'Sospetto' });
    }
    const visions = (skipLast) => {
      const v = (st.visions || []).slice(0, skipLast ? -1 : undefined).filter(x => P(x.target)); if (!v.length) return '';
      return `<div class="deaths"><span class="mono dim">LE TUE VISIONI</span>${v.map(x => `<span>${esc(P(x.target).name)} <i class="${x.wolf ? 'red' : ''}">${x.wolf ? 'lupo' : 'non lupo'} · notte ${x.night}</i></span>`).join('')}</div>`;
    };

    function body() {
      const s = st, me = s.me;
      if (s.phase === 'lobby' || me.waiting) {
        if (confirmLeave) return `<h1 class="title">Uscire dal villaggio?</h1><p class="dim">Sparirai dalla lista dei giocatori.</p>
          <button class="btn danger wide" data-a="leave">Sì, esci</button><button class="btn ghost wide" data-a="stay">Resto</button>`;
        return `<div class="card-id"><div class="avbig">${avatar(me)}</div><div><p class="word sm">${esc(me.name)}</p>${me.score ? `<p class="mono dim">${me.score} punt${me.score === 1 ? 'o' : 'i'}</p>` : ''}</div></div>
          <p class="dim">${me.waiting ? 'Partita in corso: entri dalla prossima.' : `Sei nel villaggio. Siete in ${s.players.length}: si parte dallo schermo dell’host.`}</p>
          <div class="row2"><button class="btn ghost" data-a="edit">Modifica profilo</button><button class="btn ghost" data-a="askleave">Esci</button></div>
          <details class="rules"><summary>Come si gioca</summary><ol>
            <li><b>Scopri chi sei.</b> Tieni premuta la carta: sei un lupo o un abitante, forse con un potere. Non mostrarla.</li>
            <li><b>Di notte</b> tutti tengono il telefono in mano e scelgono qualcuno: così nessuno capisce chi sta agendo davvero.</li>
            <li><b>Di giorno</b> discutete e votate chi cacciare. Il villaggio vince eliminando tutti i lupi; i lupi vincono quando sono tanti quanti gli altri.</li></ol>
            <ul class="rlist">${Object.keys(ROLES).map(k => `<li>${roleIcon(k, 20)}<span><b>${ROLES[k].t}</b> ${esc(ROLES[k].d)}</span></li>`).join('')}</ul></details>`;
      }
      if (s.phase === 'roles') {
        return `<p class="mono gold center">${s.seenRole ? 'IN ATTESA DEGLI ALTRI' : 'IL TUO DESTINO'}</p>` + roleCard()
          + (revealed && !s.seenRole ? '<button class="btn primary wide" data-a="seen">Ho capito</button>' : '')
          + (s.seenRole ? '<p class="dim small center">Puoi rileggerla tenendo premuto.</p>' : '');
      }
      if (s.phase === 'night') return nightBody() + peekRole();
      if (s.phase === 'end') {
        const e = s.end, myRole = e.roles[me.id], won = ROLES[myRole].team === e.winner, g = e.gained[me.id] || 0;
        return `<p class="mono center ${won ? 'gold' : 'red'}">${won ? 'VITTORIA' : 'SCONFITTA'}</p><div class="avbig mid">${avatar(me, { dead: !me.alive })}</div>
          <h1 class="title">${e.winner === 'lupi' ? 'Vincono i lupi' : 'Vince il villaggio'}</h1>
          <p class="dim center">Eri ${myRole === 'lupo' ? 'un lupo' : myRole === 'abitante' ? 'un abitante' : 'il ' + ROLES[myRole].t.toLowerCase()}.${g ? ` +${g} punto` : ''}</p>
          <div class="deaths">${Object.keys(e.roles).filter(P).map(id => `<span>${roleIcon(e.roles[id], 16)} ${esc(P(id).name)} <i>${esc(ROLES[e.roles[id]].t)}</i></span>`).join('')}</div>
          <p class="mono dim center">Totale ${me.score} punt${me.score === 1 ? 'o' : 'i'}</p>`;
      }
      if (s.phase === 'hunter' && s.hunter && s.hunter.id === me.id) {
        return `<p class="mono red center">L’ULTIMA FRECCIA</p><h1 class="title">Chi porti con te?</h1><p class="dim center">Sei morto, ma sei il cacciatore: scegli chi colpire.</p>`
          + pickList(s.alive.filter(id => id !== me.id), { label: 'Colpisci', danger: true, act: 'hpick' });
      }
      if (!me.alive) {
        return `<div class="avbig mid">${avatar(me, { dead: true })}</div><h1 class="title">Sei uno spirito</h1><p class="dim center">Sei fuori dal gioco: guarda lo schermo e non suggerire niente.</p>${deaths()}${peekRole()}`;
      }
      if (s.phase === 'dawn') {
        const d = s.dawn || {}, v = d.victim && P(d.victim);
        return `<p class="mono gold center">ALBA</p>${v ? `<div class="avbig mid">${avatar(v, { dead: true })}</div><h1 class="title">${esc(v.name)} non c’è più</h1>` : `<h1 class="title">Nessun morto stanotte</h1>`}<p class="dim center">Guarda lo schermo.</p>${peekRole()}`;
      }
      if (s.phase === 'hunter' || s.phase === 'shot') return `<p class="mono red center">L’ULTIMA FRECCIA</p><h1 class="title">Il cacciatore prende la mira</h1><p class="dim center">Guarda lo schermo.</p>${peekRole()}`;
      if (s.phase === 'day') {
        const left = dayBase ? Math.max(0, Math.ceil((dayBase - Date.now()) / 1000)) : null;
        return `<p class="mono gold center">GIORNO ${s.day}</p><h1 class="title">Discutete</h1><p class="dim center">Chi è il lupo? Parlate ad alta voce: il voto arriva sul telefono.</p>
          ${left != null ? `<p class="count mono center" id="left">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</p>` : ''}${deaths()}${peekRole()}`;
      }
      if (s.phase === 'vote') {
        if (s.myVote && pick === null) {
          const v = P(s.myVote);
          return `<p class="mono dim center">VOTO REGISTRATO</p><div class="avbig mid">${avatar(v)}</div><h1 class="title">Hai votato ${esc(v.name)}</h1>
            <p class="dim center">${s.voted} su ${s.voters} hanno votato</p><button class="btn ghost wide" data-a="change">Cambia voto</button>`;
        }
        return `<h1 class="title">${s.runoff ? 'Ballottaggio' : 'Chi cacciamo?'}</h1><p class="dim center">Tocca un nome, poi conferma.</p>`
          + pickList(s.candidates.filter(id => id !== me.id), { label: 'Caccia', danger: true, act: 'vpick' }) + peekRole();
      }
      if (s.phase === 'result') {
        const r = s.result, e = r.elim && P(r.elim);
        if (!e) return `<h1 class="title">Nessuna decisione</h1><p class="dim center">Nessuno viene cacciato. Guarda lo schermo.</p>`;
        return `<div class="avbig mid">${avatar(e, { dead: true })}</div><h1 class="title">${esc(e.name)} viene cacciato</h1><p class="dim center">${r.role ? 'Era ' + esc(ROLES[r.role].t) + '.' : 'Guarda lo schermo.'}</p>`;
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

    const hideHold = () => { if (!holding) return; holding = false; box.querySelectorAll('[data-hold].open').forEach(d => d.classList.remove('open')); render(); };
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
        case 'npick': case 'hpick': case 'vpick':
          pick = b.dataset.id;
          if (st.phase === 'night' && st.nightTask === 'kill') send({ t: 'night', pick: 1, target: pick });   // gli altri lupi vedono subito
          render(); break;
        case 'unpick': pick = null; if (st.phase === 'night' && st.nightTask === 'kill') send({ t: 'night', pick: 1, target: null }); render(); break;
        case 'nconfirm': {
          const t = pick; pick = null; buzz(40);
          if (st.phase === 'night') { if (st.nightTask === 'kill') send({ t: 'night', ok: 1 }); else send({ t: 'night', target: t }); }
          else if (st.phase === 'hunter') send({ t: 'shoot', target: t });
          else if (st.phase === 'vote') send({ t: 'vote', target: t });
          render(); break;
        }
        case 'nchange': pick = (st.wolfPicks || {})[st.me.id] || null; send({ t: 'night', pick: 1, target: pick }); render(); break;
        case 'nok': send({ t: 'night', ok: 1 }); buzz(30); b.disabled = true; break;
        case 'change': pick = st.myVote; send({ t: 'unvote' }); render(); break;
        case 'edit': openEditor(); break;
        case 'askleave': confirmLeave = true; render(); break;
        case 'stay': confirmLeave = false; render(); break;
        case 'leave': confirmLeave = false; send({ t: 'leave' }); opts.onExit && opts.onExit(); break;
      }
    });
    setInterval(() => { const el = box.querySelector('#left'); if (el && dayBase) { const l = Math.max(0, Math.ceil((dayBase - Date.now()) / 1000)); el.textContent = `${Math.floor(l / 60)}:${String(l % 60).padStart(2, '0')}`; } }, 250);

    render();
    return { receive, render, get state() { return st; }, el: box };
  };
})();
