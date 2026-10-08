// Claude Conflict – Mehrspieler-Karten (achsensymmetrisch, daher fair; Straßen verbinden alle Orte)
(function (G) {
  const mp = [
    {
      id: 'corners', players: 4, name: { de: 'Vier Ecken', en: 'Four Corners' },
      rows: [
        '1Q..ff=c====c=ff..W2',
        '=q=======..=======w=',
        '=.f...mm=..=mm...f.=',
        '=f......=..=......f=',
        '==m....f=..=f....m==',
        '=c.....m=..=m.....c=',
        '.=f.....=cc=.....f=.',
        '.=f.....=cc=.....f=.',
        '=c.....m=..=m.....c=',
        '==m....f=..=f....m==',
        '=f......=..=......f=',
        '=.f...mm=..=mm...f.=',
        '=e=======..=======r=',
        '3E..ff=c====c=ff..R4',
      ],
    },
    {
      id: 'isles', players: 4, name: { de: 'Inselreich', en: 'Isle Realm' },
      rows: [
        '1QZ.f...mmmm...f.XW2',
        '.q..f..f....f..f..w.',
        '.=f....ff..ff....f=.',
        '.=...,,~~bb~~,,...=.',
        '.c===,~~~bb~~~,===c.',
        '.=m==,~~~bb~~~,==m=.',
        '.=m.=bbbbbbbbbb=.m=.',
        '.=m.=bbbbbbbbbb=.m=.',
        '.=m==,~~~bb~~~,==m=.',
        '.c===,~~~bb~~~,===c.',
        '.=...,,~~bb~~,,...=.',
        '.=f....ff..ff....f=.',
        '.e..f..f....f..f..r.',
        '3EC.f...mmmm...f.VR4',
      ],
    },
    {
      id: 'twin', players: 2, name: { de: 'Zwei Reiche', en: 'Twin Realms' },
      rows: [
        '..ff...mm....mm...ff..',
        '.f==c...m=cc=m...c==f.',
        '..=.=..ff=..=ff..=.=..',
        '.q===....=..=....===w.',
        '.=f.....f=..=f.....f=.',
        '1Q..f..mm=..=mm..f..W2',
        '.q==f..mm=..=mm..f==w.',
        '.=f=.....=..=.....=f=.',
        '.====..ff=..=ff..====.',
        '.f.=c==.m=cc=m.==c=.f.',
        '..ff=.=mm=..=mm=.=ff..',
        '..f.=====c==c=====.f..',
      ],
    },
  ];

  G.MPMAPS = mp.map(m => Object.assign({ funds: 1500, units: [], allowed: G.UNIT_ORDER.slice() }, m));
})(window.CC = window.CC || {});
