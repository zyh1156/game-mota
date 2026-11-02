/* 音频：WebAudio 合成音效 + 双轨 BGM（普通层《不安》 / Boss 层《暗黒神復活》） */
(function () {
  'use strict';
  const A = {};

  let actx = null, master = null;
  let musicOn = true, started = false;

  /* ------------------------------------------------------------ 音效合成 */
  function ensureCtx() {
    if (actx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { actx = new AC(); } catch (e) { return false; }
    master = actx.createGain();
    master.gain.value = 0.42;
    master.connect(actx.destination);
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ensureCtx()) return;
    const t0 = actx.currentTime + (delay || 0);
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay) {
    if (!ensureCtx()) return;
    const t0 = actx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(actx.sampleRate * dur));
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const f = actx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 1200;
    const g = actx.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const SFX = {
    move: function () { tone(520, 0.045, 'triangle', 0.05, 470); },
    bump: function () { tone(110, 0.08, 'square', 0.08, 70); },
    unlock: function () { tone(880, 0.06, 'square', 0.09); tone(1320, 0.09, 'square', 0.08, null, 0.06); },
    locked: function () { tone(160, 0.12, 'sawtooth', 0.09, 120); tone(120, 0.14, 'sawtooth', 0.07, 90, 0.1); },
    item: function () { tone(660, 0.09, 'sine', 0.14); tone(990, 0.12, 'sine', 0.13, null, 0.07); },
    gem: function () { tone(784, 0.08, 'sine', 0.13); tone(1175, 0.1, 'sine', 0.12, null, 0.06); tone(1568, 0.14, 'sine', 0.1, null, 0.12); },
    gold: function () { tone(1200, 0.06, 'square', 0.09); tone(1600, 0.1, 'square', 0.08, null, 0.05); tone(2100, 0.12, 'sine', 0.07, null, 0.1); },
    key: function () { tone(700, 0.06, 'triangle', 0.12); tone(1050, 0.1, 'triangle', 0.11, null, 0.06); },
    equip: function () { tone(392, 0.1, 'triangle', 0.13); tone(523, 0.1, 'triangle', 0.13, null, 0.09); tone(784, 0.18, 'triangle', 0.12, null, 0.18); },
    chest: function () { noise(0.12, 0.1, 700); tone(523, 0.09, 'triangle', 0.11, null, 0.1); tone(784, 0.14, 'triangle', 0.11, null, 0.18); },
    stairs: function () { tone(300, 0.28, 'sine', 0.1, 620); noise(0.2, 0.05, 900); },
    buy: function () { tone(988, 0.06, 'square', 0.09); tone(1319, 0.1, 'square', 0.08, null, 0.05); },
    battle: function () { noise(0.25, 0.21, 500); tone(220, 0.3, 'sawtooth', 0.18, 90); },
    hit: function () { noise(0.07, 0.24, 1600); tone(180, 0.07, 'square', 0.12, 90); },
    crit: function () { noise(0.12, 0.3, 2400); tone(140, 0.14, 'sawtooth', 0.2, 60); tone(1100, 0.1, 'square', 0.11, 2200, 0.02); },
    reflect: function () { tone(1500, 0.07, 'square', 0.12, 700); tone(900, 0.09, 'square', 0.11, 500, 0.05); },
    victory: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.2, null, i * 0.09); }); },
    dead: function () { [392, 311, 262, 196].forEach(function (f, i) { tone(f, 0.22, 'sawtooth', 0.15, null, i * 0.14); }); }
  };

  A.sfx = function (name) {
    if (!musicOn) return; // 静音开关同时管音效
    const fn = SFX[name];
    if (fn) { try { fn(); } catch (e) { } }
  };

  /* ------------------------------------------------------------ BGM */
  const BGM_VOL = 0.327;   // 背景音乐基础音量（累计降低 45%：0.55→0.385→0.327）
  const tracks = {};
  let current = null; // 'normal' | 'boss'
  let want = null;

  function makeTrack(file) {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.src = encodeURI(file);
    el.addEventListener('error', function () { el.__broken = true; });
    return el;
  }

  function fadeTo(el, target, step) {
    if (!el || el.__broken) return;
    clearInterval(el.__fade);
    el.__fade = setInterval(function () {
      const v = el.volume;
      const nv = v + (target > v ? 1 : -1) * step;
      el.volume = Math.max(0, Math.min(target, nv));
      if (el.volume === target) clearInterval(el.__fade);
    }, 60);
  }

  function switchTo(name) {
    if (current === name) return;
    const oldEl = current ? tracks[current] : null;
    current = name;
    const el = tracks[name];
    if (!el || el.__broken || !started) return;
    if (oldEl && oldEl !== el) fadeTo(oldEl, 0, 0.04);
    const p = el.play();
    if (p && p.catch) p.catch(function () { });
    fadeTo(el, musicOn ? BGM_VOL : 0, 0.03);
  }

  A.BGM_NORMAL = '光宗信吉 - 不安….mp3';
  A.BGM_BOSS = '光宗信吉 - 暗黒神復活.mp3';

  /* 首次用户手势时调用：解锁 AudioContext 并开始播放（iOS 要求） */
  A.unlock = function () {
    if (started) {
      if (actx && actx.state === 'suspended') actx.resume();
      return;
    }
    if (!ensureCtx()) return;
    started = true;
    tracks.normal = makeTrack(A.BGM_NORMAL);
    tracks.boss = makeTrack(A.BGM_BOSS);
    if (want) switchTo(want);
    else switchTo('normal');
  };

  A.setBoss = function (isBoss) {
    want = isBoss ? 'boss' : 'normal';
    if (started) switchTo(want);
  };

  A.toggle = function () {
    musicOn = !musicOn;
    if (started) {
      const el = tracks[current];
      if (el && !el.__broken) {
        if (musicOn) { const p = el.play(); if (p && p.catch) p.catch(function () { }); fadeTo(el, BGM_VOL, 0.05); }
        else fadeTo(el, 0, 0.05);
      }
    }
    return musicOn;
  };
  A.isOn = function () { return musicOn; };

  window.MTAudio = A;
})();
