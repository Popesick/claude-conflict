// Claude Conflict – Spielansicht: Canvas, Eingabe, Animationen, KI-Schleife
(function (G) {
  const E = G.Engine, A = G.Audio, I = G.I18N, X = G.Gfx;
  const t = (k, v) => I.t(k, v);

  // --- Einstellungen (Animation, Testoptionen) ---
  const Settings = {
    anim: 'normal', unlockAll: false,
    load() { try { const o = JSON.parse(localStorage.getItem('cc.settings') || '{}'); if (o.anim) this.anim = o.anim; this.unlockAll = !!o.unlockAll; } catch (e) { } },
    save() { try { localStorage.setItem('cc.settings', JSON.stringify({ anim: this.anim, unlockAll: this.unlockAll })); } catch (e) { } },
    get speed() { return this.anim === 'off' ? 0 : this.anim === 'fast' ? 0.45 : 1; },
  };
  Settings.load();

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function unitIcon(type, color, px) {
    const c = document.createElement('canvas');
    const d = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = px * d; c.style.width = c.style.height = px + 'px';
    const x = c.getContext('2d'); x.scale(d, d);
    X.drawIconUnit(x, type, color, px / 2, px / 2, px * 0.9);
    return c;
  }

  function create(root, opts) {
    const def = opts.def, cfg = opts.cfg;
    let st = E.newGame(def, cfg);
    // abgeschaltete Plätze: Spieler tot, Besitz neutral
    cfg.players.forEach((p, i) => {
      if (p.off) {
        st.players[i].alive = false;
        for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) if (st.owner[y][x] === i) st.owner[y][x] = -1;
        st.units = st.units.filter((u) => u.owner !== i);
      }
    });
    G.AI.reset();
    const colors = () => st.players.map((p) => p.color);
    const humans = st.players.filter((p) => !p.ai && p.alive);

    // --- DOM ---
    root.innerHTML = '';
    const wrap = el('div', 'game');
    const hud = el('div', 'hud');
    const hudDay = el('div', 'hud-day');
    const hudPlayer = el('div', 'hud-player');
    const hudFunds = el('div', 'hud-funds');
    const hudObj = el('div', 'hud-obj');
    const hudBtns = el('div', 'hud-btns');
    const btnMenu = el('button', 'btn small', '☰');
    const btnEnd = el('button', 'btn primary small', '');
    hudBtns.append(btnMenu, btnEnd);
    hud.append(hudDay, hudPlayer, hudFunds, hudObj, hudBtns);
    const stage = el('div', 'stage');
    const board = el('div', 'board');
    const canvas = el('canvas');
    board.appendChild(canvas);
    stage.appendChild(board);
    const info = el('div', 'info');
    wrap.append(hud, stage, info);
    root.appendChild(wrap);
    const ctx = canvas.getContext('2d');

    // --- Laufzeitzustand ---
    let ts = 40, dpr = 1, W = 0, H = 0;
    let destroyed = false, busy = 0, dirty = true, aiRunning = false, finished = false;
    let mode = 'idle', sel = null, reach = null, undoSnap = null, threat = new Set(), targets = [];
    let insp = null, inspMove = null, inspAtk = null;
    let hover = null, cursorInfo = null, menuEl = null;
    const vis = {};              // id -> {x,y,dx,dy,flip}
    const hpOv = {};             // id -> HP-Anzeige während einer Animation
    const ghosts = {};           // id -> Einheit, die schon aus dem Zustand entfernt wurde
    const face = {};
    const popups = [], parts = [];
    let terr = document.createElement('canvas');

    const sp = () => Settings.speed;
    const sleep = (ms) => (sp() === 0 ? Promise.resolve() : wait(ms * sp()));
    function tween(ms, fn) {
      if (sp() === 0) { fn(1); return Promise.resolve(); }
      const dur = ms * sp();
      return new Promise((res) => {
        const t0 = performance.now();
        const step = () => {
          if (destroyed) return res();
          const p = Math.min(1, (performance.now() - t0) / dur);
          fn(p);
          if (p >= 1) res(); else setTimeout(step, 16);
        };
        step();
      });
    }

    // --- Layout ---
    function layout() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const aw = Math.max(200, stage.clientWidth - 8), ah = Math.max(160, stage.clientHeight - 8);
      ts = Math.max(22, Math.floor(Math.min(aw / st.w, ah / st.h)));
      W = ts * st.w; H = ts * st.h;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      board.style.width = W + 'px'; board.style.height = H + 'px';
      terr.width = W * dpr; terr.height = H * dpr;
      dirty = true;
    }
    function redrawTerrain() {
      const c = terr.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = colors();
      for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) X.drawTile(c, st, x, y, x * ts, y * ts, ts, 0, cols);
      dirty = false;
    }

    // --- Zeichnen ---
    const cx = (x) => (x + 0.5) * ts, cy = (y) => (y + 0.5) * ts;
    function drawUnitAt(u, now, ghost) {
      const v = vis[u.id];
      const px = v ? v.x : u.x, py = v ? v.y : u.y;
      let flip = v && v.flip != null ? v.flip : face[u.id];
      if (flip == null) flip = u.x > st.w / 2;
      const hp = hpOv[u.id] != null ? hpOv[u.id] : u.hp;
      X.drawUnit(ctx, u.type, st.players[u.owner].color, cx(px), cy(py), ts, {
        time: now, flip, dx: v ? (v.dx || 0) * ts : 0, dy: v ? (v.dy || 0) * ts : 0,
        done: !ghost && u.done && u.owner === st.cur && !st.players[st.cur].ai ? true : false,
        hp, capt: u.capt, alpha: v && v.alpha,
      });
    }
    function tileRect(x, y, fill, stroke, lwid) {
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(x * ts, y * ts, ts, ts); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lwid || 2; ctx.strokeRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2); }
    }
    function draw(now) {
      if (dirty) redrawTerrain();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(terr, 0, 0, W, H);
      // Reichweite
      if (reach && (mode === 'sel')) {
        reach.stops.forEach((_, k) => { const [x, y] = k.split(',').map(Number); tileRect(x, y, 'rgba(70,150,255,0.38)', 'rgba(255,255,255,0.55)', 1.5); });
        threat.forEach((id) => { const e = E.unitById(st, id); if (e) tileRect(e.x, e.y, 'rgba(255,60,40,0.28)', 'rgba(255,60,40,0.9)', 2.5); });
        if (hover && reach.stops.has(hover.x + ',' + hover.y) && (hover.x !== sel.x || hover.y !== sel.y)) {
          const path = E.pathTo(reach, hover.x, hover.y);
          ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(3, ts * 0.09); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.setLineDash([ts * 0.12, ts * 0.12]); ctx.beginPath();
          path.forEach((p, i) => (i ? ctx.lineTo(cx(p.x), cy(p.y)) : ctx.moveTo(cx(p.x), cy(p.y)))); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      if (mode === 'inspect' && insp) {
        inspAtk.forEach((k) => { const [x, y] = k.split(',').map(Number); tileRect(x, y, 'rgba(255,60,40,0.34)', 'rgba(255,60,40,0.8)', 1.5); });
        inspMove.forEach((k) => { const [x, y] = k.split(',').map(Number); tileRect(x, y, 'rgba(255,190,60,0.3)', 'rgba(255,225,130,0.95)', 1.5); });
        tileRect(insp.x, insp.y, 'rgba(255,255,255,0.18)', '#fff', 3);
      }
      if (mode === 'target') targets.forEach((e) => tileRect(e.x, e.y, 'rgba(255,60,40,0.4)', '#ff3b24', 3));
      if (mode === 'menu' && sel) tileRect(sel.x, sel.y, 'rgba(255,255,255,0.2)', '#fff', 2.5);
      // Einheiten (nach y sortiert)
      const list = st.units.map((u) => [u, false]);
      Object.values(ghosts).forEach((g) => list.push([g, true]));
      list.sort((a, b) => ((vis[a[0].id] ? vis[a[0].id].y : a[0].y) - (vis[b[0].id] ? vis[b[0].id].y : b[0].y)));
      list.forEach(([u, g]) => drawUnitAt(u, now, g));
      // Schadensvorschau
      if (mode === 'target' && sel) {
        targets.forEach((e) => {
          const dmg = E.calcDamage(st, sel, e, sel.hp);
          const rem = e.hp - dmg;
          let counter = 0;
          if (rem > 0 && !G.UNITS[e.type].indirect && Math.abs(e.x - sel.x) + Math.abs(e.y - sel.y) === 1 && G.DMG[e.type][sel.type] > 0) counter = E.calcDamage(st, Object.assign({}, e, { hp: rem }), sel, rem);
          label(e.x, e.y, '−' + Math.min(10, Math.round(dmg / 10)) + (counter ? ' ↩' + Math.round(counter / 10) : ''));
        });
      }
      // Cursor
      if (hover && mode !== 'busy') tileRect(hover.x, hover.y, null, 'rgba(255,255,255,0.9)', 2);
      // Partikel + Popups
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i], a = (now - p.t0) / p.life;
        if (a >= 1) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - a; ctx.fillStyle = p.color;
        const px = p.x + p.vx * (now - p.t0) / 1000 * ts, py = p.y + p.vy * (now - p.t0) / 1000 * ts + 0.5 * 3 * ts * Math.pow((now - p.t0) / 1000, 2);
        ctx.beginPath(); ctx.arc(px * 1, py * 1, p.size * ts * (1 - a * 0.5), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i], a = (now - p.t0) / p.life;
        if (a >= 1) { popups.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = a > 0.7 ? (1 - a) / 0.3 : 1;
        ctx.font = '900 ' + Math.round(ts * 0.42) + 'px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const px = cx(p.x), py = cy(p.y) - ts * 0.3 - a * ts * 0.5;
        ctx.lineWidth = ts * 0.1; ctx.strokeStyle = '#2a1f14'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, px, py);
        ctx.fillStyle = p.color; ctx.fillText(p.text, px, py);
        ctx.restore();
      }
    }
    function label(x, y, text) {
      ctx.save();
      ctx.font = '900 ' + Math.round(ts * 0.3) + 'px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(text).width + ts * 0.2, px = cx(x), py = y * ts + ts * 0.08;
      ctx.fillStyle = '#fffbe8'; ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px - w / 2, py - ts * 0.14, w, ts * 0.3, ts * 0.08) : ctx.rect(px - w / 2, py - ts * 0.14, w, ts * 0.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8321f'; ctx.fillText(text, px, py + 1);
      ctx.restore();
    }
    let raf = 0;
    function frame(now) { if (destroyed) return; draw(now); raf = requestAnimationFrame(frame); }

    function popup(x, y, text, color) { popups.push({ x, y, text, color: color || '#fff', t0: performance.now(), life: 900 }); }
    function boom(x, y, big) {
      const now = performance.now();
      const cols = ['#ffdc5c', '#ff9a2e', '#e8472f', '#fff3b0'];
      for (let i = 0; i < (big ? 26 : 12); i++) {
        const a = Math.random() * 6.283, v = (0.6 + Math.random() * 1.6) * (big ? 1.3 : 0.8);
        parts.push({ x: cx(x), y: cy(y), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, size: 0.05 + Math.random() * 0.09, color: cols[i % 4], life: 500 + Math.random() * 400, t0: now });
      }
    }

    // --- Ereignisse abspielen ---
    function snapUnits() { const m = {}; st.units.forEach((u) => { m[u.id] = Object.assign({}, u); }); return m; }

    async function playEvents(events, pre) {
      events.filter((e) => e.k === 'attack').forEach((e) => {
        if (pre[e.tid]) hpOv[e.tid] = pre[e.tid].hp;
        if (pre[e.id]) hpOv[e.id] = pre[e.id].hp;
        if (e.killed && pre[e.tid]) ghosts[e.tid] = pre[e.tid];
        if (e.ckilled && pre[e.id]) ghosts[e.id] = pre[e.id];
      });
      for (const ev of events) {
        if (destroyed) return;
        if (ev.k === 'move') {
          const p = ev.path;
          for (let i = 1; i < p.length; i++) {
            const a = p[i - 1], b = p[i];
            if (b.x !== a.x) face[ev.id] = b.x < a.x;
            A.play('step');
            await tween(105, (q) => { vis[ev.id] = { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q }; });
          }
          delete vis[ev.id];
        } else if (ev.k === 'attack') {
          const a = pre[ev.id], d = pre[ev.tid];
          const ua = a || E.unitById(st, ev.id), ud = d || E.unitById(st, ev.tid);
          if (!ua || !ud) continue;
          const au = G.UNITS[ua.type];
          const dx = Math.sign(ud.x - ua.x), dy = Math.sign(ud.y - ua.y);
          if (ud.x !== ua.x) face[ev.id] = ud.x < ua.x;
          A.play(ua.type === 'tank' || ua.type === 'howitzer' ? 'cannon' : 'shoot');
          if (au.indirect) {
            await tween(320, (q) => { const px = ua.x + (ud.x - ua.x) * q, py = ua.y + (ud.y - ua.y) * q - Math.sin(q * Math.PI) * 1.2; parts.push({ x: cx(px), y: cy(py), vx: 0, vy: 0, size: 0.06, color: '#2a1f14', life: 160, t0: performance.now() }); });
          } else {
            await tween(150, (q) => { vis[ev.id] = { x: ua.x, y: ua.y, dx: dx * 0.28 * Math.sin(q * Math.PI), dy: dy * 0.28 * Math.sin(q * Math.PI), flip: face[ev.id] }; });
            delete vis[ev.id];
          }
          delete hpOv[ev.tid];
          A.play(ev.killed ? 'boom' : 'hit');
          popup(ud.x, ud.y, '−' + Math.min(10, Math.round(ev.dmg / 10)), '#ff6b52');
          boom(ud.x, ud.y, ev.killed);
          await tween(220, (q) => { vis[ev.tid] = { x: ud.x, y: ud.y, dx: Math.sin(q * 30) * 0.06 * (1 - q), dy: 0, flip: face[ev.tid] }; });
          delete vis[ev.tid];
          if (ev.killed) { delete ghosts[ev.tid]; await sleep(120); }
          else if (ev.counter > 0) {
            await sleep(120);
            A.play(ud.type === 'tank' ? 'cannon' : 'shoot');
            const ddx = -dx, ddy = -dy;
            await tween(140, (q) => { vis[ev.tid] = { x: ud.x, y: ud.y, dx: ddx * 0.25 * Math.sin(q * Math.PI), dy: ddy * 0.25 * Math.sin(q * Math.PI), flip: face[ev.tid] }; });
            delete vis[ev.tid];
            delete hpOv[ev.id];
            A.play(ev.ckilled ? 'boom' : 'hit');
            popup(ua.x, ua.y, '−' + Math.min(10, Math.round(ev.counter / 10)), '#ff6b52');
            boom(ua.x, ua.y, ev.ckilled);
            if (ev.ckilled) { delete ghosts[ev.id]; }
            await sleep(120);
          }
          delete hpOv[ev.tid]; delete hpOv[ev.id]; delete ghosts[ev.tid]; delete ghosts[ev.id];
        } else if (ev.k === 'capture') {
          A.play(ev.done ? 'captured' : 'capture');
          popup(ev.x, ev.y, ev.done ? t('capturedMsg') : ev.pts + '/' + E.CAPTURE_MAX, ev.done ? '#ffe27a' : '#fff');
          dirty = true;
          await sleep(ev.done ? 450 : 260);
        } else if (ev.k === 'build') {
          A.play('build');
          const u = E.unitById(st, ev.id);
          if (u) await tween(200, (q) => { vis[ev.id] = { x: u.x, y: u.y - (1 - q) * 0.4, dy: 0 }; });
          delete vis[ev.id];
        } else if (ev.k === 'heal') {
          const u = E.unitById(st, ev.id);
          if (u) popup(u.x, u.y, '+' + Math.round(ev.amt / 10), '#7dff8a');
        } else if (ev.k === 'turn') {
          dirty = true; updateHud();
          if (events.some((e) => e.k === 'heal')) A.play('heal');
          A.play('turn');
          await showBanner(ev);
        } else if (ev.k === 'eliminated') {
          A.play('boom');
          await banner(t('eliminated', { n: esc(st.players[ev.player].name) }), G.PLAYER_COLORS[st.players[ev.player].color].main, 1100);
        }
      }
    }

    // --- Banner ---
    let bannerEl = null;
    function banner(html, color, ms, click) {
      if (bannerEl) bannerEl.remove();
      const b = el('div', 'banner');
      b.innerHTML = '<div class="banner-in" style="border-color:' + color + '">' + html + '</div>';
      wrap.appendChild(b);
      bannerEl = b;
      return new Promise((res) => {
        const done = () => { if (bannerEl === b) bannerEl = null; b.remove(); res(); };
        if (click) { b.classList.add('click'); b.addEventListener('click', done); }
        else if (sp() === 0) done();
        else setTimeout(done, ms * Math.max(0.5, sp()));
      });
    }
    async function showBanner(ev) {
      const p = st.players[ev.player], col = G.PLAYER_COLORS[p.color].main;
      const multi = humans.length >= 2 && !p.ai;
      const head = '<div class="banner-day">' + t('dayN', { n: ev.day }) + '</div>';
      if (multi) await banner(head + '<div class="banner-name" style="color:' + col + '">' + t('passDevice') + '<br><b>' + esc(p.name) + '</b></div><div class="banner-sub">' + t('tapContinue') + '</div>', col, 0, true);
      else await banner(head + '<div class="banner-name" style="color:' + col + '">' + t('turnOf', { n: esc(p.name) }) + '</div>', col, 900);
    }

    // --- HUD / Info ---
    function incomeOf(pi) {
      let n = 0;
      for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) if (st.owner[y][x] === pi) n += E.terr(st, x, y).income || 0;
      return n;
    }
    function objText() {
      const o = st.objective;
      if (o.type === 'survive') return t('obj_survive', { n: o.days }) + ' (' + t('day') + ' ' + st.day + ')';
      return t('obj_' + o.type);
    }
    function readyCount() { return st.units.filter((u) => u.owner === st.cur && !u.done).length; }
    function updateHud() {
      const p = st.players[st.cur], col = G.PLAYER_COLORS[p.color];
      hudDay.innerHTML = '<small>' + t('day') + '</small><b>' + st.day + '</b>';
      hudPlayer.innerHTML = '<span class="chip" style="background:' + col.main + '"></span>' + esc(p.name) + (p.ai ? ' <em>' + t('ai') + '</em>' : '');
      hudFunds.innerHTML = '<small>' + t('funds') + '</small><b>' + p.funds + '</b> <em>+' + incomeOf(st.cur) + '</em>';
      hudObj.innerHTML = '<small>' + t('objective') + '</small>' + esc(objText());
      const mine = humanTurn();
      btnEnd.disabled = !mine;
      btnEnd.textContent = mine ? t('endTurn') + (readyCount() ? ' (' + readyCount() + ')' : '') : (aiRunning ? t('thinking') : '…');
    }
    function infoFor(x, y) {
      if (x == null) { info.innerHTML = ''; return; }
      const tt = E.terr(st, x, y), o = st.owner[y][x], u = E.unitAt(st, x, y);
      const stars = '★'.repeat(tt.def) + '☆'.repeat(Math.max(0, 4 - tt.def));
      let h = '<div class="card"><b>' + t('terrain.' + tt.id) + '</b> <span class="stars">' + stars + '</span>';
      if (tt.prop) {
        h += '<br><span class="chip" style="background:' + (o >= 0 ? G.PLAYER_COLORS[st.players[o].color].main : '#bbb') + '"></span>' + (o >= 0 ? esc(st.players[o].name) : t('neutral'));
        if (st.cap[y][x]) h += ' · ' + t('captureProgress') + ' ' + st.cap[y][x] + '/' + E.CAPTURE_MAX;
      }
      h += '</div>';
      if (u) {
        const d = G.UNITS[u.type];
        h += '<div class="card"><b>' + t('unit.' + u.type) + '</b> <span class="chip" style="background:' + G.PLAYER_COLORS[st.players[u.owner].color].main + '"></span>' + esc(st.players[u.owner].name) +
          '<br>' + t('hp') + ' <b>' + E.dispHp(u) + '</b>/10 · ' + t('move') + ' ' + d.move + ' · ' + t('range') + ' ' + (d.range[0] === d.range[1] ? d.range[0] : d.range[0] + '–' + d.range[1]) +
          '<br><small>' + t('unitDesc.' + u.type) + '</small></div>';
      }
      info.innerHTML = h;
    }

    // --- Menüs ---
    function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
    function openMenu(x, y, items, title) {
      closeMenu();
      const m = el('div', 'amenu');
      if (title) m.appendChild(el('div', 'amenu-title', title));
      items.forEach((it) => {
        const b = el('button', 'amenu-item' + (it.cls ? ' ' + it.cls : ''));
        if (it.icon) b.appendChild(it.icon);
        b.appendChild(el('span', '', it.label));
        if (it.right) b.appendChild(el('em', '', it.right));
        if (it.disabled) b.disabled = true;
        b.addEventListener('click', (e) => { e.stopPropagation(); A.play('click'); it.fn(); });
        m.appendChild(b);
      });
      board.appendChild(m);
      menuEl = m;
      const mw = m.offsetWidth, mh = m.offsetHeight;
      let left = (x + 1) * ts + 6;
      if (left + mw > W) left = Math.max(0, x * ts - mw - 6);
      let top = Math.min(Math.max(0, y * ts - 4), Math.max(0, H - mh));
      m.style.left = left + 'px'; m.style.top = top + 'px';
      // ins Sichtfeld scrollen
      const r = m.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      if (r.bottom > sr.bottom || r.top < sr.top || r.right > sr.right || r.left < sr.left) m.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    const humanTurn = () => !finished && st.winner == null && !st.players[st.cur].ai && !aiRunning && busy === 0;

    function resetSel() { mode = 'idle'; insp = inspMove = inspAtk = null; sel = null; reach = null; undoSnap = null; threat = new Set(); targets = []; closeMenu(); }

    function selectUnit(u) {
      A.play('select');
      undoSnap = E.clone(st);
      sel = u; reach = E.reachable(st, u); mode = 'sel'; closeMenu();
      threat = new Set();
      const def = G.UNITS[u.type];
      st.units.forEach((e) => {
        if (!E.isEnemy(st, e.owner, u.owner)) return;
        if (!(G.DMG[u.type][e.type] > 0)) return;
        if (def.indirect) { if (E.targetsFrom(st, u, u.x, u.y).includes(e)) threat.add(e.id); return; }
        for (const k of reach.stops.keys()) {
          const [sx, sy] = k.split(',').map(Number);
          const d = Math.abs(e.x - sx) + Math.abs(e.y - sy);
          if (d >= def.range[0] && d <= def.range[1]) { threat.add(e.id); break; }
        }
      });
    }

    function inspectUnit(u) {
      A.play('select');
      closeMenu();
      const def = G.UNITS[u.type];
      const r = E.reachable(st, u);
      insp = u; mode = 'inspect'; sel = null; reach = null;
      inspMove = [...r.stops.keys()];
      inspAtk = new Set();
      const origins = def.indirect ? [[u.x, u.y]] : inspMove.map((k) => k.split(',').map(Number));
      origins.forEach(([ox, oy]) => {
        for (let y = Math.max(0, oy - def.range[1]); y <= Math.min(st.h - 1, oy + def.range[1]); y++) {
          for (let x = Math.max(0, ox - def.range[1]); x <= Math.min(st.w - 1, ox + def.range[1]); x++) {
            const d = Math.abs(x - ox) + Math.abs(y - oy);
            if (d >= def.range[0] && d <= def.range[1]) inspAtk.add(x + ',' + y);
          }
        }
      });
    }

    function undo() {
      A.play('cancel');
      if (undoSnap) { st = undoSnap; dirty = true; }
      Object.keys(vis).forEach((k) => delete vis[k]);
      resetSel(); updateHud();
    }

    function unitMenu() {
      const u = E.unitById(st, sel.id);
      sel = u; mode = 'menu';
      const def = G.UNITS[u.type];
      const items = [];
      const tg = E.canAttackNow(st, u) ? E.targetsFrom(st, u, u.x, u.y) : [];
      if (tg.length) items.push({ label: t('attack'), fn: () => beginTarget(tg), cls: 'danger' });
      const tl = E.terr(st, u.x, u.y);
      if (def.capture && tl.prop && (st.owner[u.y][u.x] < 0 || E.isEnemy(st, st.owner[u.y][u.x], u.owner))) {
        items.push({ label: t('capture'), right: (st.cap[u.y][u.x] + E.dispHp(u)) + '/' + E.CAPTURE_MAX, fn: () => act({ t: 'capture', id: u.id }) });
      }
      items.push({ label: t('wait'), fn: () => act({ t: 'wait', id: u.id }) });
      items.push({ label: t('cancel'), cls: 'ghost', fn: undo });
      openMenu(u.x, u.y, items);
    }
    function beginTarget(tg) { closeMenu(); mode = 'target'; targets = tg; }

    function buildMenu(x, y) {
      mode = 'build'; sel = { x, y };
      const tl = E.terr(st, x, y), p = st.players[st.cur];
      const items = st.allowed.filter((ty) => (G.UNITS[ty].mt === 'air') === (tl.builds === 'air')).map((ty) => ({
        label: t('unit.' + ty), right: String(G.UNITS[ty].cost), icon: unitIcon(ty, p.color, 30), disabled: p.funds < G.UNITS[ty].cost,
        fn: async () => { closeMenu(); resetSel(); await act({ t: 'build', x, y, type: ty }); },
      }));
      items.push({ label: t('cancel'), cls: 'ghost', fn: () => { resetSel(); } });
      openMenu(x, y, items, t('build'));
    }

    async function act(a) {
      closeMenu();
      const pre = snapUnits();
      const r = E.apply(st, a);
      if (!r.ok) { return r; }
      dirty = true;
      busy++;
      try { await playEvents(r.events, pre); } finally { busy--; }
      dirty = true;
      if (a.t !== 'build') resetSel();
      updateHud();
      if (st.winner != null) { finish(); return r; }
      if (a.t === 'end') afterEnd();
      return r;
    }

    // --- Eingabe ---
    function tileAt(e) {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * st.w), y = Math.floor((e.clientY - r.top) / r.height * st.h);
      return E.inBounds(st, x, y) ? { x, y } : null;
    }
    canvas.addEventListener('mousemove', (e) => {
      const p = tileAt(e);
      if (!p) { hover = null; return; }
      if (!hover || hover.x !== p.x || hover.y !== p.y) { hover = p; infoFor(p.x, p.y); }
    });
    canvas.addEventListener('mouseleave', () => { hover = null; if (cursorInfo) infoFor(cursorInfo.x, cursorInfo.y); });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelStep(); });
    canvas.addEventListener('click', (e) => {
      A.init();
      const p = tileAt(e);
      if (!p) return;
      cursorInfo = p; infoFor(p.x, p.y);
      hover = e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) ? p : hover;
      onTile(p.x, p.y);
    });
    function cancelStep() {
      if (!humanTurn()) return;
      if (mode === 'target') { mode = 'menu'; targets = []; unitMenu(); }
      else if (mode === 'menu' || mode === 'sel') undo();
      else if (mode === 'build' || mode === 'inspect') resetSel();
    }

    function onTile(x, y) {
      if (!humanTurn()) return;
      const u = E.unitAt(st, x, y);
      const key = x + ',' + y;
      if (mode === 'idle') {
        if (u && u.owner === st.cur && !u.done) { selectUnit(u); return; }
        if (u) { inspectUnit(u); return; }
        const tl = E.terr(st, x, y);
        if (!u && tl.builds && st.owner[y][x] === st.cur) { A.play('click'); buildMenu(x, y); }
      } else if (mode === 'sel') {
        if (u && u.id === sel.id) { A.play('click'); unitMenu(); return; }
        if (reach.stops.has(key)) { doMove(x, y); return; }
        if (u && u.owner === st.cur && !u.done) { selectUnit(u); return; }
        undo();
        const v = E.unitAt(st, x, y);
        if (v) inspectUnit(v);
      } else if (mode === 'target') {
        const tg = targets.find((e) => e.x === x && e.y === y);
        if (tg) { const id = sel.id; resetSel(); act({ t: 'attack', id, tid: tg.id }); }
        else { mode = 'menu'; targets = []; unitMenu(); }
      } else if (mode === 'build') {
        resetSel();
        onTile(x, y);
      } else if (mode === 'inspect') {
        const same = u && u.id === insp.id;
        resetSel();
        if (!same) onTile(x, y);
      }
    }

    async function doMove(x, y) {
      const id = sel.id;
      closeMenu();
      const pre = snapUnits();
      const r = E.apply(st, { t: 'move', id, x, y });
      if (!r.ok) return;
      dirty = true;
      mode = 'busy'; busy++;
      try { await playEvents(r.events, pre); } finally { busy--; }
      if (destroyed) return;
      sel = E.unitById(st, id);
      unitMenu();
    }

    function nextReady() {
      if (!humanTurn()) return;
      const l = st.units.filter((u) => u.owner === st.cur && !u.done);
      if (!l.length) return;
      resetSel();
      const u = l[(nextReady.i = ((nextReady.i || 0) + 1) % l.length)];
      cursorInfo = { x: u.x, y: u.y }; infoFor(u.x, u.y);
      selectUnit(u);
    }

    const onKey = (e) => {
      if (destroyed) return;
      if (e.key === 'Escape') { if (modal) closeModal(); else if (mode !== 'idle') cancelStep(); else openPause(); }
      else if (e.key === 'Tab') { e.preventDefault(); nextReady(); }
    };
    document.addEventListener('keydown', onKey);
    const onResize = () => { layout(); closeMenu(); if (mode === 'menu' && sel) unitMenu(); else if (mode === 'build' && sel) buildMenu(sel.x, sel.y); };
    window.addEventListener('resize', onResize);

    btnEnd.addEventListener('click', () => { A.init(); if (humanTurn()) { A.play('click'); resetSel(); act({ t: 'end' }); } });
    btnMenu.addEventListener('click', () => { A.init(); A.play('click'); openPause(); });

    // --- Pause / Modal ---
    let modal = null;
    function closeModal() { if (modal) { modal.remove(); modal = null; } }
    function openModal(html, buttons) {
      closeModal();
      const m = el('div', 'modal');
      const box = el('div', 'modal-box', html);
      const row = el('div', 'modal-btns');
      buttons.forEach((b) => { const bt = el('button', 'btn' + (b.cls ? ' ' + b.cls : ''), b.label); bt.addEventListener('click', () => { A.init(); A.play('click'); b.fn(); }); row.appendChild(bt); });
      box.appendChild(row); m.appendChild(box); wrap.appendChild(m); modal = m;
    }
    function openPause() {
      openModal('<h2>' + t('pause') + '</h2>', [
        { label: t('resume'), cls: 'primary', fn: closeModal },
        { label: t('help'), fn: () => openModal('<h2>' + t('help') + '</h2><ul class="help">' + t('helpText').map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>', [{ label: t('back'), cls: 'primary', fn: openPause }]) },
        { label: t('quit'), cls: 'danger', fn: () => { closeModal(); opts.onQuit && opts.onQuit(); } },
      ]);
    }

    // --- Spielablauf ---
    function afterEnd() {
      if (finished) return;
      if (st.players[st.cur].ai) runAI();
      else { updateHud(); }
    }

    async function runAI() {
      if (aiRunning) return;
      aiRunning = true; updateHud();
      let guard = 0, fails = 0;
      try {
        while (!destroyed && !finished && st.winner == null && st.players[st.cur].ai && guard++ < 800) {
          let a = G.AI.next(st);
          const pre = snapUnits();
          let r = E.apply(st, a);
          if (!r.ok) { if (++fails > 3) { a = { t: 'end' }; r = E.apply(st, a); } else continue; }
          dirty = true;
          busy++;
          try { await playEvents(r.events, pre); } finally { busy--; }
          if (st.winner != null) break;
          if (a.t !== 'end') await sleep(a.t === 'move' ? 20 : 60);
          else { guard = 0; fails = 0; await wait(0); }
          updateHud();
        }
      } finally { aiRunning = false; }
      dirty = true; updateHud();
      if (st.winner != null) finish();
    }

    function finish() {
      if (finished) return;
      finished = true; resetSel(); updateHud();
      const w = st.winner;
      const humanWon = w >= 0 && humans.some((p) => p.team === w);
      const lost = humans.length && humans.every((p) => !st.players[p.id].alive) || w === -1;
      A.play(humanWon ? 'win' : 'lose');
      setTimeout(() => { if (!destroyed) opts.onFinish && opts.onFinish({ winnerTeam: w, humanWon, lost: !humanWon, st, why: st.result, ctrl }); }, sp() ? 700 : 0);
    }

    function showResult(r) {
      const col = r.color || '#ffe27a';
      openModal('<div class="result ' + (r.good ? 'good' : 'bad') + '"><h1 style="color:' + col + '">' + esc(r.title) + '</h1><p>' + esc(r.text || '') + '</p></div>', r.buttons);
    }

    // --- Start ---
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!destroyed) { const w = stage.clientWidth, h = stage.clientHeight; if (w !== ro.w || h !== ro.h) { ro.w = w; ro.h = h; onResize(); } } }) : null;
    if (ro) ro.observe(stage);
    layout(); updateHud(); infoFor(null);
    raf = requestAnimationFrame(frame);

    const ctrl = {
      get state() { return st; },
      showResult, openModal, closeModal,
      destroy() { destroyed = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); if (ro) ro.disconnect(); root.innerHTML = ''; },
      async start() {
        await playEvents([{ k: 'turn', player: st.cur, day: st.day, income: 0 }], {});
        if (destroyed) return;
        if (st.players[st.cur].ai) runAI(); else updateHud();
      },
      // Testzugriff
      _dbg: { act, get mode() { return mode; } },
    };
    return ctrl;
  }

  G.UI = { create };
  G.Settings = Settings;
  G.dom = { el, esc, unitIcon, wait };
})(window.CC = window.CC || {});
