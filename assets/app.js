/* HyLevel Club · hero guiado por scroll, a rota, a mesa e o formulário */
(function () {
  'use strict';

  var VIDEO_SRC = 'assets/hero-scrub.mp4';
  var POSTER_SRC = 'assets/hero-poster.jpg';
  var VIDEO_BYTES = 17148549; // tamanho real do hero-scrub.mp4; atualizar a cada troca de vídeo
  var RING_LEN = 126;

  // Scroll → tempo do vídeo, por trecho. Cada ponto turístico ocupa cerca de 1000px de
  // scroll (uns 3 flicks de trackpad) e as transições escuras passam em ~200px.
  // Pares [progresso do hero, segundo do vídeo]; entre os pares é linear.
  var TIMEMAP = [
    [0.000, 0.00],   // Cristo Redentor
    [0.184, 8.00],
    [0.219, 9.75],   // escuro
    [0.404, 15.50],  // Arcos da Lapa
    [0.439, 17.00],  // escuro
    [0.623, 23.00],  // Pão de Açúcar
    [0.658, 24.75],  // água
    [0.833, 30.30],  // Copacabana
    [1.000, 32.07]   // fade para a noite
  ];
  function progressToTime(p) {
    var dur = (video && video.duration) || TIMEMAP[TIMEMAP.length - 1][1];
    var last = TIMEMAP[TIMEMAP.length - 1][1];
    for (var i = 1; i < TIMEMAP.length; i++) {
      var a = TIMEMAP[i - 1], b = TIMEMAP[i];
      if (p <= b[0]) {
        var t = a[1] + (b[1] - a[1]) * ((p - a[0]) / (b[0] - a[0]));
        return Math.min(dur, t * (dur / last));
      }
    }
    return dur;
  }
  var INTRO_MS = 1100;
  var HOLD_MS = 1800;
  var RELEASE_MS = 2400;

  // Destino do pedido de convite: função hylevel-lead do HyperCRM (card no funil
  // Hylevel Club, etapa Backlog). O valor do header é público por natureza (site
  // estático); ele só barra varredura automática. Com o endereço vazio o envio falha à vista.
  var LEAD_ENDPOINT = 'https://wcttnystjjozcpzovgiu.supabase.co/functions/v1/hylevel-lead';
  var LEAD_SECRET = 'ca3a10c52b473f26c3d9fd426496188a647f0dc004577886';

  var hero = document.getElementById('topo');
  var stage = document.getElementById('stage');
  var video = document.getElementById('hero-video');
  var ringWrap = document.getElementById('ring-wrap');
  var ringArc = ringWrap ? ringWrap.querySelectorAll('circle')[1] : null;
  var chevron = document.getElementById('chevron');
  var bandsRoot = document.getElementById('bands');
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('nav-toggle');
  var navLinks = document.getElementById('nav-links');
  var posterImg = document.querySelector('#poster img');
  var conteudo = document.querySelector('.conteudo');
  var rota = document.getElementById('rota');
  var rotaPath = document.getElementById('rota-path');
  var marcos = Array.prototype.slice.call(document.querySelectorAll('.rota .marco'));
  var mesa = document.getElementById('mesa');
  var mesaSvg = mesa ? mesa.querySelector('svg') : null;
  var cadeirasG = document.getElementById('cadeiras');

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var smoothstep = function (p, e0, e1) {
    if (e1 <= e0) return p >= e1 ? 1 : 0;
    var t = clamp01((p - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  function rng(seed) {
    var s = seed >>> 0;
    return function () { return (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  }

  /* ---------- os cinco portões do hero estático: idênticos ao CSS ---------- */

  var GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  var MQLS = GATES.map(function (q) { return window.matchMedia(q); });
  var REDUCE = MQLS[4];
  function isStaticHero() {
    return MQLS.some(function (m) { return m.matches; });
  }

  /* ---------- divisão do texto em palavras e letras ---------- */

  var SPREAD = { blur: 0.25, split: 0.3, grid: 0.45, depth: 0.3, punch: 0.4, rise: 0.4 };

  function applyJitter(cs, entry, i, total, spread, rand) {
    var t = total > 1 ? i / (total - 1) : 0;
    if (entry === 'split') {
      var mid = (total - 1) / 2;
      var dist = mid > 0 ? Math.abs(i - mid) / mid : 0;
      var inward = i < mid ? 1 : -1;
      cs.style.setProperty('--th', (dist * spread).toFixed(4));
      cs.style.setProperty('--jx', (inward * (10 + dist * 30)).toFixed(1) + 'px');
      return;
    }
    if (entry === 'grid') {
      cs.style.setProperty('--th', (t * spread + rand() * 0.06).toFixed(4));
      cs.style.setProperty('--jx', ((rand() * 2 - 1) * 16).toFixed(1) + 'px');
      return;
    }
    cs.style.setProperty('--th', (t * spread).toFixed(4));
  }

  function splitText(el, mode, entry, index) {
    var rand = rng(0x9e3779b9 + index * 7919);
    var spread = parseFloat(el.getAttribute('data-spread')) || SPREAD[entry] || 0.35;
    var nodes = Array.prototype.slice.call(el.childNodes);
    var text = (el.textContent || '').trim();
    if (!text) return;

    var reader = document.createElement('span');
    reader.className = 'visually-hidden';
    reader.textContent = text;

    var visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');

    var words = [];
    nodes.forEach(function (n) {
      var em = n.nodeType === 1 && n.classList.contains('em');
      var txt = (n.textContent || '');
      txt.split(/\s+/).forEach(function (w) { if (w) words.push({ w: w, em: em }); });
    });
    var totalChars = text.replace(/\s+/g, '').length;
    var ci = 0;
    words.forEach(function (item, wi) {
      var ws = document.createElement('span');
      ws.className = 'w' + (item.em ? ' em' : '');
      if (mode === 'word') {
        ws.textContent = item.w;
        var step = words.length > 1 ? wi / (words.length - 1) : 0;
        ws.style.setProperty('--th', (step * spread).toFixed(4));
      } else {
        Array.from(item.w).forEach(function (ch) {
          var cs = document.createElement('span');
          cs.className = 'c';
          cs.textContent = ch;
          applyJitter(cs, entry, ci, totalChars, spread, rand);
          ws.appendChild(cs);
          ci++;
        });
      }
      visual.appendChild(ws);
      if (wi < words.length - 1) visual.appendChild(document.createTextNode(' '));
    });

    el.textContent = '';
    el.appendChild(reader);
    el.appendChild(visual);
  }

  /* ---------- faixas de legenda ---------- */

  var bands = [];
  if (bandsRoot) {
    var nodes = Array.prototype.slice.call(bandsRoot.querySelectorAll('.band'));
    nodes.forEach(function (el, i) {
      var entry = el.getAttribute('data-entry') || 'rise';
      Array.prototype.slice.call(el.querySelectorAll('[data-split]')).forEach(function (t, j) {
        splitText(t, t.getAttribute('data-split'), entry, i * 10 + j);
      });
      var counters = Array.prototype.slice.call(el.querySelectorAll('[data-count]')).map(function (c) {
        return { el: c, target: parseFloat(c.getAttribute('data-count')), prefix: c.getAttribute('data-prefix') || '', suffix: c.getAttribute('data-suffix') || '', last: '' };
      });
      bands.push({
        el: el,
        a: parseFloat(el.getAttribute('data-a')) || 0,
        b: parseFloat(el.getAttribute('data-b')) || 1,
        ramp: parseFloat(el.getAttribute('data-ramp')) || 0,
        first: i === 0,
        last: i === nodes.length - 1,
        sub: el.querySelector('.sub') || el.querySelector('.hint'),
        links: Array.prototype.slice.call(el.querySelectorAll('.cta-row a')),
        counters: counters,
        op: -1, k: -1, ks: -1, kb: -1, tabbable: null
      });
    });
  }

  var introStart = 0;
  var introK = 0;

  function writeK(band, k) {
    if (k === band.k) return;
    if (k !== 0 && k !== 1 && Math.abs(k - band.k) < 0.008) return;
    band.el.style.setProperty('--k', k.toFixed(3));
    band.k = k;
  }

  function writeCounters(band, k) {
    if (!band.counters.length) return;
    var e = 1 - Math.pow(1 - clamp01(k), 3);
    band.counters.forEach(function (c) {
      var txt = c.prefix + Math.round(c.target * e) + c.suffix;
      if (txt !== c.last) { c.el.textContent = txt; c.last = txt; }
    });
  }

  function updateCaptions(p) {
    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
      var a = band.a, b = band.b;
      var f = Math.min(0.02, (b - a) / 3);

      var op = 1;
      if (!band.first) op *= smoothstep(p, a, a + f);
      if (!band.last) op *= 1 - smoothstep(p, b - f, b);
      if (op !== band.op && (op === 0 || op === 1 || Math.abs(op - band.op) > 0.004)) {
        band.el.style.opacity = op.toFixed(3);
        band.op = op;
      }

      var ramp = band.ramp || Math.min(0.025, (b - a) * 0.35);
      var k = clamp01((p - a) / ramp);
      if (band.first) k = Math.max(k, introK);
      writeK(band, k);
      writeCounters(band, clamp01((p - a) / Math.max(ramp * 2.2, 0.001)));

      if (band.sub) {
        var ks = clamp01((k - 0.66) * 4);
        if (ks !== band.ks && (ks === 0 || ks === 1 || Math.abs(ks - band.ks) > 0.008)) {
          band.el.style.setProperty('--ks', ks.toFixed(3));
          band.ks = ks;
        }
        var kb = clamp01((k - 0.78) * 5);
        if (kb !== band.kb && (kb === 0 || kb === 1 || Math.abs(kb - band.kb) > 0.008)) {
          band.el.style.setProperty('--kb', kb.toFixed(3));
          band.kb = kb;
        }
        if (band.links.length) {
          var on = kb > 0.5 && op > 0.5;
          if (on !== band.tabbable) {
            band.tabbable = on;
            band.links.forEach(function (l) {
              if (on) l.removeAttribute('tabindex'); else l.setAttribute('tabindex', '-1');
            });
          }
        }
      }
    }
  }

  /* ---------- carregamento do vídeo em Blob, atrás do anel ---------- */

  var bootstrapped = false;
  var fetchStarted = false;
  var videoReady = false;
  var videoFailed = false;

  function setRing(frac) {
    if (ringArc) ringArc.style.strokeDashoffset = (RING_LEN - RING_LEN * frac).toFixed(1);
  }

  function failVideo() {
    if (videoReady || videoFailed) return;
    videoFailed = true;
    if (ringWrap) ringWrap.style.display = 'none';
    if (chevron) chevron.style.display = '';
    if (stage) stage.classList.add('video-failed');
    if (hero) hero.classList.add('sem-filme');
  }

  function startBlobFetch() {
    if (fetchStarted) return;
    fetchStarted = true;
    var controller = new AbortController();
    var watchdog = 0;
    var arm = function () {
      clearTimeout(watchdog);
      watchdog = setTimeout(function () { controller.abort(); }, 20000);
    };
    arm();
    fetch(VIDEO_SRC, { signal: controller.signal, priority: 'low' }).then(function (res) {
      if (!res.ok || !res.body) throw new Error('http ' + res.status);
      var total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
      var reader = res.body.getReader();
      var chunks = [];
      var received = 0;
      var lastPaint = 0;
      var pump = function () {
        return reader.read().then(function (step) {
          arm();
          if (step.done) return null;
          chunks.push(step.value);
          received += step.value.length;
          var now = performance.now();
          if (now - lastPaint > 100) {
            lastPaint = now;
            setRing(Math.min(1, received / total));
          }
          return pump();
        });
      };
      return pump().then(function () {
        clearTimeout(watchdog);
        setRing(1);
        video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        video.load();
      });
    }).catch(function () {
      clearTimeout(watchdog);
      failVideo();
    });
  }

  function bootstrapVideo() {
    if (bootstrapped || !video) return;
    bootstrapped = true;
    if (chevron) chevron.style.display = 'none';
    setRing(0);
    var warm = new Image();
    warm.onload = warm.onerror = startBlobFetch;
    warm.src = (posterImg && posterImg.currentSrc) || POSTER_SRC;
    setTimeout(startBlobFetch, 4000);
  }

  /* ---------- busca de quadro travada ---------- */

  var seekBusy = false;
  var pendingTime = -1;

  function requestSeek(t) {
    if (!videoReady || !isFinite(t)) return;
    if (seekBusy) { pendingTime = t; return; }
    if (Math.abs(video.currentTime - t) < 0.012) return;
    seekBusy = true;
    try { video.currentTime = t; } catch (err) { seekBusy = false; }
  }

  function heroProgress() {
    if (!hero) return 0;
    var span = hero.offsetHeight - window.innerHeight;
    if (span <= 0) return 0;
    return clamp01(-hero.getBoundingClientRect().top / span);
  }

  if (video) {
    video.addEventListener('seeked', function () {
      seekBusy = false;
      if (pendingTime >= 0) {
        var t = pendingTime;
        pendingTime = -1;
        requestSeek(t);
      }
    });
    video.addEventListener('error', function () {
      seekBusy = false;
      pendingTime = -1;
      failVideo();
    });
    video.addEventListener('canplay', function () {
      if (videoReady) return;
      videoReady = true;
      if (stage) stage.classList.add('video-ready');
      if (ringWrap) {
        ringWrap.style.opacity = '0';
        setTimeout(function () { ringWrap.style.display = 'none'; }, 700);
      }
      video.pause();
      requestSeek(progressToTime(heroProgress()));
      if (chevron) chevron.style.display = '';
    });
  }

  /* ---------- laço de animação do hero ---------- */

  var scrubOn = false;
  var heroOnScreen = true;
  var running = false;
  var rafId = 0;
  var lastT = 0;
  var shown = 0;
  var chevronDim = null;

  function paint(p) {
    updateCaptions(p);
    if (videoReady && video.duration) requestSeek(progressToTime(p));
    if (chevron && !videoFailed) {
      var dim = p > 0.02;
      if (dim !== chevronDim) {
        chevronDim = dim;
        chevron.style.opacity = dim ? '0' : '';
      }
    }
  }

  function tick(now) {
    rafId = 0;
    var dt = Math.min(100, lastT ? now - lastT : 16.667);
    lastT = now;
    if (introK < 1) introK = clamp01((now - introStart) / INTRO_MS);
    var target = heroProgress();
    shown += (target - shown) * (1 - Math.pow(1 - 0.16, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005 && introK >= 1) {
      shown = target;
      paint(shown);
      running = false;
      lastT = 0;
      return;
    }
    paint(shown);
    rafId = requestAnimationFrame(tick);
  }

  function kick() {
    if (!scrubOn || !heroOnScreen || running) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(tick);
  }

  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    unpinFinalStates();
    bands.forEach(function (b) { b.op = -1; b.k = -1; b.ks = -1; b.kb = -1; });
    introStart = performance.now();
    introK = 0;
    bootstrapVideo();
    shown = heroProgress();
    updateCaptions(shown);
    onScroll();
    kick();
  }

  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (video && videoReady) video.pause();
    if (stage) stage.classList.remove('video-ready');
  }

  function applyHeroMode() {
    if (isStaticHero()) disableScrub(); else enableScrub();
  }

  function onGateChange() {
    if (REDUCE.matches) pinToFinalStates(); else unpinFinalStates();
    applyHeroMode();
    layoutRota();
  }

  MQLS.forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', onGateChange);
    else if (m.addListener) m.addListener(onGateChange);
  });

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      heroOnScreen = entries[0].isIntersecting;
      if (heroOnScreen) kick();
    }, { threshold: 0 }).observe(hero);
  }

  /* ---------- a mesa: pressione e segure para montar ---------- */

  var SETORES = ['Varejo', 'Indústria', 'Logística', 'Saúde', 'Tecnologia', 'Educação', 'Mercado financeiro', 'Mercado imobiliário'];
  var cadeiras = [];
  var setores = [];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  if (cadeirasG) {
    SETORES.forEach(function (nome, i) {
      var ang = (i / SETORES.length) * Math.PI * 2 - Math.PI / 2;
      var cx = 300 + Math.cos(ang) * 196;
      var cy = 300 + Math.sin(ang) * 196;
      var deg = (ang * 180 / Math.PI) + 90;
      var chair = document.createElementNS(SVG_NS, 'rect');
      chair.setAttribute('class', 'cadeira');
      chair.setAttribute('x', cx - 16);
      chair.setAttribute('y', cy - 11);
      chair.setAttribute('width', 32);
      chair.setAttribute('height', 22);
      chair.setAttribute('rx', 6);
      chair.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')');
      cadeirasG.appendChild(chair);
      cadeiras.push(chair);

      var lx = 300 + Math.cos(ang) * 262;
      var ly = 300 + Math.sin(ang) * 262;
      var label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('class', 'setor');
      label.setAttribute('x', lx.toFixed(1));
      label.setAttribute('y', (ly + 4).toFixed(1));
      var c = Math.cos(ang);
      label.setAttribute('text-anchor', c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle');
      label.textContent = nome;
      cadeirasG.appendChild(label);
      setores.push(label);
    });
    if (mesaSvg) mesaSvg.style.setProperty('--len', (2 * Math.PI * 238).toFixed(1));
  }

  var holdP = 0;
  var holding = false;
  var holdDone = false;
  var holdRaf = 0;
  var holdLast = 0;
  var litCount = -1;

  function setHoldP(v) {
    holdP = v;
    var s = v.toFixed(3);
    if (mesa) mesa.style.setProperty('--p', s);
    var n = Math.min(cadeiras.length, Math.floor(v * cadeiras.length + 0.0001));
    if (v >= 1) n = cadeiras.length;
    if (n !== litCount) {
      litCount = n;
      cadeiras.forEach(function (ch, i) { ch.classList.toggle('lit', i < n); });
      setores.forEach(function (lb, i) { lb.classList.toggle('lit', i < n); });
    }
  }

  function completeHold() {
    holdDone = true;
    holding = false;
    setHoldP(1);
    if (mesa) { mesa.classList.add('complete'); mesa.setAttribute('aria-pressed', 'true'); }
  }

  function holdTick(now) {
    holdRaf = 0;
    var dt = Math.min(100, holdLast ? now - holdLast : 16.667);
    holdLast = now;
    var v = holding ? holdP + dt / HOLD_MS : holdP - (dt / RELEASE_MS) * (0.3 + holdP * 0.7);
    v = clamp01(v);
    setHoldP(v);
    if (v >= 1) { completeHold(); holdLast = 0; return; }
    if (!holding && v <= 0.001) { setHoldP(0); holdLast = 0; return; }
    holdRaf = requestAnimationFrame(holdTick);
  }

  function holdKick() {
    if (holdRaf) return;
    holdLast = 0;
    holdRaf = requestAnimationFrame(holdTick);
  }

  function startHold(e) {
    if (holdDone) return;
    if (REDUCE.matches) { completeHold(); return; }
    holding = true;
    if (e && e.pointerId !== undefined && mesa.setPointerCapture) {
      try { mesa.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
    }
    holdKick();
  }

  function stopHold() {
    if (!holding) return;
    holding = false;
    holdKick();
  }

  if (mesa) {
    mesa.addEventListener('pointerdown', function (e) { e.preventDefault(); startHold(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) { mesa.addEventListener(evt, stopHold); });
    mesa.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if (!e.repeat) startHold(null);
    });
    mesa.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') stopHold();
    });
    mesa.addEventListener('blur', stopHold);
  }

  /* ---------- a rota: a linha que desce a página ---------- */

  var rotaLen = 1000;
  var rotaP = -1;
  var marcoOn = [];

  function layoutRota() {
    if (!rota || !conteudo) return;
    var top = conteudo.getBoundingClientRect().top + window.pageYOffset;
    var h = conteudo.offsetHeight || 1;
    marcos.forEach(function (m, i) {
      var sec = document.getElementById(m.getAttribute('data-for'));
      if (!sec) return;
      var y = sec.getBoundingClientRect().top + window.pageYOffset - top + 24;
      m.style.top = y + 'px';
      m.frac = y / h;
      marcoOn[i] = marcoOn[i] || false;
    });
    if (rotaPath) rotaPath.style.setProperty('--len', rotaLen);
  }

  function paintRota() {
    if (!rota || !conteudo) return;
    var r = conteudo.getBoundingClientRect();
    var p = clamp01((window.innerHeight * 0.7 - r.top) / (r.height || 1));
    if (REDUCE.matches) p = 1;
    if (Math.abs(p - rotaP) > 0.003 || p === 0 || p === 1) {
      rotaP = p;
      if (rotaPath) rotaPath.style.setProperty('--p', p.toFixed(3));
    }
    marcos.forEach(function (m, i) {
      var on = p >= (m.frac || 0);
      if (on !== marcoOn[i]) { marcoOn[i] = on; m.classList.toggle('on', on); }
    });
  }

  /* ---------- estados finais fixos (movimento reduzido) ---------- */

  function pinToFinalStates() {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); el.classList.add('done'); });
    setHoldP(1);
    if (mesa) mesa.classList.add('complete');
    holdDone = true;
    bands.forEach(function (b) { writeCounters(b, 1); });
  }

  function unpinFinalStates() {
    if (mesa) { mesa.classList.remove('complete'); mesa.setAttribute('aria-pressed', 'false'); }
    setHoldP(0);
    holdDone = false;
  }

  /* ---------- cromo da página ---------- */

  var navSolid = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var solid = y > 40;
    if (solid !== navSolid) {
      navSolid = solid;
      if (nav) nav.classList.toggle('solid', solid);
    }
    paintRota();
    kick();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    applyHeroMode();
    layoutRota();
    onScroll();
  }, { passive: true });

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
  }
  if (navLinks && nav) {
    navLinks.addEventListener('click', function (e) {
      if (!e.target.closest('a')) return;
      nav.classList.remove('open');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav && nav.classList.contains('open')) {
      nav.classList.remove('open');
      if (navToggle) { navToggle.setAttribute('aria-expanded', 'false'); navToggle.focus(); }
    }
  });

  /* ---------- entradas de seção ---------- */

  var revealTargets = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('in');
        revealIO.unobserve(el);
        setTimeout(function () { el.classList.add('done'); }, 1600);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -10% 0px' });
    revealTargets.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('in'); el.classList.add('done'); });
  }

  /* ---------- formulário em duas etapas ---------- */

  var form = document.getElementById('form-convite');
  var formBox = document.getElementById('form-box');
  if (form) {
    var etapa1 = document.getElementById('etapa-1');
    var etapa2 = document.getElementById('etapa-2');
    var passo2 = document.getElementById('passo-2');
    var passoRotulo = document.getElementById('passo-rotulo');
    var btnContinuar = document.getElementById('btn-continuar');
    var btnVoltar = document.getElementById('btn-voltar');
    var btnEnviar = document.getElementById('btn-enviar');

    function erroDe(input) {
      var lab = input.closest('label');
      return lab ? lab.querySelector('.erro') : null;
    }
    function marcar(input, msg) {
      var e = erroDe(input);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (e) e.textContent = msg || '';
    }
    function validar(fs) {
      var ok = true;
      Array.prototype.slice.call(fs.querySelectorAll('input[required]')).forEach(function (input) {
        var v = input.value.trim();
        var msg = '';
        if (input.type === 'checkbox') {
          if (!input.checked) msg = 'Preencha este campo para continuar.';
          var ec = document.getElementById('erro-consent');
          if (ec) ec.textContent = msg;
          input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        } else {
          if (!v) msg = 'Preencha este campo para continuar.';
          else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Confira o e-mail.';
          else if (input.type === 'tel' && v.replace(/\D/g, '').length < 10) msg = 'Confira o WhatsApp, com DDD.';
          marcar(input, msg);
        }
        if (msg) ok = false;
      });
      return ok;
    }
    Array.prototype.slice.call(form.querySelectorAll('input')).forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') {
          if (input.type === 'checkbox') { var ec = document.getElementById('erro-consent'); if (ec) ec.textContent = ''; input.setAttribute('aria-invalid', 'false'); }
          else marcar(input, '');
        }
      });
    });

    function irPara(n) {
      var dois = n === 2;
      etapa1.hidden = dois;
      etapa2.hidden = !dois;
      if (passo2) passo2.classList.toggle('on', dois);
      if (passoRotulo) passoRotulo.textContent = dois ? 'Etapa 2 de 2' : 'Etapa 1 de 2';
      var first = (dois ? etapa2 : etapa1).querySelector('input');
      if (first) first.focus();
    }
    btnContinuar.addEventListener('click', function () { if (validar(etapa1)) irPara(2); });
    btnVoltar.addEventListener('click', function () { irPara(1); });

    function utm() {
      var q = {};
      try {
        var sp = new URLSearchParams(window.location.search);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (sp.get(k)) q[k] = sp.get(k); });
      } catch (err) { /* sem query */ }
      return q;
    }
    function param(k) {
      try { return new URLSearchParams(window.location.search).get(k) || ''; } catch (err) { return ''; }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validar(etapa2)) return;
      formBox.classList.remove('falhou');
      btnEnviar.disabled = true;
      var rotulo = btnEnviar.textContent;
      btnEnviar.textContent = 'Enviando...';
      var fd = new FormData(form);
      var dados = {
        nome: fd.get('nome'), email: fd.get('email'), telefone: fd.get('telefone'),
        empresa: fd.get('empresa'), cargo: fd.get('cargo'), indicacao: fd.get('indicacao') || '',
        consentimento: fd.get('consentimento') === 'on', hl_campo: fd.get('hl_campo') || '',
        origem: 'site', pagina: window.location.pathname, referer: document.referrer || '',
        utm: utm(), gclid: param('gclid'), fbclid: param('fbclid')
      };
      var done = function () { formBox.classList.add('enviado'); window.location.assign('obrigado/'); };
      var fail = function () { btnEnviar.disabled = false; btnEnviar.textContent = rotulo; formBox.classList.add('falhou'); };
      if (!LEAD_ENDPOINT) { fail(); return; }
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-lp-secret': LEAD_SECRET },
        body: JSON.stringify(dados)
      }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (j) { if (j && j.ok) done(); else fail(); })
        .catch(fail);
    });
  }

  /* ---------- letreiro das logos: cada metade da trilha mais larga que a tela ----------
     A animação anda -50% e recomeça; se a metade for mais estreita que a janela
     (monitor ultralargo), abre um vão vazio no fim de cada volta. Aqui a trilha
     é remontada com quantas cópias forem precisas e a duração acompanha o
     tamanho, para a velocidade continuar a mesma. */

  var MARQUEE_SPEED = 42; // px por segundo
  var marqueeUl = document.querySelector('#marquee ul');
  var marqueeBase = marqueeUl ? Array.prototype.slice.call(marqueeUl.children, 0, marqueeUl.children.length / 2).map(function (li) { return li.cloneNode(true); }) : [];
  var marqueeCopies = 0;

  function layoutMarquee() {
    if (!marqueeUl || !marqueeBase.length) return;
    var first = marqueeUl.children[0];
    var next = marqueeUl.children[marqueeBase.length];
    if (!first || !next) return;
    var setW = next.offsetLeft - first.offsetLeft;
    if (setW <= 0) return;
    var need = Math.max(1, Math.ceil((window.innerWidth + 200) / setW));
    if (need !== marqueeCopies) {
      marqueeCopies = need;
      var frag = document.createDocumentFragment();
      for (var h = 0; h < 2; h++) {
        for (var c = 0; c < need; c++) {
          marqueeBase.forEach(function (li) { frag.appendChild(li.cloneNode(true)); });
        }
      }
      marqueeUl.textContent = '';
      marqueeUl.appendChild(frag);
    }
    marqueeUl.style.animationDuration = Math.round(setW * marqueeCopies / MARQUEE_SPEED) + 's';
  }

  var marqueeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(marqueeTimer);
    marqueeTimer = setTimeout(layoutMarquee, 200);
  }, { passive: true });
  layoutMarquee();

  /* ---------- pausar animações com a aba escondida ---------- */

  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('paused', document.hidden);
    if (!document.hidden) kick();
  });

  /* ---------- partida ---------- */

  layoutRota();
  if (REDUCE.matches) pinToFinalStates();
  applyHeroMode();
  onScroll();
  window.addEventListener('load', function () { layoutRota(); paintRota(); });
})();
