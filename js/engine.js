// Claude Conflict – Spielregeln. Rein datengetrieben: apply(state, action) ist der einzige Weg, den Zustand zu ändern.
(function (G) {
  const { TERRAIN, UNITS, DMG } = G;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const CAPTURE_MAX = 20;
  const MAX_HP = 100;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  const dispHp = (u) => Math.ceil(u.hp / 10);

  // mapDef: { name, rows:[str], owners:{ 'x,y': playerIdx } oder in rows als Ziffer 1-4 hinter Gebäude (siehe parseMap), units:[{type,owner,x,y}] }
  const OVERLAY = {};
  '1234'.split('').forEach((c, i) => { OVERLAY[c] = ['H', i]; });
  'QWER'.split('').forEach((c, i) => { OVERLAY[c] = ['F', i]; });
  'qwer'.split('').forEach((c, i) => { OVERLAY[c] = ['c', i]; });
  'ZXCV'.split('').forEach((c, i) => { OVERLAY[c] = ['A', i]; });

  // Kartenzeichen: Gelände (siehe TERRAIN) plus Besitzerzeichen: 1-4 = HQ, QWER = Fabrik, qwer = Stadt, ZXCV = Flugfeld (Spieler 1-4)
  function parseMap(def) {
    const rows = def.rows;
    const h = rows.length, w = rows[0].length;
    const tiles = [], owner = [], cap = [];
    for (let y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error('Zeilenlänge falsch in ' + def.id + ' Zeile ' + y);
      tiles.push([]); owner.push([]); cap.push([]);
      for (let x = 0; x < w; x++) {
        let ch = rows[y][x], o = -1;
        if (OVERLAY[ch]) { o = OVERLAY[ch][1]; ch = OVERLAY[ch][0]; }
        if (!TERRAIN[ch]) throw new Error('Unbekanntes Feld "' + ch + '" in ' + def.id + ' @' + x + ',' + y);
        tiles[y].push(ch); owner[y].push(o); cap[y].push(0);
      }
    }
    return { w, h, tiles, owner, cap };
  }

  function newGame(def, cfg) {
    // cfg: { players:[{team, ai, name, funds}], objective }
    const m = parseMap(def);
    const players = cfg.players.map((p, i) => ({
      id: i, team: p.team != null ? p.team : i, color: p.color != null ? p.color : i, ai: !!p.ai, name: p.name || ('P' + (i + 1)),
      funds: p.funds != null ? p.funds : (def.funds || 0), alive: true,
    }));
    const st = {
      mapId: def.id, w: m.w, h: m.h, tiles: m.tiles, owner: m.owner, cap: m.cap,
      units: [], nextId: 1, players, cur: 0, day: 1,
      objective: cfg.objective || def.objective || { type: 'rout' },
      allowed: def.allowed || G.UNIT_ORDER.slice(), winner: null, result: null,
    };
    (def.units || []).forEach(u => addUnit(st, u.type, u.owner, u.x, u.y, false));
    // Erstes Einkommen für den Startspieler entfällt, Tag 1.
    return st;
  }

  function addUnit(st, type, owner, x, y, spent) {
    const u = { id: st.nextId++, type, owner, x, y, hp: MAX_HP, moved: !!spent, done: !!spent, capt: false };
    st.units.push(u);
    return u;
  }

  const inBounds = (st, x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  const unitAt = (st, x, y) => st.units.find(u => u.x === x && u.y === y) || null;
  const unitById = (st, id) => st.units.find(u => u.id === id) || null;
  const terr = (st, x, y) => TERRAIN[st.tiles[y][x]];
  const teamOf = (st, owner) => st.players[owner].team;
  const isEnemy = (st, a, b) => teamOf(st, a) !== teamOf(st, b);

  // Erreichbare Felder: Map "x,y" -> { cost, from }
  function reachable(st, u) {
    const def = UNITS[u.type];
    const best = new Map();
    best.set(u.x + ',' + u.y, { cost: 0, from: null });
    const open = [[u.x, u.y, 0]];
    while (open.length) {
      open.sort((a, b) => a[2] - b[2]);
      const [x, y, c] = open.shift();
      if (best.get(x + ',' + y).cost < c) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(st, nx, ny)) continue;
        const k = terr(st, nx, ny).cost[def.mt];
        if (!k) continue;
        const nc = c + k;
        if (nc > def.move) continue;
        const occ = unitAt(st, nx, ny);
        if (occ && isEnemy(st, occ.owner, u.owner)) continue;
        const key = nx + ',' + ny;
        const prev = best.get(key);
        if (!prev || prev.cost > nc) {
          best.set(key, { cost: nc, from: x + ',' + y });
          open.push([nx, ny, nc]);
        }
      }
    }
    // Felder, auf denen man nicht stehen bleiben darf (besetzt von anderen Einheiten) rausfiltern
    const stops = new Map();
    best.forEach((v, key) => {
      const [x, y] = key.split(',').map(Number);
      const occ = unitAt(st, x, y);
      if (!occ || occ.id === u.id) stops.set(key, v);
    });
    return { all: best, stops };
  }

  function pathTo(reach, x, y) {
    const path = [];
    let key = x + ',' + y;
    while (key) {
      const [px, py] = key.split(',').map(Number);
      path.unshift({ x: px, y: py });
      key = reach.all.get(key).from;
    }
    return path;
  }

  function targetsFrom(st, u, fx, fy) {
    const def = UNITS[u.type];
    const out = [];
    for (const t of st.units) {
      if (!isEnemy(st, t.owner, u.owner)) continue;
      const d = Math.abs(t.x - fx) + Math.abs(t.y - fy);
      if (d < def.range[0] || d > def.range[1]) continue;
      if (!(DMG[u.type][t.type] > 0)) continue;
      out.push(t);
    }
    return out;
  }

  function canAttackNow(st, u) {
    const def = UNITS[u.type];
    return !u.done && !(def.indirect && u.moved);
  }

  function calcDamage(st, a, d, aHp) {
    const base = DMG[a.type][d.type] || 0;
    const stars = UNITS[d.type].air ? 0 : terr(st, d.x, d.y).def;
    const mult = 1 - 0.09 * stars * (d.hp / MAX_HP);
    return Math.max(base > 0 ? 1 : 0, Math.round(base * (aHp / MAX_HP) * mult));
  }

  function removeUnit(st, u) {
    if (u.capt) st.cap[u.y][u.x] = 0;
    st.units = st.units.filter(x => x.id !== u.id);
  }

  // --- Aktionen ---
  function apply(st, act) {
    const r = { ok: false, events: [] };
    if (st.winner != null) return r;
    const me = st.players[st.cur];
    switch (act.t) {
      case 'move': {
        const u = unitById(st, act.id);
        if (!u || u.owner !== st.cur || u.moved || u.done) return r;
        const reach = reachable(st, u);
        if (!reach.stops.has(act.x + ',' + act.y)) return r;
        const path = pathTo(reach, act.x, act.y);
        if (u.capt) { st.cap[u.y][u.x] = 0; u.capt = false; }
        u.x = act.x; u.y = act.y; u.moved = true;
        r.ok = true; r.events.push({ k: 'move', id: u.id, path });
        return r;
      }
      case 'wait': {
        const u = unitById(st, act.id);
        if (!u || u.owner !== st.cur || u.done) return r;
        u.moved = true; u.done = true;
        r.ok = true; return r;
      }
      case 'capture': {
        const u = unitById(st, act.id);
        if (!u || u.owner !== st.cur || u.done || !UNITS[u.type].capture) return r;
        const t = terr(st, u.x, u.y);
        if (!t.prop || (st.owner[u.y][u.x] >= 0 && !isEnemy(st, st.owner[u.y][u.x], u.owner))) return r;
        u.capt = true;
        st.cap[u.y][u.x] += dispHp(u);
        const ev = { k: 'capture', id: u.id, x: u.x, y: u.y, pts: st.cap[u.y][u.x], done: false };
        if (st.cap[u.y][u.x] >= CAPTURE_MAX) {
          const prevOwner = st.owner[u.y][u.x];
          st.owner[u.y][u.x] = u.owner; st.cap[u.y][u.x] = 0; u.capt = false;
          ev.done = true;
          if (t.hq && prevOwner >= 0) { r.events.push(ev); eliminate(st, prevOwner, r, 'hq'); u.moved = u.done = true; r.ok = true; checkWin(st, r); return r; }
        }
        u.moved = u.done = true;
        r.events.push(ev);
        r.ok = true; checkWin(st, r); return r;
      }
      case 'attack': {
        const u = unitById(st, act.id), t = unitById(st, act.tid);
        if (!u || !t || u.owner !== st.cur || !canAttackNow(st, u)) return r;
        if (!targetsFrom(st, u, u.x, u.y).includes(t)) return r;
        const dmg = calcDamage(st, u, t, u.hp);
        t.hp -= dmg;
        const ev = { k: 'attack', id: u.id, tid: t.id, dmg, counter: 0, killed: false, ckilled: false };
        if (t.hp <= 0) {
          ev.killed = true; removeUnit(st, t);
        } else {
          const td = UNITS[t.type];
          const dist = Math.abs(t.x - u.x) + Math.abs(t.y - u.y);
          if (!td.indirect && dist === 1 && DMG[t.type][u.type] > 0) {
            const cd = calcDamage(st, t, u, t.hp);
            u.hp -= cd; ev.counter = cd;
            if (u.hp <= 0) { ev.ckilled = true; removeUnit(st, u); }
          }
        }
        if (!ev.ckilled) { u.moved = u.done = true; }
        r.events.push(ev); r.ok = true;
        pruneDead(st, r);
        checkWin(st, r);
        return r;
      }
      case 'build': {
        const t = terr(st, act.x, act.y);
        if (!t.builds || st.owner[act.y][act.x] !== st.cur || unitAt(st, act.x, act.y)) return r;
        const def = UNITS[act.type];
        if (!def || !st.allowed.includes(act.type)) return r;
        const isAir = def.mt === 'air';
        if (isAir && t.builds !== 'air' ) return r;
        if (!isAir && t.builds === 'air') return r;
        if (me.funds < def.cost) return r;
        me.funds -= def.cost;
        const u = addUnit(st, act.type, st.cur, act.x, act.y, true);
        r.ok = true; r.events.push({ k: 'build', id: u.id }); return r;
      }
      case 'end': {
        endTurn(st, r); r.ok = true; return r;
      }
    }
    return r;
  }

  function pruneDead(st, r) {
    st.players.forEach((p, i) => { if (p.alive) maybeEliminate(st, i, r); });
  }

  function maybeEliminate(st, i, r) {
    if (i < 0) return;
    const p = st.players[i];
    if (!p || !p.alive) return;
    const hasUnit = st.units.some(u => u.owner === i);
    let hasFactory = false;
    for (let y = 0; y < st.h && !hasFactory; y++) for (let x = 0; x < st.w; x++) {
      if (st.owner[y][x] === i && terr(st, x, y).builds) { hasFactory = true; break; }
    }
    if (!hasUnit && !hasFactory) eliminate(st, i, r, 'wiped');
  }

  function eliminate(st, i, r, why) {
    const p = st.players[i];
    if (!p.alive) return;
    p.alive = false;
    st.units = st.units.filter(u => u.owner !== i);
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      if (st.owner[y][x] === i) { st.owner[y][x] = -1; st.cap[y][x] = 0; }
    }
    r.events.push({ k: 'eliminated', player: i, why });
  }

  function checkWin(st, r) {
    if (st.winner != null) return;
    const aliveTeams = new Set(st.players.filter(p => p.alive).map(p => p.team));
    if (aliveTeams.size <= 1) finish(st, r, aliveTeams.size ? [...aliveTeams][0] : null, 'last');
  }

  function finish(st, r, team, why) {
    st.winner = team == null ? -1 : team;
    st.result = why;
    r.events.push({ k: 'win', team: st.winner, why });
  }

  function endTurn(st, r) {
    let n = st.cur;
    do { n = (n + 1) % st.players.length; } while (!st.players[n].alive);
    if (n <= st.cur) st.day++;
    st.cur = n;
    const obj = st.objective;
    if (obj.type === 'survive' && st.day > obj.days) {
      if (st.players[0].alive) finish(st, r, st.players[0].team, 'survive');
      else finish(st, r, -1, 'timeout');
      return;
    }
    const p = st.players[n];
    let income = 0;
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      if (st.owner[y][x] === n) income += terr(st, x, y).income || 0;
    }
    p.funds += income;
    r.events.push({ k: 'turn', player: n, day: st.day, income });
    st.units.forEach(u => {
      if (u.owner !== n) return;
      u.moved = false; u.done = false;
      if (st.owner[u.y][u.x] !== n || u.hp >= MAX_HP) return;
      const t = terr(st, u.x, u.y);
      const air = UNITS[u.type].air;
      const fits = t.builds === 'air' ? air : true;
      if (!t.heal || !fits) return;
      const amt = Math.min(t.heal, MAX_HP - u.hp);
      const cost = Math.ceil(UNITS[u.type].cost * amt / MAX_HP);
      if (p.funds >= cost) { p.funds -= cost; u.hp += amt; r.events.push({ k: 'heal', id: u.id, amt }); }
    });
  }

  G.Engine = {
    MAX_HP, CAPTURE_MAX, newGame, apply, clone, dispHp, parseMap,
    reachable, pathTo, targetsFrom, canAttackNow, calcDamage, unitAt, unitById, terr, isEnemy, inBounds, addUnit,
  };
})(window.CC = window.CC || {});
