/* ==========================================================================
   Seção "Do primeiro contato à escolha" — Google · Instagram · Cardápio digital
   Empresa fictícia: Café Aurora. As telas usam as imagens fornecidas (img/jornada/*.webp) e
   refazem em código só o que precisa se mexer: barra de busca, teclado, barra de progresso do Story,
   curtida, controles de quantidade, carrinho, total e confirmação do pedido.

   Como funciona
   - Um único relógio (requestAnimationFrame) comanda tudo. Cada celular tem uma linha do tempo própria
     (função render(t), em ms) que só depende do tempo: dá para pausar, retomar e congelar no último quadro.
   - Um celular por vez fica ativo (zoom + luz). O tempo de cada etapa é o da própria história:
     o celular só passa o foco quando termina de contar a sua parte.
   - Ciclo: [destaque 0,7 s + história] x 3 + pausa 1,5 s, e recomeça. Só roda com a seção visível.
   - No celular (≤ 900px) é um carrossel: avança sozinho até o visitante tocar/deslizar.
   - prefers-reduced-motion: versão estática (cada tela num quadro representativo, sem zoom).
   - As imagens são carregadas e decodificadas antes de a apresentação começar (sem flash).
   ========================================================================== */
(function () {
  'use strict';
  var sec = document.getElementById('tres-celulares');
  if (!sec) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileMq = window.matchMedia('(max-width: 900px)');
  var stage = document.getElementById('p3Stage'), spark = document.getElementById('p3Spark');
  var cols = [].slice.call(stage.querySelectorAll('.p3-col'));
  var phones = cols.map(function (c) { return c.querySelector('.p3'); });
  var dots = [].slice.call(document.querySelectorAll('#p3Dots button'));
  var TR = 700, PAUSE = 1500, LEAD = 260;                         /* ms */
  var line = stage.parentNode.querySelector('.p3-line'), lineW = 0;
  function measure() { lineW = line ? line.offsetWidth : 0; }

  /* ---------- utilidades de tempo e de escrita no DOM ---------- */
  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sg(t, a, b) { return cl((t - a) / (b - a)); }
  function ez(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eo(x) { return 1 - Math.pow(1 - x, 3); }
  function mix(a, b, x) { return a + (b - a) * x; }
  function set(el, k, v) { var c = el._c || (el._c = {}); if (c[k] !== v) { c[k] = v; el.style[k] = v; } }
  function op(el, v) { set(el, 'opacity', v <= 0.001 ? '0' : v >= 0.999 ? '1' : v.toFixed(3)); }
  function ty(el, y, unit) { set(el, 'transform', 'translate3d(0,' + y.toFixed(2) + (unit || 'cqw') + ',0)'); }
  function sc(el, s) { set(el, 'transform', 'scale(' + s.toFixed(3) + ')'); }
  function txt(el, s) { if (el._t !== s) { el._t = s; el.textContent = s; } }
  function pos(el, root) {                                        /* centro do elemento, em px, relativo à tela */
    var x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 };
  }
  /* toque na tela: círculo translúcido discreto, 560 ms (x, y em cqw) */
  var TAPD = 560;
  function tapAt(el, list, t) {
    for (var i = 0; i < list.length; i++) {
      var u = (t - list[i][0]) / TAPD;
      if (u >= 0 && u <= 1) {
        set(el, 'left', list[i][1].toFixed(2) + 'cqw'); set(el, 'top', list[i][2].toFixed(2) + 'cqw');
        op(el, (u < .16 ? u / .16 : 1 - (u - .16) / .84) * .95);
        sc(el, .55 + .8 * eo(u));
        return;
      }
    }
    op(el, 0);
  }
  var UG = 95.6 / 887, UI = 95.6 / 941;                           /* cqw por pixel das imagens */

  /* =======================================================================
     1. GOOGLE — home → toque na busca → teclado → digitação → pesquisar → carregamento → resultado → rolagem → Rotas
     ======================================================================= */
  function sceneGoogle(ph) {
    var $ = function (q) { return ph.querySelector(q); };
    var s = $('.p3-s'), res = $('.gx-res'), scr = $('.gx-scroll'), skel = $('.gx-skel'), home = $('.gx-home'), logo = $('.gx-logo'),
      sug = $('.gx-sug'), av = $('.gx-av'), bar = $('.gx-bar'), typed = $('.gx-typed'), load = $('.gx-load'), loadI = $('.gx-load i'),
      kb = $('.gx-kb'), sheet = $('.gx-sheet'), tp = $('.p3-tap');
    var Q = 'cafeteria perto de mim', keys = {}, go, ct = [];
    var HOME_DY = 64 - (15 + (200 - 80) * UG);                    /* a barra desce até 64cqw na tela inicial */
    var SUGG = ['cafeteria perto de mim', 'cafeteria aberta agora', 'cafeteria com brunch', 'cafeteria 24 horas', 'café da manhã perto de mim'];

    /* teclado virtual */
    [['qwertyuiop'], ['asdfghjkl'], ['⇧', 'zxcvbnm', '⌫']].forEach(function (r) {
      var row = document.createElement('div'); row.className = 'gx-r';
      r.forEach(function (grp) {
        if (grp.length === 1 && '⇧⌫'.indexOf(grp) > -1) { var sp = document.createElement('i'); sp.className = 'gx-k sp'; sp.textContent = grp; row.appendChild(sp); return; }
        grp.split('').forEach(function (ch) { var k = document.createElement('i'); k.className = 'gx-k l'; k.textContent = ch; k.setAttribute('data-k', ch); keys[ch] = k; row.appendChild(k); });
      });
      kb.appendChild(row);
    });
    var last = document.createElement('div'); last.className = 'gx-r';
    last.innerHTML = '<i class="gx-k sp">123</i><i class="gx-k space">espaço</i><i class="gx-k go">Pesquisar</i>';
    kb.appendChild(last); go = last.querySelector('.go'); keys[' '] = last.querySelector('.space');

    /* instante de cada letra (ritmo humano, determinístico) */
    var tt = 1650;
    for (var i = 0; i < Q.length; i++) { ct.push(tt); tt += 70 + ((i * 37) % 5) * 7 + (Q[i] === ' ' ? 48 : 0); }
    var TYPED_END = tt;

    var T_TAP1 = 700, T_UP = 950, T_GO = 3900, T_KBDN = 4150, T_LOAD = 4300, T_RES = 5250, T_SCR = 6300, T_ROTAS = 7950, T_SHEET = 8300;
    var rot = null;

    function render(t) {
      /* barra: sobe da posição da tela inicial para o topo */
      var mv = ez(sg(t, T_UP, T_UP + 450));
      ty(bar, (1 - mv) * HOME_DY);
      op(logo, 1 - sg(t, 850, 1150)); ty(logo, -mv * 5);
      /* teclado */
      var up = ez(sg(t, T_UP, T_UP + 480)) * (1 - ez(sg(t, T_KBDN, T_KBDN + 450)));
      ty(kb, (1 - up) * 100, '%');
      /* digitação */
      var n = 0; while (n < ct.length && ct[n] <= t) n++;
      txt(typed, Q.slice(0, n));
      bar.classList.toggle('cur', t > T_TAP1 + 250 && t < T_GO + 300);
      /* tecla pressionada (balão da letra) */
      var pressed = null;
      if (n > 0 && n <= ct.length && t - ct[n - 1] < 95 && t < TYPED_END + 100) pressed = Q[n - 1];
      for (var ch in keys) keys[ch].classList.toggle('dn', ch === pressed);
      go.classList.toggle('dn', t > T_GO + 80 && t < T_GO + 230);
      /* sugestões enquanto digita */
      if (n !== sug._n) {
        sug._n = n; var p = Q.slice(0, n), html = '';
        if (n > 0) SUGG.forEach(function (x) { if (x.indexOf(p) === 0) html += '<li><span>' + x.slice(0, n) + '</span><b>' + x.slice(n) + '</b></li>'; });
        sug.innerHTML = html;
      }
      op(sug, sg(t, 1650, 1800) * (1 - sg(t, T_KBDN - 60, T_KBDN + 120)));
      /* carregamento: página branca sai, esqueleto entra, barra colorida percorre */
      op(home, 1 - sg(t, T_KBDN, T_KBDN + 260));
      op(skel, sg(t, T_KBDN, T_KBDN + 220) * (1 - sg(t, T_RES + 350, T_RES + 500)));
      var lp = sg(t, T_LOAD, T_RES + 150);
      op(load, lp > 0 && lp < 1 ? 1 : 0); ty(loadI, (lp - 1) * 100, '%');
      /* resultado: aparece no mesmo lugar do esqueleto; barra e avatar de código saem quando a imagem assume */
      var rv = sg(t, T_RES, T_RES + 500);
      op(res, rv);
      var chrome = 1 - sg(t, T_RES + 500, T_RES + 650);
      op(bar, chrome); op(av, chrome);
      /* rolagem */
      var S = 28 * ez(sg(t, T_SCR, T_SCR + 1200));
      ty(scr, -S + (1 - eo(rv)) * 1.4);
      /* toques: busca, tecla Pesquisar, Rotas */
      if (!rot && go.offsetWidth) { var gp = pos(go, s), cq = ph.clientWidth / 100; rot = { x: gp.x / cq, y: gp.y / cq }; }
      var kx = rot ? rot.x : 82, ky = rot ? rot.y : 183.4;
      tapAt(tp, [[T_TAP1, 47.8, 64 + 5.2], [T_GO, kx, ky], [T_ROTAS, 277 * UG, 15 + (1108 - 80) * UG - 28]], t);
      /* folha de rota */
      ty(sheet, (1 - eo(sg(t, T_SHEET, T_SHEET + 600))) * 135, '%');
    }
    return { dur: 9900, render: render };
  }

  /* =======================================================================
     2. INSTAGRAM — perfil → rolagem → volta ao topo → toque no avatar → Story → curtir → fechar → link da bio
     ======================================================================= */
  function sceneInstagram(ph) {
    var $ = function (q) { return ph.querySelector(q); };
    var prof = $('.ix-prof'), scr = $('.ix-scroll'), story = $('.ix-story'), card = $('.ix-card'), bar = $('.ix-prog b'),
      like = $('.ix-like'), hearts = [].slice.call(ph.querySelectorAll('.ix-hearts b')), hl = $('.ix-linkhl'), tp = $('.p3-tap');
    var AVX = 132 * UI, AVY = 15 + 66 * UI + (234 - 128) * UI;     /* centro do avatar no perfil (topo) */
    var HX = 785 * UI, HY = (195.6 - 1672 * UI) / 2 + 1580 * UI;   /* botão de coração do Story */
    var LX = 239 * UI, LY = 15 + 66 * UI + (499 - 128) * UI;       /* link do cardápio na bio */
    var MAXS = 20.6;
    var T_S1 = 600, T_S2 = 1900, T_S3 = 2500, T_S4 = 3500;        /* rolagem para baixo / volta ao topo */
    var T_TAPA = 3800, OA = 4000, OB = 4600, S0 = OB;             /* toque no avatar, abertura do Story */
    var PROG = 4400, T_LIKE = S0 + 1500, CA = S0 + 3300, CB = S0 + 3900, T_LINK = CB + 450;
    card.style.transformOrigin = AVX.toFixed(2) + 'cqw ' + AVY.toFixed(2) + 'cqw';

    function render(t) {
      var S = MAXS * (ez(sg(t, T_S1, T_S2)) - ez(sg(t, T_S3, T_S4)));
      ty(scr, -S);
      /* Story: abre a partir do avatar e fecha de volta para ele */
      var v = eo(sg(t, OA, OB)) * (1 - ez(sg(t, CA, CB)));
      var on = v > 0.001;
      set(story, 'visibility', on ? 'visible' : 'hidden');
      ph.setAttribute('data-story', on ? '1' : '0');
      if (on) {
        set(card, 'transform', 'scale(' + mix(.1, 1, v).toFixed(3) + ')');
        set(card, 'borderRadius', mix(48, 13, v).toFixed(2) + 'cqw');
        op(card, cl(v * 3));
      }
      set(bar, 'transform', 'scaleX(' + cl((t - S0) / PROG).toFixed(4) + ')');
      /* curtida: coração vermelho com "pop" + corações subindo */
      var lp = sg(t, T_LIKE + 120, T_LIKE + 640), ls = lp < .5 ? mix(.6, 1.4, ez(lp * 2)) : mix(1.4, 1, ez((lp - .5) * 2));
      op(like, t >= T_LIKE + 120 ? 1 : 0); sc(like, t >= T_LIKE + 120 ? ls : .6);
      hearts.forEach(function (h, j) {
        var q = sg(t, T_LIKE + 160 + j * 170, T_LIKE + 160 + j * 170 + 1300);
        op(h, q > 0 && q < 1 ? Math.sin(Math.PI * q) * .95 : 0);
        set(h, 'transform', 'translate3d(' + ((j - 1) * 3.2 * q).toFixed(2) + 'cqw,' + (-q * 24).toFixed(2) + 'cqw,0) scale(' + (.7 + .5 * q).toFixed(2) + ')');
      });
      /* link da bio */
      op(hl, Math.sin(Math.PI * sg(t, T_LINK + 60, T_LINK + 520)) * .9);
      tapAt(tp, [[T_TAPA, AVX, AVY], [T_LIKE, HX, HY], [T_LINK, LX, LY - S]], t);
    }
    return { dur: 9700, render: render };
  }

  /* =======================================================================
     3. CARDÁPIO DIGITAL — carregamento → cabeçalho → rolagem → cappuccino → latte → carrinho → finalizar → pedido confirmado
     ======================================================================= */
  function sceneMenu(ph) {
    var $ = function (q) { return ph.querySelector(q); };
    var s = $('.p3-s'), sb = $('.p3-sb'), scr = $('.dx-scroll'), veil = [].slice.call(ph.querySelectorAll('.dx-veil i')), splash = $('.dx-splash'),
      ld = $('.dx-ld b'), logo = $('.dx-splash img'), c1 = $('.dx-c1'), c2 = $('.dx-c2'), badge = $('.dx-badge'), bb = $('.dx-bbadge'),
      bn = $('.dx-bn'), bt = $('.dx-btot'), fin = $('.dx-fin'), ok = $('.dx-ok'), sheet = $('.dx-sheet'), chk = $('.dx-sheet path'), tp = $('.p3-tap');
    function ctl(c) { return { add: c.querySelector('.dx-add'), qty: c.querySelector('.dx-qty') }; }
    var k1 = ctl(c1), k2 = ctl(c2);
    var AX = 856 * UI, Y1 = (677 + 70) * UI, Y2 = (906 + 70) * UI;
    var T_SCR = 3100, MAXS = 26, T_TAP1 = 4650, A1 = T_TAP1 + 110, T_TAP2 = 5750, A2 = T_TAP2 + 110, T_FIN = 7000, T_OK = 7350;
    var finPos = null;
    function money(n) { return 'R$ ' + n.toFixed(2).replace('.', ','); }
    function pop(el, t, a) { var p = sg(t, a, a + 380); return 1 + .4 * Math.sin(Math.PI * p); }

    function render(t) {
      /* carregamento: logotipo e barra, depois a página aparece com um leve ajuste de escala */
      op(splash, 1 - sg(t, 1250, 1750));
      set(splash, 'visibility', t < 1760 ? 'visible' : 'hidden');
      set(ld, 'transform', 'scaleX(' + eo(sg(t, 100, 1150)).toFixed(3) + ')');
      sc(logo, mix(.94, 1, eo(sg(t, 0, 900))));
      var pv = ez(sg(t, 1250, 1900));
      var S = MAXS * ez(sg(t, T_SCR, T_SCR + 1200));
      set(scr, 'transform', 'translate3d(0,' + (-S).toFixed(2) + 'cqw,0) scale(' + mix(1.05, 1, pv).toFixed(4) + ')');
      set(scr, 'transformOrigin', '50% 0');
      /* esqueleto levanta bloco a bloco */
      veil.forEach(function (v, i) { op(v, 1 - eo(sg(t, 1800 + i * 190, 1800 + i * 190 + 420))); });
      /* produtos: + vira controle de quantidade */
      var p1 = eo(sg(t, A1, A1 + 300)), p2 = eo(sg(t, A2, A2 + 300));
      [[k1, p1], [k2, p2]].forEach(function (a) {
        op(a[0].add, 1 - a[1]); sc(a[0].add, 1 - .45 * a[1]);
        op(a[0].qty, a[1]); sc(a[0].qty, .6 + .4 * a[1]);
      });
      /* carrinho: quantidade e total */
      var n = (t >= A1 ? 1 : 0) + (t >= A2 ? 1 : 0), total = (t >= A1 ? 14 : 0) + (t >= A2 ? 16 : 0);
      txt(bn, n === 1 ? '1 item' : n + ' itens'); txt(bt, money(total)); txt(bb, String(n)); txt(badge, String(n));
      var bp = n ? 1 : 0, last = t >= A2 ? A2 : A1;
      op(bb, bp); sc(bb, bp ? pop(bb, t, last) : 0);
      op(badge, bp); sc(badge, bp ? pop(badge, t, last) : 0);
      sc(bt, n ? pop(bt, t, last) * .35 + .65 : 1);
      var fp = n ? ez(sg(t, A1, A1 + 350)) : 0;
      op(fin, mix(.5, 1, fp));
      var fpress = Math.sin(Math.PI * sg(t, T_FIN + 70, T_FIN + 260));
      sc(fin, 1 - .05 * fpress);
      /* pedido realizado */
      var ov = eo(sg(t, T_OK, T_OK + 350));
      op(ok, ov);
      ty(sheet, (1 - eo(sg(t, T_OK + 40, T_OK + 700))) * 100, '%');
      set(chk, 'strokeDashoffset', (1 - eo(sg(t, T_OK + 450, T_OK + 1050))).toFixed(3));
      set(sb, 'color', (S > 11 && ov < .3 && t > 1700) ? '#2a1608' : '#fff');
      /* toques */
      if (!finPos && fin.offsetWidth) { var fp0 = pos(fin, s), cq = ph.clientWidth / 100; finPos = { x: fp0.x / cq, y: fp0.y / cq }; }
      tapAt(tp, [[T_TAP1, AX, Y1 - S], [T_TAP2, AX, Y2 - S], [T_FIN, finPos ? finPos.x : 75.3, finPos ? finPos.y : 185.3]], t);
    }
    return { dur: 9300, render: render };
  }

  var scenes = [sceneGoogle(phones[0]), sceneInstagram(phones[1]), sceneMenu(phones[2])];
  var PER = scenes.map(function (sc_) { return TR + sc_.dur; });
  var OFF = [0, PER[0], PER[0] + PER[1]], CYCLE = PER[0] + PER[1] + PER[2] + PAUSE;
  var STATIC_T = [5900, 500, 6400];                               /* quadros representativos (movimento reduzido) */

  function setPhone(i, on) {
    var p = phones[i];
    if (p._on !== on) { p._on = on; p.setAttribute('data-on', on ? '1' : '0'); cols[i].setAttribute('data-active', on ? '1' : '0'); }
  }
  function settle(i, atEnd) {                                      /* celular parado: primeiro ou último quadro da sua história */
    var want = atEnd ? 1 : 0;
    if (scenes[i].st !== want) { scenes[i].st = want; scenes[i].render(atEnd ? scenes[i].dur : 0); }
  }

  /* ---------- imagens: carrega e decodifica antes de começar ---------- */
  var imgs = [].slice.call(sec.querySelectorAll('img[data-src]')), loaded = false, loading = false, waiters = [];
  function loadImages(cb) {
    if (loaded) { if (cb) cb(); return; }
    if (cb) waiters.push(cb);
    if (loading) return; loading = true;
    var left = imgs.length, finished = false;
    function fin() { if (finished) return; finished = true; loaded = true; waiters.splice(0).forEach(function (f) { f(); }); }
    function one() { if (--left <= 0) fin(); }
    setTimeout(fin, 7000);                                         /* rede lenta: não trava a seção */
    imgs.forEach(function (im) {
      im.src = im.getAttribute('data-src');
      if (im.decode) im.decode().then(one, one);
      else if (im.complete) one(); else { im.onload = one; im.onerror = one; }
    });
  }

  /* ---------- versão estática (movimento reduzido) ---------- */
  if (reduced) {
    phones.forEach(function (p, i) { setPhone(i, true); });
    if (spark) spark.style.display = 'none';
    loadImages(function () { scenes.forEach(function (sc_, i) { sc_.render(STATIC_T[i]); }); });
  } else {
    scenes.forEach(function (sc_, i) { settle(i, false); });
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
  var T = 0, auto = true, hold = false, holdAt = 0;
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
  var last = 0, raf = 0, running = false, started = false, visible = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(100, now - (last || now)); last = now;
    var i, k;

    if (mobileMq.matches) {
      /* carrossel: o celular visível conta a história; depois passa para o próximo */
      if (hold) { if (now - holdAt > 1800) { hold = false; T = 0; } return; }
      T += dt;
      var loc = Math.max(0, Math.min(scenes[cur].dur, T - TR));
      for (i = 0; i < phones.length; i++) {
        if (i === cur) { scenes[i].st = -1; scenes[i].render(loc); setPhone(i, true); }
        else { settle(i, i < cur); setPhone(i, false); }
      }
      if (T > TR + scenes[cur].dur + (cur === 2 ? PAUSE : 600)) {
        if (auto) { hold = true; holdAt = now; goTo((cur + 1) % cols.length); } else T = 0;
      }
      if (spark) spark.style.opacity = 0;
      return;
    }

    /* desktop: Google → Instagram → Cardápio, um de cada vez */
    T += dt;
    var tt = T % CYCLE;
    k = tt >= OFF[2] ? 2 : tt >= OFF[1] ? 1 : 0;
    var lc = Math.max(0, Math.min(scenes[k].dur, tt - OFF[k] - TR));
    for (i = 0; i < phones.length; i++) {
      if (i === k) { scenes[i].st = -1; scenes[i].render(lc); setPhone(i, true); }
      else { settle(i, i < k); setPhone(i, false); }              /* já apresentado: congela no último quadro */
    }
    /* fluxo luminoso na linha, rumo ao próximo celular */
    if (spark) {
      var o = 0, x = 0;
      for (var j = 0; j < 2; j++) {
        var a = OFF[j + 1] - LEAD, b = OFF[j + 1] + TR;
        if (tt >= a && tt <= b) { var u = (tt - a) / (b - a), e = u * u * (3 - 2 * u); x = (j + e) * 0.5 * lineW; o = Math.sin(Math.PI * u); }
      }
      spark.style.opacity = o > 0.01 ? (o * 0.95).toFixed(3) : 0;
      spark.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0) translateX(-100%)';
    }
  }
  function start() { if (running || reduced || !loaded) return; running = true; last = 0; measure(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (!reduced) {
    if ('IntersectionObserver' in window) {
      /* 1) perto da tela: carrega e decodifica as imagens; 2) com a seção bem visível: começa; ao sair: pausa */
      new IntersectionObserver(function (es) { if (es[0].isIntersecting) loadImages(function () { if (visible) start(); }); }, { rootMargin: '1400px 0px' }).observe(sec);
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          visible = e.isIntersecting && (e.intersectionRatio >= 0.4 || e.intersectionRect.height >= window.innerHeight * 0.5);
          if (visible) { if (!started) { started = true; T = 0; } loadImages(function () { if (visible) start(); }); } else stop();
        });
      }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }).observe(sec);
    } else { visible = true; loadImages(start); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (visible) start(); });
    window.addEventListener('resize', function () { measure(); scenes.forEach(function (s_) { s_.st = null; }); });
    cur = nearest(); markDots(cur);
  }

  /* gancho de teste (não afeta a página): desenha o celular i no instante t (ms) */
  sec._p3seek = function (i, t) { stop(); loadImages(function () { phones.forEach(function (p, n) { setPhone(n, n === i); }); scenes[i].st = -1; scenes[i].render(t); }); };
  sec._p3info = function () { return { OFF: OFF, PER: PER, CYCLE: CYCLE }; };
})();
