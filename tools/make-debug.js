// 临时调试：页面 JS 错误检查 + 音频代码路径冒烟
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const inject = `<script>window.__errs=[];window.onerror=function(m,s,l,c){window.__errs.push(String(m));};
setTimeout(function(){
  try{
    // 模拟首次手势解锁音频，验证 BGM 代码路径无异常
    MTAudio.unlock();
    MTAudio.setBoss(true);
    MTAudio.setBoss(false);
    MTAudio.toggle(); MTAudio.toggle();
  }catch(e){window.__errs.push('AUDIO:'+e.message);}
  document.title='ERRS:'+window.__errs.join('|');
},2500);</script>`;
html = html.replace('</body>', inject + '</body>');
fs.writeFileSync('debug-tmp.html', html);
console.log('ok');
