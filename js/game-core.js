/* 魔塔 50 · 高清重制版 —— 纯逻辑内核（浏览器 / Node 共用，不触碰 DOM） */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const SIZE = 11;
  MT.SIZE = SIZE;

  /* ------------------------------------------------------------------ 随机数 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ------------------------------------------------------------------ 主题 */
  const THEMES = [
    { id: 'dungeon', name: '地牢外围', floor: '#2a2732', floor2: '#211f28', wall: '#3b3646', wall2: '#272331', rim: '#5c5470', glow: 'rgba(150,130,90,0.20)', accent: '#c8a86a' },
    { id: 'crypt', name: '骷髅墓室', floor: '#2b2a28', floor2: '#222120', wall: '#3d3a34', wall2: '#2a2722', rim: '#6b6455', glow: 'rgba(170,150,110,0.18)', accent: '#b8a882' },
    { id: 'gargoyle', name: '石像回廊', floor: '#28313a', floor2: '#202830', wall: '#39434d', wall2: '#28313a', rim: '#5d7080', glow: 'rgba(110,150,180,0.18)', accent: '#8fb4c8' },
    { id: 'frost', name: '冰封地窖', floor: '#26333f', floor2: '#1e2934', wall: '#31414f', wall2: '#233039', rim: '#5f8ba6', glow: 'rgba(120,190,230,0.20)', accent: '#9ed8f0' },
    { id: 'lava', name: '熔岩深处', floor: '#33231f', floor2: '#281a17', wall: '#3f2b24', wall2: '#2c1d17', rim: '#7a4a30', glow: 'rgba(255,120,50,0.22)', accent: '#ff9a4d' },
    { id: 'library', name: '幽影书库', floor: '#282838', floor2: '#1f1f2c', wall: '#363547', wall2: '#262532', rim: '#5a5878', glow: 'rgba(140,120,220,0.18)', accent: '#a89ce0' },
    { id: 'blood', name: '血月祭坛', floor: '#31202a', floor2: '#261820', wall: '#3d2833', wall2: '#2b1c24', rim: '#7a4356', glow: 'rgba(220,60,90,0.20)', accent: '#e0708a' },
    { id: 'lair', name: '龙巢金库', floor: '#302b1f', floor2: '#252118', wall: '#3d3624', wall2: '#2b2619', rim: '#7d6a3a', glow: 'rgba(220,180,80,0.20)', accent: '#e8c46a' },
    { id: 'void', name: '虚空回廊', floor: '#241f36', floor2: '#1c182a', wall: '#2f2942', wall2: '#221d32', rim: '#584a86', glow: 'rgba(150,110,255,0.20)', accent: '#b39cff' },
    { id: 'throne', name: '魔王之巅', floor: '#231d24', floor2: '#1b161c', wall: '#332a35', wall2: '#241d26', rim: '#6b4d63', glow: 'rgba(200,60,120,0.22)', accent: '#ff8ab4' }
  ];
  MT.THEMES = THEMES;
  const themeFor = (f) => THEMES[Math.min(THEMES.length - 1, Math.floor((f - 1) / 5))];
  MT.themeFor = themeFor;

  /* ------------------------------------------------------------------ 怪物 */
  const MONSTERS = {
    slimeGreen: { name: '绿史莱姆', family: 'blob', base: 1, hp: 34, atk: 9, def: 0, gold: 3, pal: { main: '#5cc96f', dark: '#26663a', light: '#b9f5c4', eye: '#0d2a14' } },
    bat: { name: '暗影蝠', family: 'bat', base: 2, hp: 42, atk: 13, def: 1, gold: 4, pal: { main: '#7b68a8', dark: '#2a2340', light: '#c0b0e6', eye: '#ff6b6b' } },
    slimeRed: { name: '血史莱姆', family: 'blob', base: 3, hp: 58, atk: 16, def: 2, gold: 5, pal: { main: '#e05a5a', dark: '#6b1f26', light: '#ffb3ae', eye: '#2a0a0d' } },
    skeleton: { name: '骷髅兵', family: 'skeleton', base: 6, hp: 92, atk: 21, def: 4, gold: 8, pal: { main: '#e8e2cf', dark: '#6d6656', light: '#fffdf3', eye: '#6fe0ff' } },
    skeletonCaptain: { name: '骷髅队长', family: 'skeleton', base: 8, hp: 132, atk: 27, def: 7, gold: 12, pal: { main: '#efe6c8', dark: '#76694a', light: '#fffbe8', eye: '#ffb347', crown: '#d9a441' } },
    gargoyle: { name: '石像鬼', family: 'gargoyle', base: 11, hp: 196, atk: 35, def: 10, gold: 18, pal: { main: '#6f7d8c', dark: '#333d47', light: '#a9bccd', eye: '#ff5a3c' } },
    wraith: { name: '幽魂', family: 'hooded', base: 13, hp: 228, atk: 41, def: 8, gold: 22, pal: { main: '#5f5a96', dark: '#241f3d', light: '#9c94d6', eye: '#8ff5ff', robe: true } },
    frostMage: { name: '冰霜法师', family: 'hooded', base: 16, hp: 268, atk: 49, def: 14, gold: 30, pal: { main: '#3f7fa8', dark: '#1b3a4f', light: '#a8e4ff', eye: '#d6f7ff', orb: '#7fe0ff' } },
    lavaHound: { name: '熔岩犬', family: 'beast', base: 21, hp: 344, atk: 59, def: 18, gold: 40, pal: { main: '#8a3a22', dark: '#3a140a', light: '#ff8a3c', eye: '#ffe066' } },
    abyssKnight: { name: '深渊骑士', family: 'knight', base: 24, hp: 428, atk: 68, def: 24, gold: 55, pal: { main: '#3d3a5c', dark: '#1b1930', light: '#8f86c8', eye: '#ff3c5a' } },
    vampire: { name: '血族伯爵', family: 'vampire', base: 31, hp: 530, atk: 77, def: 26, gold: 70, pal: { main: '#5a1f33', dark: '#26090f', light: '#c96a80', eye: '#ff2d55', cape: '#150509' } },
    flameLord: { name: '炎魔', family: 'demon', base: 33, hp: 640, atk: 88, def: 30, gold: 90, pal: { main: '#a83a1e', dark: '#42120a', light: '#ffb066', eye: '#ffe066' } },
    boneDragon: { name: '骨龙', family: 'dragon', base: 36, hp: 780, atk: 98, def: 34, gold: 120, pal: { main: '#ded6bd', dark: '#6a6250', light: '#fffdf0', eye: '#7cffb2' } },
    voidWatcher: { name: '虚空守望者', family: 'eye', base: 41, hp: 920, atk: 110, def: 38, gold: 150, pal: { main: '#4a3a78', dark: '#1c1430', light: '#b49cff', eye: '#c9f7ff' } },
    demonGuard: { name: '魔王守卫', family: 'demon', base: 46, hp: 1120, atk: 122, def: 42, gold: 200, pal: { main: '#5c2440', dark: '#1e0a16', light: '#e05a8a', eye: '#ffd166' } },
    skeletonKing: { name: '骸骨王', family: 'skeleton', base: 10, hp: 520, atk: 95, def: 8, gold: 150, boss: true, pal: { main: '#e8e2cf', dark: '#5a5240', light: '#fffdf0', eye: '#ff4d4d', crown: '#ffcf5a' } },
    gargoyleKing: { name: '石像鬼王', family: 'gargoyle', base: 20, hp: 1250, atk: 160, def: 20, gold: 350, boss: true, pal: { main: '#8a93a8', dark: '#343c4c', light: '#cdd8e8', eye: '#ffb347' } },
    vampireLord: { name: '血族亲王', family: 'vampire', base: 30, hp: 2600, atk: 205, def: 40, gold: 650, boss: true, pal: { main: '#7a1f3a', dark: '#2a0812', light: '#e88aa0', eye: '#ff2d55', cape: '#1c040c' } },
    boneLord: { name: '白骨龙王', family: 'dragon', base: 40, hp: 4200, atk: 270, def: 58, gold: 1000, boss: true, pal: { main: '#d8d0b8', dark: '#5a5244', light: '#fffbe8', eye: '#ff6b4a' } },
    towerLord: { name: '魔塔之主', family: 'demon', base: 50, hp: 6200, atk: 335, def: 80, gold: 0, boss: true, pal: { main: '#3a1030', dark: '#12040f', light: '#ff4d8d', eye: '#ffe066' } }
  };
  MT.MONSTERS = MONSTERS;

  /* 每层出现的怪物池 */
  const POOLS = [
    ['slimeGreen', 'bat', 'slimeRed'],
    ['skeleton', 'slimeRed', 'bat'],
    ['gargoyle', 'skeletonCaptain', 'skeleton'],
    ['frostMage', 'wraith', 'gargoyle'],
    ['lavaHound', 'abyssKnight', 'gargoyle'],
    ['vampire', 'abyssKnight', 'wraith'],
    ['vampire', 'flameLord', 'boneDragon'],
    ['boneDragon', 'lavaHound', 'abyssKnight'],
    ['voidWatcher', 'boneDragon', 'flameLord'],
    ['demonGuard', 'voidWatcher', 'flameLord']
  ];
  MT.POOLS = POOLS;

  MT.BALANCE = { hpGrow: 0.115, atkGrow: 0.245, defGrow: 0.085, goldGrow: 0.10, threat: 0.006, power: 0.67, mdef: 0.55 };

  /* 同一层段的怪物共用同一缩放基准，避免旧怪物被无限放大 */
  function bandStart(floor) { return Math.floor((floor - 1) / 5) * 5 + 1; }
  MT.bandStart = bandStart;

  function scaleMonster(id, floor) {
    const B = MT.BALANCE;
    const m = MONSTERS[id];
    const d = m.boss ? 0 : Math.max(0, floor - bandStart(floor));
    return {
      id: id, name: m.name, family: m.family, pal: m.pal, boss: !!m.boss,
      hp: Math.round(m.hp * (1 + B.hpGrow * d) * (m.boss ? 1 : (1 + B.threat * floor * 0.7)) * B.power),
      atk: Math.round(m.atk * (1 + B.atkGrow * d) * (m.boss ? 1 : (1 + B.threat * floor)) * B.power),
      def: Math.round(m.def * (1 + B.defGrow * d) * B.mdef),
      gold: Math.round(m.gold * (1 + B.goldGrow * d))
    };
  }
  MT.scaleMonster = scaleMonster;

  /* ------------------------------------------------------------------ 道具 */
  const ITEMS = {
    potionRed: { name: '红药水', short: '红', heal: 120, color: '#e04a4a', desc: '恢复 120 点生命' },
    potionBlue: { name: '蓝药水', short: '蓝', heal: 320, color: '#4a8ce0', desc: '恢复 320 点生命' },
    keyYellow: { name: '黄钥匙', short: '黄', key: 'y', color: '#e8c34a', desc: '开启黄门' },
    keyBlue: { name: '蓝钥匙', short: '蓝', key: 'b', color: '#5aa8f0', desc: '开启蓝门' },
    keyRed: { name: '红钥匙', short: '红', key: 'r', color: '#e0534a', desc: '开启红门' },
    gemAtk: { name: '攻击宝石', short: '攻', atk: 2, color: '#ff6b5a', desc: '攻击永久 +2' },
    gemDef: { name: '防御宝石', short: '防', def: 2, color: '#5ac8ff', desc: '防御永久 +2' },
    goldBag: { name: '金币袋', short: '金', gold: 1, scale: true, color: '#e8c34a', desc: '沉甸甸的一大袋金币' },
    sword: { name: '水晶剑', short: '剑', equip: 'weapon', color: '#8fe8ff', desc: '每次攻击有 30% 概率造成 160% 伤害' },
    armor: { name: '刃甲', short: '甲', equip: 'armor', color: '#ffb45a', desc: '每次受到攻击，反弹 10 + 所受伤害的 15%' },
    necroBook: { name: '亡灵之书', short: '书', necro: true, color: '#b49cff', desc: '记录杀戮：每击败 1 只怪物积 1 点能量。使用后消失，每 10 点能量兑换 +1 攻击（不足 10 点向下取整）' },
    satan: { name: '撒旦邪力', short: '邪', equip: 'relic', color: '#e04a72', desc: '邪恶魔约：每次攻击回复所造成伤害 25% 的生命' }
  };
  MT.ITEMS = ITEMS;

  /* ------------------------------------------------------------------ 楼层生成 */

  function blank() {
    const g = [];
    for (let y = 0; y < SIZE; y++) {
      const row = [];
      for (let x = 0; x < SIZE; x++) row.push({ t: 'wall', o: null });
      g.push(row);
    }
    return g;
  }

  /* 把一个房间的入口封到只剩一个并放门；放不了返回 null（交由外层重试） */
  function sealRoom(g, room, anchor) {
    const inRoom = function (r, x, y) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; };
    const entrances = [];
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) {
        if (x < 1 || y < 1 || x > SIZE - 2 || y > SIZE - 2) continue;
        if (inRoom(room, x, y)) continue;
        const side = (x >= room.x && x < room.x + room.w && (y === room.y - 1 || y === room.y + room.h)) ||
          (y >= room.y && y < room.y + room.h && (x === room.x - 1 || x === room.x + room.w));
        if (side && g[y][x].t === 'floor') entrances.push({ x: x, y: y });
      }
    }
    if (!entrances.length) return null;
    entrances.sort(function (p, q) {
      return (Math.abs(p.x - anchor.x) + Math.abs(p.y - anchor.y)) - (Math.abs(q.x - anchor.x) + Math.abs(q.y - anchor.y));
    });
    const gate = entrances[0];
    for (let i = 1; i < entrances.length; i++) g[entrances[i].y][entrances[i].x].t = 'wall';
    return gate;
  }

  /* 混合寻路：可穿过既有地板，也可 carving 墙格；绕开禁区（房间外扩一圈）。
     用于封门后重建主路，保证不卡关。成功返回 true 并把沿途墙格凿开。 */
  function carvePath(g, from, to, forb) {
    const bad = function (x, y) {
      for (let i = 0; i < forb.length; i++) {
        const r = forb[i];
        if (x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h) return true;
      }
      return false;
    };
    const isEnd = function (x, y) { return x === to.x && y === to.y; };
    const key = function (x, y) { return x + ',' + y; };
    const prev = new Map();
    prev.set(key(from.x, from.y), null);
    const q = [from];
    while (q.length) {
      const c = q.shift();
      if (isEnd(c.x, c.y)) {
        const path = [];
        let cur = c;
        while (cur) { path.push(cur); cur = prev.get(key(cur.x, cur.y)); }
        for (let i = 1; i < path.length - 1; i++) {
          if (g[path[i].y][path[i].x].t === 'wall') g[path[i].y][path[i].x].t = 'floor';
        }
        return true;
      }
      for (let i = 0; i < 4; i++) {
        const nx = c.x + DIRS[i][0], ny = c.y + DIRS[i][1];
        if (nx < 1 || ny < 1 || nx > SIZE - 2 || ny > SIZE - 2) continue;
        if (prev.has(key(nx, ny))) continue;
        if (bad(nx, ny) && !isEnd(nx, ny)) continue;
        const t = g[ny][nx].t;
        if (t === 'gate' || t === 'stairUp' || t === 'stairDown') continue;
        prev.set(key(nx, ny), c);
        q.push({ x: nx, y: ny });
      }
    }
    return false;
  }

  /* 门格朝房间外侧的相邻格（玩家面对门所站的位置） */
  function gateOuter(g, gate, room) {
    const inRoom = function (x, y) { return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h; };
    for (let i = 0; i < 4; i++) {
      const nx = gate.x + DIRS[i][0], ny = gate.y + DIRS[i][1];
      if (nx < 1 || ny < 1 || nx > SIZE - 2 || ny > SIZE - 2) continue;
      if (inRoom(nx, ny)) continue;
      return { x: nx, y: ny };
    }
    return null;
  }

  function tryLayout(floor, rng) {
    const g = blank();
    const rooms = [];
    for (let i = 0; i < 90 && rooms.length < 4; i++) {
      const w = ri(rng, 3, 4), h = ri(rng, 3, 4);
      const x = ri(rng, 1, SIZE - 1 - w), y = ri(rng, 1, SIZE - 1 - h);
      const r = { x: x, y: y, w: w, h: h, cx: x + ((w - 1) >> 1), cy: y + ((h - 1) >> 1) };
      const hits = rooms.some(function (o) {
        return !(r.x + r.w + 1 <= o.x || o.x + o.w + 1 <= r.x || r.y + r.h + 1 <= o.y || o.y + o.h + 1 <= r.y);
      });
      if (!hits) rooms.push(r);
    }
    if (rooms.length < 3) return null;

    const carve = function (x, y) {
      if (x > 0 && x < SIZE - 1 && y > 0 && y < SIZE - 1) g[y][x].t = 'floor';
    };
    rooms.forEach(function (r) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
    });

    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      let x = a.cx, y = a.cy;
      const goX = function () { while (x !== b.cx) { x += Math.sign(b.cx - x); carve(x, y); } };
      const goY = function () { while (y !== b.cy) { y += Math.sign(b.cy - y); carve(x, y); } };
      if (rng() < 0.5) { goX(); goY(); } else { goY(); goX(); }
    }

    const ex = rooms[rooms.length - 1];
    const entry = rooms[0];

    /* 出口房间只保留一个入口，这个入口放门 */
    const gatePos = sealRoom(g, ex, entry);
    if (!gatePos) return null;

    /* 主门只用黄 / 红（红 = Boss 层）；蓝锁专用于宝石与宝物房，制造取舍 */
    const color = floor % 10 === 0 ? 'r' : 'y';
    g[gatePos.y][gatePos.x] = { t: 'gate', color: color, o: null };

    const data = {
      floor: floor,
      theme: themeFor(floor),
      g: g,
      rooms: rooms,
      gate: { x: gatePos.x, y: gatePos.y, color: color },
      start: { x: entry.cx, y: entry.cy },
      down: floor > 1 ? { x: entry.cx, y: entry.cy } : null,
      up: { x: ex.cx, y: ex.cy }
    };
    g[data.up.y][data.up.x] = { t: 'stairUp', o: null };
    if (data.down) g[data.down.y][data.down.x] = { t: 'stairDown', o: null };

    /* 自由格 */
    const freeIn = function (list, pred) {
      const out = [];
      list.forEach(function (r) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          const c = g[y][x];
          if (c.t === 'floor' && !c.o && (!pred || pred(x, y))) out.push({ x: x, y: y });
        }
      });
      return out;
    };

    const beforeGate = rooms.slice(0, -1);
    if (!beforeGate.length) return null;

    /* 宝物房：中途挑一个房间单门上锁，锁住高价值物资；封门后重修旁通走廊保证主路畅通 */
    let treasure = null;
    if (floor >= 3 && rooms.length >= 3) {
      const mids = rooms.slice(1, rooms.length - 1);
      shuffle(mids, rng);
      for (let mi = 0; mi < mids.length && !treasure; mi++) {
        const room = mids[mi];
        const idx = rooms.indexOf(room);
        const from = rooms[idx - 1];
        const nxt = rooms[idx + 1];
        const tGate = sealRoom(g, room, entry);
        if (!tGate) continue;
        const tOuter = gateOuter(g, tGate, room);
        if (!tOuter) continue;
        // 旁通 1：房间链前一段 → 宝物房门前（让钥匙能走到宝物房门口）
        if (!carvePath(g, { x: from.cx, y: from.cy }, tOuter, [room, ex])) continue;
        // 旁通 2：绕过宝物房接回主路。下一间是出口房时，接到出口门外，不破坏唯一入口
        const target2 = nxt === ex ? gateOuter(g, gatePos, ex) : { x: nxt.cx, y: nxt.cy };
        if (!target2) continue;
        if (!carvePath(g, { x: from.cx, y: from.cy }, target2, [room, ex])) continue;
        const tColor = floor >= 5 ? 'b' : 'y';
        g[tGate.y][tGate.x] = { t: 'gate', color: tColor, o: null };
        treasure = { room: room, color: tColor };
      }
    }

    /* 钥匙经济（所有钥匙都放在无锁区域，主流程永不卡关）：
       黄钥匙 = 本层黄锁数量 + 3（宽松余量，不再滥发）；
       蓝钥匙 = 本层蓝锁数量 - 2（刻意短缺：+2 宝石全部锁在蓝锁之后，玩家必须取舍）；
       红钥匙 = 红锁数量（Boss 层主门 1 把） */
    const keyOf = function (c) { return c === 'y' ? 'keyYellow' : c === 'b' ? 'keyBlue' : 'keyRed'; };
    const item = function (id) { return { kind: 'item', id: id }; };
    const openRooms = treasure ? beforeGate.filter(function (r) { return r !== treasure.room; }) : beforeGate;
    const openSpots = shuffle(freeIn(openRooms), rng);
    if (openSpots.length < 10) return null;
    let ki = 0;

    /* 上锁宝箱（黄锁）：金币 / 药水的额外门路 */
    if (floor >= 3) {
      const roll = rng();
      const loot = roll < 0.5 ? 'goldBag' : (roll < 0.8 ? 'potionBlue' : 'potionRed');
      g[openSpots[ki].y][openSpots[ki].x].o = { kind: 'chest', color: 'y', loot: loot }; ki++;
    }

    /* 蓝锁宝石宝箱：+2 宝石只从这里出（每层两个；每 5 层加映一个） */
    const blueChests = [
      { kind: 'chest', color: 'b', loot: 'gemAtk' },
      { kind: 'chest', color: 'b', loot: 'gemDef' }
    ];
    if (floor % 5 === 0) blueChests.push({ kind: 'chest', color: 'b', loot: floor % 10 === 0 ? 'potionBlue' : 'gemAtk' });
    blueChests.forEach(function (ch) {
      g[openSpots[ki].y][openSpots[ki].x].o = Object.assign({}, ch); ki++;
    });

    /* 按锁数投放钥匙 */
    const yellowLocks = (color === 'y' ? 1 : 0) + (treasure && treasure.color === 'y' ? 1 : 0) + (floor >= 3 ? 1 : 0);
    for (let i = 0; i < yellowLocks + 3; i++) {
      g[openSpots[ki].y][openSpots[ki].x].o = item('keyYellow'); ki++;
    }
    const blueLocks = blueChests.length + (treasure && treasure.color === 'b' ? 1 : 0);
    for (let i = 0; i < blueLocks - 2; i++) {
      g[openSpots[ki].y][openSpots[ki].x].o = item('keyBlue'); ki++;
    }
    if (color === 'r') { g[openSpots[ki].y][openSpots[ki].x].o = item('keyRed'); ki++; }

    /* 明面物资：药水与金币（宝石已全部移入蓝锁） */
    const itemPlan = [floor >= 12 && floor % 2 === 0 ? 'potionBlue' : 'potionRed'];
    if (floor % 2 === 1) itemPlan.push('potionRed');
    if (floor % 5 === 0) itemPlan.push('potionBlue');
    if (floor % 4 === 0 && floor >= 16) itemPlan.push('potionBlue');
    if (floor % 3 === 0) itemPlan.push('goldBag');
    itemPlan.forEach(function (id) {
      if (openSpots[ki]) { g[openSpots[ki].y][openSpots[ki].x].o = item(id); ki++; }
    });

    /* 出口房门后战利品：过主门才有，主门即道具门槛 */
    {
      const eSpots = shuffle(freeIn([ex]), rng);
      if (eSpots[0]) g[eSpots[0].y][eSpots[0].x].o = item(floor % 2 ? 'potionRed' : 'potionBlue');
    }

    /* 宝物房物资：蓝门宝物房（5 层起）可放宝石；黄门宝物房只给药水金币 */
    if (treasure) {
      const tSpots = shuffle(freeIn([treasure.room]), rng);
      const goodies = treasure.color === 'b'
        ? ['potionBlue', floor % 2 ? 'gemAtk' : 'gemDef']
        : ['potionBlue', 'goldBag'];
      goodies.forEach(function (id, gi) {
        if (tSpots[gi]) g[tSpots[gi].y][tSpots[gi].x].o = item(id);
      });
    }

    /* 商店：每 5 层 */
    if (floor % 5 === 0) {
      const spot = freeIn([entry])[0] || openSpots[ki++];
      if (spot) g[spot.y][spot.x] = { t: 'shop', o: null };
    }

    /* 怪物 */
    const band = Math.min(POOLS.length - 1, Math.floor((floor - 1) / 5));
    const pool = POOLS[band];
    const count = 4 + (floor % 3 === 0 ? 1 : 0);
    const spots = shuffle(freeIn(rooms), rng).filter(function (p) {
      return !(p.x === data.start.x && p.y === data.start.y);
    });
    let si = 0;
    for (let i = 0; i < count && si < spots.length; i++) {
      const id = pool[Math.floor(rng() * pool.length)];
      const p = spots[si++];
      g[p.y][p.x].o = { kind: 'monster', m: scaleMonster(id, floor) };
    }

    /* 守关 Boss：每 10 层一位，坐镇出口房间中心，楼梯挪到旁边 */
    if (floor % 10 === 0 && floor < 50) {
      const bossId = { 10: 'skeletonKing', 20: 'gargoyleKing', 30: 'vampireLord', 40: 'boneLord' }[floor];
      const alt = freeIn([ex]);
      if (!alt.length) return null;
      g[alt[0].y][alt[0].x] = { t: 'stairUp', o: null };
      g[ex.cy][ex.cx] = { t: 'floor', o: { kind: 'monster', m: scaleMonster(bossId, floor) } };
      data.up = { x: alt[0].x, y: alt[0].y };
      data.boss = { x: ex.cx, y: ex.cy };
    }

    /* 50 层魔王 */
    if (floor === 50) {
      const boss = scaleMonster('towerLord', 50);
      g[ex.cy][ex.cx] = { t: 'floor', o: { kind: 'monster', m: boss } };
      data.up = null;
      data.boss = { x: ex.cx, y: ex.cy };
    }

    /* 连通性校验 */
    if (!validate(data)) return null;
    return data;
  }

  const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  function validate(data) {
    const g = data.g;
    const seen = [];
    for (let y = 0; y < SIZE; y++) { seen.push(new Array(SIZE).fill(false)); }
    const q = [{ x: data.start.x, y: data.start.y }];
    seen[data.start.y][data.start.x] = true;
    while (q.length) {
      const c = q.pop();
      for (let i = 0; i < 4; i++) {
        const nx = c.x + DIRS[i][0], ny = c.y + DIRS[i][1];
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        if (seen[ny][nx]) continue;
        if (g[ny][nx].t === 'wall') continue;
        seen[ny][nx] = true;
        q.push({ x: nx, y: ny });
      }
    }
    if (data.up && !seen[data.up.y][data.up.x]) return false;
    if (data.boss && !seen[data.boss.y][data.boss.x]) return false;
    if (!data.up && !data.boss) return false;
    // 所有放置物都要可达，否则浪费或死锁
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = g[y][x];
      if (c.o && !seen[y][x]) return false;
      if (c.t === 'shop' && !seen[y][x]) return false;
      // 门本身必须能走到面前，否则钥匙再多也开不了
      if (c.t === 'gate' && !seen[y][x]) return false;
    }
    // 无锁可达集：门与宝箱都视为墙。三色钥匙与商店必须在这里，
    // 从根上杜绝"钥匙被别的锁锁住"的死锁（红钥匙只有 1 把，零容错）
    const open = [];
    for (let y = 0; y < SIZE; y++) { open.push(new Array(SIZE).fill(false)); }
    const q2 = [{ x: data.start.x, y: data.start.y }];
    open[data.start.y][data.start.x] = true;
    while (q2.length) {
      const c = q2.pop();
      for (let i = 0; i < 4; i++) {
        const nx = c.x + DIRS[i][0], ny = c.y + DIRS[i][1];
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        if (open[ny][nx]) continue;
        if (g[ny][nx].t === 'wall' || g[ny][nx].t === 'gate') continue;
        if (g[ny][nx].o && g[ny][nx].o.kind === 'chest') continue;
        open[ny][nx] = true;
        q2.push({ x: nx, y: ny });
      }
    }
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = g[y][x];
      if ((c.o && c.o.kind === 'item' && ITEMS[c.o.id] && ITEMS[c.o.id].key) || c.t === 'shop') {
        if (!open[y][x]) return false;
      }
      if (c.t === 'gate') {
        const touch = DIRS.some(function (d) {
          const nx = x + d[0], ny = y + d[1];
          return nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && open[ny][nx];
        });
        if (!touch) return false;
      }
    }
    // 主路禁蓝：蓝钥匙刻意短缺（=蓝锁-2），蓝门/蓝箱只许挡可选物资。
    // 把蓝门/蓝箱视为墙后，上下楼梯与 Boss 仍必须可达，否则本层作废重生成。
    const nb = [];
    for (let y = 0; y < SIZE; y++) nb.push(new Array(SIZE).fill(false));
    const q3 = [{ x: data.start.x, y: data.start.y }];
    nb[data.start.y][data.start.x] = true;
    while (q3.length) {
      const c = q3.pop();
      for (let i = 0; i < 4; i++) {
        const nx = c.x + DIRS[i][0], ny = c.y + DIRS[i][1];
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || nb[ny][nx]) continue;
        const t = g[ny][nx];
        if (t.t === 'wall') continue;
        if (t.t === 'gate' && t.color === 'b') continue;
        if (t.o && t.o.kind === 'chest' && t.o.color === 'b') continue;
        nb[ny][nx] = true;
        q3.push({ x: nx, y: ny });
      }
    }
    const nbOk = function (p) { return !p || (nb[p.y] && nb[p.y][p.x]); };
    if (!nbOk(data.up) || !nbOk(data.down) || !nbOk(data.boss)) return false;
    return true;
  }

  const floorCache = new Map();
  function generateFloor(floor) {
    if (floorCache.has(floor)) return floorCache.get(floor);
    for (let attempt = 0; attempt < 120; attempt++) {
      const rng = mulberry32(0x5eed + floor * 7919 + attempt * 104729);
      const data = tryLayout(floor, rng);
      if (data) { floorCache.set(floor, data); return data; }
    }
    // 兜底：空房间布局，保证可玩不崩
    const g = blank();
    for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) g[y][x].t = 'floor';
    const data = {
      floor: floor, theme: themeFor(floor), g: g,
      start: { x: 5, y: 9 }, down: floor > 1 ? { x: 5, y: 9 } : null, up: floor < 50 ? { x: 5, y: 1 } : null
    };
    if (data.up) g[1][5] = { t: 'stairUp', o: null };
    if (data.down) g[9][5] = { t: 'stairDown', o: null };
    floorCache.set(floor, data);
    return data;
  }
  MT.generateFloor = generateFloor;
  MT.clearFloorCache = function () { floorCache.clear(); };
  MT.isBossFloor = function (f) { return f % 10 === 0; };

  /* 模板深拷贝：每局游戏拿到的必须是独立地图，否则重开后会读到被清空的道具 */
  function cloneFloor(d) {
    const g = d.g.map(function (row) {
      return row.map(function (c) {
        return {
          t: c.t, color: c.color,
          o: c.o ? (c.o.kind === 'monster'
            ? { kind: 'monster', m: Object.assign({}, c.o.m) }
            : c.o.kind === 'chest'
              ? { kind: 'chest', color: c.o.color, loot: c.o.loot }
              : { kind: 'item', id: c.o.id }) : null
        };
      });
    });
    return Object.assign({}, d, { g: g });
  }
  MT.cloneFloor = cloneFloor;

  /* ------------------------------------------------------------------ 游戏 */
  const START = { hp: 1000, atk: 10, def: 10, keys: { y: 1, b: 0, r: 0 } };

  /* 守关首领掉落：击败对应楼层 Boss 后立即入手 */
  const BOSS_DROPS = { 10: 'necroBook', 20: 'sword', 30: 'armor', 40: 'satan' };
  MT.BOSS_DROPS = BOSS_DROPS;

  class Game {
    constructor() { this.reset(); }

    reset() {
      this.floorNum = 1;
      this.hp = START.hp;
      this.maxHp = START.hp;
      this.atk = START.atk;
      this.def = START.def;
      this.gold = 0;
      this.keys = { y: START.keys.y, b: 0, r: 0 };
      this.equip = { weapon: null, armor: null, relic: null };
      this.inv = [];
      this.necroOwned = false;
      this.necroEnergy = 0;
      this.lastDrop = null;
      this.seen = new Set();
      this.kills = 0;
      this.state = 'play';
      this.stairLock = true;
      this.floorNum = 1;
      this.floors = new Map();
      this.seen = new Set([1]);
      const d = this.floorData(1);
      this.x = d.start.x; this.y = d.start.y;
      this.lastEvent = null;
      this.shopOpen = false;
    }

    floorData(f) {
      if (!this.floors) this.floors = new Map();
      let d = this.floors.get(f);
      if (!d) { d = cloneFloor(generateFloor(f)); this.floors.set(f, d); }
      return d;
    }
    get map() { return this.floorData(this.floorNum); }
    get theme() { return this.map.theme; }

    /* 本层守关 Boss 是否还活着（Boss 层 = 楼层号是 10 的倍数） */
    bossAlive() {
      const b = this.map.boss;
      if (!b) return false;
      const c = this.map.g[b.y][b.x];
      return !!(c.o && c.o.kind === 'monster' && c.o.m.boss);
    }

    cell(x, y) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
      return this.map.g[y][x];
    }

    /* 上楼 / 下楼（Boss 未击败前无法上楼） */
    travel(dir) {
      if (dir === 'up') {
        if (this.floorNum >= 50) return false;
        if (this.bossAlive()) return false;
        this.floorNum++;
        const d = this.floorData(this.floorNum);
        this.x = d.down.x; this.y = d.down.y;
      } else {
        if (this.floorNum <= 1) return false;
        this.floorNum--;
        const d = this.floorData(this.floorNum);
        this.x = d.up.x; this.y = d.up.y;
      }
      this.seen.add(this.floorNum);
      this.stairLock = true;
      return true;
    }

    /* 走一步，返回事件 */
    step(dx, dy) {
      if (this.state !== 'play') return { type: 'none' };
      const nx = this.x + dx, ny = this.y + dy;
      const c = this.cell(nx, ny);
      if (!c || c.t === 'wall') return { type: 'bump' };

      if (c.t === 'gate') {
        if (this.keys[c.color] > 0) {
          this.keys[c.color]--;
          c.t = 'floor';
          return { type: 'unlock', color: c.color };
        }
        return { type: 'locked', color: c.color };
      }
      if (c.o && c.o.kind === 'monster') {
        return { type: 'battle', x: nx, y: ny, mon: c.o.m };
      }
      if (c.o && c.o.kind === 'chest') {
        if (this.keys[c.o.color] > 0) {
          const chestColor = c.o.color;
          this.keys[chestColor]--;
          const loot = this.pickup(c.o.loot);
          c.o = null;
          this.x = nx; this.y = ny;
          return { type: 'chest', item: loot, color: chestColor };
        }
        return { type: 'chestLocked', color: c.o.color };
      }
      if (c.o && c.o.kind === 'item') {
        // Boss 未败也可拾取（只锁楼梯）
        const gained = this.pickup(c.o.id);
        c.o = null;
        this.x = nx; this.y = ny;
        return { type: 'item', item: gained };
      }
      if (c.t === 'shop') {
        this.x = nx; this.y = ny;
        this.shopOpen = true;
        return { type: 'shop' };
      }
      this.x = nx; this.y = ny;
      if (c.t === 'stairUp' || c.t === 'stairDown') {
        if (this.stairLock) { this.stairLock = false; return { type: 'move' }; }
        if (c.t === 'stairUp' && this.bossAlive()) return { type: 'bossLock' };
        return { type: 'stairs', dir: c.t === 'stairUp' ? 'up' : 'down' };
      }
      this.stairLock = false;
      return { type: 'move' };
    }

    pickup(id) {
      const it = ITEMS[id];
      if (!it) return null;
      if (it.scale) { this.gold += 40 + this.floorNum * 10; return id; }
      if (it.heal) { this.hp += it.heal; if (this.hp > this.maxHp) this.maxHp = this.hp; }
      if (it.atk) this.atk += it.atk;
      if (it.def) this.def += it.def;
      if (it.key) this.keys[it.key] = (this.keys[it.key] || 0) + 1;
      if (it.necro) { this.necroOwned = true; if (this.inv.indexOf(id) < 0) this.inv.push(id); }
      if (it.equip) { if (this.inv.indexOf(id) < 0) this.inv.push(id); this.equip[it.equip] = id; }
      return id;
    }

    /* 战斗预估（用期望值 / 最坏 / 最好三档） */
    preview(mon) {
      const base = this.atk - mon.def;
      const dm = Math.max(0, mon.atk - this.def);
      const sword = this.equip.weapon === 'sword';
      const armor = this.equip.armor === 'armor';
      const satan = this.equip.relic === 'satan';
      const self = this;
      const run = function (mult) {
        const per = Math.max(0, Math.round(base * mult));
        if (per <= 0 && !armor) {
          return { win: false, rounds: 0, loss: Infinity, hpLeft: self.hp, dead: false, stuck: true };
        }
        let mhp = mon.hp, php = self.hp, loss = 0, rounds = 0;
        while (mhp > 0 && php > 0 && rounds < 999) {
          rounds++;
          mhp -= per;
          if (mhp <= 0) break;
          if (satan && php < self.maxHp) php = Math.min(self.maxHp, php + Math.round(per * 0.25));
          loss += dm; php -= dm;
          if (php <= 0) break;
          if (armor) mhp -= Math.round(10 + dm * 0.15);
        }
        return { win: php > 0 && mhp <= 0, rounds: rounds, loss: php > 0 ? loss : self.hp, hpLeft: Math.max(0, php), dead: php <= 0 };
      };
      const expected = run(sword ? 1.18 : 1);
      const worst = run(1);
      const best = run(sword ? 1.6 : 1);
      return {
        mon: mon, base: base, dm: dm, sword: sword, armor: armor, satan: satan,
        expected: expected, worst: worst, best: best,
        canWin: expected.win, gold: mon.gold
      };
    }

    /* 真实战斗：逐回合日志，供动画播放 */
    rollBattle(mon) {
      const base = this.atk - mon.def;
      const dm = Math.max(0, mon.atk - this.def);
      const sword = this.equip.weapon === 'sword';
      const armor = this.equip.armor === 'armor';
      const satan = this.equip.relic === 'satan';
      if (base <= 0 && !armor) {
        return { log: [], win: false, impossible: true, loss: this.hp, hpLeft: 0, gold: 0 };
      }
      let mhp = mon.hp, php = this.hp, loss = 0;
      const log = [];
      let guard = 0;
      while (mhp > 0 && php > 0 && guard++ < 999) {
        const crit = sword && Math.random() < 0.3;
        const per = Math.max(0, Math.round(base * (crit ? 1.6 : 1)));
        mhp -= per;
        const ev = { pDmg: per, crit: crit, mHp: Math.max(0, mhp), mDmg: 0, reflect: 0, heal: 0, pHp: php };
        if (mhp <= 0) { ev.kill = true; log.push(ev); break; }
        // 撒旦邪力：回复本次造成伤害的 25%（不超过生命上限）
        if (satan) {
          const real = Math.min(this.maxHp - php, Math.round(per * 0.25));
          if (real > 0) { php += real; ev.heal = real; }
        }
        loss += dm; php -= dm;
        ev.mDmg = dm;
        if (armor) { ev.reflect = Math.round(10 + dm * 0.15); mhp -= ev.reflect; }
        ev.pHp = Math.max(0, php);
        ev.mHp = Math.max(0, mhp);
        ev.kill = mhp <= 0 || php <= 0;
        log.push(ev);
        if (php <= 0) break;
      }
      const win = php > 0 && mhp <= 0;
      return { log: log, win: win, loss: win ? loss : this.hp, hpLeft: Math.max(0, php), gold: win ? mon.gold : 0, dead: php <= 0 };
    }

    commitBattle(x, y, result) {
      if (result.win) {
        this.hp = result.hpLeft;
        this.gold += result.gold;
        this.kills++;
        // 亡灵之书：每击败一只怪物积累 1 点能量
        if (this.necroOwned) this.necroEnergy++;
        const c = this.cell(x, y);
        // 守关首领掉落（F10 书 / F20 剑 / F30 甲 / F40 邪力）
        const drop = BOSS_DROPS[this.floorNum];
        if (drop && c && c.o && c.o.kind === 'monster' && c.o.m.boss) {
          this.pickup(drop);
          this.lastDrop = drop;
        }
        if (c) c.o = null;
        this.x = x; this.y = y;
        this.stairLock = false;
        if (this.floorNum === 50 && this.x === this.map.boss.x && this.y === this.map.boss.y) this.state = 'win';
      } else {
        this.hp = 0;
        this.state = 'dead';
      }
    }

    /* 使用亡灵之书：能量每 10 点兑换 +1 攻击（向下取整），用后消失 */
    useNecro() {
      if (!this.necroOwned) return 0;
      const gain = Math.floor(this.necroEnergy / 10);
      this.atk += gain;
      this.necroOwned = false;
      this.necroEnergy = 0;
      const i = this.inv.indexOf('necroBook');
      if (i >= 0) this.inv.splice(i, 1);
      return gain;
    }

    /* 商店：6 种商品，每个商店随机上架 3 种，价格统一按楼层核算 */
    shopOffer() {
      const f = this.floorNum;
      const C = 90 + f * 18; // 统一基准价
      const ALL = [
        { id: 'atk', name: '攻击 +4', desc: '磨锋利刃，永久生效', cost: C, apply: (g) => { g.atk += 4; } },
        { id: 'def', name: '防御 +4', desc: '精铸护符，永久生效', cost: C, apply: (g) => { g.def += 4; } },
        { id: 'hp', name: '生命 +900', desc: '大瓶生命药剂，上限提升', cost: Math.round(C * 0.7), apply: (g) => { g.hp += 900; if (g.hp > g.maxHp) g.maxHp = g.hp; } },
        { id: 'hpatk', name: '生命 +2000，攻击 -2', desc: '以力量换取生机', cost: Math.round(C * 0.45), apply: (g) => { g.hp += 2000; if (g.hp > g.maxHp) g.maxHp = g.hp; g.atk = Math.max(1, g.atk - 2); } },
        { id: 'atkdef', name: '攻击 +9，防御 -4', desc: '狂暴之力，舍防求攻', cost: Math.round(C * 0.9), apply: (g) => { g.atk += 9; g.def = Math.max(0, g.def - 4); } },
        { id: 'halfdef', name: '生命减半，防御 +4', desc: '献祭血肉，铸就护符（当前生命减半）', cost: Math.round(C * 0.6), apply: (g) => { g.hp = Math.max(1, Math.floor(g.hp / 2)); g.def += 4; } }
      ];
      // 同一层货架固定：种子取楼层
      const rng = mulberry32(0x5eed + f * 104729);
      const pool = ALL.slice();
      const out = [];
      for (let i = 0; i < 3 && pool.length; i++) {
        out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      }
      return out;
    }
    buy(id) {
      const o = this.shopOffer().find(function (x) { return x.id === id; });
      if (!o || this.gold < o.cost) return false;
      this.gold -= o.cost;
      o.apply(this);
      return true;
    }

    equipItem(id) {
      const it = ITEMS[id];
      if (!it || !it.equip) return false;
      if (this.inv.indexOf(id) < 0) return false;
      this.equip[it.equip] = this.equip[it.equip] === id ? null : id;
      return true;
    }
    isEquipped(id) {
      const it = ITEMS[id];
      if (!it || !it.equip) return false;
      return this.equip[it.equip] === id;
    }

    /* 手册：本层怪物 */
    floorMonsters() {
      const out = [];
      const g = this.map.g;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (g[y][x].o && g[y][x].o.kind === 'monster') out.push({ x: x, y: y, m: g[y][x].o.m });
      }
      return out;
    }
  }

  MT.Game = Game;
  MT.START = START;

  if (typeof module !== 'undefined' && module.exports) module.exports = MT;
})(typeof window !== 'undefined' ? window : global);
