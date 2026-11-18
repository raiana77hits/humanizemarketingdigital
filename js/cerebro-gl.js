/* Cérebro 3D da hero (WebGL puro, sem biblioteca) — Humanize
   Modelo real (GLB do Tripo) reduzido para ~1,7 MB em img/cerebro.bin.
   Visual neon: borda luminosa, rede de linhas e estrelas na superfície,
   logo azul dentro do cérebro girando junto. Rotação constante e contínua. */
(function () {
  'use strict';
  var cv = document.getElementById('cerebro-canvas');
  if (!cv) return;
  var small = window.matchMedia('(max-width:767px)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = null;
  try { gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: !small, powerPreference: 'low-power' }); } catch (e) {}
  if (!gl) { window.__cerebroGL = false; return; }
  if (!gl.getExtension('OES_element_index_uint')) { window.__cerebroGL = false; return; }
  window.__cerebroGL = true;

  function fail() {
    /* devolve um canvas limpo para o desenho antigo (cerebro-3d.js) assumir */
    window.__cerebroGL = false;
    var n = document.createElement('canvas'); n.id = 'cerebro-canvas';
    if (cv.parentNode) cv.parentNode.replaceChild(n, cv);
    var sc = document.createElement('script'); sc.src = 'js/cerebro-3d.js'; document.body.appendChild(sc);
  }

  /* ---------- shaders ---------- */
  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function prog(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  var VS_BRAIN = [
    'attribute vec3 aP; attribute vec4 aN; attribute vec4 aA;',
    'uniform mat4 uMV, uP; uniform float uSc;',
    'varying vec3 vN; varying vec3 vV; varying vec4 vA;',
    'void main(){',
    '  vec4 mv = uMV * vec4(aP * uSc, 1.0);',
    '  vV = mv.xyz; vN = mat3(uMV) * aN.xyz; vA = aA;',
    '  gl_Position = uP * mv;',
    '}'
  ].join('\n');

  var FS_BRAIN = [
    'precision mediump float;',
    'varying vec3 vN; varying vec3 vV; varying vec4 vA;',
    'uniform float uBack;',
    'void main(){',
    '  vec3 n = normalize(vN); vec3 v = normalize(-vV);',
    '  if (uBack > 0.5) n = -n;',
    '  float nv = clamp(dot(n, v), 0.0, 1.0);',
    '  float fres = 1.0 - nv;',
    '  float cur = (vA.x - 0.5) * 2.0;',        /* curvatura larga: + crista, - sulco */
    '  float cur2 = (vA.y - 0.5) * 2.0;',
    '  float det = (vA.z - 0.5) * 2.0;',        /* relevo fino vindo da textura */
    '  float crest = smoothstep(0.0, 0.5, cur + cur2 * 0.6);',
    '  float sulc = smoothstep(0.05, -0.45, cur + cur2 * 0.4);',
    '  vec3 deep = vec3(0.03, 0.004, 0.11);',
    '  vec3 mid  = vec3(0.36, 0.09, 0.86);',
    '  float k = clamp(0.50 + det * 0.9 + crest * 0.55 - sulc * 0.75, 0.0, 1.0);',
    '  vec3 base = mix(deep, mid, k);',
    '  float lam = max(dot(n, normalize(vec3(-0.35, 0.65, 0.7))), 0.0);',
    '  base += vec3(0.42, 0.12, 0.75) * lam * 0.55;',
    '  vec3 hv = normalize(normalize(vec3(-0.35, 0.65, 0.7)) + v);',
    '  base += vec3(0.85, 0.55, 1.0) * pow(max(dot(n, hv), 0.0), 38.0) * 0.55;',
    '  float rim = pow(fres, 2.2);',
    '  float rim2 = pow(fres, 5.0);',
    '  vec3 rimCol = mix(vec3(0.95, 0.35, 1.0), vec3(1.0, 0.85, 1.0), rim2);',
    '  vec3 col = base + rimCol * (rim * 0.6 + rim2 * 0.5);',
    '  col *= 1.0 - 0.55 * sulc;',
    '  if (uBack > 0.5) {',
    '    vec3 b = (mid * 0.55 + rimCol * rim * 0.7) * (0.45 + 0.55 * k);',
    '    gl_FragColor = vec4(b, max(b.r, max(b.g, b.b)));',
    '  } else {',
    '    float a = clamp(0.66 + 0.34 * rim, 0.0, 1.0);',
    '    gl_FragColor = vec4(col * a, a);',   /* alfa pré-multiplicado */
    '  }',
    '}'
  ].join('\n');

  var VS_LINE = [
    'attribute vec3 aA; attribute vec3 aB; attribute vec2 aS;',
    'uniform mat4 uMVP; uniform float uSc; uniform vec2 uRes; uniform float uW;',
    'varying float vSide;',
    'void main(){',
    '  vec4 ca = uMVP * vec4(aA * uSc, 1.0); vec4 cb = uMVP * vec4(aB * uSc, 1.0);',
    '  vec2 na = ca.xy / ca.w, nb = cb.xy / cb.w;',
    '  vec2 d = (nb - na) * uRes; float l = length(d); d = l > 0.0001 ? d / l : vec2(1.0, 0.0);',
    '  vec2 nr = vec2(-d.y, d.x);',
    '  vec4 c = mix(ca, cb, aS.x);',
    '  c.xy += nr * aS.y * uW / uRes * 2.0 * c.w;',
    '  vSide = aS.y;',
    '  gl_Position = c;',
    '}'
  ].join('\n');

  var FS_LINE = [
    'precision mediump float; varying float vSide;',
    'void main(){',
    '  float g = exp(-vSide * vSide * 3.2);',
    '  float core = exp(-vSide * vSide * 16.0);',
    '  vec3 c = vec3(0.95, 0.25, 1.0) * g * 0.34 + vec3(1.0, 0.75, 1.0) * core * 0.22;',
    '  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));',
    '}'
  ].join('\n');

  var VS_NODE = [
    'attribute vec4 aP;',
    'uniform mat4 uMVP; uniform float uSc; uniform float uPx;',
    'void main(){',
    '  vec4 c = uMVP * vec4(aP.xyz * uSc, 1.0);',
    '  gl_Position = c;',
    '  gl_PointSize = (13.0 + 24.0 * aP.w) * uPx * (4.6 / c.w);',
    '}'
  ].join('\n');

  var FS_NODE = [
    'precision mediump float;',
    'void main(){',
    '  vec2 p = gl_PointCoord - 0.5; float d = length(p);',
    '  float core = exp(-d * d * 520.0);',
    '  float halo = exp(-d * d * 60.0) * 0.55;',
    '  float ray = (exp(-abs(p.x) * 70.0) * exp(-abs(p.y) * 7.0) + exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 7.0)) * 0.55;',
    '  vec3 c = vec3(1.0, 0.9, 1.0) * core + vec3(0.9, 0.3, 1.0) * halo + vec3(1.0, 0.7, 1.0) * ray;',
    '  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));',
    '}'
  ].join('\n');

  var VS_LOGO = [
    'attribute vec2 aQ; uniform mat4 uMVP; uniform vec3 uPos; uniform float uSize; varying vec2 vT;',
    'void main(){',
    '  vT = aQ * 0.5 + 0.5; vT.y = 1.0 - vT.y;',
    '  gl_Position = uMVP * vec4(uPos + vec3(aQ * uSize, 0.0), 1.0);',
    '}'
  ].join('\n');

  var FS_LOGO = [
    'precision mediump float; varying vec2 vT; uniform sampler2D uTex; uniform float uI;',
    'void main(){',
    '  vec3 c = texture2D(uTex, vT).rgb * uI;',
    '  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));',
    '}'
  ].join('\n');

  /* ---------- matrizes (coluna-maior) ---------- */
  function persp(fov, a, n, f) {
    var t = 1 / Math.tan(fov / 2);
    return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
  }
  function mul(a, b) {
    var o = new Array(16), i, j, k, s;
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
      s = 0; for (k = 0; k < 4; k++) s += a[k * 4 + i] * b[j * 4 + k];
      o[j * 4 + i] = s;
    }
    return o;
  }
  function rotY(r) { var c = Math.cos(r), s = Math.sin(r); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function rotX(r) { var c = Math.cos(r), s = Math.sin(r); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function trans(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }

  /* ---------- carga dos dados ---------- */
  var P = {}, buf = {}, tex = null, ready = 0, nIdx = 0, nSeg = 0, nNode = 0, SC = 0.52;
  function buffer(target, data) {
    var b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b;
  }
  function pad4(n) { return (4 - (n % 4)) % 4; }

  function build(ab) {
    var dv = new DataView(ab);
    var nv = dv.getUint32(0, true), nt = dv.getUint32(4, true), nn = dv.getUint32(8, true), nl = dv.getUint32(12, true);
    SC = dv.getFloat32(16, true);
    var o = 20;
    var pos = new Int16Array(ab, o, nv * 3); o += nv * 6;
    var nor = new Int8Array(ab, o, nv * 4); o += nv * 4;
    var att = new Uint8Array(ab, o, nv * 4); o += nv * 4;
    o += pad4(nv * 14);
    var idx = new Uint32Array(ab, o, nt * 3); o += nt * 12;
    var nod = new Int16Array(ab, o, nn * 4); o += nn * 8;
    var seg = new Int16Array(ab, o, nl * 6);
    nIdx = nt * 3; nNode = nn; nSeg = nl;

    buf.pos = buffer(gl.ARRAY_BUFFER, pos);
    buf.nor = buffer(gl.ARRAY_BUFFER, nor);
    buf.att = buffer(gl.ARRAY_BUFFER, att);
    buf.idx = buffer(gl.ELEMENT_ARRAY_BUFFER, idx);

    var nf = new Float32Array(nn * 4), i;
    for (i = 0; i < nn; i++) {
      nf[i * 4] = nod[i * 4] / 32767 * SC / SC; nf[i * 4 + 1] = nod[i * 4 + 1] / 32767; nf[i * 4 + 2] = nod[i * 4 + 2] / 32767;
      nf[i * 4 + 3] = nod[i * 4 + 3] / 255;
    }
    buf.node = buffer(gl.ARRAY_BUFFER, nf);

    var corners = [[0, -1], [0, 1], [1, 1], [0, -1], [1, 1], [1, -1]];
    var lf = new Float32Array(nl * 6 * 8), q = 0, s, c, k;
    for (s = 0; s < nl; s++) {
      var a = [seg[s * 6] / 32767, seg[s * 6 + 1] / 32767, seg[s * 6 + 2] / 32767];
      var b = [seg[s * 6 + 3] / 32767, seg[s * 6 + 4] / 32767, seg[s * 6 + 5] / 32767];
      for (c = 0; c < 6; c++) {
        for (k = 0; k < 3; k++) lf[q++] = a[k];
        for (k = 0; k < 3; k++) lf[q++] = b[k];
        lf[q++] = corners[c][0]; lf[q++] = corners[c][1];
      }
    }
    buf.line = buffer(gl.ARRAY_BUFFER, lf);
    buf.quad = buffer(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
  }

  try {
    P.brain = prog(VS_BRAIN, FS_BRAIN); P.line = prog(VS_LINE, FS_LINE);
    P.node = prog(VS_NODE, FS_NODE); P.logo = prog(VS_LOGO, FS_LOGO);
  } catch (e) { fail(); return; }

  /* o ponto do modelo já vem normalizado: pos * SC (int16 normalizado) */
  function loadTex(url, cb) {
    var im = new Image();
    im.onload = function () {
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      cb();
    };
    im.onerror = cb; im.src = url;
  }

  function ok() { if (++ready === 2) start(); }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'img/cerebro.bin'); xhr.responseType = 'arraybuffer';
  xhr.onload = function () {
    if (xhr.status !== 200) { fail(); return; }
    try { build(xhr.response); } catch (e) { fail(); return; }
    ok();
  };
  xhr.onerror = fail; xhr.send();
  loadTex('img/logo-neon.webp', ok);

  /* ---------- desenho ---------- */
  var W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = Math.max(2, Math.round(cv.clientWidth * dpr)); H = Math.max(2, Math.round(cv.clientHeight * dpr));
    cv.width = W; cv.height = H; gl.viewport(0, 0, W, H);
  }

  function attr(pr, name, b, n, type, norm, stride, off) {
    var l = gl.getAttribLocation(pr, name); if (l < 0) return l;
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, n, type, norm, stride || 0, off || 0); return l;
  }
  function U(pr, n) { return gl.getUniformLocation(pr, n); }

  var START = 0;            /* ângulo inicial: lado do cérebro virado pra câmera */
  var SPEED = 0.30;             /* rad/s — constante */
  var TILT = 0.12;

  function draw(ang) {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var a = W / H, D = 4.6;
    var Pm = persp(0.36, a, 1.5, 6.5);
    var MV = mul(trans(0, 0, -D), mul(rotX(TILT), rotY(ang)));
    var MVP = mul(Pm, MV);
    var i, l;

    /* 1) costas do cérebro (parede interna, aditivo) */
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
    gl.useProgram(P.brain);
    attr(P.brain, 'aP', buf.pos, 3, gl.SHORT, true, 0, 0);
    attr(P.brain, 'aN', buf.nor, 4, gl.BYTE, true, 0, 0);
    attr(P.brain, 'aA', buf.att, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.uniformMatrix4fv(U(P.brain, 'uMV'), false, MV); gl.uniformMatrix4fv(U(P.brain, 'uP'), false, Pm);
    gl.uniform1f(U(P.brain, 'uSc'), SC); gl.uniform1f(U(P.brain, 'uBack'), 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx);
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
    gl.disable(gl.CULL_FACE);

    /* 2) logo azul dentro do cérebro (gira junto; 3 camadas dão volume) */
    if (tex) {
      gl.useProgram(P.logo);
      l = attr(P.logo, 'aQ', buf.quad, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(U(P.logo, 'uTex'), 0);
      gl.uniformMatrix4fv(U(P.logo, 'uMVP'), false, MVP);
      gl.uniform1f(U(P.logo, 'uSize'), 0.27);
      var zs = [-0.016, 0, 0.016], is = [0.25, 0.5, 0.25];
      for (i = 0; i < 3; i++) {
        gl.uniform3f(U(P.logo, 'uPos'), 0, 0.07, zs[i]); gl.uniform1f(U(P.logo, 'uI'), is[i]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }

    /* 3) frente do cérebro (translúcida, escreve profundidade) */
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.brain);
    attr(P.brain, 'aP', buf.pos, 3, gl.SHORT, true, 0, 0);
    attr(P.brain, 'aN', buf.nor, 4, gl.BYTE, true, 0, 0);
    attr(P.brain, 'aA', buf.att, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.uniform1f(U(P.brain, 'uBack'), 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx);
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
    gl.disable(gl.CULL_FACE);

    /* 3b) reforço do brilho da logo por cima da superfície (sem profundidade) */
    if (tex) {
      gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.logo);
      attr(P.logo, 'aQ', buf.quad, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniformMatrix4fv(U(P.logo, 'uMVP'), false, MVP);
      gl.uniform1f(U(P.logo, 'uSize'), 0.27);
      gl.uniform3f(U(P.logo, 'uPos'), 0, 0.07, 0); gl.uniform1f(U(P.logo, 'uI'), 0.8);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.enable(gl.DEPTH_TEST);
    }

    /* 4) rede de linhas na superfície (aditivo, respeita a profundidade) */
    gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.line);
    attr(P.line, 'aA', buf.line, 3, gl.FLOAT, false, 32, 0);
    attr(P.line, 'aB', buf.line, 3, gl.FLOAT, false, 32, 12);
    attr(P.line, 'aS', buf.line, 2, gl.FLOAT, false, 32, 24);
    gl.uniformMatrix4fv(U(P.line, 'uMVP'), false, MVP); gl.uniform1f(U(P.line, 'uSc'), SC);
    gl.uniform2f(U(P.line, 'uRes'), W, H); gl.uniform1f(U(P.line, 'uW'), 1.6 * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, nSeg * 6);

    /* 5) estrelas nos nós */
    gl.useProgram(P.node);
    attr(P.node, 'aP', buf.node, 4, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(U(P.node, 'uMVP'), false, MVP); gl.uniform1f(U(P.node, 'uSc'), SC);
    gl.uniform1f(U(P.node, 'uPx'), dpr * Math.max(0.6, cv.clientWidth / 400));
    gl.drawArrays(gl.POINTS, 0, nNode);
  }

  function start() {
    if (!buf.pos) return;
    size();
    window.addEventListener('resize', function () { size(); if (reduce) draw(START); });
    var hero = document.querySelector('.hero');
    if (reduce) { draw(START); return; }
    var t0 = performance.now(), acc = 0, last = t0;
    function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (window.__cerebroPause || document.hidden || (hero && hero.classList.contains('is-offscreen'))) return;
      acc += dt;
      draw(START + acc * SPEED);
    }
    requestAnimationFrame(loop);
    window.__cerebroDraw = draw;
  }
})();
