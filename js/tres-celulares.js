/* ==========================================================================
   Seção "Uma estratégia, três experiências" — Google · Instagram · Delivery
   - Dados demonstrativos em DEMO (empresa fictícia). Para trocar por um cliente real,
     sobrescreva window.HUMANIZE_DEMO antes deste script ou edite o objeto abaixo.
     Imagens: troque os <symbol id="cf-..."> no SVG da seção (ou use <img>) .
   - Um único relógio (requestAnimationFrame) comanda as três demonstrações em sequência
     (9 s cada). Só roda enquanto a seção está perto da tela. Respeita prefers-reduced-motion.
   - No celular (≤ 900px) vira carrossel por swipe: só a demonstração visível anima.
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
  var DUR = 9000, SCENE = DUR / 4, Q = DEMO.query;

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
    sRaf = requestAnimationFrame(function () { sRaf = 0; var n = nearest(); if (n !== cur) { cur = n; markDots(n); T = 0; } });
  }, { passive: true });
  document.getElementById('p3Prev').addEventListener('click', function () { goTo(cur - 1); });
  document.getElementById('p3Next').addEventListener('click', function () { goTo(cur + 1); });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { goTo(i); }); });

  /* ---------- relógio ---------- */
  var T = 0, last = 0, raf = 0, running = false, started = false;
  var lastCaret = -1;

  function frame(now) {
    var dt = Math.min(100, now - (last || now)); last = now; T += dt;
    var mobile = mobileMq.matches, active, local;
    if (mobile) { active = cur; local = T % DUR; }
    else { var tt = T % (DUR * 3); active = Math.floor(tt / DUR); local = tt - active * DUR; }
    var scene = Math.min(4, Math.floor(local / SCENE) + 1);

    for (var i = 0; i < phones.length; i++) {
      if (i === active) setPhone(i, true, scene); else setPhone(i, false, 1);
    }

    /* digitação do primeiro celular */
    var n = Q.length, typing = active === 0 && scene === 1;
    if (typing) n = Math.floor(Math.min(1, local / 1500) * Q.length);
    if (n !== lastCaret) { lastCaret = n; typed.textContent = Q.slice(0, n); phones[0].classList.toggle('typed', n >= 5); }

    /* faísca de ligação entre os celulares (só desktop) */
    if (!mobile && spark) {
      var x = active * 50, k = Math.max(0, (local - (DUR - 1300)) / 1300), o = 1;
      if (active < 2) x += 50 * (k * k * (3 - 2 * k)); else { o = 1 - k; }
      spark.style.left = x + '%'; spark.style.opacity = (k > 0 ? .95 * o : .0) + (k === 0 ? 0 : 0);
    } else if (spark) spark.style.opacity = 0;

    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduced) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (!reduced) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { if (!started) { started = true; T = 0; } start(); } else stop(); });
      }, { rootMargin: '160px 0px' });
      io.observe(sec);
    } else { start(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
    cur = nearest(); markDots(cur);
  }
})();
