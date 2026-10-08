// Claude Conflict – synthetisierte Soundeffekte (Web Audio, keine Samples)
(function (G) {
  let ctx = null, master = null, noiseBuf = null;
  const S = { on: true, vol: 0.6 };
  try {
    const o = JSON.parse(localStorage.getItem('cc.audio') || 'null');
    if (o) { S.on = o.on !== false; S.vol = typeof o.vol === 'number' ? o.vol : 0.6; }
  } catch (e) { }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = S.vol;
    master.connect(ctx.destination);
    const n = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function save() { try { localStorage.setItem('cc.audio', JSON.stringify(S)); } catch (e) { } }
  function set(on, vol) {
    if (on != null) S.on = on;
    if (vol != null) S.vol = vol;
    if (master) master.gain.value = S.vol;
    save();
  }

  function tone(freq, dur, type, vol, t0, slideTo) {
    const t = ctx.currentTime + (t0 || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, t0, lo, hi) {
    const t = ctx.currentTime + (t0 || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(hi || 1800, t);
    f.frequency.exponentialRampToValueAtTime(lo || 200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  const FX = {
    click()   { tone(660, 0.05, 'square', 0.12); },
    select()  { tone(520, 0.06, 'square', 0.14); tone(780, 0.07, 'square', 0.12, 0.05); },
    cancel()  { tone(400, 0.07, 'square', 0.12); tone(260, 0.09, 'square', 0.12, 0.06); },
    step()    { tone(180 + Math.random() * 30, 0.05, 'triangle', 0.16); },
    engine()  { tone(90, 0.12, 'sawtooth', 0.08, 0, 70); },
    shoot()   { noise(0.18, 0.28, 0, 200, 2200); tone(220, 0.12, 'square', 0.15, 0, 90); },
    cannon()  { noise(0.35, 0.4, 0, 90, 1200); tone(110, 0.3, 'sawtooth', 0.2, 0, 40); },
    hit()     { noise(0.12, 0.25, 0, 150, 1500); tone(140, 0.1, 'square', 0.18, 0, 60); },
    boom()    { noise(0.7, 0.5, 0, 60, 900); tone(80, 0.6, 'sawtooth', 0.28, 0, 25); },
    capture() { [523, 659, 784].forEach((f, i) => tone(f, 0.1, 'square', 0.14, i * 0.07)); },
    captured(){ [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.16, i * 0.09)); },
    build()   { tone(300, 0.08, 'square', 0.14); tone(450, 0.08, 'square', 0.14, 0.07); tone(600, 0.12, 'square', 0.14, 0.14); },
    heal()    { tone(700, 0.08, 'triangle', 0.14); tone(900, 0.12, 'triangle', 0.14, 0.08); },
    turn()    { tone(440, 0.1, 'triangle', 0.16); tone(554, 0.1, 'triangle', 0.16, 0.1); tone(659, 0.16, 'triangle', 0.16, 0.2); },
    win()     { [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.17, i * 0.13)); },
    lose()    { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.15, i * 0.2)); },
    dialog()  { tone(300 + Math.random() * 200, 0.04, 'square', 0.07); },
  };

  function play(name) {
    if (!S.on) return;
    if (!init()) return;
    const f = FX[name];
    if (f) { try { f(); } catch (e) { } }
  }

  G.Audio = { play, set, init, get on() { return S.on; }, get vol() { return S.vol; } };
})(window.CC = window.CC || {});
