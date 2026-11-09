(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ================= deferred images (journey paintings) ================= */
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
  const finish = () => {
    if (opened) return; opened = true; mark(true); window.__music && window.__music();
    let doneOnce = false;
    const reveal = () => {
      if (doneOnce) return; doneOnce = true;
      gate.classList.add('done'); body.classList.add('open'); body.classList.remove('locked');
      scrollTo(0, 0); setTimeout(() => gate.remove(), 800); loadDeferred();
    };
    tweenTo(full, 650, () => {
      const t = setTimeout(reveal, 350);
      const skip = () => { clearTimeout(t); reveal(); };
      gate.addEventListener('wheel', skip, { once: true, passive: true });
      gate.addEventListener('touchstart', skip, { once: true, passive: true });
      gate.addEventListener('pointerdown', skip, { once: true });
    });
  };
  sizeScroll(); addEventListener('resize', () => gate.isConnected && sizeScroll());

  let y0 = 0, ph0 = 0, moved = 0, drag = false;
  scroll.addEventListener('pointerdown', e => {
    if (opened) return; drag = true; moved = 0; y0 = e.clientY; ph0 = ph; cancelAnimationFrame(anim);
    scroll.setPointerCapture(e.pointerId);
  });
  scroll.addEventListener('pointermove', e => {
    if (!drag || opened) return;
    const dy = e.clientY - y0; moved = Math.max(moved, Math.abs(dy));
    setPh(clamp(ph0 + Math.abs(dy) * 1.25, 0, full)); mark(ph > 6);
  });
  const up = () => {
    if (!drag || opened) return; drag = false;
    if (moved < 6 || ph > full * 0.28) finish();
    else tweenTo(0, 500, () => mark(false));
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

  /* ================= THE JOURNEY: through the train window ================= */
  const J = $('#journey'), route = $('.route'), carriage = $('#carriage');
  const rail = $('#rail'), train = $('#train'), stopsBox = $('#stops');
  const wrod = $('#wrod'), jNextLbl = $('#jNextLbl'), scenes = $$('#scenes .scene'), board = $('#board'), bTe = $('#bTe'), bEn = $('#bEn'), jLine = $('#jLine');
  const ST = [
    ['వరంగల్', 'Warangal', 'Where his story begins, beneath the Kakatiya gateway'],
    ['రామప్ప', 'Ramappa', 'Stone that dances, and the Perini Shiva Thandavam'],
    ['రాజమండ్రి', 'Rajahmundry', 'Across the Godavari, every road travelled together'],
    ['కోనసీమ', 'Konaseema', 'Banana leaves, full plates, fuller hearts'],
    ['కైలాసగిరి', 'Kailasagiri', 'Shiva and Shakthi, watching over the bay'],
    ['విశాఖపట్నం', 'Visakhapatnam', 'Where the lighthouse glows, two souls meet']
  ];
  const N = ST.length - 1, L = rail.getTotalLength();
  const stopEls = ST.map((t, i) => { const s = document.createElement('i'); s.className = 'stop'; if (i === 0) s.innerHTML = '<span>Warangal</span>'; if (i === ST.length - 1) s.innerHTML = '<span>Vizag</span>'; stopsBox.appendChild(s); return s; });
  let vh = innerHeight, rw = 0, rh = 0, cur = 0;
  const pt = f => { const q = rail.getPointAtLength(clamp(f) * L); return [q.x / 1000 * rw, q.y / 90 * rh]; };
  const layoutJ = () => {
    vh = innerHeight; rw = route.clientWidth; rh = route.clientHeight;
    stopEls.forEach((s, i) => { const [x, y] = pt(i / N); s.style.left = x + 'px'; s.style.top = y + 'px'; });
  };
  const smooth = t => t * t * (3 - 2 * t);
  const setStation = i => {
    if (i === cur) return; cur = i;
    board.classList.add('flip'); jLine.classList.add('swap');
    setTimeout(() => { bTe.textContent = ST[i][0]; bEn.textContent = ST[i][1]; jLine.textContent = ST[i][2]; jNextLbl.textContent = i < N ? 'Next stop · ' + ST[i + 1][1] : 'You have arrived'; board.classList.remove('flip'); jLine.classList.remove('swap'); }, 260);
    $('#jPrev').disabled = i === 0; $('#jNext').disabled = i === N;
  };

  const pars = $$('[data-par]');
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = J.getBoundingClientRect();
    const p = clamp(-r.top / ((r.height - vh) || 1));
    // train moves continuously; between stations the next painting unrolls down over the window
    const f = p * N, k = Math.min(N - 1, Math.floor(f)), u = f - k;
    const m = f >= N ? 1 : (u < .3 ? 0 : u > .7 ? 1 : smooth((u - .3) / .4));
    const pos = f;
    scenes.forEach((sc, i) => {
      let vis = false, clip = 'none', z = 1;
      if (i === k) { vis = m < 1; }
      if (i === k + 1) { vis = m > 0; z = 2; clip = m < 1 ? `inset(0 0 ${(1 - m) * 100}% 0)` : 'none'; }
      if (f >= N && i === N) { vis = true; clip = 'none'; z = 2; }
      if (i === k && f >= N) vis = false;
      sc.style.visibility = vis ? 'visible' : 'hidden'; sc.style.zIndex = z; sc.style.clipPath = clip; sc.style.webkitClipPath = clip;
      sc.style.transform = 'none'; sc.style.filter = (i === k && m > 0 && m < 1) ? `brightness(${1 - m * .35})` : 'none';
      if (vis) {
        const local = i === k ? u : (i === k + 1 ? u - 1 : 0);   // -1..1 around the station
        sc.firstChild.style.transform = `scale(1.38) translateY(${local * -1.6}%)`;
      }
    });
    const rolling = m > 0 && m < 1 && f < N;
    wrod.style.opacity = rolling ? 1 : 0;
    wrod.style.top = `calc(${m * 100}% - 9px)`;
    const fr = clamp(pos / N), [x, y] = pt(fr), [x2, y2] = pt(fr + .01), [x0, y0] = pt(fr - .01);
    train.style.transform = `translate(${x}px,${y}px) rotate(${Math.atan2(y2 - y0, x2 - x0) * 57.3 * .8}deg)`;
    const idx = Math.round(pos);
    stopEls.forEach((s, i) => { s.classList.toggle('on', i <= pos + .01); s.classList.toggle('cur', i === idx); });
    setStation(idx);
    pars.forEach(el => { const b = el.getBoundingClientRect(); el.style.translate = `0 ${(b.top + b.height / 2 - vh / 2) * -(+el.dataset.par)}px`; });
  };
  const goStation = i => {
    i = clamp(i, 0, N); const span = J.offsetHeight - innerHeight;
    const f = i;
    scrollTo({ top: J.offsetTop + span * (f / N), behavior: reduce ? 'auto' : 'smooth' });
  };
  $('#jPrev').addEventListener('click', () => goStation(cur - 1));
  $('#jNext').addEventListener('click', () => goStation(cur + 1));
  stopEls.forEach((s, i) => { s.setAttribute('role', 'button'); s.setAttribute('aria-label', 'Go to ' + ST[i][1]); s.addEventListener('click', () => goStation(i)); });
  $('#jPrev').disabled = true;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  const relayout = () => { layoutJ(); update(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  document.fonts && document.fonts.ready.then(relayout);
  relayout();

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
