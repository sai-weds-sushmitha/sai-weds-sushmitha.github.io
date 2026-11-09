(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ================= deferred images ================= */
  let deferredDone = false;
  const loadDeferred = () => {
    if (deferredDone) return; deferredDone = true;
    $$('img[data-src]').forEach((im, i) => setTimeout(() => { im.src = im.dataset.src; im.removeAttribute('data-src'); }, i * 120));
  };
  addEventListener('load', () => setTimeout(loadDeferred, 2500));

  /* ================= OPENING: pull the scroll ================= */
  const gate = $('#gate'), scroll = $('#scroll');
  let full = 400, ph = 0, anim = null, opened = false;
  const sizeScroll = () => {
    const w = scroll.getBoundingClientRect().width;
    const land = innerHeight < 520 && innerWidth > innerHeight;
    full = Math.round(Math.min(innerHeight - (land ? 90 : 210), w * 1.32, 620));
    scroll.style.setProperty('--full', full + 'px');
    setPh(Math.min(ph, full));
  };
  const setPh = v => { ph = v; scroll.style.setProperty('--ph', v + 'px'); };
  const mark = on => { scroll.classList.toggle('pulled', on); gate.classList.toggle('pulled', on); };
  const tweenTo = (target, dur = 900, done) => {
    cancelAnimationFrame(anim); const from = ph, t0 = performance.now();
    const step = t => {
      const k = clamp((t - t0) / dur); setPh(from + (target - from) * ease(k));
      if (k < 1) anim = requestAnimationFrame(step); else done && done();
    };
    anim = requestAnimationFrame(step);
  };
  // ribbon: --u 0 (tied) .. 1 (untied)
  const tie = $('#tie'); let u = 0, uAnim = null;
  const setU = v => { u = v; tie && tie.style.setProperty('--u', v.toFixed(3)); };
  const tweenU = (target, dur, done) => {
    cancelAnimationFrame(uAnim); const from = u, t0 = performance.now();
    const step = t => { const k = clamp((t - t0) / dur); setU(from + (target - from) * ease(k)); if (k < 1) uAnim = requestAnimationFrame(step); else done && done(); };
    uAnim = requestAnimationFrame(step);
  };
  const finish = () => {
    if (opened) return; opened = true; mark(true); window.__music && window.__music();
    let doneOnce = false;
    const reveal = () => {
      if (doneOnce) return; doneOnce = true;
      gate.classList.add('done'); body.classList.add('open'); body.classList.remove('locked');
      scrollTo(0, 0); setTimeout(() => gate.remove(), 800); loadDeferred();
    };
    const unroll = () => tweenTo(full, 650, () => {
      const t = setTimeout(reveal, 350);
      const skip = () => { clearTimeout(t); reveal(); };
      gate.addEventListener('wheel', skip, { once: true, passive: true });
      gate.addEventListener('touchstart', skip, { once: true, passive: true });
      gate.addEventListener('pointerdown', skip, { once: true });
    });
    if (u >= 1) unroll();
    else { tweenU(1, Math.round(520 * (1 - u)) + 80); setTimeout(unroll, Math.round(300 * (1 - u))); }
  };
  sizeScroll(); addEventListener('resize', () => gate.isConnected && sizeScroll());

  const UNTIE = 70;   // first 70px of the pull unties the bow, the rest unrolls
  let y0 = 0, moved = 0, drag = false;
  scroll.addEventListener('pointerdown', e => {
    if (opened) return; drag = true; moved = 0; y0 = e.clientY; cancelAnimationFrame(anim); cancelAnimationFrame(uAnim);
    scroll.setPointerCapture(e.pointerId);
  });
  scroll.addEventListener('pointermove', e => {
    if (!drag || opened) return;
    const dy = Math.max(0, e.clientY - y0); moved = Math.max(moved, Math.abs(e.clientY - y0));
    setU(clamp(dy / UNTIE)); setPh(clamp((dy - UNTIE) * 1.25, 0, full)); mark(dy > 6);
  });
  const up = () => {
    if (!drag || opened) return; drag = false;
    if (moved < 6 || u > .5) finish();
    else { tweenU(0, 400); tweenTo(0, 400, () => mark(false)); }
  };
  scroll.addEventListener('pointerup', up); scroll.addEventListener('pointercancel', up);
  // swipe anywhere on the gate also works
  let gy = null;
  gate.addEventListener('touchstart', e => { if (!e.target.closest('#scroll')) gy = e.touches[0].clientY; }, { passive: true });
  gate.addEventListener('touchmove', e => { if (gy !== null && Math.abs(e.touches[0].clientY - gy) > 30) { gy = null; finish(); } }, { passive: true });
  gate.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > 4) finish(); }, { passive: true });
  gate.addEventListener('click', e => { if (!e.target.closest('#scroll')) finish(); });
  scroll.addEventListener('keydown', e => { if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); finish(); } });

  /* ================= music: from the gesture that opens the scroll, slow fade in ================= */
  (() => {
    const song = $('#song'), btn = $('#musicBtn'); if (!song || !btn) return;
    let ctx = null, gain = null, started = false, off = false;
    try { off = localStorage.getItem('ssMusicOff') === '1'; } catch (e) {}
    const ramp = (v, sec) => {
      if (gain) { const t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(v, t + sec); }
      else { const t0 = performance.now(), v0 = song.volume; const st = () => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); song.volume = v0 + (v - v0) * k; if (k < 1) requestAnimationFrame(st); }; st(); }
    };
    const graph = () => {
      if (ctx) return;
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
        const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC();
        const src = ctx.createMediaElementSource(song); gain = ctx.createGain(); gain.gain.value = 0; src.connect(gain); gain.connect(ctx.destination);
      } catch (e) { ctx = null; gain = null; }
    };
    const play = () => {
      graph(); if (ctx && ctx.state === 'suspended') ctx.resume();
      if (gain) gain.gain.value = 0; else song.volume = 0;
      const p = song.play(); if (p && p.then) p.then(() => { started = true; ramp(.85, 6); btn.classList.remove('off'); }).catch(() => {});
    };
    const stop = () => { ramp(0, .8); setTimeout(() => song.pause(), 850); btn.classList.add('off'); };
    window.__music = () => { if (!off) play(); else btn.classList.add('off'); };
    // if opened by wheel (no gesture), start on the next tap anywhere
    const retry = () => { if (!started && !off && body.classList.contains('open')) play(); };
    addEventListener('pointerup', retry); addEventListener('keydown', retry);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (song.paused || btn.classList.contains('off')) { off = false; try { localStorage.removeItem('ssMusicOff'); } catch (_) {} play(); }
      else { off = true; try { localStorage.setItem('ssMusicOff', '1'); } catch (_) {} stop(); }
    });
    btn.hidden = false;
    song.addEventListener('loadedmetadata', () => { btn.hidden = false; });
    song.addEventListener('error', () => { btn.hidden = true; });
    if (song.readyState >= 1) btn.hidden = false;
  })();

  /* ================= gold dust (gate) ================= */
  $$('canvas.dust').forEach(cv => {
    const ctx = cv.getContext('2d'); const N = +cv.dataset.dust || 40; let w, h; const P = [];
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    for (let i = 0; i < N; i++) P.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + .4, s: Math.random() * .0003 + .0001, p: Math.random() * 6.3 });
    const tick = t => {
      if (!cv.isConnected) return; ctx.clearRect(0, 0, w, h);
      for (const q of P) { q.y -= q.s; if (q.y < -.02) { q.y = 1.02; q.x = Math.random(); }
        ctx.beginPath(); ctx.arc(q.x * w + Math.sin(t / 2400 + q.p) * 8, q.y * h, q.r, 0, 6.3);
        ctx.fillStyle = `rgba(243,215,150,${.3 + .4 * Math.sin(t / 900 + q.p)})`; ctx.fill(); }
      if (!reduce) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* ================= petals (hero) ================= */
  const pc = $('#petals');
  if (pc && !reduce) {
    const ctx = pc.getContext('2d'); let w, h; const P = []; let vis = true;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = pc.clientWidth; h = pc.clientHeight; pc.width = w * d; pc.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    const cols = ['#f29a2e', '#e8781c', '#f6c04a', '#fff6e6', '#f3e2c4'];
    const n = innerWidth < 600 ? 16 : 26;
    for (let i = 0; i < n; i++) P.push({ x: Math.random(), y: Math.random() * -1, s: .00045 + Math.random() * .0005, r: 4 + Math.random() * 5, a: Math.random() * 6.3, v: (Math.random() - .5) * .03, c: cols[i % cols.length], sw: Math.random() * 6.3 });
    new IntersectionObserver(([e]) => vis = e.isIntersecting).observe(pc);
    const tick = t => {
      if (vis && body.classList.contains('open')) {
        ctx.clearRect(0, 0, w, h);
        for (const q of P) {
          q.y += q.s; q.a += q.v; if (q.y > 1.05) { q.y = -.05; q.x = Math.random(); }
          const x = q.x * w + Math.sin(t / 1600 + q.sw) * 24, y = q.y * h;
          ctx.save(); ctx.translate(x, y); ctx.rotate(q.a); ctx.globalAlpha = .85;
          ctx.fillStyle = q.c; ctx.beginPath(); ctx.ellipse(0, 0, q.r, q.r * .55, 0, 0, 6.3); ctx.fill(); ctx.restore();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ================= scroll cue / reveal ================= */
  $$('[data-scroll]').forEach(b => b.addEventListener('click', () => $(b.dataset.scroll).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* ================= THE JOURNEY: flight map, Warangal ∞ Vizag ================= */
  (() => {
    const J = $('#journey'), frame = $('#mapFrame'), world = $('#mapWorld'); if (!J || !frame) return;
    const plane = $('#plane'), pinW = $('#pinW'), pinV = $('#pinV'), trail = $('#infTrail'), ghost = $('#infGhost');
    const mWhen = $('#mWhen'), mWhat = $('#mWhat'), cap = $('#mCap');
    // infinity (lemniscate) whose two ends are the two cities, in map pixels (1600x1200)
    const W = [430, 561], V = [1215, 615], C = [(W[0] + V[0]) / 2, (W[1] + V[1]) / 2];
    const A = Math.hypot(V[0] - W[0], V[1] - W[1]) / 2, TH = Math.atan2(V[1] - W[1], V[0] - W[0]), LOBE = 1.3;
    const M = 480, PTS = [];
    for (let i = 0; i <= M; i++) {   // s 0..1 : W -> (up over west lobe) -> centre -> V -> (up over east lobe) -> centre -> W
      const t = Math.PI + 2 * Math.PI * i / M, sn = Math.sin(t), cs = Math.cos(t), d = 1 + sn * sn;
      const lx = A * cs / d, ly = -LOBE * A * sn * cs / d;
      PTS.push([C[0] + lx * Math.cos(TH) - ly * Math.sin(TH), C[1] + lx * Math.sin(TH) + ly * Math.cos(TH)]);
    }
    const dOf = n => 'M' + PTS.slice(0, n + 1).map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
    ghost.setAttribute('d', dOf(M) + 'Z');
    const at = s => { const f = clamp(s) * M, i = Math.min(M - 1, Math.floor(f)), k = f - i; const a = PTS[i], b = PTS[i + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
    const layout = () => {
      const fw = frame.clientWidth, fh = frame.clientHeight, sc = Math.max(fw / 1600, fh / 1200, Math.min(fw / 1150, fh / 540));
      frame.style.setProperty('--k', sc.toFixed(3));
      const ww = 1600 * sc, wh = 1200 * sc;
      world.style.width = ww + 'px'; world.style.height = wh + 'px';
      world.style.left = clamp(fw / 2 - C[0] * sc, fw - ww, 0) + 'px'; world.style.top = clamp(fh / 2 - 600 * sc, fh - wh, 0) + 'px';
    };
    const sm = t => t * t * (3 - 2 * t);
    const CAP = [
      ['Where his story begins', 'Warangal, city of the Kakatiyas'],
      ['11 – 13 December', 'Flying to the coast for the wedding'],
      ['Sangeet · Haldi · Mehendi · Wedding', 'Visakhapatnam, by the sea'],
      ['16 December', 'Home to Warangal for the reception'],
      ['Two cities, two souls', 'one infinite journey']
    ];
    let stage = -1, vDrop = false, wDrop = false, ticking = false;
    const setStage = n => {
      if (n === stage) return; stage = n; cap.classList.add('swap');
      setTimeout(() => { mWhen.textContent = CAP[n][0]; mWhat.textContent = CAP[n][1]; cap.classList.remove('swap'); }, 220);
    };
    const update = () => {
      ticking = false;
      const r = J.getBoundingClientRect(), vh = innerHeight;
      if (!wDrop && r.top < vh * .45) { wDrop = true; pinW.classList.add('drop'); }
      const p = clamp(-r.top / ((r.height - vh) || 1));
      // 0-.08 rest at Warangal | .08-.44 fly out | .44-.56 land in Vizag | .56-.92 fly home | .92-1 infinity complete
      const s = p < .08 ? 0 : p < .44 ? .5 * sm((p - .08) / .36) : p < .56 ? .5 : p < .92 ? .5 + .5 * sm((p - .56) / .36) : 1;
      const n = Math.round(s * M);
      trail.setAttribute('d', n > 0 ? dOf(n) : 'M0 0');
      const [x, y, ang] = at(s), leg = s < .5 ? s * 2 : (s - .5) * 2, fly = (s > 0 && s < .5) || (s > .5 && s < 1);
      const lift = fly ? Math.sin(Math.PI * leg) : 0;
      plane.style.left = (x / 16) + '%'; plane.style.top = (y / 12) + '%';
      plane.style.transform = `translate(-50%,-50%) rotate(${ang * 57.2958}deg) scale(${.78 + lift * .42})`;
      plane.style.filter = `drop-shadow(${4 + lift * 14}px ${6 + lift * 18}px ${3 + lift * 5}px rgba(40,15,0,${.45 - lift * .2}))`;
      plane.classList.toggle('rest', !fly);
      const atV = s >= .5;
      if (atV !== vDrop) { vDrop = atV; pinV.classList.toggle('drop', atV); }
      frame.classList.toggle('done', s >= 1);
      setStage(s >= 1 ? 4 : s > .5 ? 3 : s === .5 ? 2 : s > 0 ? 1 : 0);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    const relayout = () => { layout(); update(); };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', relayout);
    addEventListener('load', relayout);
    relayout();
  })();

  /* ================= calendar + maps buttons ================= */
  const ua = navigator.userAgent, apple = /iPhone|iPad|iPod|Macintosh/.test(ua) && !/Android/.test(ua);
  const icoCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  const icoPin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  $$('.ev-copy[data-cal]').forEach(c => {
    const box = $('.ev-actions', c), d = c.dataset;
    const cal = document.createElement('a'); cal.className = 'ev-btn'; cal.innerHTML = icoCal + 'Add to Calendar';
    if (apple) { cal.href = `assets/cal/${d.cal}.ics`; cal.setAttribute('download', `sai-sushmitha-${d.cal}.ics`); }
    else {
      const dates = d.allday ? d.allday : `${d.start}/${d.end}`;
      cal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(d.title) + '&dates=' + dates + '&location=' + encodeURIComponent(d.loc) + '&details=' + encodeURIComponent('With love, the Vadnala family') + '&ctz=Asia/Kolkata';
      cal.target = '_blank'; cal.rel = 'noopener';
    }
    box.appendChild(cal);
    if (d.maps) {
      const m = document.createElement('a'); m.className = 'ev-btn'; m.innerHTML = icoPin + 'Location';
      m.href = apple ? 'https://maps.apple.com/?q=' + encodeURIComponent(d.maps) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d.maps);
      m.target = '_blank'; m.rel = 'noopener'; box.appendChild(m);
    }
  });

  /* ================= countdown ================= */
  const target = new Date('2026-12-13T20:21:00+05:30').getTime();
  const cells = Object.fromEntries($$('#cd [data-u]').map(b => [b.dataset.u, b]));
  const pad2 = n => String(n).padStart(2, '0');
  const cd = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    cells.d.textContent = pad2(d); cells.h.textContent = pad2(h); cells.m.textContent = pad2(m); cells.s.textContent = pad2(s);
  };
  cd(); setInterval(cd, 1000);
})();
