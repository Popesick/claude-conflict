// Claude Conflict – Regeldaten (eigener Entwurf)
(function (G) {
  // Terrain: code -> Definition. def = Verteidigungssterne, cost = Bewegungskosten je Bewegungsart (0 = unpassierbar)
  const TERRAIN = {
    '.': { id: 'plain',    def: 1, cost: { foot: 1, wheel: 2, track: 1, air: 1 } },
    'f': { id: 'forest',   def: 2, cost: { foot: 1, wheel: 3, track: 2, air: 1 } },
    'm': { id: 'mountain', def: 4, cost: { foot: 2, wheel: 0, track: 0, air: 1 } },
    '=': { id: 'road',     def: 0, cost: { foot: 1, wheel: 1, track: 1, air: 1 } },
    '~': { id: 'sea',      def: 0, cost: { foot: 0, wheel: 0, track: 0, air: 1 } },
    ',': { id: 'shoal',    def: 0, cost: { foot: 1, wheel: 2, track: 2, air: 1 } },
    'b': { id: 'bridge',   def: 0, cost: { foot: 1, wheel: 1, track: 1, air: 1 } },
    'c': { id: 'city',     def: 3, cost: { foot: 1, wheel: 1, track: 1, air: 1 }, prop: true, income: 100, heal: 20 },
    'F': { id: 'factory',  def: 3, cost: { foot: 1, wheel: 1, track: 1, air: 1 }, prop: true, income: 100, heal: 20, builds: true },
    'H': { id: 'hq',       def: 4, cost: { foot: 1, wheel: 1, track: 1, air: 1 }, prop: true, income: 100, heal: 20, hq: true },
    'A': { id: 'airfield', def: 3, cost: { foot: 1, wheel: 1, track: 1, air: 1 }, prop: true, income: 100, heal: 20, builds: 'air' },
  };

  // Einheiten
  const UNITS = {
    trooper:   { cost: 100, move: 3, mt: 'foot',  vision: 2, range: [1, 1], fuel: 0, capture: true,  air: false },
    rocketeer: { cost: 250, move: 2, mt: 'foot',  vision: 2, range: [1, 1], capture: true,  air: false },
    buggy:     { cost: 200, move: 7, mt: 'wheel', vision: 5, range: [1, 1], capture: false, air: false },
    tank:      { cost: 700, move: 5, mt: 'track', vision: 3, range: [1, 1], capture: false, air: false },
    howitzer:  { cost: 600, move: 3, mt: 'track', vision: 1, range: [2, 4], capture: false, air: false, indirect: true },
    flak:      { cost: 500, move: 4, mt: 'track', vision: 3, range: [1, 1], capture: false, air: false },
    chopper:   { cost: 900, move: 6, mt: 'air',   vision: 4, range: [1, 1], capture: false, air: true },
  };
  const UNIT_ORDER = ['trooper', 'rocketeer', 'buggy', 'tank', 'howitzer', 'flak', 'chopper'];

  // Grundschaden in % (Angreifer -> Verteidiger). Fehlt ein Eintrag, kann nicht angegriffen werden.
  const DMG = {
    trooper:   { trooper: 55, rocketeer: 45, buggy: 18, tank: 5,  howitzer: 40, flak: 10, chopper: 8 },
    rocketeer: { trooper: 70, rocketeer: 55, buggy: 80, tank: 65, howitzer: 70, flak: 55, chopper: 15 },
    buggy:     { trooper: 70, rocketeer: 55, buggy: 55, tank: 8,  howitzer: 55, flak: 10, chopper: 12 },
    tank:      { trooper: 75, rocketeer: 70, buggy: 85, tank: 55, howitzer: 80, flak: 75, chopper: 0 },
    howitzer:  { trooper: 90, rocketeer: 85, buggy: 80, tank: 65, howitzer: 75, flak: 70 },
    flak:      { trooper: 70, rocketeer: 65, buggy: 70, tank: 15, howitzer: 60, flak: 45, chopper: 85 },
    chopper:   { trooper: 75, rocketeer: 55, buggy: 70, tank: 45, howitzer: 65, flak: 20, chopper: 50 },
  };

  const PLAYER_COLORS = [
    { name: 'red',    main: '#e0453a', dark: '#8f2a22', light: '#ff8c80' },
    { name: 'blue',   main: '#3a7be0', dark: '#224f94', light: '#86b4ff' },
    { name: 'green',  main: '#3fae4a', dark: '#26702e', light: '#8ee096' },
    { name: 'yellow', main: '#e0b830', dark: '#8f7418', light: '#ffe27a' },
  ];

  G.TERRAIN = TERRAIN; G.UNITS = UNITS; G.UNIT_ORDER = UNIT_ORDER; G.DMG = DMG; G.PLAYER_COLORS = PLAYER_COLORS;
})(window.CC = window.CC || {});
