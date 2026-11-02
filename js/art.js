/* 高清矢量美术：全部用 Canvas 路径绘制，按设备像素比渲染，无位图素材 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const Art = (MT.Art = {});
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------ 基础工具 */
  function rr(ctx, x, y, w, h, r) {
    const m = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + m, y);
    ctx.lineTo(x + w - m, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + m);
    ctx.lineTo(x + w, y + h - m);
    ctx.quadraticCurveTo(x + w, y + h, x + w - m, y + h);
    ctx.lineTo(x + m, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - m);
    ctx.lineTo(x, y + m);
    ctx.quadraticCurveTo(x, y, x + m, y);
    ctx.closePath();
  }
  Art.rr = rr;

  const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';

  /* ------------------------------------------------------------ 地砖缓存 */
  const tileCache = new Map();

  function makeTile(theme, kind, size, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    paintTile(ctx, theme, kind, size);
    return c;
  }

  function paintTile(ctx, th, kind, S) {
    const pad = 0.5;
    if (kind === 'floor' || kind === 'stairUp' || kind === 'stairDown' || kind === 'gate' || kind === 'shop') {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, th.floor);
      g.addColorStop(1, th.floor2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      // 石板接缝
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, S * 0.52);
      ctx.lineTo(S * 0.48, S * 0.52);
      ctx.moveTo(S * 0.52, S * 0.52);
      ctx.lineTo(S, S * 0.52);
      ctx.moveTo(S * 0.5, 0);
      ctx.lineTo(S * 0.5, S * 0.52);
      ctx.moveTo(S * 0.26, S * 0.52);
      ctx.lineTo(S * 0.26, S);
      ctx.moveTo(S * 0.76, S * 0.52);
      ctx.lineTo(S * 0.76, S);
      ctx.stroke();
      // 高光与积灰
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = Math.max(1, S * 0.025);
      ctx.beginPath();
      ctx.moveTo(0, S * 0.5);
      ctx.lineTo(S * 0.48, S * 0.5);
      ctx.moveTo(0, S * 0.02);
      ctx.lineTo(S, S * 0.02);
      ctx.stroke();
      const specks = [[0.16, 0.18], [0.62, 0.3], [0.36, 0.78], [0.84, 0.66]];
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      specks.forEach(function (p, i) {
        ctx.beginPath();
        ctx.arc(S * p[0], S * p[1], S * (0.018 + (i % 2) * 0.012), 0, TAU);
        ctx.fill();
      });
      // 内阴影，让格子之间有层次
      const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.20)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, S, S);
    }

    if (kind === 'wall') {
      ctx.fillStyle = th.wall2;
      ctx.fillRect(0, 0, S, S);
      const bh = S / 3;
      for (let row = 0; row < 3; row++) {
        const off = row % 2 ? -S * 0.25 : 0;
        for (let i = -1; i < 3; i++) {
          const bx = off + i * S * 0.5;
          const g2 = ctx.createLinearGradient(bx, row * bh, bx, row * bh + bh);
          g2.addColorStop(0, th.wall);
          g2.addColorStop(0.55, th.wall);
          g2.addColorStop(1, th.wall2);
          ctx.fillStyle = g2;
          rr(ctx, bx + pad, row * bh + pad, S * 0.5 - pad * 2, bh - pad * 2, S * 0.05);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = Math.max(1, S * 0.02);
          ctx.stroke();
          // 顶部受光
          ctx.strokeStyle = 'rgba(255,255,255,0.07)';
          ctx.beginPath();
          ctx.moveTo(bx + pad + S * 0.04, row * bh + pad + S * 0.03);
          ctx.lineTo(bx + S * 0.5 - pad - S * 0.04, row * bh + pad + S * 0.03);
          ctx.stroke();
        }
      }
      // 顶部环境色
      const rg = ctx.createLinearGradient(0, 0, 0, S);
      rg.addColorStop(0, 'rgba(255,255,255,0.06)');
      rg.addColorStop(0.35, 'rgba(255,255,255,0)');
      rg.addColorStop(1, 'rgba(0,0,0,0.30)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, S, S);
    }

    if (kind === 'stairUp' || kind === 'stairDown') {
      // 台阶
      const up = kind === 'stairUp';
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const w = S * (0.78 - t * 0.42);
        const y = S * (0.16 + t * 0.56);
        const h = S * 0.16;
        const g3 = ctx.createLinearGradient(0, y, 0, y + h);
        g3.addColorStop(0, up ? '#cfd6e2' : '#8d94a3');
        g3.addColorStop(1, up ? '#7d8798' : '#4b5261');
        ctx.fillStyle = g3;
        rr(ctx, S / 2 - w / 2, y, w, h, S * 0.04);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = Math.max(1, S * 0.022);
        ctx.stroke();
      }
      // 箭头
      ctx.fillStyle = 'rgba(140,220,255,0.85)';
      ctx.beginPath();
      const ax = S / 2, ay = up ? S * 0.17 : S * 0.83;
      const dir = up ? -1 : 1;
      ctx.moveTo(ax, ay + dir * S * -0.12);
      ctx.lineTo(ax - S * 0.11, ay + dir * S * 0.04);
      ctx.lineTo(ax + S * 0.11, ay + dir * S * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'rgba(120,220,255,0.9)';
      ctx.shadowBlur = S * 0.18;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (kind && kind.indexOf('gate') === 0) {
      // 门色：y=黄钥匙 b=蓝钥匙 r=红钥匙
      const PAL = {
        y: { plank0: '#6e5527', plank1: '#9c7c36', plank2: '#574319', trim: '#e8c86a', glow: 'rgba(255,214,106,' },
        b: { plank0: '#22436e', plank1: '#39699f', plank2: '#1a3355', trim: '#7fc0ff', glow: 'rgba(127,192,255,' },
        r: { plank0: '#6e2230', plank1: '#a03a52', plank2: '#521824', trim: '#ff8ba1', glow: 'rgba(255,139,161,' }
      };
      const P = PAL[kind.length > 4 ? kind.slice(4) : 'y'] || PAL.y;
      // 门框
      const g4 = ctx.createLinearGradient(0, 0, 0, S);
      g4.addColorStop(0, '#4a3f36');
      g4.addColorStop(1, '#241d18');
      ctx.fillStyle = g4;
      rr(ctx, S * 0.1, S * 0.06, S * 0.8, S * 0.9, S * 0.16);
      ctx.fill();
      // 门板（按钥匙颜色）
      const g5 = ctx.createLinearGradient(0, 0, S, 0);
      g5.addColorStop(0, P.plank0);
      g5.addColorStop(0.5, P.plank1);
      g5.addColorStop(1, P.plank2);
      ctx.fillStyle = g5;
      rr(ctx, S * 0.18, S * 0.14, S * 0.64, S * 0.8, S * 0.12);
      ctx.fill();
      // 铆钉
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.arc(S * (0.3 + j * 0.4), S * (0.3 + i * 0.22), S * 0.035, 0, TAU);
          ctx.fill();
        }
      }
      // 发光锁孔：颜色即钥匙颜色
      ctx.save();
      ctx.shadowColor = P.glow + '0.9)';
      ctx.shadowBlur = S * 0.16;
      ctx.fillStyle = P.trim;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.62, S * 0.06, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.62);
      ctx.lineTo(S * 0.5 - S * 0.045, S * 0.8);
      ctx.lineTo(S * 0.5 + S * 0.045, S * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (kind === 'shop') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      rr(ctx, S * 0.12, S * 0.18, S * 0.76, S * 0.7, S * 0.1);
      ctx.fill();
      // 遮阳棚
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#c9a24a' : '#8a3b34';
        ctx.beginPath();
        ctx.moveTo(S * (0.14 + i * 0.18), S * 0.2);
        ctx.lineTo(S * (0.32 + i * 0.18), S * 0.2);
        ctx.lineTo(S * (0.3 + i * 0.18), S * 0.42);
        ctx.lineTo(S * (0.16 + i * 0.18), S * 0.42);
        ctx.closePath();
        ctx.fill();
      }
      // 柜台
      ctx.fillStyle = '#5a4632';
      rr(ctx, S * 0.18, S * 0.56, S * 0.64, S * 0.26, S * 0.05);
      ctx.fill();
      ctx.fillStyle = '#d9b55c';
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.68, S * 0.07, 0, TAU);
      ctx.fill();
    }
  }

  Art.tile = function (theme, kind, size, dpr) {
    const key = theme.id + '|' + kind + '|' + Math.round(size) + '|' + dpr;
    let c = tileCache.get(key);
    if (!c) {
      if (tileCache.size > 260) tileCache.clear();
      c = makeTile(theme, kind, size, dpr);
      tileCache.set(key, c);
    }
    return c;
  };
  Art.clearTiles = function () { tileCache.clear(); };

  /* ------------------------------------------------------------ 怪物立绘 */
  function shadow(ctx, w) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    const g = ctx.createRadialGradient(0, 42, 2, 0, 42, w * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 42, w * 0.46, w * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function eyes(ctx, x1, x2, y, r, color, glow) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = 10;
    [x1, x2].forEach(function (x) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.12, 0, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  const FAMILY = {};

  /* 软体：史莱姆 */
  FAMILY.blob = function (ctx, p, t) {
    const wob = Math.sin(t * 2.2) * 0.05;
    const body = ctx.createRadialGradient(-12, -18, 6, 0, 6, 52);
    body.addColorStop(0, p.light);
    body.addColorStop(0.5, p.main);
    body.addColorStop(1, p.dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-36, 30);
    ctx.bezierCurveTo(-40, -6, -22, -34 + wob * 20, 0, -34 + wob * 20);
    ctx.bezierCurveTo(22, -34 + wob * 20, 40, -6, 36, 30);
    ctx.bezierCurveTo(20, 38 + wob * 10, -20, 38 + wob * 10, -36, 30);
    ctx.closePath();
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.beginPath();
    ctx.ellipse(-13, -16, 10, 7, -0.5, 0, TAU);
    ctx.fill();
    // 眼睛
    eyes(ctx, -13, 13, -4, 5.2, p.eye, 'rgba(255,255,255,0.5)');
    ctx.fillStyle = p.eye;
    ctx.beginPath();
    ctx.ellipse(0, 14, 8, 4.5, 0, 0, TAU);
    ctx.fill();
    // 滴落
    ctx.fillStyle = p.main;
    ctx.beginPath();
    ctx.ellipse(24, 34, 4, 6, 0, 0, TAU);
    ctx.fill();
  };

  /* 蝙蝠 */
  FAMILY.bat = function (ctx, p, t) {
    const flap = Math.sin(t * 6) * 8;
    ctx.fillStyle = p.dark;
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.beginPath();
      ctx.moveTo(6, -6);
      ctx.quadraticCurveTo(30, -20 - flap, 46, 4 - flap * 0.8);
      ctx.quadraticCurveTo(34, 2, 30, 16);
      ctx.quadraticCurveTo(24, 4, 16, 10);
      ctx.quadraticCurveTo(12, 0, 6, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    const body = ctx.createRadialGradient(-6, -12, 3, 0, 0, 34);
    body.addColorStop(0, p.light);
    body.addColorStop(0.6, p.main);
    body.addColorStop(1, p.dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 2, 15, 20, 0, 0, TAU);
    ctx.fill();
    // 耳朵
    ctx.beginPath();
    ctx.moveTo(-13, -14); ctx.lineTo(-7, -34); ctx.lineTo(-1, -12);
    ctx.moveTo(13, -14); ctx.lineTo(7, -34); ctx.lineTo(1, -12);
    ctx.fill();
    eyes(ctx, -6, 6, -4, 3.4, p.eye);
    // 獠牙
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-5, 12); ctx.lineTo(-2, 19); ctx.lineTo(1, 12);
    ctx.moveTo(5, 12); ctx.lineTo(2, 19); ctx.lineTo(-1, 12);
    ctx.fill();
  };

  /* 骷髅 */
  FAMILY.skeleton = function (ctx, p, t) {
    const bone = ctx.createLinearGradient(-20, -40, 20, 30);
    bone.addColorStop(0, p.light);
    bone.addColorStop(0.55, p.main);
    bone.addColorStop(1, p.dark);
    ctx.strokeStyle = bone;
    ctx.fillStyle = bone;
    ctx.lineCap = 'round';
    // 骨架
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 2); ctx.lineTo(0, 30);
    ctx.stroke();
    ctx.lineWidth = 3.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-11, 6 + i * 6);
      ctx.quadraticCurveTo(0, 10 + i * 6, 11, 6 + i * 6);
      ctx.stroke();
    }
    // 手臂 + 剑
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-9, 8); ctx.lineTo(-24, 16); ctx.lineTo(-21, 27);
    ctx.moveTo(9, 8); ctx.lineTo(24, 14); ctx.lineTo(24, 26);
    ctx.stroke();
    // 剑
    ctx.strokeStyle = '#9fb2c6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 26); ctx.lineTo(34, -16);
    ctx.stroke();
    ctx.strokeStyle = '#d9e6f2';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(24, 24); ctx.lineTo(33, -14);
    ctx.stroke();
    // 头骨
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.ellipse(0, -20, 16, 16, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -6, 10, 8, 0, 0, TAU);
    ctx.fill();
    // 眼窝
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath();
    ctx.ellipse(-6, -21, 5, 6, 0, 0, TAU);
    ctx.ellipse(6, -21, 5, 6, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -6, 6, -21, 2.6, p.eye);
    // 牙
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * 4 - 1.2, -6, 2.4, 5);
    if (p.crown) {
      ctx.fillStyle = p.crown;
      ctx.beginPath();
      ctx.moveTo(-15, -32); ctx.lineTo(-11, -44); ctx.lineTo(-5, -34);
      ctx.lineTo(0, -46); ctx.lineTo(5, -34); ctx.lineTo(11, -44); ctx.lineTo(15, -32);
      ctx.closePath();
      ctx.fill();
    }
  };

  /* 石像鬼 */
  FAMILY.gargoyle = function (ctx, p, t) {
    const flap = Math.sin(t * 2.6) * 5;
    const st = ctx.createLinearGradient(-30, -30, 25, 40);
    st.addColorStop(0, p.light);
    st.addColorStop(0.5, p.main);
    st.addColorStop(1, p.dark);
    ctx.fillStyle = st;
    // 翅膀
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.beginPath();
      ctx.moveTo(8, -12);
      ctx.quadraticCurveTo(34, -34 - flap, 44, -4);
      ctx.quadraticCurveTo(32, -6, 26, 8);
      ctx.quadraticCurveTo(20, -2, 8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    // 身体
    ctx.beginPath();
    ctx.moveTo(-18, 34);
    ctx.quadraticCurveTo(-22, -6, -12, -18);
    ctx.quadraticCurveTo(0, -30, 12, -18);
    ctx.quadraticCurveTo(22, -6, 18, 34);
    ctx.closePath();
    ctx.fill();
    // 角
    ctx.beginPath();
    ctx.moveTo(-11, -20); ctx.quadraticCurveTo(-20, -38, -6, -30);
    ctx.moveTo(11, -20); ctx.quadraticCurveTo(20, -38, 6, -30);
    ctx.fill();
    // 裂纹
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -6); ctx.lineTo(-2, 4); ctx.lineTo(-8, 12);
    ctx.moveTo(9, 2); ctx.lineTo(4, 12);
    ctx.stroke();
    eyes(ctx, -7, 7, -14, 3.6, p.eye);
    // 爪
    ctx.fillStyle = p.dark;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.ellipse(s * 13, 34, 7, 5, 0, 0, TAU);
      ctx.fill();
    });
  };

  /* 斗篷系：法师 / 幽魂 */
  FAMILY.hooded = function (ctx, p, t) {
    const float = Math.sin(t * 1.8) * 3;
    const rg = ctx.createLinearGradient(0, -40 + float, 0, 40);
    rg.addColorStop(0, p.main);
    rg.addColorStop(0.65, p.dark);
    rg.addColorStop(1, 'rgba(10,8,20,0.92)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(0, -40 + float);
    ctx.bezierCurveTo(24, -34 + float, 30, -4, 26, 12);
    ctx.quadraticCurveTo(32, 32, 34, 40);
    ctx.quadraticCurveTo(12, 30, 6, 40);
    ctx.quadraticCurveTo(0, 32, -6, 40);
    ctx.quadraticCurveTo(-12, 30, -34, 40);
    ctx.quadraticCurveTo(-32, 32, -26, 12);
    ctx.bezierCurveTo(-30, -4, -24, -34 + float, 0, -40 + float);
    ctx.closePath();
    ctx.fill();
    // 兜帽内阴影
    ctx.fillStyle = 'rgba(4,2,10,0.88)';
    ctx.beginPath();
    ctx.ellipse(0, -14 + float, 13, 15, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -5.5, 5.5, -15 + float, 2.6, p.eye);
    // 法球
    if (p.orb) {
      ctx.save();
      const oy = 12 + Math.sin(t * 3) * 2;
      const og = ctx.createRadialGradient(24, oy, 1, 24, oy, 12);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.35, p.orb);
      og.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(24, oy, 12, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // 裙摆碎裂
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 8, 28);
      ctx.lineTo(i * 9, 40);
      ctx.stroke();
    }
  };

  /* 吸血鬼 */
  FAMILY.vampire = function (ctx, p, t) {
    const flap = Math.sin(t * 2.4) * 4;
    // 披风
    ctx.fillStyle = p.cape;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(40, -26 - flap, 34, 40);
    ctx.lineTo(22, 30); ctx.lineTo(14, 40); ctx.lineTo(0, 30); ctx.lineTo(-14, 40);
    ctx.lineTo(-22, 30); ctx.lineTo(-34, 40);
    ctx.quadraticCurveTo(-40, -26 - flap, 0, -22);
    ctx.closePath();
    ctx.fill();
    // 立领
    ctx.fillStyle = p.main;
    ctx.beginPath();
    ctx.moveTo(-12, -22); ctx.lineTo(-24, -40); ctx.lineTo(-4, -30);
    ctx.moveTo(12, -22); ctx.lineTo(24, -40); ctx.lineTo(4, -30);
    ctx.fill();
    // 身体
    const bg = ctx.createLinearGradient(0, -20, 0, 30);
    bg.addColorStop(0, p.main);
    bg.addColorStop(1, p.dark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-11, -18);
    ctx.quadraticCurveTo(0, -24, 11, -18);
    ctx.lineTo(15, 26); ctx.lineTo(-15, 26);
    ctx.closePath();
    ctx.fill();
    // 脸
    const fg = ctx.createLinearGradient(0, -34, 0, -8);
    fg.addColorStop(0, p.light);
    fg.addColorStop(1, '#c9b6bd');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(0, -22, 11, 13, 0, 0, TAU);
    ctx.fill();
    // 头发
    ctx.fillStyle = 'rgba(12,6,10,0.9)';
    ctx.beginPath();
    ctx.moveTo(-11, -26);
    ctx.quadraticCurveTo(-12, -38, 0, -36);
    ctx.quadraticCurveTo(12, -38, 11, -26);
    ctx.quadraticCurveTo(6, -32, 0, -30);
    ctx.quadraticCurveTo(-6, -32, -11, -26);
    ctx.fill();
    eyes(ctx, -4.5, 4.5, -23, 2.6, p.eye, '#ff3355');
    // 獠牙
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-3.5, -14); ctx.lineTo(-2.2, -9.5); ctx.lineTo(-1, -14);
    ctx.moveTo(3.5, -14); ctx.lineTo(2.2, -9.5); ctx.lineTo(1, -14);
    ctx.fill();
  };

  /* 魔兽 */
  FAMILY.beast = function (ctx, p, t) {
    const step = Math.sin(t * 4) * 2;
    const body = ctx.createLinearGradient(0, -20, 0, 34);
    body.addColorStop(0, p.main);
    body.addColorStop(0.6, p.dark);
    body.addColorStop(1, '#140805');
    ctx.fillStyle = body;
    // 躯干
    ctx.beginPath();
    ctx.moveTo(-26, 12);
    ctx.quadraticCurveTo(-30, -12, -6, -16);
    ctx.quadraticCurveTo(18, -20, 24, -2);
    ctx.quadraticCurveTo(30, 16, 18, 26);
    ctx.quadraticCurveTo(-8, 32, -26, 12);
    ctx.closePath();
    ctx.fill();
    // 头
    ctx.beginPath();
    ctx.moveTo(-24, -6);
    ctx.quadraticCurveTo(-44, -10, -46, 4);
    ctx.quadraticCurveTo(-42, 18, -24, 14);
    ctx.closePath();
    ctx.fill();
    // 耳朵
    ctx.beginPath();
    ctx.moveTo(-30, -8); ctx.lineTo(-38, -24); ctx.lineTo(-22, -12);
    ctx.fill();
    // 腿
    ctx.strokeStyle = p.dark;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    [-16, 12].forEach(function (x, i) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + (i ? 4 : -4) + step * (i ? -1 : 1), 38);
      ctx.stroke();
    });
    // 火焰鬃毛
    for (let i = 0; i < 5; i++) {
      const fx = -20 + i * 9, fy = -14 - Math.abs(Math.sin(t * 5 + i)) * 10;
      const fg2 = ctx.createLinearGradient(fx, fy, fx, fy + 18);
      fg2.addColorStop(0, p.light);
      fg2.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = fg2;
      ctx.beginPath();
      ctx.moveTo(fx - 5, -6);
      ctx.quadraticCurveTo(fx, fy, fx + 5, -6);
      ctx.closePath();
      ctx.fill();
    }
    eyes(ctx, -38, -31, 2, 2.6, p.eye, '#ffcc00');
    // 牙
    ctx.fillStyle = '#f6f0e4';
    ctx.beginPath();
    ctx.moveTo(-40, 11); ctx.lineTo(-37, 16); ctx.lineTo(-34, 11);
    ctx.moveTo(-32, 11); ctx.lineTo(-29, 16); ctx.lineTo(-26, 11);
    ctx.fill();
  };

  /* 骑士 */
  FAMILY.knight = function (ctx, p, t) {
    const metal = ctx.createLinearGradient(-22, -34, 22, 34);
    metal.addColorStop(0, p.light);
    metal.addColorStop(0.45, p.main);
    metal.addColorStop(1, p.dark);
    ctx.fillStyle = metal;
    // 躯干
    ctx.beginPath();
    ctx.moveTo(-17, -14);
    ctx.quadraticCurveTo(0, -22, 17, -14);
    ctx.lineTo(20, 22);
    ctx.quadraticCurveTo(0, 30, -20, 22);
    ctx.closePath();
    ctx.fill();
    // 肩甲
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.ellipse(s * 19, -10, 9, 8, s * 0.3, 0, TAU);
      ctx.fill();
    });
    // 头盔
    ctx.beginPath();
    ctx.moveTo(-11, -18);
    ctx.quadraticCurveTo(-12, -38, 0, -38);
    ctx.quadraticCurveTo(12, -38, 11, -18);
    ctx.closePath();
    ctx.fill();
    // 角
    ctx.beginPath();
    ctx.moveTo(-10, -30); ctx.quadraticCurveTo(-24, -42, -12, -40);
    ctx.moveTo(10, -30); ctx.quadraticCurveTo(24, -42, 12, -40);
    ctx.fill();
    // 面甲缝
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(-9, -26, 18, 4);
    eyes(ctx, -5, 5, -24, 2.2, p.eye);
    // 剑
    ctx.save();
    ctx.translate(20, 0);
    ctx.rotate(-0.25 + Math.sin(t * 1.5) * 0.03);
    const blade = ctx.createLinearGradient(0, -34, 0, 26);
    blade.addColorStop(0, '#eef6ff');
    blade.addColorStop(0.5, '#a8bdd4');
    blade.addColorStop(1, '#5b6a7e');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(0, -38); ctx.lineTo(4, -30); ctx.lineTo(4, 16); ctx.lineTo(-4, 16); ctx.lineTo(-4, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-9, 16, 18, 4);
    ctx.restore();
    // 盾
    ctx.fillStyle = p.dark;
    ctx.beginPath();
    ctx.moveTo(-22, -12);
    ctx.quadraticCurveTo(-12, -10, -6, -14);
    ctx.quadraticCurveTo(-6, 10, -14, 20);
    ctx.quadraticCurveTo(-22, 10, -22, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };

  /* 恶魔 */
  FAMILY.demon = function (ctx, p, t) {
    const flap = Math.sin(t * 2) * 6;
    // 翅膀
    ctx.fillStyle = 'rgba(20,4,10,0.92)';
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.beginPath();
      ctx.moveTo(10, -18);
      ctx.quadraticCurveTo(38, -46 - flap, 52, -14);
      ctx.quadraticCurveTo(36, -16, 30, 4);
      ctx.quadraticCurveTo(24, -10, 12, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    // 身体
    const body = ctx.createRadialGradient(-6, -14, 6, 0, 6, 46);
    body.addColorStop(0, p.light);
    body.addColorStop(0.45, p.main);
    body.addColorStop(1, p.dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-16, -16);
    ctx.quadraticCurveTo(0, -26, 16, -16);
    ctx.quadraticCurveTo(24, 10, 14, 32);
    ctx.quadraticCurveTo(0, 38, -14, 32);
    ctx.quadraticCurveTo(-24, 10, -16, -16);
    ctx.closePath();
    ctx.fill();
    // 头
    ctx.beginPath();
    ctx.ellipse(0, -26, 13, 12, 0, 0, TAU);
    ctx.fill();
    // 角
    ctx.beginPath();
    ctx.moveTo(-9, -33); ctx.quadraticCurveTo(-26, -50, -6, -44);
    ctx.moveTo(9, -33); ctx.quadraticCurveTo(26, -50, 6, -44);
    ctx.fill();
    // 胸口魔纹
    ctx.fillStyle = p.eye;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(5, 8); ctx.lineTo(0, 16); ctx.lineTo(-5, 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    eyes(ctx, -5.5, 5.5, -27, 3, p.eye, '#ffdd66');
    // 爪
    ctx.strokeStyle = p.dark;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(s * 16, 2); ctx.lineTo(s * 28, 12); ctx.lineTo(s * 30, 24);
      ctx.stroke();
    });
    // 火焰光环
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 8, 0, 0, 46);
    halo.addColorStop(0, 'rgba(255,120,60,0.16)');
    halo.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  /* 骨龙 */
  FAMILY.dragon = function (ctx, p, t) {
    const flap = Math.sin(t * 2.2) * 7;
    const bone = ctx.createLinearGradient(-20, -40, 20, 30);
    bone.addColorStop(0, p.light);
    bone.addColorStop(0.6, p.main);
    bone.addColorStop(1, p.dark);
    ctx.fillStyle = bone;
    // 翼膜
    ctx.fillStyle = 'rgba(60,54,44,0.85)';
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.beginPath();
      ctx.moveTo(8, -16);
      ctx.quadraticCurveTo(40, -40 - flap, 50, -10);
      ctx.quadraticCurveTo(34, -8, 26, 10);
      ctx.quadraticCurveTo(18, -4, 8, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = bone;
    // 颈与脊椎
    ctx.strokeStyle = bone;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.quadraticCurveTo(4, 8, -2, -12);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 24 - i * 11, 5.4, 0, TAU);
      ctx.fill();
    }
    // 头骨
    ctx.beginPath();
    ctx.moveTo(-14, -30);
    ctx.quadraticCurveTo(-4, -40, 10, -32);
    ctx.lineTo(28, -24);
    ctx.quadraticCurveTo(30, -16, 16, -14);
    ctx.quadraticCurveTo(2, -10, -14, -18);
    ctx.closePath();
    ctx.fill();
    // 眼窝
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.ellipse(-3, -26, 4.4, 5, 0.2, 0, TAU);
    ctx.fill();
    eyes(ctx, -3, -3, -26, 2, p.eye, p.eye);
    // 牙
    ctx.fillStyle = '#fffdf2';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(8 + i * 5, -16);
      ctx.lineTo(10 + i * 5, -10);
      ctx.lineTo(12 + i * 5, -16);
      ctx.fill();
    }
    // 角
    ctx.strokeStyle = bone;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, -34); ctx.quadraticCurveTo(20, -46, 30, -42);
    ctx.stroke();
  };

  /* 巨眼 */
  FAMILY.eye = function (ctx, p, t) {
    const pulse = 1 + Math.sin(t * 2) * 0.04;
    ctx.save();
    ctx.scale(pulse, pulse);
    const orb = ctx.createRadialGradient(-10, -12, 4, 0, 0, 40);
    orb.addColorStop(0, p.light);
    orb.addColorStop(0.5, p.main);
    orb.addColorStop(1, p.dark);
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, TAU);
    ctx.fill();
    // 触须
    ctx.strokeStyle = p.dark;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + t * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.quadraticCurveTo(Math.cos(a) * 40, Math.sin(a) * 40 + 6, Math.cos(a + 0.4) * 46, Math.sin(a + 0.4) * 46 - 4);
      ctx.stroke();
    }
    // 眼白
    ctx.fillStyle = '#f4f8ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 15, 0, 0, TAU);
    ctx.fill();
    // 虹膜
    const ir = ctx.createRadialGradient(0, 0, 2, 0, 0, 11);
    ir.addColorStop(0, '#1a1030');
    ir.addColorStop(0.6, p.eye);
    ir.addColorStop(1, p.main);
    ctx.fillStyle = ir;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0b0618';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(-4, -4, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  /* 上锁宝箱：金属包边颜色对应开启所需钥匙 */
  Art.drawChest = function (ctx, color, cx, cy, size, t) {
    const band = color === 'b' ? '#5aa8f0' : color === 'r' ? '#e0534a' : '#e8c34a';
    ctx.save();
    ctx.translate(cx, cy);
    const k = size / 100;
    ctx.scale(k, k);
    shadow(ctx, 88);
    const bob = Math.sin((t || 0) * 2.2) * 1.6;
    ctx.translate(0, bob);
    // 锁性光晕
    const pl = 0.22 + Math.sin((t || 0) * 3) * 0.1;
    const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    gl.addColorStop(0, hexA(band, pl));
    gl.addColorStop(1, hexA(band, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, TAU);
    ctx.fill();
    // 箱体
    const body = ctx.createLinearGradient(0, -20, 0, 24);
    body.addColorStop(0, '#9a6a38');
    body.addColorStop(0.5, '#7a4e26');
    body.addColorStop(1, '#4c2e14');
    ctx.fillStyle = body;
    rr(ctx, -18, -8, 36, 28, 4);
    ctx.fill();
    // 箱盖
    ctx.fillStyle = '#a8763e';
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.quadraticCurveTo(-18, -24, 0, -24);
    ctx.quadraticCurveTo(18, -24, 18, -8);
    ctx.closePath();
    ctx.fill();
    // 金属包边与锁
    ctx.fillStyle = band;
    rr(ctx, -18, -12, 36, 6, 2);
    ctx.fill();
    ctx.fillRect(-3, -12, 6, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(0, -2, 2.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-14, -18);
    ctx.quadraticCurveTo(0, -21, 14, -18);
    ctx.stroke();
    ctx.restore();
  };

  Art.drawMonster = function (ctx, mon, cx, cy, size, t) {
    const p = mon.pal || { main: '#888', dark: '#333', light: '#ccc', eye: '#fff' };
    ctx.save();
    ctx.translate(cx, cy);
    const k = size / 100;
    ctx.scale(k, k);
    shadow(ctx, 90);
    if (mon.boss) {
      // 守关首领：暗金气焰光环
      const au = ctx.createRadialGradient(0, 4, 8, 0, 4, 52);
      const pulse = 0.5 + Math.sin((t || 0) * 3) * 0.12;
      au.addColorStop(0, 'rgba(255,190,80,' + (0.34 * pulse).toFixed(3) + ')');
      au.addColorStop(0.55, 'rgba(180,60,200,' + (0.2 * pulse).toFixed(3) + ')');
      au.addColorStop(1, 'rgba(180,60,200,0)');
      ctx.fillStyle = au;
      ctx.beginPath();
      ctx.arc(0, 4, 52, 0, TAU);
      ctx.fill();
    }
    const bob = Math.sin((t || 0) * 2 + (mon.id ? mon.id.length : 0)) * 2.2;
    ctx.translate(0, bob);
    (FAMILY[mon.family] || FAMILY.blob)(ctx, p, t || 0);
    ctx.restore();
  };

  /* 玩家：兜帽剑士 */
  Art.drawHero = function (ctx, cx, cy, size, t, opts) {
    opts = opts || {};
    const k = size / 100;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    shadow(ctx, 80);
    const bob = Math.sin((t || 0) * 1.6) * 1.6;
    ctx.translate(0, bob);
    // 红披风（经典勇者）
    const cape = ctx.createLinearGradient(0, -20, 0, 42);
    cape.addColorStop(0, '#c23a4a');
    cape.addColorStop(0.6, '#8a2230');
    cape.addColorStop(1, '#42101a');
    ctx.fillStyle = cape;
    ctx.beginPath();
    ctx.moveTo(-9, -16);
    ctx.quadraticCurveTo(-27, 8, -22, 42);
    ctx.quadraticCurveTo(-7, 34, 0, 42);
    ctx.quadraticCurveTo(7, 34, 22, 42);
    ctx.quadraticCurveTo(27, 8, 9, -16);
    ctx.closePath();
    ctx.fill();
    // 银白铠甲身体
    const bd = ctx.createLinearGradient(-10, -18, 10, 30);
    bd.addColorStop(0, '#f4f8fc');
    bd.addColorStop(0.45, '#c3d2e2');
    bd.addColorStop(1, '#71859c');
    ctx.fillStyle = bd;
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.quadraticCurveTo(0, -22, 10, -16);
    ctx.lineTo(12, 26);
    ctx.quadraticCurveTo(0, 32, -12, 26);
    ctx.closePath();
    ctx.fill();
    // 胸甲轮廓与金徽章
    ctx.strokeStyle = 'rgba(60,80,105,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.fillStyle = '#d9b55c';
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(4.4, 3);
    ctx.lineTo(0, 9);
    ctx.lineTo(-4.4, 3);
    ctx.closePath();
    ctx.fill();
    // 肩甲
    [-11, 11].forEach(function (sx) {
      const sg = ctx.createLinearGradient(sx - 6, -20, sx + 5, -8);
      sg.addColorStop(0, '#eef4fa');
      sg.addColorStop(1, '#8296ad');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(sx, -13, 6.2, 5.4, sx < 0 ? 0.35 : -0.35, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,90,115,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
    // 腰带与金扣
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-11, 9, 22, 4.4);
    ctx.fillStyle = '#d9b55c';
    ctx.fillRect(-2.4, 9.4, 4.8, 3.6);
    // 脸 + 头盔（银盔、金边、红缨）
    ctx.fillStyle = '#f6cf9e';
    ctx.beginPath();
    ctx.ellipse(0, -23.5, 7.8, 9.2, 0, 0, TAU);
    ctx.fill();
    // 头盔穹顶（抬高，露出眉眼）
    const hd = ctx.createLinearGradient(0, -48, 0, -30);
    hd.addColorStop(0, '#f2f7fc');
    hd.addColorStop(1, '#8ea2b8');
    ctx.fillStyle = hd;
    ctx.beginPath();
    ctx.arc(0, -31, 9.4, Math.PI, 0);
    ctx.quadraticCurveTo(9.8, -26, 8.6, -24.5);
    ctx.lineTo(-8.6, -24.5);
    ctx.quadraticCurveTo(-9.8, -26, -9.4, -31);
    ctx.closePath();
    ctx.fill();
    // 眉眼（盔沿之下）
    ctx.fillStyle = '#26313e';
    [-3.1, 3.1].forEach(function (ex) {
      ctx.beginPath();
      ctx.ellipse(ex, -21.5, 1.5, 2, 0, 0, TAU);
      ctx.fill();
    });
    // 盔沿金边
    ctx.strokeStyle = '#d9b55c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9.2, -25);
    ctx.lineTo(9.2, -25);
    ctx.stroke();
    // 盔顶红缨
    ctx.fillStyle = '#c23a4a';
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.quadraticCurveTo(-7, -47, -13, -44);
    ctx.quadraticCurveTo(-8, -41, -3, -38.4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.quadraticCurveTo(6, -48, 12, -45);
    ctx.quadraticCurveTo(7, -41.4, 3, -38.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9b55c';
    ctx.beginPath();
    ctx.arc(0, -40, 2.2, 0, TAU);
    ctx.fill();
    // 左手圆盾（金边蓝底金星）
    ctx.save();
    ctx.translate(-14.5, 4);
    ctx.rotate(Math.sin((t || 0) * 1.6) * 0.04);
    const sh = ctx.createLinearGradient(-9, -9, 9, 9);
    sh.addColorStop(0, '#3f6fae');
    sh.addColorStop(1, '#22436e');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#d9b55c';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = '#f2d98a';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(1.8, -1.8);
    ctx.lineTo(6, 0);
    ctx.lineTo(1.8, 1.8);
    ctx.lineTo(0, 6);
    ctx.lineTo(-1.8, 1.8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-1.8, -1.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 右手圣剑
    ctx.save();
    ctx.translate(14, 2);
    ctx.rotate(opts.swing || -0.15);
    const blade = ctx.createLinearGradient(0, -30, 0, 24);
    blade.addColorStop(0, '#ffffff');
    blade.addColorStop(0.4, '#dceeff');
    blade.addColorStop(1, '#8fa8c2');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(0, -32); ctx.lineTo(3.8, -24); ctx.lineTo(3.8, 14); ctx.lineTo(-3.8, 14); ctx.lineTo(-3.8, -24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,180,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.fillStyle = '#d9b55c';
    ctx.fillRect(-7.5, 14, 15, 3.6);
    ctx.fillStyle = '#7a4a22';
    ctx.fillRect(-2.2, 17.6, 4.4, 8.4);
    ctx.fillStyle = '#d9b55c';
    ctx.beginPath();
    ctx.arc(0, 27.4, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  /* ------------------------------------------------------------ 地图物件 */
  Art.drawItem = function (ctx, id, cx, cy, size, t) {
    const it = MT.ITEMS[id];
    if (!it) return;
    const k = size / 100;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    const bob = Math.sin((t || 0) * 2.6 + cx * 0.05) * 2;
    ctx.translate(0, bob);
    // 掉落物光晕
    const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    gl.addColorStop(0, hexA(it.color, 0.34));
    gl.addColorStop(1, hexA(it.color, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, TAU);
    ctx.fill();

    if (it.scale) {
      // 金币袋
      const g = ctx.createLinearGradient(0, -20, 0, 24);
      g.addColorStop(0, '#f4e2a0');
      g.addColorStop(0.45, it.color);
      g.addColorStop(1, '#8a6420');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-6, -18);
      ctx.quadraticCurveTo(-20, -6, -16, 10);
      ctx.quadraticCurveTo(-12, 24, 0, 24);
      ctx.quadraticCurveTo(12, 24, 16, 10);
      ctx.quadraticCurveTo(20, -6, 6, -18);
      ctx.closePath();
      ctx.fill();
      // 袋口绳结
      ctx.strokeStyle = '#5a4014';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -14);
      ctx.quadraticCurveTo(0, -8, 8, -14);
      ctx.stroke();
      ctx.fillStyle = '#5a4014';
      ctx.beginPath();
      ctx.arc(0, -20, 5, 0, TAU);
      ctx.fill();
      // 露出的金币
      ctx.fillStyle = '#ffe9a0';
      ctx.strokeStyle = '#b08020';
      ctx.lineWidth = 1.4;
      [[-7, 8], [1, 12], [8, 6], [-2, 2], [6, 16]].forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      });
    } else if (it.heal) {
      // 药水瓶
      const g = ctx.createLinearGradient(-12, -26, 12, 26);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, it.color);
      g.addColorStop(1, shade(it.color, -40));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-7, -24);
      ctx.lineTo(7, -24);
      ctx.lineTo(7, -12);
      ctx.quadraticCurveTo(18, -2, 14, 16);
      ctx.quadraticCurveTo(0, 30, -14, 16);
      ctx.quadraticCurveTo(-18, -2, -7, -12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-5, 6, 3, 8, 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(-8, -30, 16, 7);
    } else if (it.key) {
      ctx.save();
      ctx.rotate(-0.5);
      const g = ctx.createLinearGradient(0, -20, 0, 24);
      g.addColorStop(0, '#fff6cf');
      g.addColorStop(0.4, it.color);
      g.addColorStop(1, shade(it.color, -45));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(0, -16, 4.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = g;
      ctx.fillRect(-3.4, -8, 6.8, 32);
      ctx.fillRect(-3.4, 14, 11, 5);
      ctx.fillRect(-3.4, 22, 8, 5);
      ctx.restore();
    } else if (it.atk || it.def) {
      // 宝石
      const g = ctx.createLinearGradient(-14, -20, 14, 20);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, it.color);
      g.addColorStop(1, shade(it.color, -50));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(17, -6); ctx.lineTo(9, 22); ctx.lineTo(-9, 22); ctx.lineTo(-17, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(-5, -6); ctx.lineTo(0, 22);
      ctx.moveTo(-17, -6); ctx.lineTo(17, -6);
      ctx.moveTo(-5, -6); ctx.lineTo(-9, 22);
      ctx.moveTo(-5, -6); ctx.lineTo(0, 22);
      ctx.stroke();
    } else if (id === 'necroBook') {
      // 亡灵之书：紫皮古书 + 发光符文之眼
      const g = ctx.createLinearGradient(-16, -20, 16, 22);
      g.addColorStop(0, '#6a559e');
      g.addColorStop(0.5, '#4a3a78');
      g.addColorStop(1, '#241a45');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-14, -22);
      ctx.quadraticCurveTo(0, -27, 14, -22);
      ctx.lineTo(14, 20);
      ctx.quadraticCurveTo(0, 26, -14, 20);
      ctx.closePath();
      ctx.fill();
      // 纸页
      ctx.fillStyle = '#e8e0c8';
      ctx.beginPath();
      ctx.moveTo(14, -22);
      ctx.lineTo(19, -17);
      ctx.lineTo(19, 16);
      ctx.lineTo(14, 20);
      ctx.closePath();
      ctx.fill();
      // 书脊
      ctx.fillStyle = '#2c2148';
      ctx.fillRect(-14, -22, 5, 43);
      // 符文之眼
      ctx.strokeStyle = '#c9b6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(2, -1, 8, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#e6d9ff';
      ctx.beginPath();
      ctx.arc(2, -1, 3, 0, TAU);
      ctx.fill();
      // 缎带书签
      ctx.fillStyle = '#e05a7a';
      ctx.fillRect(8, 14, 4, 12);
    } else if (it.equip) {
      if (id === 'satan') {
        // 撒旦邪力：暗红魔核 + 双角 + 邪纹
        const g = ctx.createRadialGradient(-4, -4, 2, 0, 2, 20);
        g.addColorStop(0, '#ff8aa2');
        g.addColorStop(0.45, '#d8446a');
        g.addColorStop(1, '#4a0c1e');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 2, 17, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2c0a14';
        ctx.beginPath();
        ctx.moveTo(-11, -10);
        ctx.quadraticCurveTo(-21, -25, -6, -23);
        ctx.quadraticCurveTo(-11, -16, -7, -9);
        ctx.closePath();
        ctx.moveTo(11, -10);
        ctx.quadraticCurveTo(21, -25, 6, -23);
        ctx.quadraticCurveTo(11, -16, 7, -9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,190,205,0.85)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(7, 7); ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#ffd0da';
        ctx.beginPath();
        ctx.arc(0, 2, 2.4, 0, TAU);
        ctx.fill();
      } else if (id === 'sword') {
        ctx.save();
        ctx.rotate(-0.7);
        const g = ctx.createLinearGradient(0, -32, 0, 20);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, '#a8ecff');
        g.addColorStop(1, '#2f7fa8');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -34); ctx.lineTo(6, -22); ctx.lineTo(6, 12); ctx.lineTo(-6, 12); ctx.lineTo(-6, -22);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.fillStyle = '#c9a24a';
        ctx.fillRect(-13, 12, 26, 5);
        ctx.fillStyle = '#4a3a24';
        ctx.fillRect(-3.4, 17, 6.8, 11);
        ctx.restore();
      } else {
        const g = ctx.createLinearGradient(0, -26, 0, 26);
        g.addColorStop(0, '#ffd9a0');
        g.addColorStop(0.45, '#e08a3c');
        g.addColorStop(1, '#7a3a14');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.quadraticCurveTo(18, -22, 20, -2);
        ctx.quadraticCurveTo(18, 22, 0, 30);
        ctx.quadraticCurveTo(-18, 22, -20, -2);
        ctx.quadraticCurveTo(-18, -22, 0, -28);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -24); ctx.lineTo(0, 26);
        ctx.moveTo(-16, -4); ctx.lineTo(16, -4);
        ctx.stroke();
        // 刃刺
        ctx.fillStyle = '#ffe0b0';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 9 - 4, -6);
          ctx.lineTo(i * 9, -18);
          ctx.lineTo(i * 9 + 4, -6);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  Art.hexA = hexA;

  /* ------------------------------------------------------------ 战斗特效 */
  Art.slash = function (ctx, cx, cy, r, p, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#bfe9ff';
    ctx.shadowBlur = 18;
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -0.9 + p * 0.6, 0.9 + p * 0.6);
    ctx.stroke();
    ctx.restore();
  };

  Art.burst = function (ctx, cx, cy, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  MT.FONT = FONT;
})(typeof window !== 'undefined' ? window : global);
