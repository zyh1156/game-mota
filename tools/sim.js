/* 平衡性模拟：贪心 AI 自动爬塔（含回退补刷、商店消费），验证 50 层可通且不轻松 */
const MT = require('../js/game-core.js');
const SIZE = 11;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const verbose = process.argv.indexOf('-v') > 0;

function walkable(g, c, keys) {
  if (!c || c.t === 'wall') return false;
  if (c.t === 'gate') return keys[c.color] > 0;
  if (c.o && c.o.kind === 'monster') return false;
  if (c.o && c.o.kind === 'chest') return keys[c.o.color] > 0;
  return true;
}

function reach(game) {
  const g = game.map.g;
  const seen = new Map();
  const q = [{ x: game.x, y: game.y }];
  seen.set(game.x + ',' + game.y, { x: game.x, y: game.y, prev: null });
  while (q.length) {
    const c = q.shift();
    for (const d of DIRS) {
      const nx = c.x + d[0], ny = c.y + d[1], k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || seen.has(k)) continue;
      if (!walkable(g, g[ny][nx], game.keys)) continue;
      seen.set(k, { x: nx, y: ny, prev: c.x + ',' + c.y });
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

function pathTo(map, target) {
  const out = [];
  let k = target.x + ',' + target.y;
  while (k) {
    const n = map.get(k);
    if (!n) return null;
    out.push({ x: n.x, y: n.y });
    k = n.prev;
  }
  return out.reverse();
}

function walk(game, path) {
  for (let i = 1; i < path.length; i++) {
    const ev = game.step(path[i].x - game.x, path[i].y - game.y);
    if (ev.type === 'battle' || ev.type === 'locked') return ev;
  }
  return { type: 'ok' };
}

function buyAll(game) {
  let bought = 0;
  for (let i = 0; i < 40; i++) {
    const os = game.shopOffer();
    // 钥匙兑换：黄钥匙富余（至少留 1 把）就换蓝钥匙开宝石箱
    const ex = os.find((o) => o.id === 'exYB');
    if (ex && game.keys.y >= 4) { game.buy('exYB'); bought++; continue; }
    // 低血优先回复
    let pick = null;
    if (game.hp < game.maxHp * 0.5) pick = os.find((o) => o.id === 'hp200' && o.buysLeft > 0);
    // 攻防优先，其次暴击，金币加成前期复利高
    const order = game.floorNum <= 15 ? ['def4', 'atk4', 'goldB', 'critR', 'critD'] : ['def4', 'atk4', 'critR', 'critD', 'goldB'];
    if (!pick) for (const id of order) { pick = os.find((o) => o.id === id && o.buysLeft > 0); if (pick) break; }
    if (!pick || game.gold < pick.cost) break;
    game.buy(pick.id);
    bought++;
  }
  return bought;
}

function run() {
  const game = new MT.Game();
  const shopsUsed = new Set();
  let stuck = null;
  let noProgress = 0;
  let guard = 0;
  const trail = [];
  let lastFloor = 0;

  for (; guard < 30000; guard++) {
    if (game.state !== 'play') break;
    if (game.floorNum !== lastFloor) {
      lastFloor = game.floorNum;
      trail.push({ f: game.floorNum, hp: game.hp, atk: game.atk, def: game.def, gold: game.gold });
    }
    const g = game.map.g;
    let acted = false;      // 真实进展（战斗/拾取/开门/消费）
    let moved = false;      // 仅移动（上楼下楼/用书），不算进展

    /* 商店：同层只买一次，之后不再打断流程 */
    if (g[game.y][game.x].t === 'shop' && !shopsUsed.has(game.floorNum)) {
      buyAll(game);
      shopsUsed.add(game.floorNum);
      acted = true;
    }

    const map = reach(game);
    const bossLock = game.bossAlive();

    /* 亡灵之书：Boss 战前（或后期）把能量兑换成攻击 */
    if (game.necroOwned && game.necroEnergy >= 10 && (bossLock || game.floorNum >= 49)) {
      game.useNecro();
      moved = true;
    }

    /* Boss 未死：优先击杀 Boss（楼梯被锁，需先过关） */
    if (!acted && bossLock) {
      const cands = [];
      map.forEach((n) => {
        for (const d of DIRS) {
          const nx = n.x + d[0], ny = n.y + d[1];
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          const c = g[ny][nx];
          if (!c.o || c.o.kind !== 'monster') continue;
          const pv = game.preview(c.o.m);
          if (!pv.canWin || pv.expected.loss >= game.hp) continue;
          cands.push({ x: nx, y: ny, pv: pv, from: n, boss: !!c.o.m.boss });
        }
      });
      if (cands.length) {
        cands.sort((a, b) => (b.boss - a.boss) || (a.pv.expected.loss - b.pv.expected.loss));
        const best = cands[0];
        walk(game, pathTo(map, best.from));
        const roll = game.rollBattle(g[best.y][best.x].o.m);
        game.commitBattle(best.x, best.y, roll);
        acted = true;
      }
    }

    /* 捡东西（Boss 活着也可拾取道具与开宝箱，只锁楼梯） */
    if (!acted) {
      let target = null;
      map.forEach((n) => {
        if (target) return;
        const c = g[n.y][n.x];
        if (c.o && c.o.kind === 'item') target = n;
        if (!target && c.o && c.o.kind === 'chest' && game.keys[c.o.color] > 0) target = n;
      });
      if (target) { walk(game, pathTo(map, target)); acted = true; }
    }

    /* 找商店（顺路消费） */
    if (!acted && !shopsUsed.has(game.floorNum)) {
      let shop = null;
      map.forEach((n) => { if (!shop && g[n.y][n.x].t === 'shop') shop = n; });
      if (shop) { walk(game, pathTo(map, shop)); acted = true; }
    }

    /* 打怪 */
    if (!acted) {
      const cands = [];
      map.forEach((n) => {
        for (const d of DIRS) {
          const nx = n.x + d[0], ny = n.y + d[1];
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          const c = g[ny][nx];
          if (!c.o || c.o.kind !== 'monster') continue;
          const pv = game.preview(c.o.m);
          if (!pv.canWin || pv.expected.loss >= game.hp) continue;
          cands.push({ x: nx, y: ny, pv: pv, from: n });
        }
      });
      if (cands.length) {
        cands.sort((a, b) => (a.pv.expected.loss - b.pv.expected.loss) || (b.pv.gold - a.pv.gold));
        const best = cands[0];
        walk(game, pathTo(map, best.from));
        const roll = game.rollBattle(g[best.y][best.x].o.m);
        game.commitBattle(best.x, best.y, roll);
        acted = true;
      }
    }

    /* 开门 */
    if (!acted) {
      let gate = null;
      map.forEach((n) => {
        for (const d of DIRS) {
          const nx = n.x + d[0], ny = n.y + d[1];
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          const c = g[ny][nx];
          if (c.t === 'gate' && game.keys[c.color] > 0 && !gate) gate = { x: nx, y: ny, from: n };
        }
      });
      if (gate) {
        walk(game, pathTo(map, gate.from));
        game.step(gate.x - game.x, gate.y - game.y);
        acted = true;
      }
    }

    /* 上楼（Boss 活着时被锁，先回去杀 Boss） */
    if (!acted) {
      if (game.floorNum >= 50) { stuck = 'boss'; break; }
      if (game.bossAlive()) {
        noProgress++;
        if (noProgress <= 8 && game.floorNum > 1) { game.travel('down'); moved = true; }
        else stuck = 'bossAlive F' + game.floorNum;
        if (stuck) break;
        continue;
      }
      const up = game.map.up;
      const node = map.get(up.x + ',' + up.y);
      if (node) {
        walk(game, pathTo(map, node));
        game.travel('up');
        moved = true;
      }
    }

    if (acted) noProgress = 0;
    else if (moved) {
      /* 只有楼层移动、没有真实进展：连续多次视为卡死（防止上下楼无限弹跳） */
      noProgress++;
      if (noProgress > 24) { stuck = 'F' + game.floorNum + ' 无进展弹跳'; break; }
    } else {
      /* 卡住了：回退到下层补刷 */
      noProgress++;
      if (noProgress <= 8 && game.floorNum > 1) { game.travel('down'); continue; }
      stuck = 'F' + game.floorNum;
      break;
    }
  }
  return { game: game, stuck: stuck, steps: guard, trail: trail };
}

const r = run();
const g = r.game;
if (require.main === module) {
  const runsIdx = process.argv.indexOf('--runs');
  if (runsIdx > 0) {
    const n = parseInt(process.argv[runsIdx + 1], 10) || 100;
    let wins = 0, floorSum = 0, hpWins = [];
    for (let i = 0; i < n; i++) {
      const res = run();
      floorSum += res.game.floorNum;
      if (res.game.state === 'win') { wins++; hpWins.push(res.game.hp); }
    }
    hpWins.sort((a, b) => a - b);
    console.log(`通关率: ${(wins / n * 100).toFixed(1)}% (${wins}/${n}) · 平均到达层数: ${(floorSum / n).toFixed(1)}`);
    if (hpWins.length) {
      console.log(`通关剩余HP: 最低 ${hpWins[0]} · 中位 ${hpWins[Math.floor(hpWins.length / 2)]} · 最高 ${hpWins[hpWins.length - 1]}`);
    }
  } else {
    console.log(`结果: 状态=${g.state} 楼层=${g.floorNum} HP=${g.hp} 攻=${g.atk} 防=${g.def} 金币=${g.gold} 击杀=${g.kills} 装备=${JSON.stringify(g.equip)} 亡灵能量=${g.necroEnergy}`);
    if (r.stuck) console.log('卡住:', r.stuck, '步数', r.steps);
  }
}
module.exports = { run: run };
