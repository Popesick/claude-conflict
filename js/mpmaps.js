// Claude Conflict – Mehrspieler-Karten (gespiegelt aus einem Viertel bzw. einer Hälfte, daher fair)
(function (G) {
  const SETS = ['1234', 'QWER', 'qwer', 'ZXCV'];
  function remap(ch, fx, fy) {
    for (const s of SETS) {
      const i = s.indexOf(ch);
      if (i >= 0) return s[i ^ (fx ? 1 : 0) ^ (fy ? 2 : 0)];
    }
    return ch;
  }
  const flipRow = (r, fx, fy) => r.split('').reverse().map(c => remap(c, fx, fy)).join('');
  const tagRow = (r, fx, fy) => r.split('').map(c => remap(c, fx, fy)).join('');

  // Viertel (oben links) -> 4 Spieler: TL=0, TR=1, BL=2, BR=3
  function quad(q) {
    const top = q.map(r => r + flipRow(r, true, false));
    const bottom = q.slice().reverse().map(r => tagRow(r, false, true) + flipRow(r, true, true));
    return top.concat(bottom);
  }
  // Linke Hälfte -> 2 Spieler
  function half(h) { return h.map(r => r + flipRow(r, true, false)); }

  const mp = [
    {
      id: 'corners', players: 4, name: { de: 'Vier Ecken', en: 'Four Corners' },
      rows: quad([
        '1Q..ff.c..',
        '.q..f...=.',
        '..f...mm=.',
        '.f..=====.',
        '..m..=.ff.',
        '.c...=.m..',
        '..f..=...c',
      ]),
    },
    {
      id: 'isles', players: 4, name: { de: 'Inselreich', en: 'Isle Realm' },
      rows: quad([
        '1QZ.f...mm',
        '.q..f..f..',
        '..f....ff.',
        '.....,,~~b',
        '.c...,~~~b',
        '..m..,~~~b',
        '..m.=bbbbb',
      ]),
    },
    {
      id: 'twin', players: 2, name: { de: 'Zwei Reiche', en: 'Twin Realms' },
      rows: half([
        '..ff...mm..',
        '.f..c...m.c',
        '.....=.ff..',
        '.q...=....=',
        '..f==.=.f..',
        '1Q..f=.mm.=',
        '.q..f=.mm.=',
        '..f=====...',
        '.....=.ff..',
        '.f..c...m.c',
        '..ff...mm..',
        '..f......c.',
      ]),
    },
  ];

  G.MPMAPS = mp.map(m => Object.assign({ funds: 1500, units: [], allowed: G.UNIT_ORDER.slice() }, m));
})(window.CC = window.CC || {});
