// Claude Conflict – Comic-Grafik, komplett prozedural (Canvas). Sprites aus Bilddateien können später darüber gelegt werden.
(function (G) {
  const INK = '#2a1f14';
  const NEUTRAL = { main: '#d8d4c8', dark: '#8d8878', light: '#f2efe6' };
  const COL = G.PLAYER_COLORS;

  function lw(ctx, s, k) { ctx.lineWidth = Math.max(1.5, s * (k || 0.055)); ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fillStroke(ctx, fill, s) { ctx.fillStyle = fill; ctx.fill(); lw(ctx, s); ctx.stroke(); }
  function circle(ctx, x, y, r, fill, s) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fillStroke(ctx, fill, s); }
  const pal = (owner, colorIdx) => (owner < 0 ? NEUTRAL : COL[colorIdx]);

  // --- Bild-Atlanten (optional, Fallback = Vektorzeichnung) ---
  const ATL = {};
  const CELL = 128;
  const OBJ_IDX = { f: 0, m: 1, c: 2, F: 3, H: 4, A: 5 };
  function atlas(name) {
    let a = ATL[name];
    if (!a) { a = ATL[name] = new Image(); a.onload = () => { a.ok = true; }; a.onerror = () => { a.bad = true; }; a.src = 'img/' + name + '.png'; }
    return a;
  }
  function preload(ms) {
    const names = ['ground_grass', 'ground_sea', 'ground_shoal', 'ground_road', 'units_0', 'units_1', 'units_2', 'units_3', 'objs_n', 'objs_0', 'objs_1', 'objs_2', 'objs_3'];
    const ps = names.map((n) => { const a = atlas(n); return a.ok || a.bad ? Promise.resolve() : new Promise((r) => { a.addEventListener('load', r); a.addEventListener('error', r); }); });
    return Promise.race([Promise.all(ps), new Promise((r) => setTimeout(r, ms || 4000))]);
  }

  // --- Gelände ---
  const isWater = (ch) => ch === '~' || ch === ',';
  const isRoadish = (ch) => ch === '=' || ch === 'b' || 'cFHA'.includes(ch);

  function tuft(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x - s * 0.05, y); ctx.lineTo(x, y - s * 0.07); ctx.lineTo(x + s * 0.05, y);
    ctx.strokeStyle = '#6fa646'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
  }

  function seeded(x, y, n) { const v = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453; return v - Math.floor(v); }

  function drawGround(ctx, ch, st, tx, ty, px, py, s, time) {
    const tiles = st.tiles;
    const at = (x, y) => (tiles[y] && tiles[y][x]) || '.';
    // Basis
    let base = '#a6d96f';
    if (ch === '~') base = '#47a3e3';
    else if (ch === ',') base = '#8fd0ea';
    else if (ch === '=') base = '#dcc58f';
    else if (ch === 'b') base = '#47a3e3';
    const gname = ch === '~' || ch === 'b' ? 'ground_sea' : ch === ',' ? 'ground_shoal' : 'ground_grass';
    const gi = atlas(gname), useImg = !!gi.ok;
    if (useImg) { ctx.drawImage(gi, (tx % 3) * CELL, (ty % 3) * CELL, CELL, CELL, px, py, s, s); if (gname === 'ground_grass') { ctx.fillStyle = 'rgba(170,220,110,0.32)'; ctx.fillRect(px, py, s, s); } }
    else { ctx.fillStyle = base; ctx.fillRect(px, py, s, s); }
    if (!useImg && (ch === '.' || ch === 'f' || ch === 'm' || 'cFHA'.includes(ch))) {
      for (let i = 0; i < 3; i++) tuft(ctx, px + seeded(tx, ty, i) * s * 0.8 + s * 0.1, py + seeded(tx, ty, i + 5) * s * 0.8 + s * 0.15, s);
    }
    if (ch === '~' || ch === ',') {
      if (!useImg) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, s * 0.035);
      const off = ((time || 0) / 900 + seeded(tx, ty, 1)) % 1;
      for (let i = 0; i < 2; i++) {
        const yy = py + s * (0.3 + 0.4 * i) + Math.sin((off + i * 0.5) * Math.PI * 2) * s * 0.03;
        ctx.beginPath(); ctx.moveTo(px + s * 0.15, yy); ctx.quadraticCurveTo(px + s * 0.3, yy - s * 0.07, px + s * 0.45, yy); ctx.quadraticCurveTo(px + s * 0.6, yy + s * 0.07, px + s * 0.75, yy); ctx.stroke();
      }
      if (ch === ',') { ctx.fillStyle = '#e8d9a0'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(px + seeded(tx, ty, i + 9) * s, py + seeded(tx, ty, i + 12) * s, s * 0.05, 0, 7); ctx.fill(); } }
      }
      // Küstenlinie zu Land
      const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      ctx.strokeStyle = 'rgba(42,31,20,0.5)'; ctx.lineWidth = Math.max(1, s * 0.04);
      nb.forEach(([dx, dy]) => {
        const c = at(tx + dx, ty + dy);
        if (!isWater(c) && c !== 'b' && ch === '~' && (tx + dx >= 0 && ty + dy >= 0 && tx + dx < st.w && ty + dy < st.h)) {
          ctx.beginPath();
          if (dx === 0) { ctx.moveTo(px, py + (dy < 0 ? 0 : s)); ctx.lineTo(px + s, py + (dy < 0 ? 0 : s)); }
          else { ctx.moveTo(px + (dx < 0 ? 0 : s), py); ctx.lineTo(px + (dx < 0 ? 0 : s), py + s); }
          ctx.stroke();
        }
      });
    }
    if (ch === '=') {
      const horiz = isRoadish(at(tx - 1, ty)) || isRoadish(at(tx + 1, ty));
      const vert = isRoadish(at(tx, ty - 1)) || isRoadish(at(tx, ty + 1));
      const ri = atlas('ground_road');
      if (ri.ok) {
        const a = 0.2, b = 0.6;
        if (horiz || !vert) ctx.drawImage(ri, 0, CELL * a, CELL, CELL * b, px, py + s * a, s, s * b);
        if (vert) { ctx.save(); ctx.translate(px + s / 2, py + s / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(ri, 0, CELL * a, CELL, CELL * b, -s / 2, -s / 2 + s * a, s, s * b); ctx.restore(); }
        return;
      }
      ctx.strokeStyle = '#b79c64'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.setLineDash([s * 0.12, s * 0.1]);
      ctx.beginPath();
      if (horiz || !vert) { ctx.moveTo(px, py + s / 2); ctx.lineTo(px + s, py + s / 2); }
      if (vert) { ctx.moveTo(px + s / 2, py); ctx.lineTo(px + s / 2, py + s); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (ch === 'b') {
      const horizWater = isWater(at(tx - 1, ty)) || isWater(at(tx + 1, ty)) || at(tx - 1, ty) === '~';
      ctx.fillStyle = '#b8864b';
      if (horizWater) {
        ctx.fillRect(px + s * 0.12, py, s * 0.76, s); lw(ctx, s, 0.04); ctx.strokeRect(px + s * 0.12, py, s * 0.76, s);
        ctx.strokeStyle = '#7c5428'; ctx.lineWidth = Math.max(1, s * 0.03);
        for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(px + s * 0.12, py + s * i / 5); ctx.lineTo(px + s * 0.88, py + s * i / 5); ctx.stroke(); }
      } else {
        ctx.fillRect(px, py + s * 0.12, s, s * 0.76); lw(ctx, s, 0.04); ctx.strokeRect(px, py + s * 0.12, s, s * 0.76);
        ctx.strokeStyle = '#7c5428'; ctx.lineWidth = Math.max(1, s * 0.03);
        for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(px + s * i / 5, py + s * 0.12); ctx.lineTo(px + s * i / 5, py + s * 0.88); ctx.stroke(); }
      }
    }
  }

  function drawFeature(ctx, ch, st, tx, ty, px, py, s, owner, colorIdx) {
    if (OBJ_IDX[ch] != null) {
      const a = atlas('objs_' + (owner < 0 ? 'n' : colorIdx));
      const an = ch === 'f' || ch === 'm' ? atlas('objs_n') : a;
      if (an.ok) { ctx.drawImage(an, OBJ_IDX[ch] * CELL, 0, CELL, CELL, px, py, s, s); return; }
    }
    const p = pal(owner, colorIdx);
    const cx = px + s / 2, cy = py + s / 2;
    if (ch === 'f') {
      [[0.3, 0.62, 0.2], [0.68, 0.58, 0.22], [0.5, 0.35, 0.22]].forEach(([ox, oy, r], i) => {
        ctx.fillStyle = '#7a4f2a'; ctx.fillRect(px + s * ox - s * 0.025, py + s * oy, s * 0.05, s * 0.2);
        circle(ctx, px + s * ox, py + s * oy - s * 0.02, s * r, i % 2 ? '#3f9f4b' : '#2f8a3f', s);
        ctx.beginPath(); ctx.arc(px + s * ox - s * r * 0.3, py + s * oy - s * 0.02 - s * r * 0.3, s * r * 0.25, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
      });
    } else if (ch === 'm') {
      ctx.beginPath(); ctx.moveTo(px + s * 0.05, py + s * 0.88); ctx.lineTo(px + s * 0.35, py + s * 0.25); ctx.lineTo(px + s * 0.62, py + s * 0.88); ctx.closePath(); fillStroke(ctx, '#9a8f86', s);
      ctx.beginPath(); ctx.moveTo(px + s * 0.4, py + s * 0.88); ctx.lineTo(px + s * 0.68, py + s * 0.4); ctx.lineTo(px + s * 0.95, py + s * 0.88); ctx.closePath(); fillStroke(ctx, '#b3a89d', s);
      ctx.beginPath(); ctx.moveTo(px + s * 0.27, py + s * 0.42); ctx.lineTo(px + s * 0.35, py + s * 0.25); ctx.lineTo(px + s * 0.43, py + s * 0.42); ctx.lineTo(px + s * 0.35, py + s * 0.38); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); lw(ctx, s, 0.03); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + s * 0.6, py + s * 0.55); ctx.lineTo(px + s * 0.68, py + s * 0.4); ctx.lineTo(px + s * 0.76, py + s * 0.55); ctx.lineTo(px + s * 0.68, py + s * 0.5); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); lw(ctx, s, 0.03); ctx.stroke();
    } else if (ch === 'c') {
      const house = (ox, oy, w, h, wall) => {
        ctx.fillStyle = wall; ctx.fillRect(px + s * ox, py + s * oy, s * w, s * h); lw(ctx, s, 0.04); ctx.strokeRect(px + s * ox, py + s * oy, s * w, s * h);
        ctx.beginPath(); ctx.moveTo(px + s * (ox - 0.04), py + s * oy); ctx.lineTo(px + s * (ox + w / 2), py + s * (oy - 0.17)); ctx.lineTo(px + s * (ox + w + 0.04), py + s * oy); ctx.closePath(); fillStroke(ctx, p.main, s);
        ctx.fillStyle = '#ffe9a3'; ctx.fillRect(px + s * (ox + w * 0.3), py + s * (oy + h * 0.3), s * w * 0.4, s * h * 0.3);
      };
      house(0.1, 0.45, 0.32, 0.42, '#f3ead7'); house(0.5, 0.35, 0.38, 0.52, '#ece0c4'); house(0.38, 0.6, 0.24, 0.28, '#f8f1e0');
    } else if (ch === 'F') {
      ctx.fillStyle = '#8c9199'; ctx.fillRect(px + s * 0.12, py + s * 0.4, s * 0.76, s * 0.46); lw(ctx, s, 0.045); ctx.strokeRect(px + s * 0.12, py + s * 0.4, s * 0.76, s * 0.46);
      ctx.beginPath(); ctx.moveTo(px + s * 0.12, py + s * 0.4); ctx.lineTo(px + s * 0.3, py + s * 0.25); ctx.lineTo(px + s * 0.5, py + s * 0.4); ctx.lineTo(px + s * 0.7, py + s * 0.25); ctx.lineTo(px + s * 0.88, py + s * 0.4); ctx.closePath(); fillStroke(ctx, p.main, s);
      ctx.fillStyle = '#5c616a'; ctx.fillRect(px + s * 0.62, py + s * 0.08, s * 0.14, s * 0.2); lw(ctx, s, 0.04); ctx.strokeRect(px + s * 0.62, py + s * 0.08, s * 0.14, s * 0.2);
      rr(ctx, px + s * 0.3, py + s * 0.56, s * 0.4, s * 0.3, s * 0.05); fillStroke(ctx, '#3b3f46', s);
      ctx.fillStyle = p.light; ctx.fillRect(px + s * 0.34, py + s * 0.62, s * 0.32, s * 0.05);
    } else if (ch === 'H') {
      ctx.fillStyle = '#e8dfc9'; ctx.fillRect(px + s * 0.18, py + s * 0.35, s * 0.64, s * 0.5); lw(ctx, s, 0.045); ctx.strokeRect(px + s * 0.18, py + s * 0.35, s * 0.64, s * 0.5);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#e8dfc9'; ctx.fillRect(px + s * (0.18 + i * 0.25), py + s * 0.27, s * 0.14, s * 0.1); ctx.strokeRect(px + s * (0.18 + i * 0.25), py + s * 0.27, s * 0.14, s * 0.1); }
      ctx.beginPath(); ctx.moveTo(cx, py + s * 0.04); ctx.lineTo(cx, py + s * 0.3); lw(ctx, s, 0.04); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, py + s * 0.04); ctx.lineTo(cx + s * 0.26, py + s * 0.12); ctx.lineTo(cx, py + s * 0.2); ctx.closePath(); fillStroke(ctx, p.main, s);
      rr(ctx, cx - s * 0.1, py + s * 0.6, s * 0.2, s * 0.25, s * 0.08); fillStroke(ctx, p.dark, s);
      circle(ctx, cx, py + s * 0.5, s * 0.07, p.main, s);
    } else if (ch === 'A') {
      ctx.fillStyle = '#7d838c'; ctx.fillRect(px + s * 0.08, py + s * 0.3, s * 0.84, s * 0.4); lw(ctx, s, 0.045); ctx.strokeRect(px + s * 0.08, py + s * 0.3, s * 0.84, s * 0.4);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.setLineDash([s * 0.1, s * 0.08]); ctx.beginPath(); ctx.moveTo(px + s * 0.12, cy); ctx.lineTo(px + s * 0.88, cy); ctx.stroke(); ctx.setLineDash([]);
      rr(ctx, px + s * 0.1, py + s * 0.72, s * 0.28, s * 0.18, s * 0.04); fillStroke(ctx, p.main, s);
      ctx.beginPath(); ctx.moveTo(px + s * 0.78, py + s * 0.3); ctx.lineTo(px + s * 0.78, py + s * 0.1); lw(ctx, s, 0.04); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + s * 0.78, py + s * 0.1); ctx.lineTo(px + s * 0.92, py + s * 0.15); ctx.lineTo(px + s * 0.78, py + s * 0.2); ctx.closePath(); fillStroke(ctx, p.main, s);
    }
  }

  function drawTile(ctx, st, tx, ty, px, py, s, time, colors) {
    const ch = st.tiles[ty][tx];
    drawGround(ctx, ch, st, tx, ty, px, py, s, time);
    const o = st.owner[ty][tx];
    const ci = o >= 0 ? (colors ? colors[o] : o) : 0;
    drawFeature(ctx, ch, st, tx, ty, px, py, s, o, ci);
  }

  // --- Einheiten --- (alle Maße relativ zu s, Zentrum bei 0,0, Blick nach rechts)
  function tracks(ctx, s, w) {
    rr(ctx, -s * w, s * 0.16, s * w * 2, s * 0.2, s * 0.1); fillStroke(ctx, '#4a4e57', s);
    ctx.fillStyle = '#7b808b';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(s * w * i / 2.4 * 0.95, s * 0.26, s * 0.045, 0, 7); ctx.fill(); }
  }
  const SPR = {
    trooper(ctx, s, c, t) {
      const bob = Math.sin(t / 220) * s * 0.012;
      ctx.translate(0, bob);
      // Beine
      ctx.fillStyle = '#3d4b5a'; ctx.fillRect(-s * 0.1, s * 0.15, s * 0.08, s * 0.2); ctx.fillRect(s * 0.02, s * 0.15, s * 0.08, s * 0.2);
      lw(ctx, s, 0.035); ctx.strokeRect(-s * 0.1, s * 0.15, s * 0.08, s * 0.2); ctx.strokeRect(s * 0.02, s * 0.15, s * 0.08, s * 0.2);
      // Körper
      rr(ctx, -s * 0.16, -s * 0.07, s * 0.32, s * 0.28, s * 0.07); fillStroke(ctx, c.main, s);
      // Gewehr
      ctx.beginPath(); ctx.moveTo(-s * 0.02, s * 0.06); ctx.lineTo(s * 0.34, -s * 0.06); lw(ctx, s, 0.07); ctx.stroke(); ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
      // Kopf + Helm
      circle(ctx, 0, -s * 0.2, s * 0.14, '#ffd9b0', s);
      ctx.beginPath(); ctx.arc(0, -s * 0.23, s * 0.15, Math.PI, 0); ctx.closePath(); fillStroke(ctx, c.dark, s);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * 0.06, -s * 0.19, s * 0.02, 0, 7); ctx.fill();
    },
    rocketeer(ctx, s, c, t) {
      SPR.trooper(ctx, s, c, t);
      ctx.save(); ctx.rotate(-0.25);
      rr(ctx, -s * 0.18, -s * 0.2, s * 0.5, s * 0.1, s * 0.04); fillStroke(ctx, '#6b7078', s);
      ctx.beginPath(); ctx.moveTo(s * 0.32, -s * 0.2); ctx.lineTo(s * 0.42, -s * 0.15); ctx.lineTo(s * 0.32, -s * 0.1); ctx.closePath(); fillStroke(ctx, '#e5513d', s);
      ctx.restore();
    },
    buggy(ctx, s, c, t) {
      ctx.beginPath(); ctx.moveTo(-s * 0.38, s * 0.1); ctx.lineTo(-s * 0.3, -s * 0.08); ctx.lineTo(s * 0.05, -s * 0.08); ctx.lineTo(s * 0.18, -s * 0.22); ctx.lineTo(s * 0.3, -s * 0.22); ctx.lineTo(s * 0.4, s * 0.1); ctx.lineTo(s * 0.4, s * 0.2); ctx.lineTo(-s * 0.38, s * 0.2); ctx.closePath(); fillStroke(ctx, c.main, s);
      ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.08); ctx.lineTo(s * 0.2, -s * 0.18); ctx.lineTo(s * 0.28, -s * 0.18); ctx.lineTo(s * 0.32, -s * 0.08); ctx.closePath(); fillStroke(ctx, '#bfe6ff', s);
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.08); ctx.lineTo(-s * 0.3, -s * 0.28); ctx.lineTo(-s * 0.05, -s * 0.28); lw(ctx, s, 0.05); ctx.stroke();
      [-0.24, 0.26].forEach(x => { circle(ctx, s * x, s * 0.24, s * 0.13, '#3b3f46', s); circle(ctx, s * x, s * 0.24, s * 0.05, '#c9ced6', s); });
    },
    tank(ctx, s, c, t) {
      tracks(ctx, s, 0.4);
      rr(ctx, -s * 0.34, -s * 0.02, s * 0.68, s * 0.22, s * 0.07); fillStroke(ctx, c.main, s);
      rr(ctx, -s * 0.16, -s * 0.2, s * 0.34, s * 0.2, s * 0.08); fillStroke(ctx, c.dark, s);
      rr(ctx, s * 0.1, -s * 0.15, s * 0.36, s * 0.07, s * 0.03); fillStroke(ctx, '#5c616a', s);
      ctx.fillStyle = c.light; ctx.fillRect(-s * 0.28, s * 0.03, s * 0.2, s * 0.04);
    },
    howitzer(ctx, s, c, t) {
      tracks(ctx, s, 0.36);
      rr(ctx, -s * 0.3, s * 0.0, s * 0.6, s * 0.2, s * 0.06); fillStroke(ctx, c.main, s);
      ctx.save(); ctx.translate(-s * 0.05, -s * 0.02); ctx.rotate(-0.55);
      rr(ctx, 0, -s * 0.06, s * 0.55, s * 0.12, s * 0.03); fillStroke(ctx, '#5c616a', s);
      rr(ctx, s * 0.5, -s * 0.08, s * 0.08, s * 0.16, s * 0.02); fillStroke(ctx, '#3b3f46', s);
      ctx.restore();
      circle(ctx, -s * 0.05, -s * 0.02, s * 0.1, c.dark, s);
    },
    flak(ctx, s, c, t) {
      tracks(ctx, s, 0.38);
      rr(ctx, -s * 0.32, -s * 0.0, s * 0.64, s * 0.2, s * 0.06); fillStroke(ctx, c.main, s);
      rr(ctx, -s * 0.14, -s * 0.18, s * 0.28, s * 0.2, s * 0.06); fillStroke(ctx, c.dark, s);
      ctx.save(); ctx.translate(0, -s * 0.12); ctx.rotate(-0.9);
      [-0.045, 0.045].forEach(o => { rr(ctx, 0, s * (o - 0.025), s * 0.42, s * 0.05, s * 0.02); fillStroke(ctx, '#5c616a', s); });
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(-s * 0.22, -s * 0.1, s * 0.1, s * 0.05, -0.5, 0, 7); fillStroke(ctx, '#c9ced6', s);
    },
    chopper(ctx, s, c, t) {
      const spin = (t / 40) % (Math.PI * 2);
      ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.04); ctx.lineTo(-s * 0.46, -s * 0.12); ctx.lineTo(-s * 0.46, -s * 0.02); ctx.lineTo(-s * 0.16, s * 0.08); ctx.closePath(); fillStroke(ctx, c.dark, s);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.26, s * 0.18, 0, 0, 7); fillStroke(ctx, c.main, s);
      ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 0.03, s * 0.13, s * 0.1, 0, Math.PI, Math.PI * 2.2); ctx.closePath(); fillStroke(ctx, '#bfe6ff', s);
      ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.26); ctx.lineTo(s * 0.2, s * 0.26); lw(ctx, s, 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.04, s * 0.17); ctx.lineTo(-s * 0.04, s * 0.26); ctx.moveTo(s * 0.14, s * 0.17); ctx.lineTo(s * 0.14, s * 0.26); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.18); ctx.lineTo(0, -s * 0.26); ctx.stroke();
      const rl = s * (0.42 + 0.08 * Math.abs(Math.sin(spin)));
      ctx.beginPath(); ctx.moveTo(-rl, -s * 0.27); ctx.lineTo(rl, -s * 0.27); lw(ctx, s, 0.06); ctx.stroke(); ctx.strokeStyle = '#8c9199'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
      circle(ctx, -s * 0.46, -s * 0.07, s * (0.05 + 0.03 * Math.abs(Math.cos(spin))), '#8c9199', s);
    },
  };

  // Alle Schatten: Flieger größer/weiter weg
  function drawUnit(ctx, type, colorIdx, cx, cy, s, o) {
    o = o || {};
    const c = COL[colorIdx];
    const t = o.time || 0;
    ctx.save();
    // Schatten
    const air = G.UNITS[type].air;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + s * (air ? 0.44 : 0.38), s * (air ? 0.26 : 0.34), s * 0.07, 0, 0, 7); ctx.fill();
    ctx.translate(cx + (o.dx || 0), cy + (o.dy || 0) + (air ? -s * 0.08 + Math.sin(t / 300) * s * 0.02 : 0));
    ctx.scale(o.flip ? -1 : 1, 1);
    const ua = atlas('units_' + colorIdx);
    if (ua.ok) ctx.drawImage(ua, G.UNIT_ORDER.indexOf(type) * CELL, 0, CELL, CELL, -s * 0.5, -s * (air ? 0.5 : 0.56), s, s);
    else SPR[type](ctx, s, c, t);
    if (o.done) { ctx.globalCompositeOperation = 'source-atop'; }
    ctx.restore();
    if (o.done) {
      ctx.save(); ctx.globalAlpha = 0.38; ctx.fillStyle = '#10151c';
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.4, s * 0.4, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    if (o.hp != null && o.hp < 100) {
      const n = Math.ceil(o.hp / 10);
      const bx = cx + s * 0.18, by = cy + s * 0.22, bw = s * 0.3, bh = s * 0.26;
      ctx.save();
      rr(ctx, bx, by, bw, bh, s * 0.06); ctx.fillStyle = '#fffbe8'; ctx.fill(); lw(ctx, s, 0.04); ctx.stroke();
      ctx.fillStyle = n <= 3 ? '#c8321f' : INK; ctx.font = 'bold ' + Math.round(s * 0.2) + 'px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, bx + bw / 2, by + bh / 2 + 1);
      ctx.restore();
    }
    if (o.capt) {
      ctx.save();
      const fx = cx - s * 0.36, fy = cy - s * 0.4;
      ctx.beginPath(); ctx.moveTo(fx, fy + s * 0.3); ctx.lineTo(fx, fy); lw(ctx, s, 0.04); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + s * 0.22, fy + s * 0.07); ctx.lineTo(fx, fy + s * 0.14); ctx.closePath(); fillStroke(ctx, c.main, s);
      ctx.restore();
    }
  }

  function drawIconUnit(ctx, type, colorIdx, cx, cy, s) { drawUnit(ctx, type, colorIdx, cx, cy, s, { time: 0 }); }


  // --- Porträts für Dialoge (Comic-Köpfe) ---
  const PORT = {
    juniper:  { skin: '#ffd9b0', hair: '#7a3b1e', body: '#3a7be0', hat: '#3a7be0', style: 'cap', extra: 'smile' },
    sprocket: { skin: '#f1c08d', hair: '#3a2a1a', body: '#d98a1f', hat: null, style: 'messy', extra: 'goggles' },
    crumpet:  { skin: '#ffd9b0', hair: '#c9c9c9', body: '#8a5ec9', hat: '#8a5ec9', style: 'bigHat', extra: 'glasses' },
    boltbeard:{ skin: '#e9b58a', hair: '#8f2a22', body: '#c43a2f', hat: '#6b7078', style: 'helmet', extra: 'beard' },
    gruff:    { skin: '#e9b58a', hair: '#555555', body: '#c43a2f', hat: '#8f2a22', style: 'cap', extra: 'mustache' },
    fuss:     { skin: '#ffd9b0', hair: '#c9a21f', body: '#c9a21f', hat: '#e0b830', style: 'cap', extra: 'monocle' },
  };
  function drawPortraitVec(ctx, id, size) {
    const P = PORT[id] || PORT.juniper, s = size, S2 = s * 0.42;
    ctx.save();
    ctx.clearRect(0, 0, s, s);
    // Schultern
    ctx.beginPath(); ctx.moveTo(s * 0.08, s); ctx.quadraticCurveTo(s * 0.1, s * 0.72, s * 0.5, s * 0.7); ctx.quadraticCurveTo(s * 0.9, s * 0.72, s * 0.92, s); ctx.closePath(); fillStroke(ctx, P.body, S2);
    // Hals
    ctx.fillStyle = P.skin; ctx.fillRect(s * 0.42, s * 0.6, s * 0.16, s * 0.14);
    // Kopf
    const cx = s * 0.5, cy = s * 0.42;
    if (P.extra === 'beard') { ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.14, s * 0.28, s * 0.26, 0, 0, Math.PI); ctx.lineTo(cx - s * 0.28, cy + s * 0.14); ctx.closePath(); fillStroke(ctx, P.hair, S2); }
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.26, s * 0.28, 0, 0, 7); fillStroke(ctx, P.skin, S2);
    // Ohren
    circle(ctx, cx - s * 0.26, cy + s * 0.02, s * 0.05, P.skin, S2); circle(ctx, cx + s * 0.26, cy + s * 0.02, s * 0.05, P.skin, S2);
    // Haare / Hut
    if (P.style === 'messy') {
      ctx.beginPath(); ctx.moveTo(cx - s * 0.27, cy - s * 0.05);
      [[-0.2, -0.3], [-0.1, -0.2], [0, -0.36], [0.1, -0.2], [0.2, -0.32], [0.27, -0.05]].forEach(([a, b]) => ctx.lineTo(cx + s * a, cy + s * b));
      ctx.closePath(); fillStroke(ctx, P.hair, S2);
    } else if (P.style === 'cap' || P.style === 'helmet') {
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.04, s * 0.28, Math.PI, 0); ctx.closePath(); fillStroke(ctx, P.hat, S2);
      ctx.beginPath(); ctx.moveTo(cx + s * 0.05, cy - s * 0.1); ctx.lineTo(cx + s * 0.38, cy - s * 0.08); ctx.lineTo(cx + s * 0.3, cy - s * 0.02); ctx.lineTo(cx + s * 0.05, cy - s * 0.04); ctx.closePath(); fillStroke(ctx, P.hat, S2);
      if (P.style === 'helmet') { ctx.beginPath(); ctx.moveTo(cx - s * 0.05, cy - s * 0.32); ctx.lineTo(cx + s * 0.06, cy - s * 0.46); ctx.lineTo(cx + s * 0.04, cy - s * 0.33); ctx.closePath(); fillStroke(ctx, '#e0b830', S2); }
    } else if (P.style === 'bigHat') {
      ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.15, s * 0.4, s * 0.07, 0, 0, 7); fillStroke(ctx, P.hat, S2);
      ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.17); ctx.lineTo(cx - s * 0.12, cy - s * 0.42); ctx.lineTo(cx + s * 0.12, cy - s * 0.42); ctx.lineTo(cx + s * 0.2, cy - s * 0.17); ctx.closePath(); fillStroke(ctx, P.hat, S2);
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(cx - s * 0.18, cy - s * 0.24, s * 0.36, s * 0.05);
      ctx.beginPath(); ctx.arc(cx - s * 0.26, cy + s * 0.05, s * 0.07, 0, 7); ctx.fillStyle = P.hair; ctx.fill(); ctx.beginPath(); ctx.arc(cx + s * 0.26, cy + s * 0.05, s * 0.07, 0, 7); ctx.fill();
    }
    // Augen
    const ey = cy + s * 0.01;
    [-1, 1].forEach(k => {
      circle(ctx, cx + k * s * 0.1, ey, s * 0.055, '#fff', S2);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + k * s * 0.1 + s * 0.012, ey, s * 0.024, 0, 7); ctx.fill();
    });
    if (P.extra === 'goggles') {
      ctx.beginPath(); ctx.arc(cx - s * 0.1, cy - s * 0.17, s * 0.075, 0, 7); fillStroke(ctx, '#9fd5ee', S2);
      ctx.beginPath(); ctx.arc(cx + s * 0.1, cy - s * 0.17, s * 0.075, 0, 7); fillStroke(ctx, '#9fd5ee', S2);
      ctx.beginPath(); ctx.moveTo(cx - s * 0.26, cy - s * 0.15); ctx.lineTo(cx + s * 0.26, cy - s * 0.15); lw(ctx, S2, 0.05); ctx.stroke();
    }
    if (P.extra === 'glasses') {
      [-1, 1].forEach(k => { ctx.beginPath(); ctx.arc(cx + k * s * 0.1, ey, s * 0.08, 0, 7); lw(ctx, S2, 0.035); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(cx - s * 0.02, ey); ctx.lineTo(cx + s * 0.02, ey); ctx.stroke();
    }
    if (P.extra === 'monocle') { ctx.beginPath(); ctx.arc(cx + s * 0.1, ey, s * 0.085, 0, 7); lw(ctx, S2, 0.04); ctx.strokeStyle = '#c9a21f'; ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.1, ey + s * 0.085); ctx.lineTo(cx + s * 0.18, cy + s * 0.3); ctx.stroke(); }
    // Brauen (Boltbeard/Gruff finster)
    if (P.extra === 'beard' || P.extra === 'mustache') {
      lw(ctx, S2, 0.05);
      ctx.beginPath(); ctx.moveTo(cx - s * 0.17, ey - s * 0.1); ctx.lineTo(cx - s * 0.04, ey - s * 0.06); ctx.moveTo(cx + s * 0.17, ey - s * 0.1); ctx.lineTo(cx + s * 0.04, ey - s * 0.06); ctx.stroke();
    }
    // Nase, Mund
    circle(ctx, cx + s * 0.02, cy + s * 0.1, s * 0.03, 'rgba(0,0,0,0.12)', S2);
    if (P.extra === 'mustache') {
      ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.14); ctx.quadraticCurveTo(cx - s * 0.12, cy + s * 0.08, cx - s * 0.2, cy + s * 0.2); ctx.quadraticCurveTo(cx - s * 0.1, cy + s * 0.2, cx, cy + s * 0.18); ctx.quadraticCurveTo(cx + s * 0.1, cy + s * 0.2, cx + s * 0.2, cy + s * 0.2); ctx.quadraticCurveTo(cx + s * 0.12, cy + s * 0.08, cx, cy + s * 0.14); ctx.closePath(); fillStroke(ctx, P.hair, S2);
    } else {
      ctx.beginPath(); ctx.arc(cx, cy + s * 0.15, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI); lw(ctx, S2, 0.04); ctx.stroke();
    }
    ctx.restore();
  }

  // Emotionen pro Figur (Dateien: img/portraits/<id>_<emo>.png), sonst Neutral / Vektor-Fallback
  const EMOS = {
    juniper: ['neutral', 'happy', 'determined', 'worried', 'thinking', 'surprised'],
    sprocket: ['neutral', 'excited', 'smirk', 'worried', 'laugh'],
    crumpet: ['neutral', 'worried', 'determined', 'happy'],
    boltbeard: ['neutral', 'laugh', 'angry', 'surprised', 'resigned'],
    gruff: ['neutral', 'angry', 'sheepish'],
    fuss: ['neutral', 'excited', 'indignant', 'sheepish'],
  };
  const ALIAS = { smirk: 'laugh', excited: 'happy', thinking: 'neutral', indignant: 'angry', resigned: 'worried', sheepish: 'neutral', laugh: 'happy', happy: 'neutral', determined: 'neutral', worried: 'neutral', surprised: 'neutral', angry: 'neutral' };
  const imgs = {};
  function portraitKey(id, emo) {
    const list = EMOS[id] || [];
    let e = emo || 'neutral';
    for (let i = 0; i < 4 && e !== 'neutral' && list.indexOf(e) < 0; i++) e = ALIAS[e] || 'neutral';
    return id + '_' + (list.indexOf(e) < 0 ? 'neutral' : e);
  }
  function getPortraitImg(key, onload) {
    let im = imgs[key];
    if (!im) { im = imgs[key] = new Image(); im.onload = () => { im.ok = true; (im.cbs || []).forEach((f) => f()); im.cbs = null; }; im.onerror = () => { im.bad = true; }; im.src = 'img/portraits/' + key + '.png'; }
    if (!im.ok && !im.bad && onload) (im.cbs = im.cbs || []).push(onload);
    return im;
  }
  function drawPortrait(ctx, id, size, emo, onload) {
    const key = portraitKey(id, emo), im = getPortraitImg(key, () => onload ? onload() : drawPortrait(ctx, id, size, emo));
    if (im.ok) {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(im, 0, 0, size, size);
    } else drawPortraitVec(ctx, id, size);
  }
  function preloadPortraits() { Object.keys(EMOS).forEach((id) => EMOS[id].forEach((e) => getPortraitImg(id + '_' + e))); }

  G.Gfx = { preload, preloadPortraits, drawTile, drawUnit, drawIconUnit, drawPortrait, INK };
})(window.CC = window.CC || {});
