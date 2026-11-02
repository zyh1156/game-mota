// 临时调试：自动化交互冒烟测试（移动/战斗/HUD 数值）
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const inject = `<script>
setTimeout(function(){
  try{
    var g = MTHD.game();
    var log = [];
    // 1) 键盘移动模拟
    var before = g.x + ',' + g.y + ' f' + g.floorNum;
    MTHD.move('up'); MTHD.move('left'); MTHD.move('up'); MTHD.move('right');
    log.push('mv:' + before + '->' + g.x + ',' + g.y);
    // 2) HUD 数值
    var ids=['hud-hp','hud-atk','hud-def','hud-gold','hud-crit','hud-ky','hud-kb'];
    log.push('hud:' + ids.map(function(i){return document.getElementById(i).textContent;}).join('/'));
    // 3) 战斗预估数值（情报卡）
    var found=null;
    g.map.g.forEach(function(row,y){row.forEach(function(c,x){if(!found&&c.o&&c.o.kind==='monster'&&!c.o.m.boss)found={x:x,y:y,m:c.o.m};});});
    if(found){var pv=g.preview(found.m);log.push('mon:'+found.m.name+' Lv'+found.m.lv+' hp'+found.m.hp+' loss='+pv.expected.loss+' canWin='+pv.canWin);}
    // 4) 传送打一场真战斗
    MTHD.teleport(found.x, found.y);
    log.push('afterTeleport hp=' + g.hp);
    document.title = 'SMOKE|' + log.join(' | ');
  }catch(e){document.title='ERR|'+e.message+'|'+(e.stack||'').split('\\n')[1];}
},3000);
</script>`;
html = html.replace('</body>', inject + '</body>');
fs.writeFileSync('debug-tmp.html', html);
console.log('ok');
