/* 交互层：渲染循环、输入、情报卡、战斗动画、弹层 */
(function () {
  'use strict';
  const MT = window.MT, Art = MT.Art;
  const SIZE = MT.SIZE;
  const $ = function (id) { return document.getElementById(id); };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const board = $('board'), stage = $('stage'), ctx = board.getContext('2d');
  const cardEl = $('card'), battleEl = $('battle'), bcanvas = $('bcanvas');
  let game = new MT.Game();
  let view = 1, boardPx = 360, dpr = 1, cellPx = 32;
  let heroPx = 0, heroPy = 0, heroTx = 0, heroTy = 0, heroT0 = 0;
  let floaters = []; // 拾取飘字：{ text, color, x, y, t0 }
  let selected = null;
  let battle = null;
  let sheetKind = null;

  /* ------------------------------------------------------------ 画布尺寸 */
  function resize() {
    const r = stage.getBoundingClientRect();
    const size = Math.max(220, Math.floor(Math.min(r.width, r.height)));
    boardPx = size;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    board.style.width = size + 'px';
    board.style.height = size + 'px';
    board.width = Math.round(size * dpr);
    board.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellPx = size / SIZE;
    Art.clearTiles();
  }
  window.addEventListener('resize', function () { resize(); sizeBattle(); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { resize(); sizeBattle(); }, 120); });

  /* ------------------------------------------------------------ 地图绘制 */
  function tileKind(c) {
    if (c.t === 'wall') return 'wall';
    if (c.t === 'stairUp') return 'stairUp';
    if (c.t === 'stairDown') return 'stairDown';
    if (c.t === 'gate') return 'gate' + (c.color || 'y');
    if (c.t === 'shop') return 'shop';
    return 'floor';
  }

  function draw(now) {
    const g = game.map, th = g.theme;
    ctx.clearRect(0, 0, boardPx, boardPx);
    const S = cellPx;

    // 地砖
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = g.g[y][x];
        const img = Art.tile(th, tileKind(c), S, dpr);
        ctx.drawImage(img, x * S, y * S, S, S);
      }
    }
    // 墙体投影
    for (let y = 0; y < SIZE - 1; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (g.g[y][x].t === 'wall' && g.g[y + 1][x].t !== 'wall') {
          const grd = ctx.createLinearGradient(0, (y + 1) * S, 0, (y + 1) * S + S * 0.45);
          grd.addColorStop(0, 'rgba(0,0,0,0.42)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(x * S, (y + 1) * S, S, S * 0.45);
        }
      }
    }

    // 门上的锁孔光
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = g.g[y][x];
        if (c.t !== 'gate') continue;
        const col = c.color === 'y' ? '232,195,74' : c.color === 'b' ? '90,168,240' : '224,83,74';
        const pulse = 0.35 + Math.sin(now / 480) * 0.15;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(x * S + S / 2, y * S + S * 0.55, S * 0.04, x * S + S / 2, y * S + S * 0.55, S * 0.55);
        gr.addColorStop(0, 'rgba(' + col + ',' + pulse + ')');
        gr.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x * S - S * 0.2, y * S - S * 0.2, S * 1.4, S * 1.4);
        ctx.restore();
      }
    }

    // 选中高亮
    if (selected) {
      ctx.save();
      ctx.strokeStyle = 'rgba(217,184,106,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      Art.rr(ctx, selected.x * S + 2, selected.y * S + 2, S - 4, S - 4, 6);
      ctx.stroke();
      ctx.restore();
    }

    // 物件与怪物
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = g.g[y][x];
        if (!c.o) continue;
        const cx = x * S + S / 2, cy = y * S + S / 2;
        if (c.o.kind === 'item') {
          Art.drawItem(ctx, c.o.id, cx, cy, S * 1.02, now / 1000);
          const it = MT.ITEMS[c.o.id];
          if (it && it.equip) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const pl = 0.25 + Math.sin(now / 300) * 0.12;
            const gr = ctx.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.72);
            gr.addColorStop(0, Art.hexA(it.color, pl));
            gr.addColorStop(1, Art.hexA(it.color, 0));
            ctx.fillStyle = gr;
            ctx.fillRect(cx - S, cy - S, S * 2, S * 2);
            ctx.restore();
          }
        } else if (c.o.kind === 'chest') {
          Art.drawChest(ctx, c.o.color, cx, cy, S * 1.1, now / 1000, c.o.loot);
        } else if (c.o.kind === 'monster') {
          const pv = game.preview(c.o.m);
          if (!pv.canWin || pv.expected.loss > game.hp * 0.75) {
            // 打不过：脚下红雾
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const pl = 0.16 + Math.sin(now / 420 + x) * 0.06;
            const gr = ctx.createRadialGradient(cx, cy + S * 0.3, 2, cx, cy + S * 0.3, S * 0.62);
            gr.addColorStop(0, 'rgba(226,60,60,' + pl + ')');
            gr.addColorStop(1, 'rgba(226,60,60,0)');
            ctx.fillStyle = gr;
            ctx.fillRect(cx - S, cy - S, S * 2, S * 2);
            ctx.restore();
          }
          Art.drawMonster(ctx, c.o.m, cx, cy + S * 0.02, S * 1.06, now / 1000);
        }
      }
    }

    // 英雄
    const hx = heroPx * S + S / 2, hy = heroPy * S + S / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(hx, hy, 1, hx, hy, S * 0.75);
    hg.addColorStop(0, 'rgba(140,200,255,0.20)');
    hg.addColorStop(1, 'rgba(140,200,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(hx - S, hy - S, S * 2, S * 2);
    ctx.restore();
    Art.drawHero(ctx, hx, hy + S * 0.03, S * 1.04, now / 1000);

    // Boss 未败：上楼梯红框警示（不能前往下一层）
    if (game.bossAlive() && g.up) {
      const sx = g.up.x * S, sy = g.up.y * S;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(now / 300) * 0.18;
      ctx.strokeStyle = '#e23c3c';
      ctx.lineWidth = Math.max(2, S * 0.07);
      Art.rr(ctx, sx + S * 0.06, sy + S * 0.06, S * 0.88, S * 0.88, S * 0.12);
      ctx.stroke();
      ctx.restore();
    }

    // 拾取飘字：从角色头顶上浮并淡出
    if (floaters.length) {
      floaters = floaters.filter(function (f) { return now - f.t0 < 1150; });
      floaters.forEach(function (f) {
        const p = (now - f.t0) / 1150;
        const fx = f.x * S + S / 2;
        const fy = f.y * S + S * 0.28 - S * 0.62 * p;
        ctx.save();
        ctx.globalAlpha = p < 0.12 ? p / 0.12 : Math.max(0, 1 - Math.pow((p - 0.12) / 0.88, 1.6));
        ctx.font = '700 ' + Math.max(11, Math.round(S * 0.32)) + 'px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, S * 0.09);
        ctx.strokeStyle = 'rgba(10, 6, 16, 0.85)';
        ctx.strokeText(f.text, fx, fy);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, fx, fy);
        ctx.restore();
      });
    }
  }

  /* ------------------------------------------------------------ 渲染循环 */
  let lastDraw = 0;
  function loop(now) {
    if (battle) drawBattle(now);
    else {
      // 英雄位移缓动
      const k = Math.min(1, (now - heroT0) / 90);
      const e = 1 - Math.pow(1 - k, 3);
      heroPx += (heroTx - heroPx) * (k >= 1 ? 1 : 0.45 + e * 0.2);
      heroPy += (heroTy - heroPy) * (k >= 1 ? 1 : 0.45 + e * 0.2);
      if (Math.abs(heroPx - heroTx) < 0.002) heroPx = heroTx;
      if (Math.abs(heroPy - heroTy) < 0.002) heroPy = heroTy;
      if (now - lastDraw > 33) { draw(now); lastDraw = now; }
    }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------ HUD */
  function updateHud() {
    $('hud-floor').textContent = game.floorNum;
    $('hud-hp').textContent = Math.max(0, game.hp);
    $('hud-atk').textContent = game.atk;
    $('hud-def').textContent = game.def;
    $('hud-gold').textContent = game.gold;
    const ci = game.critInfo();
    $('hud-crit').textContent = Math.round(ci.rate * 100) + '%×' + Math.round(ci.mult * 100) + '%';
    $('hud-ky').textContent = game.keys.y;
    $('hud-kb').textContent = game.keys.b;
    $('hud-kr').textContent = game.keys.r;
    $('hud-theme').textContent = game.theme.name;
    const mini = $('equip-mini');
    mini.innerHTML = '';
    ['sword', 'armor', 'satan', 'necroBook'].forEach(function (id) {
      const em = document.createElement('em');
      const owned = game.inv.indexOf(id) >= 0;
      const on = game.isEquipped(id);
      em.className = owned ? (on ? 'on' : '') : '';
      em.title = MT.ITEMS[id].name + (id === 'necroBook' && owned ? '（能量 ' + game.necroEnergy + '）' : '');
      if (owned && !on) em.style.opacity = '0.55';
      mini.appendChild(em);
    });
    document.body.classList.toggle('equipped-both', game.isEquipped('sword') && game.isEquipped('armor'));
    refreshFightBtn();
  }

  /* ------------------------------------------------------------ 情报卡 */
  function showCard(x, y) {
    const c = game.cell(x, y);
    if (!c || !c.o || c.o.kind !== 'monster') { hideCard(); return; }
    const pv = game.preview(c.o.m);
    const m = c.o.m;
    $('card-name').textContent = m.name + (m.boss ? (game.floorNum === 50 ? ' · 魔塔之主' : ' · 守关首领') : '');
    $('card-hp').textContent = m.hp;
    $('card-atk').textContent = m.atk;
    $('card-def').textContent = m.def;
    const tag = $('card-tag');
    if (!pv.canWin) {
      tag.textContent = pv.expected.stuck ? '无法击破' : '会阵亡';
      tag.className = 'card-tag bad';
    } else if (pv.expected.loss > game.hp * 0.6) {
      tag.textContent = '惨胜';
      tag.className = 'card-tag risk';
    } else {
      tag.textContent = '可战胜';
      tag.className = 'card-tag ok';
    }
    $('card-loss').textContent = pv.expected.loss === Infinity ? '—' : pv.expected.loss;
    $('card-left').textContent = Math.max(0, pv.expected.hpLeft);
    $('card-gold').textContent = '+' + pv.gold;
    const rng = pv.worst.loss === pv.best.loss
      ? '伤害固定 <b>' + pv.expected.loss + '</b>，' + pv.expected.rounds + ' 回合结束'
      : '伤害区间 <b>' + pv.best.loss + ' ~ ' + pv.worst.loss + '</b> · 期望 ' + pv.expected.loss + ' · ' + pv.expected.rounds + ' 回合';
    $('card-range').innerHTML = rng;
    let tip = '';
    if (pv.crit && pv.crit.rate > 0) tip += '暴击 ' + Math.round(pv.crit.rate * 100) + '% × ' + Math.round(pv.crit.mult * 100) + '% 伤害 → 期望更高，最坏情况见上界。';
    if (pv.armor) tip += (tip ? ' ' : '') + '刃甲：每回合反弹 10 + 15% 伤害，已计入。';
    if (pv.satan) tip += (tip ? ' ' : '') + '撒旦邪力：每次攻击回复 25% 伤害的生命，已计入。';
    $('card-tip').textContent = tip;
    cardEl.hidden = false;
    selected = { x: x, y: y };
    refreshFightBtn();
  }
  function hideCard() {
    cardEl.hidden = true;
    selected = null;
    refreshFightBtn();
  }

  function refreshFightBtn() {
    const btn = $('btn-fight');
    let ok = false;
    if (selected) {
      const dx = Math.abs(selected.x - game.x), dy = Math.abs(selected.y - game.y);
      ok = dx + dy === 1;
    }
    btn.disabled = !ok;
  }

  /* ------------------------------------------------------------ 本层怪物列表 */
  function renderSide() {
    const list = $('side-list');
    if (!list) return;
    const mons = game.floorMonsters();
    list.innerHTML = '';
    const seen = {};
    mons.forEach(function (entry) {
      const pv = game.preview(entry.m);
      const key = entry.m.id + pv.expected.loss;
      if (seen[key]) return;
      seen[key] = 1;
      list.appendChild(monRow(entry.m, pv, 40));
    });
    if (!mons.length) {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:11px;color:#9b9086;margin:0';
      p.textContent = '本层已无敌人。';
      list.appendChild(p);
    }
  }

  function monRow(m, pv, picSize) {
    const row = document.createElement('div');
    row.className = 'mon-row';
    const pic = document.createElement('canvas');
    pic.className = 'mon-pic';
    pic.width = picSize * 2; pic.height = picSize * 2;
    pic.style.width = picSize + 'px'; pic.style.height = picSize + 'px';
    const c2 = pic.getContext('2d');
    c2.scale(2, 2);
    Art.drawMonster(c2, m, picSize / 2, picSize / 2 + 2, picSize * 0.98, 0, false);
    const info = document.createElement('div');
    info.className = 'mon-info';
    info.innerHTML = '<b>' + m.name + (m.boss ? '<i class="boss-mark">守关</i>' : '') + '</b><span>生命 ' + m.hp + ' · 攻击 ' + m.atk + ' · 防御 ' + m.def + '</span>';
    const res = document.createElement('div');
    res.className = 'mon-res';
    let cls = 'ok', label = '可战胜';
    if (!pv.canWin) { cls = 'bad'; label = '打不过'; }
    else if (pv.expected.loss > game.hp * 0.6) { cls = 'risk'; label = '惨胜'; }
    res.innerHTML = '<span>损失</span><b class="' + cls + '">' + (pv.expected.loss === Infinity ? '—' : pv.expected.loss) + '</b><span>' + label + '</span>';
    row.appendChild(pic);
    row.appendChild(info);
    row.appendChild(res);
    return row;
  }

  /* ------------------------------------------------------------ 事件与步进 */
  let msgTimer = null;
  function toast(text) {
    let el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }

  function floorBanner() {
    let el = $('banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'banner';
      el.className = 'banner';
      document.body.appendChild(el);
    }
    el.innerHTML = '<b>第 ' + game.floorNum + ' 层</b><span>' + game.theme.name + (MT.isBossFloor(game.floorNum) ? ' · 守关首领' : '') + '</span>';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // Boss 存活时才用 Boss BGM；被击败后本层回到普通楼层 BGM
  function syncBgm() { MTAudio.setBoss(MT.isBossFloor(game.floorNum) && game.bossAlive()); }

  function syncHero() {
    heroTx = game.x; heroTy = game.y;
    heroT0 = performance.now();
  }

  function afterAction() {
    updateHud();
    renderSide();
    if (!cardEl.hidden) {
      const c = game.cell(selected ? selected.x : -1, selected ? selected.y : -1);
      if (!c || !c.o) hideCard();
    }
  }

  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };

  function move(dir) {
    if (battle || sheetKind) return;
    const d = DIRS[dir];
    if (!d) return;
    const ev = game.step(d[0], d[1]);
    switch (ev.type) {
      case 'bump':
        MTAudio.sfx('bump');
        break;
      case 'locked':
        MTAudio.sfx('locked');
        toast('需要' + GATE_NAME[ev.color] + '钥匙');
        popFloat('需要' + GATE_NAME[ev.color] + '钥匙', GATE_COLOR[ev.color], game.x + d[0], game.y + d[1]);
        break;
      case 'unlock':
        MTAudio.sfx('unlock');
        toast('门已打开');
        popFloat('门已打开', GATE_COLOR[ev.color], game.x + d[0], game.y + d[1]);
        syncHero();
        break;
      case 'item':
        MTAudio.sfx(pickSfx(ev.item));
        onPickup(ev.item);
        syncHero();
        break;
      case 'chest':
        MTAudio.sfx('chest');
        MTAudio.sfx(pickSfx(ev.item));
        onPickup(ev.item, true);
        syncHero();
        break;
      case 'chestLocked':
        MTAudio.sfx('locked');
        toast('宝箱上着锁 · 需要' + GATE_NAME[ev.color] + '钥匙');
        popFloat('需要' + GATE_NAME[ev.color] + '钥匙', GATE_COLOR[ev.color], game.x + d[0], game.y + d[1]);
        break;
      case 'bossLock':
        MTAudio.sfx('locked');
        toast('击败守关首领后才能上楼');
        popFloat('守关首领在此', '#ff8ba1', game.x + d[0], game.y + d[1]);
        break;
      case 'move':
        MTAudio.sfx('move');
        syncHero();
        break;
      case 'shop':
        MTAudio.sfx('stairs');
        syncHero();
        openShop();
        break;
      case 'stairs':
        MTAudio.sfx('stairs');
        if (game.travel(ev.dir)) {
          syncBgm();
          syncHero();
          floorBanner();
          hideCard();
          floaters = [];
          Art.clearTiles();
        }
        break;
      case 'battle':
        syncHero();
        startBattle(ev.x, ev.y, ev.mon);
        break;
    }
    afterAction();
  }

  function pickSfx(id) {
    const it = MT.ITEMS[id];
    if (!it) return 'item';
    if (it.scale) return 'gold';
    if (it.key) return 'key';
    if (it.equip) return 'equip';
    if (it.atk || it.def) return 'gem';
    return 'item';
  }

  function popFloat(text, color, gx, gy) {
    floaters.push({ text: text, color: color || '#ffd76a', x: gx === undefined ? game.x : gx, y: gy === undefined ? game.y : gy, t0: performance.now() });
    if (floaters.length > 6) floaters.shift();
  }

  const GATE_NAME = { y: '黄', b: '蓝', r: '红' };
  const GATE_COLOR = { y: '#ffd76a', b: '#7fc0ff', r: '#ff8ba1' };

  /* 守关首领掉落播报（F10 亡灵之书 / F20 水晶剑 / F30 刃甲 / F40 撒旦邪力） */
  function announceDrop() {
    const d = game.lastDrop;
    if (!d) return;
    game.lastDrop = null;
    const it = MT.ITEMS[d];
    MTAudio.sfx('equip');
    toast('守关首领掉落 · ' + it.name);
    popFloat(it.name, it.color);
  }

  function onPickup(id, fromChest) {
    const it = MT.ITEMS[id];
    if (!it) return;
    const pre = fromChest ? '宝箱开启 · ' : '';
    if (it.scale) {
      toast(pre + '金币袋 · 金币 +' + (40 + game.floorNum * 10));
      popFloat('金币 +' + (40 + game.floorNum * 10), '#ffd76a');
      return;
    }
    if (it.equip) {
      toast(pre + '获得装备 · ' + it.name + '（已自动装备）');
      popFloat(it.name, it.color);
      if (sheetKind === 'equip') openEquip();
    } else if (it.necro) {
      toast(pre + '获得 ' + it.name + ' · 击败怪物积累能量，可兑换攻击');
      popFloat(it.name, it.color);
      if (sheetKind === 'equip') openEquip();
    } else if (it.heal) {
      toast(pre + it.name + ' · 生命 +' + it.heal);
      popFloat('生命 +' + it.heal, '#ff7d8c');
    } else if (it.atk) {
      toast(pre + '攻击宝石 · 攻击 +' + it.atk);
      popFloat('攻击 +' + it.atk, it.color || '#ff9f6a');
    } else if (it.def) {
      toast(pre + '防御宝石 · 防御 +' + it.def);
      popFloat('防御 +' + it.def, it.color || '#5ac8ff');
    } else {
      toast(pre + '获得 ' + it.name);
      popFloat(it.name, it.color);
    }
  }

  /* ------------------------------------------------------------ 战斗动画 */
  function sizeBattle() {
    if (!battleEl || battleEl.hidden) return;
    const w = Math.min(window.innerWidth - 24, 520);
    const h = Math.min(window.innerHeight - 80, 460);
    const size = Math.max(280, Math.min(w, h));
    bcanvas.style.width = size + 'px';
    bcanvas.style.height = size + 'px';
    bcanvas.width = Math.round(size * dpr);
    bcanvas.height = Math.round(size * dpr);
    battle.W = size; battle.H = size;
  }

  function startBattle(x, y, mon) {
    const roll = game.rollBattle(mon);
    if (roll.impossible) {
      MTAudio.sfx('locked');
      toast('攻击力不足以击破 ' + mon.name);
      return;
    }
    // 零损耗（一击毙命）：跳过战斗动画，直接结算
    if (roll.win && roll.loss === 0) {
      MTAudio.sfx('victory');
      game.commitBattle(x, y, roll);
      syncHero();
      afterAction();
      syncBgm();
      announceDrop();
      popFloat('无伤 · 金币 +' + roll.gold, '#ffd76a');
      if (game.state === 'dead') showDead();
      else if (game.state === 'win') showWin();
      else toast('一击必杀 · ' + mon.name + ' · 金币 +' + roll.gold);
      return;
    }
    // 逐回合完整播放：回合多时自动加速，保证每一击都有伤害数字
    const beatMs = roll.log.length <= 10 ? 210 : roll.log.length <= 20 ? 170 : 130;
    battle = {
      x: x, y: y, mon: mon, roll: roll, beats: roll.log.slice(),
      t0: performance.now(), W: 360, H: 360, beatMs: beatMs,
      dur: 380 + roll.log.length * beatMs + 700,
      done: false, shake: 0, pops: [], lastBi: -1, reflekBi: -1
    };
    MTAudio.sfx(mon.boss ? 'battle' : 'battle');
    battleEl.hidden = false;
    $('battle-skip').hidden = false;
    sizeBattle();
  }

  function endBattle(now) {
    if (!battle || battle.done) return;
    battle.done = true;
    const roll = battle.roll, x = battle.x, y = battle.y;
    const mon = battle.mon;
    MTAudio.sfx(roll.win ? 'victory' : 'dead');
    setTimeout(function () {
      battleEl.hidden = true;
      battle = null;
      game.commitBattle(x, y, roll);
      syncHero();
      afterAction();
      syncBgm();
      announceDrop();
      if (game.state === 'dead') showDead();
      else if (game.state === 'win') showWin();
      else if (roll.win) toast('击败 ' + mon.name + ' · 金币 +' + roll.gold);
    }, 620);
  }

  function drawBattle(now) {
    const b = battle;
    const W = b.W, H = b.H;
    const c = bcanvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const el = now - b.t0;
    const t = el / 1000;

    c.clearRect(0, 0, W, H);
    // 背景
    const bg = c.createRadialGradient(W / 2, H * 0.42, W * 0.1, W / 2, H * 0.5, W * 0.8);
    bg.addColorStop(0, '#241c31');
    bg.addColorStop(1, '#0a0710');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // 地面
    c.save();
    const fg = c.createLinearGradient(0, H * 0.66, 0, H);
    fg.addColorStop(0, 'rgba(120,110,140,0.16)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fg;
    c.beginPath();
    c.ellipse(W / 2, H * 0.78, W * 0.5, H * 0.16, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    const intro = Math.min(1, el / 300);
    const ease = 1 - Math.pow(1 - intro, 3);
    const heroX = W * 0.29 - (1 - ease) * W * 0.2;
    const monX = W * 0.71 + (1 - ease) * W * 0.2;
    const baseY = H * 0.62;
    const sprite = W * 0.3;

    // 找到当前 beat
    let bi = Math.floor((el - 380) / b.beatMs);
    if (bi < 0) bi = -1;
    const inBeat = ((el - 380) % b.beatMs) / b.beatMs;
    const beat = bi >= 0 && bi < b.beats.length ? b.beats[bi] : null;
    const finished = bi >= b.beats.length;
    const lastBeat = b.beats[b.beats.length - 1];

    // 每一击的音效：命中 / 暴击 / 反弹
    if (beat && bi !== b.lastBi) { b.lastBi = bi; MTAudio.sfx(beat.crit ? 'crit' : 'hit'); b.reflekBi = -1; }
    if (beat && beat.reflect && inBeat >= 0.42 && b.reflekBi !== bi) { b.reflekBi = bi; MTAudio.sfx('reflect'); }

    let heroDx = 0, monDx = 0, heroSwing = -0.15, alpha = 1;
    if (beat && !b.done) {
      if (inBeat < 0.42) {
        const p = inBeat / 0.42;
        heroDx = Math.sin(p * Math.PI) * W * 0.055;
        heroSwing = -0.15 - Math.sin(p * Math.PI) * 1.0;
        if (p > 0.55) {
          // 命中特效
          const k = (p - 0.55) / 0.45;
          const mhpPos = monX + monDx;
          if (beat.crit) Art.burst(c, mhpPos, baseY - sprite * 0.28, sprite * 0.55 * (0.6 + k * 0.6), 'rgba(255,214,120,1)', 1 - k);
          Art.slash(c, mhpPos, baseY - sprite * 0.26, sprite * 0.42, p, 1 - k * 0.9);
        }
      } else {
        const p = (inBeat - 0.42) / 0.58;
        monDx = -Math.sin(p * Math.PI) * W * 0.05;
        // 反弹特效
        if (beat.reflect) {
          const k = Math.max(0, (p - 0.5) / 0.5);
          c.save();
          c.globalCompositeOperation = 'lighter';
          Art.burst(c, monX + monDx, baseY - sprite * 0.3, sprite * 0.3 * (0.4 + k), 'rgba(255,170,80,1)', 1 - k);
          c.restore();
        }
      }
    }

    // 屏幕震动
    if (beat && beat.crit && inBeat > 0.42 && inBeat < 0.56) {
      const s = (1 - Math.abs(inBeat - 0.49) / 0.07) * 6;
      c.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // 血条
    const hpTotal = b.roll.log.length ? b.roll.log[0] : null;
    const startHp = game.hp;
    const curHeroHp = beat ? beat.pHp : (b.done || finished ? b.roll.hpLeft : startHp);
    const curMonHp = beat ? beat.mHp : (finished ? 0 : b.mon.hp);
    drawHpBar(c, 16, 18, W * 0.38, '你', Math.max(0, curHeroHp), startHp, '#e2574c');
    drawHpBar(c, W - 16 - W * 0.38, 18, W * 0.38, b.mon.name, Math.max(0, curMonHp), b.mon.hp, '#b45ad0');

    // 角色
    try {
      Art.drawHero(c, heroX + heroDx, baseY + sprite * 0.14, sprite, t, { swing: heroSwing });
      const monK = beat && inBeat < 0.42 && inBeat > 0.42 * 0.55 ? 1 + Math.sin(inBeat * Math.PI) * 0.03 : 1;
      Art.drawMonster(c, b.mon, monX + monDx, baseY + sprite * 0.12, sprite * monK, t);
    } catch (err) {
      c.save();
      c.fillStyle = '#ff8888';
      c.font = '14px monospace';
      c.textAlign = 'left';
      c.fillText(String(err && err.stack || err).slice(0, 300), 10, H / 2);
      c.restore();
    }
    if (window.__MTDBG) {
      c.save();
      c.fillStyle = '#8fff9a';
      c.font = '13px monospace';
      c.textAlign = 'left';
      c.fillText('el=' + el + ' W=' + W + ' H=' + H + ' sp=' + sprite + ' hx=' + heroX + ' hy=' + (baseY + sprite * 0.14) + ' bi=' + bi, 10, H - 10);
      c.restore();
    }

    // 伤害数字
    const popT = (el - 380) % b.beatMs;
    if (beat && bi >= 0 && popT < b.beatMs - 10 && popT > 60 * (b.beatMs / 210)) {
      const k = (popT - 60) / 140;
      c.save();
      c.globalAlpha = 1 - k * k;
      c.textAlign = 'center';
      const size = W * (beat.crit ? 0.085 : 0.068);
      c.font = '800 ' + size + 'px ' + MT.FONT;
      c.fillStyle = beat.crit ? '#ffd76a' : '#ff8f83';
      c.shadowColor = 'rgba(0,0,0,0.9)';
      c.shadowBlur = 8;
      const dy = -k * W * 0.06;
      c.fillText('-' + beat.pDmg + (beat.crit ? '!' : ''), monX + monDx, baseY - sprite * 0.42 + dy);
      if (beat.mDmg > 0) {
        c.fillStyle = '#ff9d92';
        c.font = '800 ' + (size * 0.72) + 'px ' + MT.FONT;
        c.fillText('-' + beat.mDmg, heroX + heroDx, baseY - sprite * 0.30 + dy);
      }
      if (beat.reflect) {
        c.fillStyle = '#ffc064';
        c.font = '800 ' + (size * 0.6) + 'px ' + MT.FONT;
        c.fillText('反弹 ' + beat.reflect, monX + monDx, baseY - sprite * 0.18 + dy);
      }
      if (beat.heal > 0) {
        c.fillStyle = '#7ce08a';
        c.font = '800 ' + (size * 0.58) + 'px ' + MT.FONT;
        c.fillText('+' + beat.heal, heroX + heroDx, baseY - sprite * 0.5 + dy);
      }
      c.restore();
    }

    // 结算
    if ((b.done || finished) && el > 380 + b.beats.length * b.beatMs) {
      const k = Math.min(1, (el - (380 + b.beats.length * b.beatMs)) / 260);
      c.save();
      c.globalAlpha = k;
      c.textAlign = 'center';
      c.font = '800 ' + W * 0.062 + 'px ' + MT.FONT;
      c.fillStyle = b.roll.win ? '#f2dca6' : '#ff8f83';
      c.shadowColor = b.roll.win ? 'rgba(217,184,106,0.7)' : 'rgba(226,87,76,0.7)';
      c.shadowBlur = 24;
      c.fillText(b.roll.win ? '战斗胜利' : '你已倒下', W / 2, H * 0.86);
      c.font = '600 ' + W * 0.032 + 'px ' + MT.FONT;
      c.fillStyle = 'rgba(236,229,216,0.8)';
      c.shadowBlur = 0;
      c.fillText(b.roll.win ? ('-' + b.roll.loss + ' 生命   +' + b.roll.gold + ' 金币') : ('造成 ' + (b.mon.hp - b.roll.log[b.roll.log.length - 1].mHp) + ' 点伤害'), W / 2, H * 0.86 + W * 0.05);
      c.restore();
      if (!b.done) endBattle(now);
    }
  }

  function drawHpBar(c, x, y, w, name, cur, max, color) {
    const h = 9;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.55)';
    Art.rr(c, x, y, w, h, 5);
    c.fill();
    const p = Math.max(0, Math.min(1, cur / Math.max(1, max)));
    const gr = c.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(255,255,255,0.85)');
    c.fillStyle = gr;
    Art.rr(c, x + 1, y + 1, Math.max(0, (w - 2) * p), h - 2, 4);
    c.fill();
    c.font = '700 11px ' + MT.FONT;
    c.fillStyle = '#e8e0d2';
    c.textBaseline = 'bottom';
    c.textAlign = 'left';
    c.fillText(name, x, y - 5);
    c.textAlign = 'right';
    c.fillStyle = 'rgba(240,232,220,0.9)';
    c.fillText(Math.max(0, cur) + ' / ' + max, x + w, y - 5);
    c.restore();
  }

  $('battle-skip').addEventListener('click', function () {
    if (!battle || battle.done) return;
    battleEl.hidden = true;
    const roll = battle.roll, x = battle.x, y = battle.y, mon = battle.mon;
    battle = null;
    MTAudio.sfx(roll.win ? 'victory' : 'dead');
    game.commitBattle(x, y, roll);
    syncHero();
    afterAction();
    syncBgm();
    announceDrop();
    if (game.state === 'dead') showDead();
    else if (game.state === 'win') showWin();
    else if (roll.win) toast('击败 ' + mon.name + ' · 金币 +' + roll.gold);
  });

  /* ------------------------------------------------------------ 弹层 */
  const sheetWrap = $('sheet-wrap'), sheetTitle = $('sheet-title'), sheetBody = $('sheet-body'), sheetFoot = $('sheet-foot');

  function openSheet(kind, title) {
    sheetKind = kind;
    sheetTitle.textContent = title;
    sheetBody.innerHTML = '';
    sheetFoot.innerHTML = '';
    sheetWrap.hidden = false;
  }
  function closeSheet() {
    sheetKind = null;
    sheetWrap.hidden = true;
  }
  $('sheet-close').addEventListener('click', closeSheet);
  sheetWrap.addEventListener('click', function (e) { if (e.target === sheetWrap) closeSheet(); });

  function btn(label, cls, fn) {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function openMenu() {
    openSheet('menu', '冒险菜单');
    const list = document.createElement('div');
    list.className = 'menu-list';
    const items = [
      { t: '继续游戏', s: '回到魔塔', fn: closeSheet },
      { t: '装备', s: '查看附加效果', fn: openEquip },
      { t: '怪物手册', s: '本层战斗预估', fn: openManual },
      { t: '音乐 / 音效：' + (MTAudio.isOn() ? '开' : '关'), s: '点击切换', fn: function () { MTAudio.toggle(); openMenu(); } },
      { t: '重新开始', s: '清空进度，从第 1 层重来', cls: 'danger', fn: confirmRestart },
      { t: '玩法说明', s: '战斗计算与装备机制', fn: openHelp }
    ];
    items.forEach(function (it) {
      const b = document.createElement('button');
      b.className = 'menu-item ' + (it.cls || '');
      b.innerHTML = '<span>' + it.t + '</span><small>' + it.s + '</small>';
      b.addEventListener('click', it.fn);
      list.appendChild(b);
    });
    sheetBody.appendChild(list);
  }

  function confirmRestart() {
    openSheet('confirm', '重新开始');
    const p = document.createElement('p');
    p.style.cssText = 'font-size:12.5px;line-height:1.8;color:#c8bcae;margin:0 0 4px';
    p.textContent = '本作不提供存档。重新开始会立刻回到第 1 层，当前进度无法恢复。';
    sheetBody.appendChild(p);
    sheetFoot.appendChild(btn('确认重来', 'danger', restart));
    sheetFoot.appendChild(btn('再想想', 'ghost', closeSheet));
  }

  function restart() {
    game = new MT.Game();
    selected = null;
    floaters = [];
    hideCard();
    closeSheet();
    syncBgm();
    syncHero();
    Art.clearTiles();
    updateHud();
    renderSide();
    floorBanner();
  }

  function equipCard(id, ownedText) {
    const it = MT.ITEMS[id];
    const owned = game.inv.indexOf(id) >= 0;
    const on = game.isEquipped(id);
    const card = document.createElement('div');
    card.className = 'equip-card' + (on ? ' on' : '');
    const pic = document.createElement('canvas');
    pic.className = 'equip-pic';
    pic.width = 128; pic.height = 128;
    pic.style.width = '64px'; pic.style.height = '64px';
    const c2 = pic.getContext('2d');
    c2.scale(1.28, 1.28);
    c2.globalAlpha = owned ? 1 : 0.28;
    Art.drawItem(c2, id, 50, 50, 92, 0);
    const txt = document.createElement('div');
    txt.className = 'equip-txt';
    let extra = '';
    if (id === 'necroBook' && owned) {
      extra = '<br>当前能量 <b>' + game.necroEnergy + '</b> · 使用可兑换 <b>+' + Math.floor(game.necroEnergy / 10) + '</b> 攻击';
    }
    txt.innerHTML = '<h3>' + it.name + '</h3><p>' + it.desc + extra + '</p><em>' +
      (owned ? (id === 'necroBook' ? '已获得 · 使用后消失' : (on ? '已装备 · 点击下方卸下' : '已获得 · 可装备')) : ownedText) + '</em>';
    const act = document.createElement('div');
    act.className = 'equip-act';
    let b;
    if (id === 'necroBook') {
      b = btn(owned ? '使用' : '尚未获得', '', function () {
        const gain = game.useNecro();
        MTAudio.sfx('equip');
        toast('亡灵之书化为灰烬 · 攻击 +' + gain);
        popFloat('攻击 +' + gain, '#b49cff');
        updateHud();
        openEquip();
        renderSide();
      });
      b.disabled = !owned;
    } else {
      b = btn(owned ? (on ? '卸下' : '装备') : '尚未获得', on ? 'ghost' : '', function () {
        if (!owned) return;
        game.equipItem(id);
        updateHud();
        openEquip();
        renderSide();
      });
      b.disabled = !owned;
    }
    act.appendChild(b);
    card.appendChild(pic);
    card.appendChild(txt);
    card.appendChild(act);
    return card;
  }

  function openEquip() {
    openSheet('equip', '装备与秘宝');
    const grid = document.createElement('div');
    grid.className = 'equip-grid';
    grid.appendChild(equipCard('sword', '击败第 20 层守关首领获得'));
    grid.appendChild(equipCard('armor', '击败第 30 层守关首领获得'));
    grid.appendChild(equipCard('satan', '击败第 40 层守关首领获得'));
    sheetBody.appendChild(grid);
    const grid2 = document.createElement('div');
    grid2.className = 'equip-grid';
    grid2.style.marginTop = '10px';
    grid2.appendChild(equipCard('necroBook', '击败第 10 层守关首领获得'));
    sheetBody.appendChild(grid2);
    const note = document.createElement('p');
    note.style.cssText = 'font-size:11px;color:#9b9086;line-height:1.7;margin:12px 0 0';
    note.textContent = '三件装备可同时生效。装备不影响面板攻防数值，只改变战斗过程；亡灵之书在菜单-装备中使用。';
    sheetBody.appendChild(note);
  }

  function openManual() {
    openSheet('manual', '怪物手册 · 第 ' + game.floorNum + ' 层');
    const mons = game.floorMonsters();
    if (!mons.length) {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:12px;color:#9b9086';
      p.textContent = '本层已无敌人。';
      sheetBody.appendChild(p);
    }
    mons.forEach(function (e) {
      sheetBody.appendChild(monRow(e.m, game.preview(e.m), 46));
    });
    const note = document.createElement('p');
    note.style.cssText = 'font-size:11px;color:#9b9086;line-height:1.7;margin:10px 0 0';
    note.textContent = '“损失”为期望值：已计入暴击期望与刃甲反弹。实际战斗可能更好或更差。';
    sheetBody.appendChild(note);
  }

  let shopMessage = '';
  function openShop() {
    shopMessage = '';
    openSheet('shop', '神秘商人 · 第 ' + game.floorNum + ' 层');
    renderShop();
  }
  function renderShop() {
    sheetBody.innerHTML = '';
    const ci = game.critInfo();
    const head = document.createElement('p');
    head.style.cssText = 'font-size:11.5px;color:#9b9086;margin:0 0 4px';
    head.textContent = '金币 ' + game.gold + ' · 随机上架 3 种商品 · 每种全场限购 ' + MT.Game.SHOP_LIMIT + ' 次，每购一次价格永久 +2% · 商品按楼层享 ' + Math.min(70, game.floorNum) + '% 折扣。';
    sheetBody.appendChild(head);
    if (game.goldBonus > 0 || game.critRate > 0 || game.critMult > 1.5) {
      const cur = document.createElement('p');
      cur.style.cssText = 'font-size:11px;color:#6fd08a;margin:0 0 10px';
      cur.textContent = '当前加成：金币掉落 +' + Math.round(game.goldBonus * 100) + '% · 暴击率 ' + Math.round(ci.rate * 100) + '% · 暴击伤害 ' + Math.round(ci.mult * 100) + '%。';
      sheetBody.appendChild(cur);
    }
    game.shopOffer().forEach(function (o) {
      const row = document.createElement('div');
      row.className = 'shop-row' + (o.exchange ? ' shop-exchange' : '');
      const info = document.createElement('div');
      if (o.exchange) {
        info.innerHTML = '<b>' + o.name + '</b><span>' + o.desc + '（现有黄钥匙 ' + game.keys.y + ' / 蓝钥匙 ' + game.keys.b + '）</span>';
      } else {
        info.innerHTML = '<b>' + o.name + '</b><span>' + (o.desc || '') + (o.buysLeft <= 0 ? ' · 已达限购' : ' · 还可购买 ' + o.buysLeft + ' 次') + '</span>';
      }
      const b = document.createElement('button');
      b.className = 'shop-buy';
      if (o.exchange) {
        b.textContent = '3 黄 → 1 蓝';
        b.disabled = game.keys.y < 3;
        b.addEventListener('click', function () {
          if (game.buy('exYB')) {
            MTAudio.sfx('buy');
            shopMessage = '兑换成功：蓝钥匙 +1';
            updateHud();
            renderShop();
            renderSide();
          }
        });
      } else {
        b.textContent = o.buysLeft <= 0 ? '限购已满' : o.cost + ' 金币';
        b.disabled = o.buysLeft <= 0 || game.gold < o.cost;
        b.addEventListener('click', function () {
          if (game.buy(o.id)) {
            MTAudio.sfx('buy');
            shopMessage = '购买了 ' + o.name + (o.buysLeft - 1 >= 0 ? '（该商品价格永久 +2%）' : '');
            updateHud();
            renderShop();
            renderSide();
          }
        });
      }
      row.appendChild(info);
      row.appendChild(b);
      sheetBody.appendChild(row);
    });
    if (shopMessage) {
      const m = document.createElement('p');
      m.style.cssText = 'font-size:11.5px;color:#6fd08a;margin:6px 0 0';
      m.textContent = shopMessage;
      sheetBody.appendChild(m);
    }
    sheetFoot.innerHTML = '';
    sheetFoot.appendChild(btn('离开商店', 'ghost', closeSheet));
  }

  function openHelp() {
    openSheet('help', '玩法说明');
    sheetBody.innerHTML =
      '<div class="help">' +
      '<h3>战斗如何计算</h3>' +
      '<p>你先出手。每回合你造成 <b>攻击 − 敌人防御</b> 点伤害；敌人每回合造成 <b>敌人攻击 − 你的防御</b> 点伤害。</p>' +
      '<p>所以整场战斗的伤害是可以提前算出来的：<b>预计损失 = 每回合受伤 × 回合数</b>。点地图上的怪物或打开手册即可看到预估。</p>' +
      '<h3>装备</h3>' +
      '<p><b>水晶剑</b>：暴击率 +30%、暴击伤害 +10%（基础暴击伤害 150%），暴击已计入战斗预估。</p>' +
      '<p><b>刃甲</b>：每次被攻击时反弹 10 + 所受伤害的 15%，让高攻敌人自己流血。</p>' +
      '<p><b>撒旦邪力</b>：每次攻击回复所造成伤害 25% 的生命，越战越勇。</p>' +
      '<p><b>亡灵之书</b>：每击败一只怪物积 1 点能量，在装备面板使用后消失，每 10 点能量兑换 +1 攻击（不足 10 点向下取整）。</p>' +
      '<p>装备与秘宝来自守关首领：第 10 层亡灵之书、第 20 层水晶剑、第 30 层刃甲、第 40 层撒旦邪力。</p>' +
      '<h3>目标</h3>' +
      '<p>一路向上，第 50 层击败魔塔之主。<b>每 10 层有一位守关首领</b>：击败它之前，本层的道具、宝箱与门都可正常使用，但<b>无法上楼</b>。怪物头上的 <b>Lv 徽章</b>代表其强度等级，遇到高你许多的怪物请绕行——它们不会挡在必经之路上。</p>' +
      '<h3>钥匙与解谜</h3>' +
      '<p>黄 / 蓝 / 红三色门对应三色钥匙。<b>黄钥匙有余量</b>，主流程畅通无阻；<b>蓝钥匙刻意短缺</b>——+2 攻击 / 防御宝石全部锁在蓝门与蓝箱之后，数量不够全开，想好先拿哪些。<b>宝物房</b>（5 层起为蓝门）藏着额外物资。</p>' +
      '<p>商店每 5 层出现一次：随机上架 6 种商品中的 3 种（攻击 / 防御 / 生命 / 金币掉落 / 暴击率 / 暴击伤害），另设 <b>3 黄钥匙兑 1 蓝钥匙</b>。每种商品全场限购 5 次，每购一次价格永久 +2%；楼层越深折扣越大（楼层 ×1%）。菜单里可以开关音乐与音效。</p>' +
      '<p>本作<b>没有存档</b>，只有重新开始。</p>' +
      '</div>';
    sheetFoot.appendChild(btn('知道了', '', closeSheet));
  }

  function showDead() {
    openSheet('dead', '');
    sheetTitle.textContent = '冒险结束';
    sheetBody.innerHTML = '<div class="result lose"><h2>你已倒下</h2><p>第 ' + game.floorNum + ' 层 · ' + game.theme.name + '</p>' +
      '<div class="stat-line"><span>击杀<b>' + game.kills + '</b></span><span>攻击<b>' + game.atk + '</b></span><span>防御<b>' + game.def + '</b></span></div></div>';
    sheetFoot.appendChild(btn('重新开始', 'danger', restart));
    sheetFoot.appendChild(btn('看看本层敌人', 'ghost', openManual));
  }

  function showWin() {
    openSheet('win', '');
    sheetTitle.textContent = '通关';
    sheetBody.innerHTML = '<div class="result win"><h2>魔塔之主已陨落</h2><p>50 层尽头的光，终于照进来了。</p>' +
      '<div class="stat-line"><span>击杀<b>' + game.kills + '</b></span><span>攻击<b>' + game.atk + '</b></span><span>防御<b>' + game.def + '</b></span><span>金币<b>' + game.gold + '</b></span></div></div>';
    sheetFoot.appendChild(btn('再来一次', '', restart));
  }

  /* ------------------------------------------------------------ 输入 */
  function bindHold(el, fn) {
    let timer = null, rep = null;
    const start = function (e) {
      e.preventDefault();
      el.classList.add('pressed');
      fn();
      clearTimeout(timer);
      timer = setTimeout(function () {
        rep = setInterval(fn, 130);
      }, 300);
    };
    const end = function () {
      el.classList.remove('pressed');
      clearTimeout(timer);
      clearInterval(rep);
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  document.querySelectorAll('.dbtn').forEach(function (b) {
    bindHold(b, function () { move(b.dataset.dir); });
  });

  window.addEventListener('keydown', function (e) {
    if (sheetKind) {
      if (e.key === 'Escape') closeSheet();
      return;
    }
    if (battle) return;
    const d = KEYMAP[e.key];
    if (d) { e.preventDefault(); move(d); return; }
    if (e.key === 'b' || e.key === 'B') openManual();
    else if (e.key === 'e' || e.key === 'E') openEquip();
    else if (e.key === 'Escape') openMenu();
  });

  document.querySelectorAll('.dbtn').forEach(function (b) {
    b.addEventListener('click', function () { b.blur(); });
  });

  // 棋盘点击：查看怪物情报
  board.addEventListener('pointerdown', function (e) {
    if (battle || sheetKind) return;
    const r = board.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width / SIZE));
    const y = Math.floor((e.clientY - r.top) / (r.height / SIZE));
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const c = game.cell(x, y);
    if (c && c.o && c.o.kind === 'monster') showCard(x, y);
    else hideCard();
  });

  $('btn-fight').addEventListener('click', function () {
    if (!selected) return;
    const dx = selected.x - game.x, dy = selected.y - game.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    move(dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up');
  });
  $('btn-manual').addEventListener('click', openManual);
  $('btn-equip').addEventListener('click', openEquip);
  $('btn-equip-quick').addEventListener('click', openEquip);
  $('btn-menu').addEventListener('click', openMenu);

  /* ------------------------------------------------------------ 启动 */
  function boot() {
    resize();
    syncHero();
    heroPx = heroTx; heroPy = heroTy;
    syncBgm();
    updateHud();
    renderSide();
    floorBanner();
    requestAnimationFrame(loop);
  }
  // 首次交互解锁音频（iOS / 各浏览器自动播放策略）
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, function () { MTAudio.unlock(); }, { passive: true });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.target.closest('.sheet-body')) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  boot();

  /* 供自动化验收/调试使用的最小钩子，不影响正常游戏 */
  window.MTHD = {
    game: function () { return game; },
    move: move,
    teleport: function (x, y) { game.x = x; game.y = y; syncHero(); afterAction(); },
    startBattle: function (x, y) {
      const c = game.cell(x, y);
      if (c && c.o && c.o.kind === 'monster') startBattle(x, y, c.o.m);
    },
    openMenu: openMenu, openEquip: openEquip, openManual: openManual, openShop: openShop,
    showCard: showCard, hideCard: hideCard
  };
})();
