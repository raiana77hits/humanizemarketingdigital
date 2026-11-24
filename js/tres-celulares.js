/* ==========================================================================
   Seção "Uma estratégia, três experiências" — Google · Instagram · Delivery
   - Dados demonstrativos em DEMO (empresa fictícia). Para trocar por um cliente real,
     sobrescreva window.HUMANIZE_DEMO antes deste script ou edite o objeto abaixo.
     Imagens: troque os <symbol id="cf-..."> no SVG da seção (ou use <img>) .
   - Apresentação guiada: um único relógio (requestAnimationFrame) é a máquina de estados. Um celular por vez
     avança (zoom + luz), conta a sua história e devolve o foco ao próximo; os outros ficam escurecidos e parados.
     Ciclo: [destaque 0,7 s + história 9,5 s] x 3 + pausa 1,5 s, e recomeça. Só roda com a seção visível.
     Respeita prefers-reduced-motion.
   - No celular (≤ 900px) é um carrossel: avança sozinho de um celular ao outro até o visitante tocar/deslizar.
   ========================================================================== */
(function () {
  'use strict';
  var sec = document.getElementById('tres-celulares');
  if (!sec) return;

  var DEMO = {
    name: 'Café Aurora', handle: 'cafeaurora', query: 'cafeteria perto de mim', distance: '450 m', price: '$$',
    caption: 'Cappuccino do dia ☕ Cremoso, na medida certa.',
    p1: { name: 'Cappuccino Especial', desc: 'Espresso, leite vaporizado e cacau.', price: 'R$ 14,00' },
    p2: { name: 'Latte gelado', desc: 'Espresso duplo, leite e gelo.', price: 'R$ 16,00' },
    p3: { name: 'Bolo de cenoura', desc: 'Fatia com cobertura cremosa.', price: 'R$ 12,00' },
    p4: { name: 'Combo manhã', desc: 'Café + salgado do dia.', price: 'R$ 24,00' }
  };
  var over = window.HUMANIZE_DEMO;
  if (over) for (var k in over) DEMO[k] = over[k];

  /* preenche textos a partir dos dados */
  [].forEach.call(sec.querySelectorAll('[data-d]'), function (el) {
    var v = DEMO, parts = el.getAttribute('data-d').split('.');
    for (var i = 0; i < parts.length && v != null; i++) v = v[parts[i]];
    if (typeof v === 'string') el.textContent = v;
  });

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileMq = window.matchMedia('(max-width: 900px)');
  var stage = document.getElementById('p3Stage'), spark = document.getElementById('p3Spark');
  var cols = [].slice.call(stage.querySelectorAll('.p3-col'));
  var phones = cols.map(function (c) { return c.querySelector('.p3'); });
  var typed = document.getElementById('gTyped');
  var dots = [].slice.call(document.querySelectorAll('#p3Dots button'));
  var TR = 700, DUR = 9500, PAUSE = 1500, LEAD = 260, SCENE = 2250, Q = DEMO.query;   /* ms */
  var PER = TR + DUR, CYCLE = PER * 3 + PAUSE;
  var auto = true, hold = false, holdAt = 0;                  /* avanço automático no carrossel */
  var line = stage.parentNode.querySelector('.p3-line'), lineW = 0;
  function measure() { lineW = line ? line.offsetWidth : 0; }

  function setPhone(i, on, scene) {
    var p = phones[i];
    if (p._on !== on) { p._on = on; p.setAttribute('data-on', on ? '1' : '0'); cols[i].setAttribute('data-active', on ? '1' : '0'); }
    if (p._sc !== scene) { p._sc = scene; p.setAttribute('data-scene', scene); }
  }

  /* ---------- versão estática (movimento reduzido) ---------- */
  if (reduced) {
    [3, 3, 3].forEach(function (s, i) { setPhone(i, true, s); });
    phones[0].classList.add('typed');
    if (spark) spark.style.display = 'none';
  }

  /* ---------- carrossel (celular/tablet) ---------- */
  var cur = 0;
  function nearest() {
    var c = stage.scrollLeft + stage.clientWidth / 2, best = 0, bd = 1e9;
    cols.forEach(function (col, i) { var d = Math.abs(col.offsetLeft + col.offsetWidth / 2 - c); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function goTo(i) {
    i = Math.max(0, Math.min(cols.length - 1, i));
    var col = cols[i];
    stage.scrollTo({ left: col.offsetLeft - (stage.clientWidth - col.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  }
  function markDots(i) { dots.forEach(function (d, n) { d.setAttribute('aria-selected', n === i ? 'true' : 'false'); }); }
  var sRaf = 0;
  stage.addEventListener('scroll', function () {
    if (sRaf) return;
    sRaf = requestAnimationFrame(function () { sRaf = 0; var n = nearest(); if (n !== cur) { cur = n; markDots(n); T = 0; hold = false; } });
  }, { passive: true });
  document.getElementById('p3Prev').addEventListener('click', function () { goTo(cur - 1); });
  document.getElementById('p3Next').addEventListener('click', function () { goTo(cur + 1); });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { goTo(i); }); });

  /* ---------- interação manual: quem mexe assume o controle do carrossel ---------- */
  ['pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { stage.addEventListener(ev, function () { auto = false; hold = false; }, { passive: true }); });
  ['p3Prev', 'p3Next'].forEach(function (id) { document.getElementById(id).addEventListener('click', function () { auto = false; hold = false; }); });
  dots.forEach(function (d) { d.addEventListener('click', function () { auto = false; hold = false; }); });

  /* ---------- relógio / máquina de estados ---------- */
  var T = 0, last = 0, raf = 0, running = false, started = false;
  var lastCaret = -1;

  function typeText(n) { if (n !== lastCaret) { lastCaret = n; typed.textContent = Q.slice(0, n); phones[0].classList.toggle('typed', n >= 5); } }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(100, now - (last || now)); last = now;
    var mobile = mobileMq.matches, i;

    if (mobile) {
      /* carrossel: o celular visível conta a história; depois passa para o próximo */
      if (hold) { if (now - holdAt > 1800) { hold = false; T = 0; } return; }
      T += dt;
      var local = T - TR, scene = local < 0 ? 1 : Math.min(4, Math.floor(local / SCENE) + 1);
      for (i = 0; i < phones.length; i++) { if (i === cur) setPhone(i, true, scene); else setPhone(i, false, 1); }
      typeText(cur === 0 ? (local < 0 ? 0 : Math.floor(Math.min(1, local / 1500) * Q.length)) : Q.length);
      if (T > TR + DUR + (cur === 2 ? PAUSE : 600)) {
        if (auto) { hold = true; holdAt = now; goTo((cur + 1) % cols.length); } else T = 0;
      }
      if (spark) spark.style.opacity = 0;
      return;
    }

    /* desktop: Google → Instagram → Cardápio, um de cada vez */
    T += dt;
    var tt = T % CYCLE, k = Math.min(2, Math.floor(tt / PER)), loc = tt - k * PER - TR;
    for (i = 0; i < phones.length; i++) {
      if (i === k) setPhone(i, true, loc < 0 ? 1 : Math.min(4, Math.floor(loc / SCENE) + 1));
      else setPhone(i, false, i < k ? 4 : 1);             /* já apresentado: congela no último quadro */
    }
    /* a digitação só começa depois que o destaque do celular terminou */
    typeText(k === 0 ? (loc < 0 ? 0 : Math.floor(Math.min(1, loc / 1500) * Q.length)) : Q.length);

    /* fluxo luminoso na linha, rumo ao próximo celular */
    if (spark) {
      var o = 0, x = 0;
      for (var j = 0; j < 2; j++) {
        var a = (j + 1) * PER - LEAD, b = (j + 1) * PER + TR;
        if (tt >= a && tt <= b) { var u = (tt - a) / (b - a), e = u * u * (3 - 2 * u); x = (j + e) * 0.5 * lineW; o = Math.sin(Math.PI * u); }
      }
      spark.style.opacity = o > 0.01 ? (o * 0.95).toFixed(3) : 0;
      spark.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0) translateX(-100%)';
    }
  }
  function start() { if (running || reduced) return; running = true; last = 0; measure(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (!reduced) {
    if ('IntersectionObserver' in window) {
      /* começa quando a seção está suficientemente na tela e pausa quando o visitante sai */
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var on = e.isIntersecting && (e.intersectionRatio >= 0.4 || e.intersectionRect.height >= window.innerHeight * 0.5);
          if (on) { if (!started) { started = true; T = 0; } start(); } else stop();
        });
      }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
      io.observe(sec);
    } else { start(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
    window.addEventListener('resize', measure);
    cur = nearest(); markDots(cur);
  }
})();
