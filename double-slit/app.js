(function () {
  const root = document.getElementById('ds-lab');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  const scene = $('#ds-scene');
  const intensity = $('#ds-intensity');
  const g = scene.getContext('2d');
  const ig = intensity.getContext('2d');

  const state = {
    mode: 'double', // double | single
    lambdaNm: 550,
    sepMm: 0.2,
    widthMm: 0.04,
    distM: 1.0,
    showWave: true,
    showEnvelope: true,
    t: 0,
    last: 0,
  };

  const presets = {
    classic: { lambdaNm: 550, sepMm: 0.2, widthMm: 0.04, distM: 1.0, mode: 'double' },
    'red-wide': { lambdaNm: 650, sepMm: 0.12, widthMm: 0.05, distM: 1.5, mode: 'double' },
    'blue-dense': { lambdaNm: 450, sepMm: 0.45, widthMm: 0.03, distM: 0.8, mode: 'double' },
    envelope: { lambdaNm: 520, sepMm: 0.35, widthMm: 0.12, distM: 1.0, mode: 'double' },
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function wavelengthRGB(nm) {
    // Approximate visible spectrum → RGB (teaching viz)
    let r = 0, gr = 0, b = 0;
    if (nm < 380) nm = 380;
    if (nm > 700) nm = 700;
    if (nm < 440) {
      r = -(nm - 440) / (440 - 380);
      b = 1;
    } else if (nm < 490) {
      gr = (nm - 440) / (490 - 440);
      b = 1;
    } else if (nm < 510) {
      gr = 1;
      b = -(nm - 510) / (510 - 490);
    } else if (nm < 580) {
      r = (nm - 510) / (580 - 510);
      gr = 1;
    } else if (nm < 645) {
      r = 1;
      gr = -(nm - 645) / (645 - 580);
    } else {
      r = 1;
    }
    let factor = 1;
    if (nm < 420) factor = 0.3 + (0.7 * (nm - 380)) / 40;
    else if (nm > 700) factor = 0.3 + (0.7 * (780 - nm)) / 80;
    else if (nm > 645) factor = 0.3 + (0.7 * (700 - nm)) / 55;
    const gamma = 0.8;
    const to = (c) => Math.round(255 * Math.pow(clamp(c * factor, 0, 1), gamma));
    return { r: to(r), g: to(gr), b: to(b) };
  }

  function rgba(c, a) {
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  function syncControls() {
    $('#ds-lambda').value = state.lambdaNm;
    $('#ds-sep').value = state.sepMm;
    $('#ds-width').value = state.widthMm;
    $('#ds-dist').value = state.distM;
    $('#ds-lambda-text').textContent = state.lambdaNm + ' nm';
    $('#ds-sep-text').textContent = state.sepMm.toFixed(2) + ' mm';
    $('#ds-width-text').textContent = (+state.widthMm.toFixed(3)) + ' mm';
    $('#ds-dist-text').textContent = state.distM.toFixed(2) + ' m';
    $('#ds-mode-label').textContent = state.mode === 'double' ? '双缝干涉' : '单缝衍射';
    $$('#ds-modes .ds-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
    $('#ds-wave-toggle').textContent = state.showWave ? '隐藏波场' : '显示波场';
    $('#ds-envelope-toggle').textContent = state.showEnvelope ? '隐藏包络' : '显示包络';
    const c = wavelengthRGB(state.lambdaNm);
    $('#ds-swatch').style.boxShadow = `inset 0 0 0 999px ${rgba(c, 0.35)}`;
  }

  // Physics: Fraunhofer double-slit intensity
  // I(θ) ∝ sinc²(β) cos²(δ/2)  with β=π a sinθ/λ, δ=2π d sinθ/λ → cos(δ/2)=cos(π d sinθ/λ)
  function intensityAt(yMeters) {
    const lambda = state.lambdaNm * 1e-9;
    const d = state.sepMm * 1e-3;
    const a = state.widthMm * 1e-3;
    const L = state.distM;
    const r = Math.hypot(yMeters, L);
    const sinTheta = yMeters / r;
    const beta = (Math.PI * a * sinTheta) / lambda;
    const envelope = beta === 0 ? 1 : Math.pow(Math.sin(beta) / beta, 2);
    if (state.mode === 'single') return envelope;
    const phase = (Math.PI * d * sinTheta) / lambda;
    const fringe = Math.pow(Math.cos(phase), 2);
    return envelope * fringe;
  }

  function fringeSpacing() {
    // Δy ≈ λ L / d
    const lambda = state.lambdaNm * 1e-9;
    const d = state.sepMm * 1e-3;
    return (lambda * state.distM) / d;
  }

  function firstDark() {
    // first destructive: d sinθ = λ/2 → y ≈ (λ L)/(2d)
    return fringeSpacing() / 2;
  }

  function envelopeZero() {
    // first diffraction minimum: a sinθ = λ → y ≈ λ L / a
    const lambda = state.lambdaNm * 1e-9;
    const a = state.widthMm * 1e-3;
    return (lambda * state.distM) / a;
  }

  function fmtLen(meters) {
    if (!isFinite(meters)) return '—';
    if (meters < 1e-3) return (meters * 1e6).toFixed(1) + ' μm';
    if (meters < 0.1) return (meters * 1e3).toFixed(2) + ' mm';
    return meters.toFixed(3) + ' m';
  }

  function updateReadouts() {
    const dy = fringeSpacing();
    $('#ds-fringe').textContent = state.mode === 'double' ? fmtLen(dy) : '—（单缝）';
    $('#ds-central').textContent = '1.00';
    $('#ds-dark1').textContent = state.mode === 'double' ? fmtLen(firstDark()) : '—';
    $('#ds-env0').textContent = fmtLen(envelopeZero());
    $('#ds-phase').textContent = '0 rad';
    $('#ds-path').textContent = '0';
  }

  function fitCanvas(cv) {
    const rect = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    return { w: rect.width, h: rect.height, dpr };
  }

  function drawScene(now) {
    const { w, h, dpr } = fitCanvas(scene);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const color = wavelengthRGB(state.lambdaNm);
    const padL = 28;
    const padR = 36;
    const padT = 28;
    const padB = 34;
    const usableW = w - padL - padR;
    const usableH = h - padT - padB;
    const midY = padT + usableH / 2;

    // Layout in scene coords: source | slits | wave region | screen
    const xSource = padL + usableW * 0.06;
    const xSlit = padL + usableW * 0.28;
    const xScreen = padL + usableW * 0.92;
    const waveLeft = xSlit + 10;
    const waveRight = xScreen - 8;

    // Background grid
    g.strokeStyle = '#92b4d012';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }

    // Optical axis
    g.setLineDash([5, 7]);
    g.strokeStyle = '#79a8be55';
    g.beginPath();
    g.moveTo(xSource - 10, midY);
    g.lineTo(xScreen + 10, midY);
    g.stroke();
    g.setLineDash([]);

    // Source
    g.save();
    g.shadowColor = rgba(color, 0.9);
    g.shadowBlur = 18;
    g.fillStyle = rgba(color, 1);
    g.beginPath();
    g.arc(xSource, midY, 9, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = '#b8d4ea';
    g.font = '11px system-ui';
    g.textAlign = 'center';
    g.fillText('光源', xSource, midY + 28);
    g.fillText(state.lambdaNm + ' nm', xSource, midY + 42);

    // Incoming plane-wave arcs (schematic)
    if (state.showWave) {
      for (let i = 0; i < 4; i++) {
        const x = xSource + 18 + i * 14 + ((state.t * 40) % 14);
        g.strokeStyle = rgba(color, 0.18 + i * 0.05);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, midY - usableH * 0.28);
        g.lineTo(x, midY + usableH * 0.28);
        g.stroke();
      }
    }

    // Slit plate
    const plateTop = padT + 8;
    const plateBot = h - padB - 8;
    const slitHalf = Math.max(3, Math.min(14, (state.widthMm / 0.2) * 10));
    const sepHalf = Math.max(16, Math.min(usableH * 0.28, (state.sepMm / 0.8) * usableH * 0.32));
    const slits = state.mode === 'single'
      ? [{ y: midY }]
      : [{ y: midY - sepHalf }, { y: midY + sepHalf }];

    g.fillStyle = '#1a2836';
    g.strokeStyle = '#4a6780';
    g.lineWidth = 2;
    // Draw plate with slit cutouts via path difference
    g.beginPath();
    g.rect(xSlit - 6, plateTop, 12, plateBot - plateTop);
    g.fill();
    // Cut slits (overdraw background color)
    slits.forEach((s) => {
      g.fillStyle = '#0c1520';
      g.fillRect(xSlit - 7, s.y - slitHalf, 14, slitHalf * 2);
      g.strokeStyle = rgba(color, 0.85);
      g.lineWidth = 1.5;
      g.strokeRect(xSlit - 7, s.y - slitHalf, 14, slitHalf * 2);
    });
    g.fillStyle = '#b8d4ea';
    g.font = '11px system-ui';
    g.textAlign = 'center';
    g.fillText(state.mode === 'double' ? '双缝' : '单缝', xSlit, plateTop - 6);
    if (state.mode === 'double') {
      g.fillStyle = '#8fa6b8';
      g.fillText('d', xSlit - 18, midY + 4);
    }

    // Screen strip with fringe pattern
    const screenH = plateBot - plateTop;
    const yMaxPhys = Math.max(envelopeZero() * 1.15, fringeSpacing() * 8, 0.002);
    const screenX = xScreen;
    const screenW = 18;
    for (let py = 0; py < screenH; py++) {
      const yNorm = (py / screenH) * 2 - 1; // -1..1
      const yPhys = yNorm * yMaxPhys;
      const I = intensityAt(yPhys);
      const bright = Math.pow(clamp(I, 0, 1), 0.85);
      const rr = Math.round(color.r * bright);
      const gg = Math.round(color.g * bright);
      const bb = Math.round(color.b * bright);
      g.fillStyle = `rgb(${rr},${gg},${bb})`;
      g.fillRect(screenX, plateTop + py, screenW, 1.2);
    }
    g.strokeStyle = '#5a7a94';
    g.lineWidth = 1;
    g.strokeRect(screenX, plateTop, screenW, screenH);
    g.fillStyle = '#b8d4ea';
    g.font = '11px system-ui';
    g.textAlign = 'left';
    g.fillText('屏幕', screenX - 2, plateBot + 18);

    // Propagating cylindrical wave fronts from slits
    if (state.showWave) {
      g.save();
      g.beginPath();
      g.rect(waveLeft, plateTop, waveRight - waveLeft, screenH);
      g.clip();
      const phaseSpeed = 55;
      const nRings = 10;
      slits.forEach((s) => {
        for (let i = 0; i < nRings; i++) {
          const r = ((state.t * phaseSpeed + i * 28) % (nRings * 28));
          if (r < 4) continue;
          const alpha = clamp(0.55 * (1 - r / (nRings * 28)), 0.05, 0.45);
          g.strokeStyle = rgba(color, alpha);
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(xSlit + 2, s.y, r, -Math.PI * 0.55, Math.PI * 0.55);
          g.stroke();
        }
      });
      g.restore();
    }

    // Constructive/destructive markers near screen (double-slit)
    if (state.mode === 'double') {
      const dy = fringeSpacing();
      for (let k = -6; k <= 6; k++) {
        const yPhys = k * dy;
        if (Math.abs(yPhys) > yMaxPhys) continue;
        const py = midY + (yPhys / yMaxPhys) * (screenH / 2);
        g.fillStyle = rgba(color, k === 0 ? 0.85 : 0.45);
        g.beginPath();
        g.arc(screenX - 10, py, k === 0 ? 3.5 : 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Labels for L
    g.strokeStyle = '#6a879955';
    g.beginPath();
    g.moveTo(xSlit, plateBot + 6);
    g.lineTo(xScreen, plateBot + 6);
    g.stroke();
    g.fillStyle = '#8fa6b8';
    g.font = '11px system-ui';
    g.textAlign = 'center';
    g.fillText('L = ' + state.distM.toFixed(2) + ' m', (xSlit + xScreen) / 2, plateBot + 20);
  }

  function drawIntensity() {
    const { w, h, dpr } = fitCanvas(intensity);
    ig.setTransform(dpr, 0, 0, dpr, 0, 0);
    ig.clearRect(0, 0, w, h);

    const color = wavelengthRGB(state.lambdaNm);
    const padL = 44;
    const padR = 18;
    const padT = 18;
    const padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Axes
    ig.strokeStyle = '#3d5568';
    ig.lineWidth = 1;
    ig.beginPath();
    ig.moveTo(padL, padT);
    ig.lineTo(padL, padT + plotH);
    ig.lineTo(padL + plotW, padT + plotH);
    ig.stroke();

    ig.fillStyle = '#8fa6b8';
    ig.font = '11px system-ui';
    ig.textAlign = 'right';
    ig.fillText('I', padL - 10, padT + 8);
    ig.textAlign = 'center';
    ig.fillText('y', padL + plotW - 4, padT + plotH + 20);
    ig.fillText('0', padL + plotW / 2, padT + plotH + 18);

    const yMaxPhys = Math.max(envelopeZero() * 1.15, fringeSpacing() * 8, 0.002);

    // Grid
    ig.strokeStyle = '#2a3d4e';
    for (let i = 1; i <= 4; i++) {
      const yy = padT + plotH * (1 - i / 4);
      ig.beginPath();
      ig.moveTo(padL, yy);
      ig.lineTo(padL + plotW, yy);
      ig.stroke();
    }

    // Envelope curve
    if (state.showEnvelope && state.mode === 'double') {
      ig.beginPath();
      for (let i = 0; i <= plotW; i++) {
        const yNorm = (i / plotW) * 2 - 1;
        const yPhys = yNorm * yMaxPhys;
        const lambda = state.lambdaNm * 1e-9;
        const a = state.widthMm * 1e-3;
        const L = state.distM;
        const r = Math.hypot(yPhys, L);
        const sinTheta = yPhys / r;
        const beta = (Math.PI * a * sinTheta) / lambda;
        const env = beta === 0 ? 1 : Math.pow(Math.sin(beta) / beta, 2);
        const x = padL + i;
        const y = padT + plotH * (1 - env);
        if (i === 0) ig.moveTo(x, y);
        else ig.lineTo(x, y);
      }
      ig.strokeStyle = '#f2bb7088';
      ig.lineWidth = 1.5;
      ig.setLineDash([4, 4]);
      ig.stroke();
      ig.setLineDash([]);
      ig.fillStyle = '#f2bb70';
      ig.font = '11px system-ui';
      ig.textAlign = 'left';
      ig.fillText('衍射包络', padL + 8, padT + 14);
    }

    // Main intensity
    ig.beginPath();
    const samples = [];
    for (let i = 0; i <= plotW; i++) {
      const yNorm = (i / plotW) * 2 - 1;
      const yPhys = yNorm * yMaxPhys;
      const I = intensityAt(yPhys);
      samples.push(I);
      const x = padL + i;
      const y = padT + plotH * (1 - I);
      if (i === 0) ig.moveTo(x, y);
      else ig.lineTo(x, y);
    }
    ig.strokeStyle = rgba(color, 0.95);
    ig.lineWidth = 2;
    ig.stroke();

    // Fill under curve
    ig.lineTo(padL + plotW, padT + plotH);
    ig.lineTo(padL, padT + plotH);
    ig.closePath();
    const grad = ig.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, rgba(color, 0.28));
    grad.addColorStop(1, rgba(color, 0.02));
    ig.fillStyle = grad;
    ig.fill();

    // Fringe tick marks for maxima
    if (state.mode === 'double') {
      const dy = fringeSpacing();
      ig.fillStyle = rgba(color, 0.7);
      for (let k = -12; k <= 12; k++) {
        const yPhys = k * dy;
        if (Math.abs(yPhys) > yMaxPhys) continue;
        const x = padL + ((yPhys / yMaxPhys + 1) / 2) * plotW;
        ig.fillRect(x - 0.75, padT + plotH, 1.5, 5);
      }
    }

    // Center line
    ig.strokeStyle = '#6a879955';
    ig.setLineDash([3, 4]);
    ig.beginPath();
    ig.moveTo(padL + plotW / 2, padT);
    ig.lineTo(padL + plotW / 2, padT + plotH);
    ig.stroke();
    ig.setLineDash([]);
  }

  function render(now) {
    if (!state.last) state.last = now;
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;
    state.t += dt;
    drawScene(now);
    drawIntensity();
    requestAnimationFrame(render);
  }

  function applyPreset(name) {
    const p = presets[name];
    if (!p) return;
    Object.assign(state, p);
    syncControls();
    updateReadouts();
    $$('#ds-presets .ds-btn').forEach((b) => b.classList.toggle('active', b.dataset.preset === name));
  }

  function reset() {
    applyPreset('classic');
    state.showWave = true;
    state.showEnvelope = true;
    syncControls();
    updateReadouts();
  }

  // Events
  $('#ds-lambda').addEventListener('input', (e) => {
    state.lambdaNm = +e.target.value;
    syncControls();
    updateReadouts();
  });
  $('#ds-sep').addEventListener('input', (e) => {
    state.sepMm = +e.target.value;
    // Keep slit width below separation for physical sense in double-slit
    if (state.mode === 'double' && state.widthMm >= state.sepMm) {
      state.widthMm = Math.max(0.01, state.sepMm * 0.45);
    }
    syncControls();
    updateReadouts();
  });
  $('#ds-width').addEventListener('input', (e) => {
    state.widthMm = +e.target.value;
    syncControls();
    updateReadouts();
  });
  $('#ds-dist').addEventListener('input', (e) => {
    state.distM = +e.target.value;
    syncControls();
    updateReadouts();
  });

  $('#ds-modes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    syncControls();
    updateReadouts();
  });

  $('#ds-presets').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    applyPreset(btn.dataset.preset);
  });

  $('#ds-wave-toggle').addEventListener('click', () => {
    state.showWave = !state.showWave;
    syncControls();
  });
  $('#ds-envelope-toggle').addEventListener('click', () => {
    state.showEnvelope = !state.showEnvelope;
    syncControls();
  });
  $('#ds-reset').addEventListener('click', reset);

  window.addEventListener('resize', () => {
    drawScene(performance.now());
    drawIntensity();
  });

  syncControls();
  updateReadouts();
  requestAnimationFrame(render);
})();
