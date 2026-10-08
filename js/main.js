// Claude Conflict – Menüs, Dialoge, Kampagnen- und Gefechtsablauf
(function (G) {
  const E = G.Engine, A = G.Audio, I = G.I18N, X = G.Gfx, S = G.Settings;
  const { el, esc, unitIcon } = G.dom;
  const t = (k, v) => I.t(k, v);
  const app = document.getElementById('app');
  let game = null, current = null;

  // --- Fortschritt ---
  const Progress = {
    get done() { try { return (JSON.parse(localStorage.getItem('cc.progress') || '{}').done) || 0; } catch (e) { return 0; } },
    set done(n) { try { localStorage.setItem('cc.progress', JSON.stringify({ done: n })); } catch (e) { } },
    reset() { try { localStorage.removeItem('cc.progress'); } catch (e) { } },
  };

  function show(fn) {
    if (game) { game.destroy(); game = null; }
    current = fn;
    app.innerHTML = '';
    fn();
  }
  const btn = (label, fn, cls) => { const b = el('button', 'btn' + (cls ? ' ' + cls : ''), label); b.addEventListener('click', () => { A.init(); A.play('click'); fn(); }); return b; };
  const page = (cls) => { const p = el('div', 'page ' + (cls || '')); app.appendChild(p); return p; };
  const head = (title, backFn) => {
    const h = el('div', 'page-head');
    if (backFn) h.appendChild(btn('← ' + t('back'), backFn, 'small'));
    h.appendChild(el('h2', '', esc(title)));
    return h;
  };

  // --- Hauptmenü ---
  function menu() {
    const p = page('menu');
    const deco = el('canvas', 'deco'); deco.width = 560; deco.height = 150;
    p.appendChild(deco);
    p.appendChild(el('h1', 'logo', '<span>Claude</span> Conflict'));
    p.appendChild(el('p', 'tagline', esc(t('subtitle'))));
    const col = el('div', 'menu-btns');
    col.append(btn(t('campaign'), () => show(campaignScreen), 'primary big'), btn(t('skirmish'), () => show(skirmishScreen), 'big'), btn(t('settings'), () => show(settingsScreen), 'big'), btn(t('help'), () => show(helpScreen), 'big'));
    p.appendChild(col);
    const ctx = deco.getContext('2d');
    const types = ['trooper', 'rocketeer', 'tank', 'howitzer', 'chopper', 'flak', 'buggy'];
    (function loop(now) {
      if (!deco.isConnected) return;
      ctx.clearRect(0, 0, deco.width, deco.height);
      types.forEach((ty, i) => X.drawUnit(ctx, ty, i % 4, 45 + i * 78, 85 + (ty === 'chopper' ? -12 : 0), 80, { time: now, flip: i > 3 }));
      requestAnimationFrame(loop);
    })(0);
  }

  // --- Dialog ---
  function dialog(lines) {
    return new Promise((resolve) => {
      let i = 0, timer = null, full = '';
      const ov = el('div', 'dialog');
      const box = el('div', 'dialog-box');
      const portrait = el('canvas', 'portrait'); portrait.width = portrait.height = 220;
      const side = el('div', 'dialog-text');
      const who = el('div', 'dialog-who');
      const txt = el('div', 'dialog-line');
      const hint = el('div', 'dialog-hint', esc(t('tapContinue')));
      const skip = btn(t('skip'), () => end(), 'small ghost');
      side.append(who, txt, hint);
      box.append(portrait, side);
      ov.append(box, skip);
      app.appendChild(ov);
      function end() { clearInterval(timer); document.removeEventListener('keydown', key); ov.remove(); resolve(); }
      function line() {
        const l = lines[i], c = G.CHARS[l.w];
        X.drawPortrait(portrait.getContext('2d'), l.w, 220, l.e);
        who.textContent = I.tx(c); who.style.color = c.color;
        full = I.tx(l);
        let n = 0; txt.textContent = '';
        clearInterval(timer);
        if (S.speed === 0) { txt.textContent = full; return; }
        timer = setInterval(() => { n += 2; txt.textContent = full.slice(0, n); if (n % 6 === 0) A.play('dialog'); if (n >= full.length) { clearInterval(timer); txt.textContent = full; } }, 22);
      }
      function next() {
        if (txt.textContent.length < full.length) { clearInterval(timer); txt.textContent = full; return; }
        if (++i >= lines.length) end(); else line();
      }
      const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } else if (e.key === 'Escape') end(); };
      document.addEventListener('keydown', key);
      box.addEventListener('click', () => { A.init(); next(); });
      line();
    });
  }

  // --- Kampagne ---
  function campaignScreen() {
    const p = page();
    p.appendChild(head(I.tx({ de: 'Der Kuckuck von Pipsburg', en: 'The Cuckoo of Pipsburg' }), () => show(menu)));
    const done = Progress.done;
    const grid = el('div', 'missions');
    G.CAMPAIGN.forEach((m, i) => {
      const unlocked = S.unlockAll || i <= done;
      const c = el('button', 'mission' + (unlocked ? '' : ' locked') + (i < done ? ' done' : ''));
      c.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="mt"><b>' + esc(I.tx(m.title)) + '</b><small>' +
        (unlocked ? esc(t('obj_' + m.objective.type, { n: m.objective.days })) : '🔒 ' + esc(t('locked'))) + '</small></span>' + (i < done ? '<span class="star">★</span>' : '');
      c.disabled = !unlocked;
      c.addEventListener('click', () => { A.init(); A.play('click'); startMission(i); });
      grid.appendChild(c);
    });
    p.appendChild(grid);
  }

  async function startMission(i) {
    const m = G.CAMPAIGN[i];
    show(() => { page('dim'); });
    await dialog(m.intro);
    if (!app.querySelector('.page.dim')) return;
    launch(m.map, { players: m.players, objective: m.objective }, {
      onQuit: () => show(campaignScreen),
      onFinish: async (res) => {
        const ctrl = res.ctrl;
        if (res.humanWon) {
          if (Progress.done < i + 1) Progress.done = i + 1;
          await dialog(m.outro);
          const last = i + 1 >= G.CAMPAIGN.length;
          const buttons = [];
          if (!last) buttons.push({ label: t('next'), cls: 'primary', fn: () => startMission(i + 1) });
          buttons.push({ label: t('replay'), fn: () => startMission(i) }, { label: t('toMenu'), fn: () => show(campaignScreen) });
          ctrl.showResult({ title: t('victory'), text: last ? t('allWon') : I.tx(m.title), good: true, buttons });
        } else {
          ctrl.showResult({
            title: t('defeat'), text: res.why === 'timeout' ? t('gameOver') : I.tx(m.title), color: '#ff7a66',
            buttons: [{ label: t('retry'), cls: 'primary', fn: () => startMission(i) }, { label: t('toMenu'), fn: () => show(campaignScreen) }],
          });
        }
      },
    });
  }

  function launch(def, cfg, handlers) {
    if (game) game.destroy();
    app.innerHTML = '';
    const root = el('div', 'gameroot');
    app.appendChild(root);
    current = null;
    game = G.UI.create(root, Object.assign({ def, cfg }, handlers));
    game.start();
    window.__game = game;
  }

  // --- Gefecht ---
  const sk = { map: 0, funds: 1500, slots: null };
  function skirmishScreen() {
    const maps = G.MPMAPS, mp = maps[sk.map];
    if (!sk.slots || sk.slots.length !== mp.players) {
      sk.slots = Array.from({ length: mp.players }, (_, i) => ({ mode: i === 0 ? 'human' : 'ai', team: i }));
    }
    const p = page();
    p.appendChild(head(t('skirmish'), () => show(menu)));
    const body = el('div', 'sk');
    // Karte
    const mapBox = el('div', 'sk-map');
    mapBox.appendChild(el('h3', '', esc(t('chooseMap'))));
    const tabs = el('div', 'tabs');
    maps.forEach((m, i) => {
      const b = btn(I.tx(m.name) + ' (' + m.players + ')', () => { sk.map = i; sk.slots = null; show(skirmishScreen); }, 'small' + (i === sk.map ? ' primary' : ''));
      tabs.appendChild(b);
    });
    mapBox.appendChild(tabs);
    const pv = el('canvas', 'preview');
    const parsed = E.parseMap(mp);
    const pts = Math.max(6, Math.floor(Math.min(440 / parsed.w, 300 / parsed.h)));
    pv.width = pts * parsed.w; pv.height = pts * parsed.h;
    const c = pv.getContext('2d');
    for (let y = 0; y < parsed.h; y++) for (let x = 0; x < parsed.w; x++) X.drawTile(c, parsed, x, y, x * pts, y * pts, pts, 0, [0, 1, 2, 3]);
    mapBox.appendChild(pv);
    mapBox.appendChild(el('small', '', esc(parsed.w + ' × ' + parsed.h)));
    body.appendChild(mapBox);
    // Spieler
    const side = el('div', 'sk-side');
    side.appendChild(el('h3', '', esc(t('players'))));
    sk.slots.forEach((s, i) => {
      const row = el('div', 'slot');
      row.appendChild(el('span', 'chip big', '')).style.background = G.PLAYER_COLORS[i].main;
      row.appendChild(el('b', '', esc(t('color.' + i))));
      const mode = el('select');
      [['human', t('human')], ['ai', t('ai')], ['off', t('off_slot')]].forEach(([v, l]) => { const o = el('option', '', esc(l)); o.value = v; if (s.mode === v) o.selected = true; mode.appendChild(o); });
      mode.addEventListener('change', () => { s.mode = mode.value; });
      const team = el('select');
      for (let k = 0; k < mp.players; k++) { const o = el('option', '', esc(t('team') + ' ' + (k + 1))); o.value = k; if (s.team === k) o.selected = true; team.appendChild(o); }
      team.addEventListener('change', () => { s.team = Number(team.value); });
      row.append(mode, team);
      side.appendChild(row);
    });
    const fr = el('div', 'slot');
    fr.appendChild(el('b', '', esc(t('startFunds'))));
    const fs = el('select');
    [500, 1000, 1500, 2500, 5000].forEach((v) => { const o = el('option', '', String(v)); o.value = v; if (sk.funds === v) o.selected = true; fs.appendChild(o); });
    fs.addEventListener('change', () => { sk.funds = Number(fs.value); });
    fr.appendChild(fs);
    side.appendChild(fr);
    const err = el('div', 'err');
    side.appendChild(err);
    side.appendChild(btn(t('start'), () => {
      const active = sk.slots.filter((s) => s.mode !== 'off');
      if (active.length < 2 || new Set(active.map((s) => s.team)).size < 2) { err.textContent = t('needTwoTeams'); A.play('cancel'); return; }
      startSkirmish();
    }, 'primary big'));
    body.appendChild(side);
    p.appendChild(body);
  }

  function startSkirmish() {
    const mp = G.MPMAPS[sk.map];
    const players = sk.slots.map((s, i) => ({ team: s.team, color: i, ai: s.mode === 'ai', off: s.mode === 'off', name: t('color.' + i), funds: sk.funds }));
    launch(mp, { players, objective: { type: 'rout' } }, {
      onQuit: () => show(skirmishScreen),
      onFinish: (res) => {
        const st = res.st;
        const names = st.players.filter((p) => p.alive && p.team === res.winnerTeam).map((p) => p.name).join(', ');
        const spectate = !players.some((p) => !p.ai && !p.off);
        res.ctrl.showResult({
          title: spectate ? t('gameOver') : res.humanWon ? t('victory') : t('defeat'), text: t('winnerIs', { n: names || '–' }), good: res.humanWon, color: res.humanWon ? '#ffe27a' : '#ff7a66',
          buttons: [{ label: t('rematch'), cls: 'primary', fn: startSkirmish }, { label: t('toMenu'), fn: () => show(skirmishScreen) }],
        });
      },
    });
  }

  // --- Einstellungen ---
  function settingsScreen() {
    const p = page();
    p.appendChild(head(t('settings'), () => show(menu)));
    const box = el('div', 'settings');
    const row = (label, ctl) => { const r = el('div', 'srow'); r.appendChild(el('span', '', esc(label))); r.appendChild(ctl); box.appendChild(r); };
    const seg = (opts, cur, fn) => {
      const d = el('div', 'seg');
      opts.forEach(([v, l]) => d.appendChild(btn(l, () => { fn(v); show(settingsScreen); }, 'small' + (cur === v ? ' primary' : ''))));
      return d;
    };
    row(t('language'), seg([['de', 'Deutsch'], ['en', 'English']], I.lang, (v) => I.setLang(v)));
    row(t('sound'), seg([[true, t('on')], [false, t('off')]], A.on, (v) => { A.set(v); if (v) A.play('select'); }));
    const vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = Math.round(A.vol * 100);
    vol.addEventListener('input', () => A.set(null, vol.value / 100));
    vol.addEventListener('change', () => { A.init(); A.play('capture'); });
    row(t('volume'), vol);
    row(t('animSpeed'), seg([['normal', t('animNormal')], ['fast', t('animFast')], ['off', t('animOff')]], S.anim, (v) => { S.anim = v; S.save(); }));
    row(t('unlockAll'), seg([[true, t('on')], [false, t('off')]], S.unlockAll, (v) => { S.unlockAll = v; S.save(); }));
    row(t('resetProgress'), btn(t('resetProgress'), () => { if (confirm(t('confirmReset'))) { Progress.reset(); show(settingsScreen); } }, 'small danger'));
    p.appendChild(box);
  }

  // --- Spielhilfe ---
  function helpScreen() {
    const p = page();
    p.appendChild(head(t('help'), () => show(menu)));
    const box = el('div', 'helpbox');
    box.appendChild(el('ul', 'help', t('helpText').map((s) => '<li>' + esc(s) + '</li>').join('')));
    const grid = el('div', 'units');
    G.UNIT_ORDER.forEach((ty) => {
      const d = G.UNITS[ty], card = el('div', 'ucard');
      card.appendChild(unitIcon(ty, 1, 52));
      const inf = el('div', '', '<b>' + esc(t('unit.' + ty)) + '</b> <small>' + d.cost + '</small><br><small>' + esc(t('move')) + ' ' + d.move + ' · ' + esc(t('range')) + ' ' + (d.range[0] === d.range[1] ? d.range[0] : d.range[0] + '–' + d.range[1]) + '</small><br><small>' + esc(t('unitDesc.' + ty)) + '</small>');
      card.appendChild(inf);
      grid.appendChild(card);
    });
    box.appendChild(grid);
    p.appendChild(box);
  }

  // --- Start ---
  I.detect();
  document.title = 'Claude Conflict';
  document.addEventListener('pointerdown', () => A.init(), { once: true });
  X.preload(4000).then(() => { X.preloadPortraits(); show(menu); });
  G.Main = { show, menu };
})(window.CC = window.CC || {});
