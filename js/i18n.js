// Claude Conflict – Texte (Deutsch / Englisch)
(function (G) {
  const T = {
    de: {
      title: 'Claude Conflict', subtitle: 'Taktik im Comic-Land',
      campaign: 'Kampagne', skirmish: 'Gefecht', settings: 'Einstellungen', help: 'Spielhilfe', back: 'Zurück', start: 'Los geht\'s', continue: 'Weiter',
      mission: 'Mission', locked: 'Gesperrt', replay: 'Wiederholen', next: 'Nächste Mission', retry: 'Nochmal versuchen', toMenu: 'Zum Menü',
      language: 'Sprache', sound: 'Ton', volume: 'Lautstärke', animSpeed: 'Animationen', animNormal: 'Normal', animFast: 'Schnell', animOff: 'Aus',
      on: 'An', off: 'Aus', resetProgress: 'Kampagnenfortschritt zurücksetzen', confirmReset: 'Fortschritt wirklich löschen?',
      endTurn: 'Zug beenden', day: 'Tag', funds: 'Geld', income: 'Einkommen', menu: 'Menü', resume: 'Weiterspielen', quit: 'Aufgeben / Menü',
      objective: 'Ziel', obj_rout: 'Alle Gegner besiegen', obj_hq: 'Gegnerisches HQ einnehmen oder alle Gegner besiegen', obj_survive: 'Überlebe bis Tag {n}',
      chooseMap: 'Karte wählen', players: 'Spieler', human: 'Mensch', ai: 'KI', off_slot: 'Aus', team: 'Team', startFunds: 'Startgeld', unitsAvailable: 'Alle Einheiten',
      unlockAll: 'Alle Missionen freischalten (Test)', capturedMsg: 'Eingenommen!', tapContinue: 'Antippen zum Weiterlesen', skip: 'Überspringen', pause: 'Pause', readyUnits: 'Einheiten bereit', yes: 'Ja', no: 'Nein', needTwoTeams: 'Es werden mindestens zwei Teams benötigt.', dayN: 'Tag {n}', thankYou: 'Fertig!', rematch: 'Nochmal', campaignName: 'Der Kuckuck von Pipsburg', mapSize: 'Größe', anyKey: 'Taste oder Klick', unitsLeft: 'Einheiten', hqTip: 'HQ', killed: 'Vernichtet',
      p: 'Spieler', passDevice: 'Gerät weitergeben an', ready: 'Bereit',
      attack: 'Angreifen', capture: 'Einnehmen', wait: 'Warten', cancel: 'Abbrechen', build: 'Bauen', cost: 'Kosten',
      hp: 'LP', move: 'Bewegung', range: 'Reichweite', vision: 'Sicht', defense: 'Deckung',
      captureProgress: 'Einnahme', neutral: 'Neutral', owner: 'Besitzer',
      victory: 'Sieg!', defeat: 'Niederlage', draw: 'Unentschieden', winnerIs: 'Sieger: {n}', gameOver: 'Spiel vorbei',
      eliminated: '{n} ist ausgeschieden', turnOf: '{n} ist am Zug', thinking: 'KI denkt ...',
      allWon: 'Kampagne geschafft! Pipsburg feiert.', undoHint: 'Rechtsklick oder Esc bricht ab.',
      damageForecast: 'Schaden', counterForecast: 'Gegenschlag',
      helpText: [
        'Ziel: Besiege alle Gegner oder nimm ihr Hauptquartier (HQ) ein.',
        'Einheit antippen, Feld wählen, dann Aktion: Angreifen, Einnehmen oder Warten.',
        'Städte, Fabriken, Flugfelder und HQ bringen jeden Tag 100 Geld. Infanterie (Füsilier, Raketenschütze) nimmt sie ein: 20 Punkte, jeder Lebenspunkt zählt.',
        'In Fabriken baut man Bodeneinheiten, in Flugfeldern Helikopter. Auf eigenen Gebäuden werden Einheiten repariert (kostet anteilig Geld).',
        'Geländedeckung (Sterne) senkt Schaden. Flieger profitieren nicht davon. Haubitzen schießen aus 2-4 Feldern, aber nicht nach dem Bewegen.',
        'Raketenschützen jagen Fahrzeuge, Panzer jagen alles am Boden, Flak jagt Flieger, Buggys sind schnell zum Einnehmen und Verfolgen.',
      ],
      terrain: { plain: 'Ebene', forest: 'Wald', mountain: 'Berg', road: 'Straße', sea: 'Meer', shoal: 'Furt', bridge: 'Brücke', city: 'Stadt', factory: 'Fabrik', hq: 'Hauptquartier', airfield: 'Flugfeld' },
      unit: { trooper: 'Füsilier', rocketeer: 'Raketenschütze', buggy: 'Buggy', tank: 'Panzer', howitzer: 'Haubitze', flak: 'Flak', chopper: 'Helikopter' },
      unitDesc: {
        trooper: 'Billig, kann Gebäude einnehmen. Schwach gegen Fahrzeuge.',
        rocketeer: 'Kann einnehmen, stark gegen Fahrzeuge und Gebäude-Verteidiger.',
        buggy: 'Sehr schnell, gut zum Aufklären und gegen Infanterie.',
        tank: 'Robust und stark gegen alles am Boden. Kann nicht auf Flieger schießen.',
        howitzer: 'Schießt über 2-4 Felder, aber nicht nach dem Bewegen. Kein Gegenschlag.',
        flak: 'Spezialist gegen Helikopter, kann auch Bodeneinheiten stören.',
        chopper: 'Fliegt über alles, schnell und vielseitig. Nur auf Flugfeldern baubar.',
      },
      names: { P1: 'Spieler 1', P2: 'Spieler 2', P3: 'Spieler 3', P4: 'Spieler 4' },
      color: ['Rot', 'Blau', 'Grün', 'Gelb'],
      mapName: {},
    },
    en: {
      title: 'Claude Conflict', subtitle: 'Tactics in Cartoon Land',
      campaign: 'Campaign', skirmish: 'Skirmish', settings: 'Settings', help: 'How to Play', back: 'Back', start: 'Let\'s go', continue: 'Continue',
      mission: 'Mission', locked: 'Locked', replay: 'Replay', next: 'Next mission', retry: 'Try again', toMenu: 'To menu',
      language: 'Language', sound: 'Sound', volume: 'Volume', animSpeed: 'Animations', animNormal: 'Normal', animFast: 'Fast', animOff: 'Off',
      on: 'On', off: 'Off', resetProgress: 'Reset campaign progress', confirmReset: 'Really delete progress?',
      endTurn: 'End turn', day: 'Day', funds: 'Funds', income: 'Income', menu: 'Menu', resume: 'Resume', quit: 'Give up / Menu',
      objective: 'Objective', obj_rout: 'Defeat all enemies', obj_hq: 'Capture the enemy HQ or defeat all enemies', obj_survive: 'Survive until day {n}',
      chooseMap: 'Choose map', players: 'Players', human: 'Human', ai: 'AI', off_slot: 'Off', team: 'Team', startFunds: 'Starting funds', unitsAvailable: 'All units',
      unlockAll: 'Unlock all missions (test)', capturedMsg: 'Captured!', tapContinue: 'Tap to continue', skip: 'Skip', pause: 'Paused', readyUnits: 'units ready', yes: 'Yes', no: 'No', needTwoTeams: 'At least two teams are required.', dayN: 'Day {n}', thankYou: 'Done!', rematch: 'Rematch', campaignName: 'The Cuckoo of Pipsburg', mapSize: 'Size', anyKey: 'Key or click', unitsLeft: 'Units', hqTip: 'HQ', killed: 'Destroyed',
      p: 'Player', passDevice: 'Hand the device to', ready: 'Ready',
      attack: 'Attack', capture: 'Capture', wait: 'Wait', cancel: 'Cancel', build: 'Build', cost: 'Cost',
      hp: 'HP', move: 'Move', range: 'Range', vision: 'Vision', defense: 'Cover',
      captureProgress: 'Capture', neutral: 'Neutral', owner: 'Owner',
      victory: 'Victory!', defeat: 'Defeat', draw: 'Draw', winnerIs: 'Winner: {n}', gameOver: 'Game over',
      eliminated: '{n} has been eliminated', turnOf: '{n}\'s turn', thinking: 'AI thinking ...',
      allWon: 'Campaign complete! Pipsburg celebrates.', undoHint: 'Right-click or Esc cancels.',
      damageForecast: 'Damage', counterForecast: 'Counter',
      helpText: [
        'Goal: defeat all enemies or capture their headquarters (HQ).',
        'Tap a unit, choose a tile, then pick an action: Attack, Capture or Wait.',
        'Cities, factories, airfields and HQs give 100 funds each day. Infantry (Trooper, Rocketeer) captures them: 20 points, every HP counts.',
        'Factories build ground units, airfields build Choppers. Units heal on your own buildings (costs a share of their price).',
        'Terrain cover (stars) reduces damage. Aircraft ignore it. Howitzers fire from 2-4 tiles but not after moving.',
        'Rocketeers hunt vehicles, Tanks hunt anything on the ground, Flak hunts aircraft, Buggies are fast for capturing and chasing.',
      ],
      terrain: { plain: 'Plain', forest: 'Forest', mountain: 'Mountain', road: 'Road', sea: 'Sea', shoal: 'Shoal', bridge: 'Bridge', city: 'City', factory: 'Factory', hq: 'Headquarters', airfield: 'Airfield' },
      unit: { trooper: 'Trooper', rocketeer: 'Rocketeer', buggy: 'Buggy', tank: 'Tank', howitzer: 'Howitzer', flak: 'Flak', chopper: 'Chopper' },
      unitDesc: {
        trooper: 'Cheap, can capture buildings. Weak against vehicles.',
        rocketeer: 'Can capture, strong against vehicles.',
        buggy: 'Very fast, good for scouting and against infantry.',
        tank: 'Sturdy and strong against anything on the ground. Cannot hit aircraft.',
        howitzer: 'Fires over 2-4 tiles, but not after moving. No counter-attack.',
        flak: 'Anti-air specialist, also annoys ground units.',
        chopper: 'Flies over everything, fast and versatile. Only built at airfields.',
      },
      names: { P1: 'Player 1', P2: 'Player 2', P3: 'Player 3', P4: 'Player 4' },
      color: ['Red', 'Blue', 'Green', 'Yellow'],
      mapName: {},
    },
  };

  const S = { lang: 'de' };
  function setLang(l) { S.lang = T[l] ? l : 'de'; try { localStorage.setItem('cc.lang', S.lang); } catch (e) { } document.documentElement.lang = S.lang; }
  function detect() {
    let l = null;
    try { l = localStorage.getItem('cc.lang'); } catch (e) { }
    if (!l) l = (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
    setLang(l);
  }
  function t(key, vars) {
    let v = T[S.lang];
    for (const k of key.split('.')) { v = v && v[k]; }
    if (v == null) { v = T.de; for (const k of key.split('.')) { v = v && v[k]; } }
    if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return v == null ? key : v;
  }
  // Text-Objekte {de,en}
  const tx = (o) => (typeof o === 'string' ? o : (o && (o[S.lang] || o.de)) || '');

  G.I18N = { t, tx, setLang, detect, get lang() { return S.lang; }, langs: ['de', 'en'] };
})(window.CC = window.CC || {});
