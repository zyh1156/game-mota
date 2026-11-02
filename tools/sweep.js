/* 参数搜索：宝石入蓝锁后的新平衡曲线（目标：贪心 AI 通关率 33%~60%） */
const MT = require('../js/game-core.js');
const sim = require('./sim.js');

const rows = [];
for (const power of [0.5, 0.6, 0.7]) {
  for (const mdef of [0.4, 0.55, 0.7]) {
    MT.BALANCE.power = power;
    MT.BALANCE.mdef = mdef;
    MT.clearFloorCache();
    let wins = 0, floorSum = 0, stuckAt = {};
    for (let i = 0; i < 10; i++) {
      const r = sim.run();
      floorSum += r.game.floorNum;
      if (r.game.state === 'win') wins++;
      else {
        const k = r.stuck ? r.stuck.replace(/\d+$/, '') + (r.stuck.match(/\d+$/) || [''])[0] : ('dead F' + r.game.floorNum);
        stuckAt[k] = (stuckAt[k] || 0) + 1;
      }
    }
    rows.push({ power, mdef, wins, avgFloor: floorSum / 10 });
    console.log(`power=${power} mdef=${mdef} -> 通关 ${wins}/10 · 平均层 ${(floorSum / 10).toFixed(1)} · 失败 ${JSON.stringify(stuckAt)}`);
  }
}
