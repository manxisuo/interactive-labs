(() => {
  'use strict';

  const root = document.getElementById('gd-lab');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  const W = 800, H = 500, PAD = 36;
  const surface = $('#gd-surface');
  const sCtx = surface.getContext('2d');
  const chart = $('#gd-chart');
  const cCtx = chart.getContext('2d');

  // Two teaching landscapes: convex bowl and non-convex Himmelblau.
  const landscapes = {
    bowl: {
      name: '凸碗',
      loss: (x, y) => 0.5 * (x * x + y * y),
      grad: (x, y) => ({ x, y }),
      domain: { xMin: -6, xMax: 6, yMin: -3.75, yMax: 3.75 }
    },
    himmelblau: {
      name: 'Himmelblau 山谷',
      loss: (x, y) => {
        const a = x * x + y - 11;
        const b = x + y * y - 7;
        return (a * a + b * b) / 100;
      },
      grad: (x, y) => {
        const a = x * x + y - 11;
        const b = x + y * y - 7;
        const dx = (4 * x * a + 2 * b) / 100;
        const dy = (2 * a + 4 * y * b) / 100;
        return { x: dx, y: dy };
      },
      domain: { xMin: -6, xMax: 6, yMin: -3.75, yMax: 3.75 }
    }
  };

  let state = {
    land: 'bowl',
    pos: { x: 2, y: 2 },
    vel: { x: 0, y: 0 },
    history: [],
    losses: [],
    running: false,
    timer: null,
    iters: 0
  };

  let heatCanvas = null;
  let heatRange = { min: 0, max: 1 };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function fmt(v, d = 3) {
    return (typeof v === 'number' ? v : 0).toFixed(d).replace(/\.?0+$/, '');
  }
  function fmt2(x, y, d = 3) {
    return x.toFixed(d).replace(/\.?0+$/, '') + ', ' + y.toFixed(d).replace(/\.?0+$/, '');
  }

  // Heat colour ramp: dark blue -> cyan -> green -> yellow -> red.
  const stops = [
    [0.00, 11, 16, 32],
    [0.25, 42, 127, 158],
    [0.50, 42, 157, 92],
    [0.75, 233, 196, 106],
    [1.00, 231, 111, 81]
  ];
  function heatColor(t) {
    t = clamp(t, 0, 1);
    let i = 0;
    while (i + 1 < stops.length && stops[i + 1][0] <= t) i++;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const r = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    return [
      Math.round(a[1] + (b[1] - a[1]) * r),
      Math.round(a[2] + (b[2] - a[2]) * r),
      Math.round(a[3] + (b[3] - a[3]) * r)
    ];
  }

  const land = () => landscapes[state.land];
  const dom = () => land().domain;

  function toScreen(x, y) {
    const d = dom();
    return {
      x: PAD + (x - d.xMin) / (d.xMax - d.xMin) * (W - 2 * PAD),
      y: H - PAD - (y - d.yMin) / (d.yMax - d.yMin) * (H - 2 * PAD)
    };
  }

  function toWorld(sx, sy) {
    const d = dom();
    return {
      x: d.xMin + (sx - PAD) / (W - 2 * PAD) * (d.xMax - d.xMin),
      y: d.yMin + (H - PAD - sy) / (H - 2 * PAD) * (d.yMax - d.yMin)
    };
  }

  function estimateRange() {
    const d = dom(), f = land().loss;
    let min = Infinity, max = -Infinity;
    const sx = 60, sy = 40;
    for (let iy = 0; iy <= sy; iy++) {
      for (let ix = 0; ix <= sx; ix++) {
        const x = d.xMin + ix / sx * (d.xMax - d.xMin);
        const y = d.yMin + iy / sy * (d.yMax - d.yMin);
        const v = f(x, y);
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    // Himmelblau has a sharp maximum near corners; stretch a little for contrast.
    const pad = (max - min) * 0.05 || 1;
    return { min: min - pad, max: max + pad };
  }

  function makeHeatmap() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const data = img.data;
    const d = dom();
    const f = land().loss;
    heatRange = estimateRange();
    const span = heatRange.max - heatRange.min || 1;

    for (let py = 0; py < H; py++) {
      const y = d.yMin + (H - 1 - py) / (H - 1) * (d.yMax - d.yMin);
      for (let px = 0; px < W; px++) {
        const x = d.xMin + px / (W - 1) * (d.xMax - d.xMin);
        const v = f(x, y);
        const t = (v - heatRange.min) / span;
        const [r, g0, b] = heatColor(t);
        const i = (py * W + px) * 4;
        data[i] = r; data[i + 1] = g0; data[i + 2] = b; data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    heatCanvas = c;
  }

  function drawGrid() {
    const d = dom();
    sCtx.save();
    sCtx.strokeStyle = 'rgba(255,255,255,0.10)';
    sCtx.lineWidth = 1;
    // vertical integer lines
    const x0 = Math.ceil(d.xMin), x1 = Math.floor(d.xMax);
    for (let x = x0; x <= x1; x++) {
      const p = toScreen(x, 0);
      sCtx.beginPath(); sCtx.moveTo(p.x, PAD); sCtx.lineTo(p.x, H - PAD); sCtx.stroke();
    }
    const y0 = Math.ceil(d.yMin), y1 = Math.floor(d.yMax);
    for (let y = y0; y <= y1; y++) {
      const p = toScreen(0, y);
      sCtx.beginPath(); sCtx.moveTo(PAD, p.y); sCtx.lineTo(W - PAD, p.y); sCtx.stroke();
    }
    // axes
    sCtx.strokeStyle = 'rgba(255,255,255,0.22)';
    const ox = toScreen(0, 0), oy = toScreen(0, 0);
    sCtx.beginPath(); sCtx.moveTo(PAD, oy.y); sCtx.lineTo(W - PAD, oy.y); sCtx.stroke();
    sCtx.beginPath(); sCtx.moveTo(ox.x, PAD); sCtx.lineTo(ox.x, H - PAD); sCtx.stroke();
    sCtx.restore();
  }

  function drawArrow(from, dir, len) {
    const ang = Math.atan2(dir.y, dir.x);
    const toX = from.x + Math.cos(ang) * len;
    const toY = from.y + Math.sin(ang) * len;
    sCtx.save();
    sCtx.strokeStyle = '#ff8c42';
    sCtx.fillStyle = '#ff8c42';
    sCtx.lineWidth = 3;
    sCtx.lineCap = 'round';
    sCtx.beginPath(); sCtx.moveTo(from.x, from.y); sCtx.lineTo(toX, toY); sCtx.stroke();
    const head = 9;
    sCtx.beginPath();
    sCtx.moveTo(toX, toY);
    sCtx.lineTo(toX - head * Math.cos(ang - Math.PI / 6), toY - head * Math.sin(ang - Math.PI / 6));
    sCtx.lineTo(toX - head * Math.cos(ang + Math.PI / 6), toY - head * Math.sin(ang + Math.PI / 6));
    sCtx.closePath(); sCtx.fill();
    sCtx.restore();
  }

  function drawPath() {
    if (state.history.length < 2) return;
    sCtx.save();
    sCtx.strokeStyle = '#ffcf70';
    sCtx.lineWidth = 2.5;
    sCtx.lineCap = 'round';
    sCtx.lineJoin = 'round';
    sCtx.beginPath();
    const p0 = toScreen(state.history[0].x, state.history[0].y);
    sCtx.moveTo(p0.x, p0.y);
    for (let i = 1; i < state.history.length; i++) {
      const p = toScreen(state.history[i].x, state.history[i].y);
      sCtx.lineTo(p.x, p.y);
    }
    sCtx.stroke();
    sCtx.restore();
  }

  function renderSurface() {
    sCtx.clearRect(0, 0, W, H);
    if (!heatCanvas) makeHeatmap();
    sCtx.drawImage(heatCanvas, 0, 0);
    drawGrid();
    drawPath();

    // start point
    const s = toScreen(state.history[0]?.x || state.pos.x, state.history[0]?.y || state.pos.y);
    sCtx.save();
    sCtx.strokeStyle = '#7cd2a7';
    sCtx.lineWidth = 2;
    sCtx.beginPath(); sCtx.arc(s.x, s.y, 5, 0, Math.PI * 2); sCtx.stroke();
    sCtx.restore();

    // current point + gradient arrow
    const p = toScreen(state.pos.x, state.pos.y);
    const g = land().grad(state.pos.x, state.pos.y);
    const gn = Math.hypot(g.x, g.y);
    if (gn > 1e-8) {
      const unitWorld = { x: -g.x / gn, y: -g.y / gn };
      const unitScreen = toScreen(state.pos.x + unitWorld.x, state.pos.y + unitWorld.y);
      const pxScreen = toScreen(state.pos.x, state.pos.y);
      const sx = unitScreen.x - pxScreen.x;
      const sy = unitScreen.y - pxScreen.y;
      const sgn = Math.hypot(sx, sy);
      const len = clamp(gn * sgn * 0.35, 14, 62);
      drawArrow(p, { x: sx / (sgn || 1), y: sy / (sgn || 1) }, len);
    }

    sCtx.save();
    sCtx.fillStyle = '#ffffff';
    sCtx.strokeStyle = '#ff8c42';
    sCtx.lineWidth = 2;
    sCtx.beginPath(); sCtx.arc(p.x, p.y, 6, 0, Math.PI * 2); sCtx.fill(); sCtx.stroke();
    sCtx.restore();
  }

  function renderChart() {
    const cw = chart.width, ch = chart.height;
    cCtx.clearRect(0, 0, cw, ch);
    cCtx.save();
    cCtx.fillStyle = '#0b111a';
    cCtx.fillRect(0, 0, cw, ch);

    if (state.losses.length < 2) {
      cCtx.fillStyle = 'rgba(255,255,255,0.2)';
      cCtx.font = '12px system-ui';
      cCtx.fillText('运行后在此绘制损失曲线', 12, ch / 2 + 4);
      cCtx.restore();
      return;
    }

    const pad = 22;
    let maxL = -Infinity, minL = Infinity;
    for (const v of state.losses) {
      if (v > maxL) maxL = v;
      if (v < minL) minL = v;
    }
    if (maxL === minL) { maxL += 1; minL -= 1; }
    // Keep zero in view when losses are tiny.
    if (minL > 0) minL = 0;
    const range = maxL - minL;

    // grid
    cCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    cCtx.lineWidth = 1;
    cCtx.beginPath(); cCtx.moveTo(pad, pad); cCtx.lineTo(pad, ch - pad); cCtx.lineTo(cw - pad, ch - pad); cCtx.stroke();

    cCtx.strokeStyle = '#58a8ff';
    cCtx.lineWidth = 2;
    cCtx.beginPath();
    const n = state.losses.length;
    for (let i = 0; i < n; i++) {
      const x = pad + i / (n - 1) * (cw - 2 * pad);
      const y = ch - pad - (state.losses[i] - minL) / range * (ch - 2 * pad);
      if (i === 0) cCtx.moveTo(x, y); else cCtx.lineTo(x, y);
    }
    cCtx.stroke();

    // labels
    cCtx.fillStyle = 'rgba(255,255,255,0.5)';
    cCtx.font = '10px system-ui';
    cCtx.fillText(maxL.toFixed(2), cw - pad + 2, pad + 3);
    cCtx.fillText(minL.toFixed(2), cw - pad + 2, ch - pad + 3);
    cCtx.restore();
  }

  function updateReadouts() {
    const g = land().grad(state.pos.x, state.pos.y);
    const step = Math.hypot(state.vel.x, state.vel.y);
    $('#gd-pos').textContent = fmt2(state.pos.x, state.pos.y);
    $('#gd-loss').textContent = fmt(land().loss(state.pos.x, state.pos.y));
    $('#gd-grad').textContent = fmt2(g.x, g.y);
    $('#gd-step-size').textContent = fmt(step);
    $('#gd-iter').textContent = state.iters;
  }

  function render() {
    renderSurface();
    renderChart();
    updateReadouts();
  }

  function getLR() {
    return Math.pow(10, +$('#gd-lr').value);
  }

  function getMomentum() { return +$('#gd-mom').value; }
  function getSpeed() { return +$('#gd-speed').value; }

  function pushState() {
    state.history.push({ x: state.pos.x, y: state.pos.y });
    state.losses.push(land().loss(state.pos.x, state.pos.y));
    if (state.history.length > 900) state.history.shift();
    if (state.losses.length > 900) state.losses.shift();
  }

  function stepOnce() {
    const eta = getLR();
    const beta = getMomentum();
    const g = land().grad(state.pos.x, state.pos.y);

    // Momentum update: v = β·v − η·∇L; θ = θ + v.
    state.vel.x = beta * state.vel.x - eta * g.x;
    state.vel.y = beta * state.vel.y - eta * g.y;
    state.pos.x += state.vel.x;
    state.pos.y += state.vel.y;
    state.iters++;

    const loss = land().loss(state.pos.x, state.pos.y);
    pushState();

    const d = dom();
    const out = state.pos.x < d.xMin - 2 || state.pos.x > d.xMax + 2 ||
                state.pos.y < d.yMin - 2 || state.pos.y > d.yMax + 2 ||
                !isFinite(loss) || loss > heatRange.max * 20;
    if (out) {
      stop();
      $('#gd-status').textContent = '● 已发散';
      $('#gd-status').style.color = '#e27c65';
    }
    render();
  }

  function startRun() {
    if (state.running) return;
    state.running = true;
    $('#gd-run').textContent = '暂停';
    $('#gd-run').classList.add('active');
    $('#gd-status').textContent = '● 运行中';
    $('#gd-status').style.color = '#7cd2a7';
    const tick = () => {
      if (!state.running) return;
      stepOnce();
      state.timer = setTimeout(tick, 1000 / getSpeed());
    };
    tick();
  }

  function stop() {
    state.running = false;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    $('#gd-run').textContent = '运行';
    $('#gd-run').classList.remove('active');
    if ($('#gd-status').textContent !== '● 已发散') {
      $('#gd-status').textContent = '● 已暂停';
      $('#gd-status').style.color = '#ffcf70';
    }
  }

  function setStatusReady() {
    $('#gd-status').textContent = '● 就绪';
    $('#gd-status').style.color = '#7cd2a7';
  }

  function resetTo(newPos) {
    stop();
    state.pos = { x: newPos.x, y: newPos.y };
    state.vel = { x: 0, y: 0 };
    state.history = [{ x: state.pos.x, y: state.pos.y }];
    state.losses = [land().loss(state.pos.x, state.pos.y)];
    state.iters = 0;
    setStatusReady();
    render();
  }

  function defaultStart() {
    return state.land === 'bowl' ? { x: 2, y: 2 } : { x: 2, y: 2 };
  }

  function resetAll() {
    heatCanvas = null;
    makeHeatmap();
    resetTo(defaultStart());
  }

  function setLandscape(key) {
    state.land = key;
    $$('#gd-landscapes .gd-btn').forEach(b => b.classList.toggle('active', b.dataset.landscape === key));
    resetAll();
  }

  function eventPos(e) {
    const rect = surface.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const sy = (e.clientY - rect.top) * (H / rect.height);
    return toWorld(sx, sy);
  }

  let dragging = false;
  surface.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    surface.setPointerCapture(e.pointerId);
    resetTo(eventPos(e));
  });
  surface.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    resetTo(eventPos(e));
  });
  surface.addEventListener('pointerup', (e) => {
    dragging = false;
    if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
  });

  // Controls wiring
  $$('#gd-landscapes .gd-btn').forEach(btn => {
    btn.addEventListener('click', () => setLandscape(btn.dataset.landscape));
  });

  $('#gd-lr').addEventListener('input', () => {
    const v = getLR();
    $('#gd-lr-text').textContent = v.toFixed(3).replace(/\.?0+$/, '');
  });
  $('#gd-mom').addEventListener('input', () => {
    $('#gd-mom-text').textContent = (+$('#gd-mom').value).toFixed(2);
  });
  $('#gd-speed').addEventListener('input', () => {
    const s = getSpeed();
    $('#gd-speed-text').textContent = s + ' 步/秒';
    if (state.running) { stop(); startRun(); }
  });

  $('#gd-step').addEventListener('click', stepOnce);
  $('#gd-run').addEventListener('click', () => state.running ? stop() : startRun());
  $('#gd-reset').addEventListener('click', resetAll);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space') { e.preventDefault(); state.running ? stop() : startRun(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); stepOnce(); }
  });

  // Initialize labels and first render.
  $('#gd-lr-text').textContent = getLR().toFixed(3).replace(/\.?0+$/, '');
  $('#gd-mom-text').textContent = (+$('#gd-mom').value).toFixed(2);
  $('#gd-speed-text').textContent = getSpeed() + ' 步/秒';
  resetAll();
})();
