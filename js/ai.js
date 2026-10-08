// Claude Conflict – KI. next(state) liefert die nächste Aktion für den aktuellen Spieler; am Ende {t:'end'}.
(function (G) {
  const E = G.Engine, { UNITS, DMG, TERRAIN } = G;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let queue = [], qSig = '', skip = new Set();

  function sig(st) { return st.day + ':' + st.cur; }
  const myTeam = (st) => st.players[st.cur].team;
  const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

  // Wegkosten-Feld zu Zielen (ignoriert Einheiten)
  function field(st, mt, goals) {
    const f = new Map();
    const open = [];
    goals.forEach(g => { f.set(g.x + ',' + g.y, 0); open.push([g.x, g.y, 0]); });
    while (open.length) {
      open.sort((a, b) => a[2] - b[2]);
      const [x, y, c] = open.shift();
      if (f.get(x + ',' + y) < c) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!E.inBounds(st, nx, ny)) continue;
        // Kosten werden beim Betreten des Feldes (x,y) von (nx,ny) aus bezahlt
        const k = TERRAIN[st.tiles[y][x]].cost[mt];
        if (!k) continue;
        const nc = c + k;
        const key = nx + ',' + ny;
        if (TERRAIN[st.tiles[ny][nx]].cost[mt] === 0) continue;
        if (!f.has(key) || f.get(key) > nc) { f.set(key, nc); open.push([nx, ny, nc]); }
      }
    }
    return f;
  }

  function foesOf(st) { return st.units.filter(u => E.isEnemy(st, u.owner, st.cur)); }

  function propertiesToTake(st) {
    const out = [];
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      const t = E.terr(st, x, y);
      if (!t.prop) continue;
      const o = st.owner[y][x];
      if (o >= 0 && !E.isEnemy(st, o, st.cur)) continue;
      out.push({ x, y, hq: !!t.hq, o });
    }
    return out;
  }

  function danger(st, u, x, y, foes) {
    let d = 0;
    for (const e of foes) {
      const ed = UNITS[e.type], base = DMG[e.type][u.type] || 0;
      if (!base) continue;
      const dd = dist(e.x, e.y, x, y);
      const reach = ed.indirect ? ed.range[1] : ed.move + ed.range[1];
      if (dd > reach) continue;
      d += base * (e.hp / 100) * (UNITS[u.type].cost / 100) * 0.3;
    }
    return Math.min(d, UNITS[u.type].cost * 0.9);
  }

  function counterDmg(st, u, t, x, y, dealt) {
    const rem = t.hp - dealt;
    if (rem <= 0 || UNITS[t.type].indirect || dist(t.x, t.y, x, y) !== 1) return 0;
    const base = DMG[t.type][u.type] || 0;
    const stars = UNITS[u.type].air ? 0 : TERRAIN[st.tiles[y][x]].def;
    return Math.round(base * (rem / 100) * (1 - 0.09 * stars * (u.hp / 100)));
  }

  function planUnit(st, u, ctx) {
    const def = UNITS[u.type];
    const reach = E.reachable(st, u);
    const me = st.cur;
    let best = null;
    const capField = def.capture ? ctx.capFor(def.mt) : null;
    const foeField = ctx.foeFor(def.mt);
    for (const [key] of reach.stops) {
      const [x, y] = key.split(',').map(Number);
      const moved = x !== u.x || y !== u.y;
      const t = TERRAIN[st.tiles[y][x]];
      let base = -danger(st, u, x, y, ctx.foes) * ctx.fear;
      if (!def.air) base += t.def * 3;
      const f = (capField && capField.size && ctx.capGoals.length) ? capField : foeField;
      const fd = f.get(x + ',' + y);
      base -= (fd == null ? dist(x, y, ctx.cx, ctx.cy) * 2 : fd) * 8;
      if (t.builds && st.owner[y][x] === me && u.hp >= 60) base -= 30;
      // Reparatur
      if (u.hp < 60 && st.owner[y][x] === me && t.heal && (t.builds === 'air' ? def.air : true)) base += 40;
      let opt = { score: base, act: { t: 'wait', id: u.id } };
      // Einnehmen
      if (def.capture && t.prop) {
        const o = st.owner[y][x];
        if (o < 0 || E.isEnemy(st, o, me)) {
          const prog = st.cap[y][x] || 0;
          const s = base + 140 + (t.hq ? 600 : 0) + (t.builds ? 60 : 0) + prog * 4 + (o >= 0 ? 40 : 0);
          if (s > opt.score) opt = { score: s, act: { t: 'capture', id: u.id } };
        }
      }
      // Angriff
      if (!(def.indirect && moved)) {
        for (const tg of E.targetsFrom(st, u, x, y)) {
          const dmg = Math.min(tg.hp, E.calcDamage(st, u, tg, u.hp));
          const kill = dmg >= tg.hp;
          const cd = counterDmg(st, u, tg, x, y, dmg);
          const gain = dmg / 100 * UNITS[tg.type].cost - cd / 100 * def.cost * 1.1 + (kill ? 40 : 0);
          const s = base + 20 + gain * 1.4 + (G.CC_AI_BONUS || 0);
          if (s > opt.score) opt = { score: s, act: { t: 'attack', id: u.id, tid: tg.id } };
        }
      }
      if (!best || opt.score > best.score) best = { score: opt.score, x, y, moved, act: opt.act };
    }
    const acts = [];
    if (best.moved) acts.push({ t: 'move', id: u.id, x: best.x, y: best.y });
    acts.push(best.act);
    return acts;
  }

  function buildChoice(st, x, y, ctx) {
    const me = st.cur, p = st.players[me];
    const tile = E.terr(st, x, y);
    const mine = st.units.filter(u => u.owner === me);
    if (mine.length >= 22) return null;
    const foes = ctx.foes;
    const capNeed = Math.min(4, ctx.capGoals.length);
    const capCount = mine.filter(u => UNITS[u.type].capture).length;
    let bestT = null, bestS = -1e9;
    for (const type of st.allowed) {
      const d = UNITS[type];
      if (d.cost > p.funds) continue;
      const air = d.mt === 'air';
      if ((tile.builds === 'air') !== air) continue;
      let eff = 0, wsum = 0;
      for (const e of foes) {
        const w = UNITS[e.type].cost;
        eff += (DMG[type][e.type] || 0) * w; wsum += w;
      }
      eff = wsum ? eff / wsum : 50;
      let s = eff / (d.cost / 100);
      const have = mine.filter(u => u.type === type).length;
      s -= have * 1.2;
      if (d.capture && capCount < capNeed) s += 25;
      if (type === 'trooper' && capCount < capNeed) s += 30;
      if (d.indirect && have >= Math.ceil(mine.length / 4)) s -= 40;
      if (type === 'chopper' && !foes.some(f => !UNITS[f.type].air)) s -= 10;
      s += Math.random() * 4;
      if (s > bestS) { bestS = s; bestT = type; }
    }
    return bestT;
  }

  function makeCtx(st) {
    const foes = foesOf(st);
    const goals = propertiesToTake(st);
    const caches = { cap: {}, foe: {} };
    let cx = 0, cy = 0;
    if (foes.length) { cx = foes[0].x; cy = foes[0].y; }
    const foeGoals = foes.map(e => ({ x: e.x, y: e.y }));
    // gegnerisches HQ als schwaches Zusatzziel
    for (const g of goals) if (g.hq && g.o >= 0) foeGoals.push({ x: g.x, y: g.y });
    return {
      fear: 0.6 * Math.max(0.15, 1 - st.day / 30),
      foes, capGoals: goals, cx, cy,
      capFor(mt) { return caches.cap[mt] || (caches.cap[mt] = field(st, mt, goals)); },
      foeFor(mt) { return caches.foe[mt] || (caches.foe[mt] = field(st, mt, foeGoals.length ? foeGoals : goals)); },
    };
  }

  function next(st) {
    if (qSig !== sig(st)) { queue = []; skip = new Set(); qSig = sig(st); }
    while (queue.length) {
      const a = queue.shift();
      return a;
    }
    const ctx = makeCtx(st);
    const todo = st.units.filter(u => u.owner === st.cur && !u.done && !skip.has(u.id));
    if (todo.length) {
      // Vorderste Einheiten zuerst
      todo.sort((a, b) => {
        const da = Math.min(...ctx.foes.map(e => dist(e.x, e.y, a.x, a.y)), 99);
        const db = Math.min(...ctx.foes.map(e => dist(e.x, e.y, b.x, b.y)), 99);
        return da - db;
      });
      const u = todo[0];
      const acts = planUnit(st, u, ctx);
      skip.add(u.id);
      queue = acts.slice(1);
      return acts[0];
    }
    // Produktion
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      if (st.owner[y][x] !== st.cur || !TERRAIN[st.tiles[y][x]].builds || E.unitAt(st, x, y)) continue;
      const k = 'b' + x + ',' + y;
      if (skip.has(k)) continue;
      skip.add(k);
      const type = buildChoice(st, x, y, ctx);
      if (type) return { t: 'build', x, y, type };
    }
    return { t: 'end' };
  }

  function reset() { queue = []; skip = new Set(); qSig = ''; }

  G.AI = { next, reset };
})(window.CC = window.CC || {});
