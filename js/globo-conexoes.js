/* Globo de conexões — seção 3 de servico-criacao-de-conteudo.html (Humanize)
   Planeta Terra em 3D com uma rede de conexões digitais em movimento.
   - Three.js (bundle enxuto em js/vendor/three-globo.min.js, só o que o globo usa, licença MIT dentro do arquivo).
   - Continentes: gerados em código a partir de dados geográficos reais e locais
     (data/land-110m.json = Natural Earth 110m, domínio público). Nenhuma imagem de textura.
   - Feixes: cada transmissão sai de uma cidade, percorre um arco 3D, chega ao destino (que pulsa)
     e o destino reemite para outras cidades, em cascata.
   - Fundo transparente, sem halo. Pausa fora da tela, respeita "reduzir movimento",
     usa menos pontos no celular e cai para canvas 2D se o WebGL não existir. */
(function () {
  'use strict';
  var nb = document.getElementById('ccNet');
  var cv = document.getElementById('ccNetCv');
  if (!nb || !cv) return;

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var small = window.matchMedia('(max-width:767px)').matches;
  var base = new URL('.', document.currentScript ? document.currentScript.src : location.href);
  var URL_THREE = new URL('vendor/three-globo.min.js', base).href;
  var URL_LAND = new URL('../data/land-110m.json', base).href;

  /* ---------- dados ---------- */
  var D2R = Math.PI / 180;
  function ll(lat, lon) { var p = lat * D2R, l = lon * D2R; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* cidades reais (lat, lon) */
  var CITY = {
    sp: [-23.55, -46.63], ba: [-34.60, -58.38], sa: [-33.45, -70.67], li: [-12.05, -77.04], bo: [4.71, -74.07],
    mx: [19.43, -99.13], ny: [40.71, -74.00], to: [43.65, -79.38], la: [34.05, -118.24], ho: [21.31, -157.86],
    lo: [51.50, -0.12], pa: [48.85, 2.35], ma: [40.42, -3.70], be: [52.52, 13.40], mo: [55.75, 37.62], is: [41.01, 28.97],
    ca: [30.04, 31.24], lg: [6.52, 3.38], na: [-1.29, 36.82], jo: [-26.20, 28.05], ct: [-33.92, 18.42],
    du: [25.20, 55.27], mu: [19.07, 72.88], de: [28.61, 77.21], si: [1.35, 103.82], ja: [-6.20, 106.85],
    hk: [22.32, 114.17], sh: [31.23, 121.47], se: [37.57, 126.98], tk: [35.68, 139.69], sy: [-33.87, 151.21], au: [-36.85, 174.76]
  };
  var IDS = Object.keys(CITY);
  var EDGES = ('sp-ba sp-bo sp-lg sp-ma sp-ny sp-ct sp-li ba-sa li-sa li-bo bo-mx mx-la mx-ny ny-to ny-lo ny-pa ny-la la-ho la-tk ho-tk ho-au ' +
    'lo-pa lo-be lo-lg lo-du ma-lg ma-pa pa-is be-mo mo-du mo-se is-ca ca-na ca-du lg-na lg-jo na-jo jo-ct du-mu mu-de mu-si de-hk si-ja si-hk ' +
    'si-sy si-du ja-sy hk-sh sh-tk sh-se se-tk sy-au to-lo').split(' ');

  function buildNodes() {
    return IDS.map(function (id, i) { var c = CITY[id]; var v = ll(c[0], c[1]); return { id: id, v: [v[0] * 1.004, v[1] * 1.004, v[2] * 1.004], u: v, k: (i % 5 < 3) ? 0 : 1 }; });
  }

  /* arcos 3D: Bézier quadrática elevada, altura proporcional à distância */
  function buildArcs(nodes) {
    var ix = {}; nodes.forEach(function (n, i) { ix[n.id] = i; });
    return EDGES.map(function (e) {
      var s = e.split('-'), a = ix[s[0]], b = ix[s[1]];
      var A = nodes[a].v, B = nodes[b].v;
      var dot = nodes[a].u[0] * nodes[b].u[0] + nodes[a].u[1] * nodes[b].u[1] + nodes[a].u[2] * nodes[b].u[2];
      var th = Math.acos(Math.max(-1, Math.min(1, dot)));
      var hgt = 0.06 + 0.18 * (th / Math.PI);
      var m = [A[0] + B[0], A[1] + B[1], A[2] + B[2]], ml = Math.hypot(m[0], m[1], m[2]) || 1;
      var rc = 2 * (1 + hgt) - Math.cos(th / 2);
      var C = [m[0] / ml * rc, m[1] / ml * rc, m[2] / ml * rc];
      return { a: a, b: b, A: A, B: B, C: C, th: th, dur: 1.15 + 2.0 * (th / Math.PI) };
    });
  }
  function arcAt(r, t, o) {
    var u = 1 - t, w0 = u * u, w1 = 2 * u * t, w2 = t * t;
    o[0] = w0 * r.A[0] + w1 * r.C[0] + w2 * r.B[0]; o[1] = w0 * r.A[1] + w1 * r.C[1] + w2 * r.B[1]; o[2] = w0 * r.A[2] + w1 * r.C[2] + w2 * r.B[2];
    return o;
  }
  function arcTan(r, t, o) {
    var u = 1 - t;
    var x = 2 * u * (r.C[0] - r.A[0]) + 2 * t * (r.B[0] - r.C[0]), y = 2 * u * (r.C[1] - r.A[1]) + 2 * t * (r.B[1] - r.C[1]), z = 2 * u * (r.C[2] - r.A[2]) + 2 * t * (r.B[2] - r.C[2]);
    var l = Math.hypot(x, y, z) || 1; o[0] = x / l; o[1] = y / l; o[2] = z / l; return o;
  }

  /* pontos dos continentes: esfera de Fibonacci filtrada por "está em terra?" nos polígonos reais */
  function buildLand(data, N, rnd) {
    var polys = data.poligonos.map(function (rings) {
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      rings.forEach(function (r) { for (var i = 0; i < r.length; i += 2) { if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i]; if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1]; } });
      return { rings: rings, x0: x0, x1: x1, y0: y0, y1: y1 };
    });
    function inside(lon, lat) {
      for (var k = 0; k < polys.length; k++) {
        var p = polys[k]; if (lon < p.x0 || lon > p.x1 || lat < p.y0 || lat > p.y1) continue;
        var c = false;
        for (var q = 0; q < p.rings.length; q++) {
          var r = p.rings[q];
          for (var i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
            var xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
            if (((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
          }
        }
        if (c) return true;
      }
      return false;
    }
    var pos = [], tint = [], GA = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var z = 1 - 2 * (i + 0.5) / N, lat = Math.asin(z) / D2R;
      var lon = ((i * GA) % (2 * Math.PI)) / D2R; if (lon > 180) lon -= 360;
      if (lat < -78) continue;
      if (!inside(lon, lat)) continue;
      var v = ll(lat, lon); pos.push(v[0] * 1.002, v[1] * 1.002, v[2] * 1.002);
      tint.push(rnd() < 0.6 ? 0.2 : 0.8); /* 60% azul / 40% lilás */
    }
    return { pos: new Float32Array(pos), tint: new Float32Array(tint) };
  }

  /* ---------- simulação das transmissões (independente do renderizador) ---------- */
  var TRAIL = 0.6, PULSE = 1.25;
  function makeSim(arcs, nNodes, rnd, maxActive, minActive) {
    var NA = arcs.length, st = [], adj = [], i;
    for (i = 0; i < NA; i++) st.push({ on: false, t0: 0, dur: 1, dir: 1, arrived: false, dst: 0 });
    for (i = 0; i < nNodes; i++) adj.push([]);
    arcs.forEach(function (a, k) { adj[a.a].push(k); adj[a.b].push(k); });
    var hubs = []; adj.forEach(function (l, n) { if (l.length >= 3) hubs.push(n); });
    var pT0 = new Float64Array(nNodes).fill(-1e9), pend = [], now = 0, nextSeed = 0, front = new Float32Array(nNodes);
    function active() { var n = 0; for (var k = 0; k < NA; k++) if (st[k].on) n++; return n; }
    function emit(node, excl) {
      if (active() >= maxActive) return false;
      var opts = adj[node].filter(function (k) { return k !== excl && !st[k].on; });
      if (!opts.length) return false;
      var fr = opts.filter(function (k) { return front[arcs[k].a] + front[arcs[k].b] > 0.1; });
      if (fr.length && rnd() < 0.85) opts = fr;
      var k = opts[(rnd() * opts.length) | 0], a = arcs[k], s = st[k];
      s.on = true; s.t0 = now; s.dur = a.dur * (0.92 + 0.16 * rnd()); s.dir = a.a === node ? 1 : -1; s.dst = s.dir > 0 ? a.b : a.a; s.arrived = false;
      return true;
    }
    function step(t) {
      now = t;
      for (var k = pend.length - 1; k >= 0; k--) if (pend[k].t <= now) { emit(pend[k].n, pend[k].x); pend.splice(k, 1); }
      for (var j = 0; j < NA; j++) {
        var s = st[j]; if (!s.on) continue;
        var p = (now - s.t0) / s.dur;
        if (!s.arrived && p >= 1) {
          s.arrived = true; pT0[s.dst] = now;
          var r = rnd(), c = r < 0.07 ? 0 : (r < 0.68 ? 1 : 2);
          for (var q = 0; q < c; q++) pend.push({ t: now + 0.16 + 0.2 * rnd() + q * 0.09, n: s.dst, x: j });
        }
        if (p >= 1 + TRAIL) s.on = false;
      }
      if (active() + pend.length < minActive && now >= nextSeed) { var hs = hubs.filter(function (n) { return front[n] > 0.15; }); if (!hs.length) hs = hubs; emit(hs[(rnd() * hs.length) | 0], -1); nextSeed = now + 0.25; }
    }
    return {
      n: NA, step: step, front: front,
      on: function (k) { return st[k].on; },
      head: function (k) { return (now - st[k].t0) / st[k].dur; },
      dir: function (k) { return st[k].dir; },
      pulse: function (n) { var a = (now - pT0[n]) / PULSE; return (a >= 0 && a < 1) ? a : -1; }
    };
  }

  /* ---------- renderizador WebGL (Three.js) ---------- */
  var BLUE = '#075fff', LILAC = '#b829ff';
  var GLSL_COL = '#define BLUE vec3(0.0275,0.3725,1.0)\n#define LILAC vec3(0.7216,0.1608,1.0)\n';
  var SPIN = 2 * Math.PI / 40;           /* 40 s por volta */
  var TILT_X = 0.28, TILT_Z = 0.30, LON0 = -52 * D2R; /* começa mostrando as Américas */

  function makeGL(T, cv, geo, sim) {
    var NA = geo.arcs.length, NN = geo.nodes.length;
    var renderer = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(24, 1, 0.1, 50);
    var tilt = new T.Group(), spin = new T.Group(); tilt.rotation.x = TILT_X; tilt.rotation.z = TILT_Z; scene.add(tilt); tilt.add(spin);
    var U = { uPR: { value: 1 }, uK: { value: 1 } };

    /* esfera (oclui o lado de trás), cores leves, sem halo */
    var sph = new T.Mesh(new T.SphereGeometry(1, 64, 48), new T.ShaderMaterial({
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vP=mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vP; void main(){ vec3 N=normalize(vN); vec3 V=normalize(-vP); float ndv=clamp(dot(N,V),0.0,1.0);' +
        'float lam=clamp(dot(N,normalize(vec3(-0.5,0.6,0.7)))*0.5+0.5,0.0,1.0);' +
        'vec3 c=mix(vec3(0.835,0.863,0.949),vec3(0.957,0.965,0.992),lam); c=mix(c,vec3(0.90,0.86,0.97),(1.0-lam)*0.35);' +
        'c=mix(c,vec3(0.30,0.45,0.95),pow(1.0-ndv,4.0)*0.32); gl_FragColor=vec4(c,1.0); }'
    }));
    sph.renderOrder = 0; spin.add(sph);

    /* graticule bem fina */
    var gp = [], a, b;
    for (var lo = -180; lo < 180; lo += 30) for (a = -80; a < 80; a += 10) { var p0 = ll(a, lo), p1 = ll(a + 10, lo); gp.push(p0[0] * 1.002, p0[1] * 1.002, p0[2] * 1.002, p1[0] * 1.002, p1[1] * 1.002, p1[2] * 1.002); }
    for (var la = -60; la <= 60; la += 30) for (b = 0; b < 360; b += 10) { var q0 = ll(la, b), q1 = ll(la, b + 10); gp.push(q0[0] * 1.002, q0[1] * 1.002, q0[2] * 1.002, q1[0] * 1.002, q1[1] * 1.002, q1[2] * 1.002); }
    var gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(new Float32Array(gp), 3));
    var grat = new T.LineSegments(gg, new T.LineBasicMaterial({ color: 0x075fff, transparent: true, opacity: 0.09, depthWrite: false }));
    grat.renderOrder = 1; grat.frustumCulled = false; spin.add(grat);

    /* continentes: partículas */
    var lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.BufferAttribute(geo.land.pos, 3)); lg.setAttribute('aTint', new T.BufferAttribute(geo.land.tint, 1));
    var land = new T.Points(lg, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aTint; uniform float uPR; uniform float uK; varying float vA; varying float vT;' +
        'void main(){ vec4 wp=modelMatrix*vec4(position,1.0); float f=dot(normalize(wp.xyz),normalize(cameraPosition-wp.xyz)); vA=smoothstep(0.02,0.4,f); vT=aTint;' +
        'gl_PointSize=3.1*uK*uPR*mix(0.65,1.0,f); gl_Position=projectionMatrix*viewMatrix*wp; }',
      fragmentShader: GLSL_COL + 'varying float vA; varying float vT; void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; float a=(1.0-smoothstep(0.6,1.0,r))*vA; gl_FragColor=vec4(vT<0.5?BLUE:LILAC,a); }'
    }));
    land.renderOrder = 2; land.frustumCulled = false; spin.add(land);

    /* arcos: fita voltada para a câmera (base fraca + feixe com rastro) */
    var NS = 64, V = NA * (NS + 1) * 2, pos = new Float32Array(V * 3), tan = new Float32Array(V * 3), ts = new Float32Array(V * 3), idx = new Uint16Array(NA * NS * 6);
    var tmp = [0, 0, 0], tt = [0, 0, 0], vi = 0, ii = 0, i, s;
    for (i = 0; i < NA; i++) {
      for (s = 0; s <= NS; s++) {
        var t = s / NS; arcAt(geo.arcs[i], t, tmp); arcTan(geo.arcs[i], t, tt);
        for (var sd = -1; sd <= 1; sd += 2) { pos.set(tmp, vi * 3); tan.set(tt, vi * 3); ts[vi * 3] = t; ts[vi * 3 + 1] = i; ts[vi * 3 + 2] = sd; vi++; }
      }
      var o = i * (NS + 1) * 2;
      for (s = 0; s < NS; s++) { var k = o + s * 2; idx.set([k, k + 1, k + 2, k + 1, k + 3, k + 2], ii); ii += 6; }
    }
    var ag = new T.BufferGeometry();
    ag.setAttribute('position', new T.BufferAttribute(pos, 3)); ag.setAttribute('aTan', new T.BufferAttribute(tan, 3)); ag.setAttribute('aTS', new T.BufferAttribute(ts, 3));
    ag.setIndex(new T.BufferAttribute(idx, 1));
    var SV = []; for (i = 0; i < NA; i++) SV.push(new T.Vector3(0, 1, 0));
    var RV = 'uniform vec3 uSt[NA]; uniform float uW; uniform float uTrail; attribute vec3 aTan; attribute vec3 aTS; varying float vT; varying float vSide; varying vec3 vSt;' +
      'void main(){ int i=int(aTS.y+0.5); vec3 st=uSt[i]; vec4 wp=modelMatrix*vec4(position,1.0);' +
      'vec3 tn=normalize(mat3(modelMatrix)*aTan); vec3 vd=normalize(cameraPosition-wp.xyz); vec3 sd=cross(tn,vd); float l=length(sd); sd=l>1e-4?sd/l:vec3(0.0);' +
      'float w=uW;\n#ifdef BEAM\nfloat d=st.y>0.0?st.x-aTS.x:aTS.x-st.x; float tf=(d>=0.0&&d<=uTrail)?1.0-d/uTrail:0.0; w*=0.3+0.7*tf;\n#endif\n' +
      'wp.xyz+=sd*aTS.z*w; gl_Position=projectionMatrix*viewMatrix*wp; vT=aTS.x; vSide=aTS.z; vSt=st; }';
    var baseMat = new T.ShaderMaterial({
      uniforms: { uSt: { value: SV }, uW: { value: 0.0062 }, uTrail: { value: TRAIL } }, defines: { NA: NA }, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: RV,
      fragmentShader: GLSL_COL + 'varying float vT; varying float vSide; varying vec3 vSt; void main(){ float e=1.0-smoothstep(0.45,1.0,abs(vSide)); gl_FragColor=vec4(mix(BLUE,LILAC,vT),(0.40+0.14*vSt.z)*e); }'
    });
    var beamMat = new T.ShaderMaterial({
      uniforms: { uSt: { value: SV }, uW: { value: 0.036 }, uTrail: { value: TRAIL } }, defines: { NA: NA, BEAM: 1 }, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: RV,
      fragmentShader: GLSL_COL + 'uniform float uTrail; varying float vT; varying float vSide; varying vec3 vSt; void main(){' +
        'float d=vSt.y>0.0?vSt.x-vT:vT-vSt.x; if(d<0.0||d>uTrail||vSt.z<0.5) discard; float f=1.0-d/uTrail; float a=min(1.0,pow(f,1.15)*1.15);' +
        'float s=abs(vSide); float edge=1.0-smoothstep(0.55,1.0,s);' +
        'float p=vSt.y>0.0?vT:1.0-vT; vec3 c=mix(BLUE,LILAC,clamp(p*0.55+f*0.45,0.0,1.0));' +
        'float w=smoothstep(0.22,0.0,d)*(1.0-smoothstep(0.30,0.70,s)); c=mix(c,vec3(1.0),w);' +
        'gl_FragColor=vec4(c,a*edge); }'
    });
    var baseM = new T.Mesh(ag, baseMat), beamM = new T.Mesh(ag, beamMat);
    baseM.renderOrder = 3; beamM.renderOrder = 4; baseM.frustumCulled = beamM.frustumCulled = false; spin.add(baseM); spin.add(beamM);

    /* cidades (núcleo branco com contorno) + ondas de pulso quando recebem */
    var np = new Float32Array(NN * 3), nk = new Float32Array(NN), nP = new Float32Array(NN).fill(-1);
    geo.nodes.forEach(function (n, k) { np.set(n.v, k * 3); nk[k] = n.k; });
    var ng = new T.BufferGeometry(); ng.setAttribute('position', new T.BufferAttribute(np, 3)); ng.setAttribute('aK', new T.BufferAttribute(nk, 1));
    var pAttr = new T.BufferAttribute(nP, 1); ng.setAttribute('aP', pAttr);
    var NV = 'attribute float aK; attribute float aP; uniform float uPR; uniform float uK; varying float vK; varying float vP;';
    var nodes = new T.Points(ng, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: NV + 'void main(){ vK=aK; vP=aP; float b=aP>=0.0?(1.0-aP)*(1.0-aP):0.0; gl_PointSize=(10.0+7.0*b)*uK*uPR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: GLSL_COL + 'varying float vK; void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; vec3 c=vK<0.5?BLUE:LILAC; float core=1.0-smoothstep(0.50,0.58,r); gl_FragColor=vec4(mix(c,vec3(1.0),core),1.0-smoothstep(0.92,1.0,r)); }'
    }));
    nodes.renderOrder = 5; nodes.frustumCulled = false; spin.add(nodes);
    var waves = new T.Points(ng, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: NV + 'void main(){ vK=aK; vP=aP; if(aP<0.0){ gl_PointSize=0.0; gl_Position=vec4(2.0,2.0,2.0,1.0); return; } gl_PointSize=mix(14.0,62.0,aP)*uK*uPR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: GLSL_COL + 'varying float vK; varying float vP; void main(){ float r=length(gl_PointCoord-0.5)*2.0; float d=abs(r-0.88); float a=(1.0-smoothstep(0.0,0.12,d))*pow(1.0-vP,1.3)*0.85; if(a<0.01) discard; gl_FragColor=vec4(vK<0.5?BLUE:LILAC,a); }'
    }));
    waves.renderOrder = 6; waves.frustumCulled = false; spin.add(waves);

    /* cabeça de cada feixe: núcleo branco com contorno colorido */
    var hp = new Float32Array(NA * 3), hc = new Float32Array(NA);
    var hg = new T.BufferGeometry(); var hpA = new T.BufferAttribute(hp, 3), hcA = new T.BufferAttribute(hc, 1); hpA.setUsage(35048); hcA.setUsage(35048);
    hg.setAttribute('position', hpA); hg.setAttribute('aC', hcA);
    var heads = new T.Points(hg, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aC; uniform float uPR; uniform float uK; varying float vC; void main(){ vC=aC; gl_PointSize=15.0*uK*uPR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: GLSL_COL + 'varying float vC; void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; vec3 c=mix(BLUE,LILAC,vC); float core=1.0-smoothstep(0.50,0.60,r); gl_FragColor=vec4(mix(c,vec3(1.0),core),1.0-smoothstep(0.9,1.0,r)); }'
    }));
    heads.renderOrder = 7; heads.frustumCulled = false; spin.add(heads);

    var W = 0, H = 0, tmp2 = [0, 0, 0];
    function resize() {
      var r = cv.getBoundingClientRect(); var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      var pr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      if (w === W && h === H && pr === U.uPR.value) return false;
      W = w; H = h; U.uPR.value = pr; renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
      cam.aspect = w / h; var th = Math.tan(cam.fov * D2R / 2);
      var dist = 1.28 / (cam.aspect >= 1 ? th : th * cam.aspect);
      cam.position.set(0, 0, dist); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
      U.uK.value = Math.max(0.62, Math.min(1.8, Math.min(w, h) / 2 / 1.28 / 150));
      return true;
    }
    function render(simT) {
      spin.rotation.y = -LON0 + simT * SPIN;
      var n = 0, i;
      for (i = 0; i < NA; i++) {
        var on = sim.on(i), h = sim.head(i), d = sim.dir(i);
        SV[i].set(h, d, on ? 1 : 0);
        if (on && h >= 0 && h <= 1) { arcAt(geo.arcs[i], h, tmp2); hp[n * 3] = tmp2[0]; hp[n * 3 + 1] = tmp2[1]; hp[n * 3 + 2] = tmp2[2]; hc[n] = d > 0 ? h : 1 - h; n++; }
      }
      hg.setDrawRange(0, n); hpA.needsUpdate = true; hcA.needsUpdate = true;
      for (i = 0; i < NN; i++) nP[i] = sim.pulse(i);
      pAttr.needsUpdate = true;
      renderer.render(scene, cam);
    }
    return { resize: resize, render: render, kind: 'webgl' };
  }

  /* ---------- plano B: canvas 2D (sem WebGL / sem Three.js) ---------- */
  function makeC2D(cv, geo, sim) {
    var x = cv.getContext('2d'), W = 0, H = 0, pr = 1, R = 100, cx = 0, cy = 0, K = 1;
    var cZ = Math.cos(TILT_Z), sZ = Math.sin(TILT_Z), cX = Math.cos(TILT_X), sX = Math.sin(TILT_X), cA = 1, sA = 0;
    function P(v, o) {
      var x1 = v[0] * cA + v[2] * sA, z1 = -v[0] * sA + v[2] * cA, x2 = x1 * cZ - v[1] * sZ, y2 = x1 * sZ + v[1] * cZ;
      o[0] = x2; o[1] = y2 * cX - z1 * sX; o[2] = y2 * sX + z1 * cX; return o;
    }
    var q = [0, 0, 0], v3 = [0, 0, 0];
    function vis(o) { return o[2] > 0 || (o[0] * o[0] + o[1] * o[1]) > 1.0; }
    function mix(c0, c1, t) { return 'rgb(' + Math.round(c0[0] + (c1[0] - c0[0]) * t) + ',' + Math.round(c0[1] + (c1[1] - c0[1]) * t) + ',' + Math.round(c0[2] + (c1[2] - c0[2]) * t) + ')'; }
    var CB = [7, 95, 255], CL = [184, 41, 255];
    function resize() {
      var r = cv.getBoundingClientRect(); var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      var p = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      if (w === W && h === H && p === pr) return false;
      W = w; H = h; pr = p; cv.width = Math.round(w * pr); cv.height = Math.round(h * pr);
      R = Math.min(w, h) / 2 / 1.28; cx = w / 2; cy = h / 2; K = Math.max(0.62, Math.min(1.8, R / 150)); return true;
    }
    function render(simT) {
      var ang = -LON0 + simT * SPIN; cA = Math.cos(ang); sA = Math.sin(ang);
      x.setTransform(pr, 0, 0, pr, 0, 0); x.clearRect(0, 0, W, H);
      var g = x.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#f4f6fd'); g.addColorStop(1, '#d5dcf2');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.fill();
      var L = geo.land, i, n = L.tint.length;
      for (var pass = 0; pass < 2; pass++) {
        x.fillStyle = pass ? 'rgb(184,41,255)' : 'rgb(7,95,255)';
        for (i = 0; i < n; i++) {
          if ((L.tint[i] > 0.5) !== (pass === 1)) continue;
          v3[0] = L.pos[i * 3]; v3[1] = L.pos[i * 3 + 1]; v3[2] = L.pos[i * 3 + 2]; P(v3, q);
          if (q[2] < 0.03) continue;
          x.globalAlpha = Math.min(0.95, 0.25 + q[2]); var s = 2.2 * K * (0.65 + 0.35 * q[2]);
          x.fillRect(cx + q[0] * R - s / 2, cy - q[1] * R - s / 2, s, s);
        }
      }
      x.globalAlpha = 1; x.lineCap = 'round';
      var o = [0, 0, 0], prev, ok, t, k, a, N = 28;
      x.lineWidth = 1; x.strokeStyle = 'rgba(110,60,255,.24)';
      for (i = 0; i < sim.n; i++) {
        a = geo.arcs[i]; x.beginPath(); prev = false;
        for (k = 0; k <= N; k++) { arcAt(a, k / N, v3); P(v3, o); ok = vis(o); if (ok) { if (prev) x.lineTo(cx + o[0] * R, cy - o[1] * R); else x.moveTo(cx + o[0] * R, cy - o[1] * R); } prev = ok; }
        x.stroke();
      }
      for (i = 0; i < sim.n; i++) {
        if (!sim.on(i)) continue;
        a = geo.arcs[i]; var h = sim.head(i), d = sim.dir(i), prevOk = false, px = 0, py = 0, M = 22;
        for (k = 0; k <= M; k++) {
          var f = k / M, tp = h - d * TRAIL * f; if (tp < 0 || tp > 1) { prevOk = false; continue; }
          arcAt(a, tp, v3); P(v3, o); ok = vis(o); var sx = cx + o[0] * R, sy = cy - o[1] * R;
          if (ok && prevOk) { x.globalAlpha = Math.pow(1 - f, 1.8); x.lineWidth = (1 + 3 * (1 - f)) * K; x.strokeStyle = mix(CB, CL, Math.min(1, (d > 0 ? tp : 1 - tp) * 0.55 + (1 - f) * 0.45)); x.beginPath(); x.moveTo(px, py); x.lineTo(sx, sy); x.stroke(); }
          px = sx; py = sy; prevOk = ok;
        }
        x.globalAlpha = 1;
        if (h >= 0 && h <= 1) { arcAt(a, h, v3); P(v3, o); if (vis(o)) { x.fillStyle = '#fff'; x.strokeStyle = mix(CB, CL, d > 0 ? h : 1 - h); x.lineWidth = 2 * K; x.beginPath(); x.arc(cx + o[0] * R, cy - o[1] * R, 3.4 * K, 0, 6.2832); x.fill(); x.stroke(); } }
      }
      for (i = 0; i < geo.nodes.length; i++) {
        P(geo.nodes[i].v, o); if (!vis(o)) continue; var sx2 = cx + o[0] * R, sy2 = cy - o[1] * R, col = geo.nodes[i].k ? CL : CB, pu = sim.pulse(i);
        if (pu >= 0) { x.globalAlpha = Math.pow(1 - pu, 1.3) * 0.85; x.strokeStyle = mix(col, col, 0); x.lineWidth = 1.5 * K; x.beginPath(); x.arc(sx2, sy2, (6 + 20 * pu) * K, 0, 6.2832); x.stroke(); x.globalAlpha = 1; }
        x.fillStyle = '#fff'; x.strokeStyle = mix(col, col, 0); x.lineWidth = 1.8 * K; x.beginPath(); x.arc(sx2, sy2, 3.2 * K, 0, 6.2832); x.fill(); x.stroke();
      }
    }
    return { resize: resize, render: render, kind: 'canvas2d' };
  }

  /* ---------- controle ---------- */
  var started = false;
  function fadeIn() { cv.style.transition = reduceMQ.matches ? 'none' : 'opacity .9s ease'; cv.style.opacity = '1'; }
  function hasWebGL2() { try { var t = document.createElement('canvas'); return !!t.getContext('webgl2'); } catch (e) { return false; } }
  function freshCanvas() { var c = document.createElement('canvas'); c.id = cv.id; if (cv.className) c.className = cv.className; cv.replaceWith(c); cv = c; cv.style.opacity = '0'; }

  function boot(T, land) {
    var rnd = rng(7);
    var nodes = buildNodes(), arcs = buildArcs(nodes);
    var geo = { nodes: nodes, arcs: arcs, land: buildLand(land, small ? 9000 : 16000, rnd) };
    var sim = makeSim(arcs, nodes.length, rng(21), small ? 8 : 12, small ? 4 : 6);
    var R = null;
    if (T && hasWebGL2()) { try { R = makeGL(T, cv, geo, sim); } catch (e) { R = null; freshCanvas(); } }
    if (!R) R = makeC2D(cv, geo, sim);
    nb.setAttribute('data-globo', R.kind);

    function setFront(ang) { var cA = Math.cos(ang), sA = Math.sin(ang), cZ = Math.cos(TILT_Z), sZ = Math.sin(TILT_Z), cX = Math.cos(TILT_X), sX = Math.sin(TILT_X); for (var n = 0; n < nodes.length; n++) { var u = nodes[n].u, x1 = u[0] * cA + u[2] * sA, z1 = -u[0] * sA + u[2] * cA, y2 = x1 * sZ + u[1] * cZ; sim.front[n] = y2 * sX + z1 * cX; } }
    var spinBase = 0, simT = 0, last = 0, raf = 0, running = false, visible = true, i;
    for (i = 0; i < 150; i++) { simT += 1 / 30; setFront(-LON0 + (simT - 5) * SPIN); sim.step(simT); }   /* já começa com feixes no ar */
    spinBase = simT;
    R.resize(); R.render(0); fadeIn();

    function tick(ts) {
      raf = requestAnimationFrame(tick);
      var dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts; simT += dt; setFront(-LON0 + (simT - spinBase) * SPIN); sim.step(simT);
      R.resize(); R.render(simT - spinBase);
    }
    function play() { if (running || reduceMQ.matches || !visible || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    function still() { stop(); R.resize(); R.render(simT - spinBase); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) play(); else stop(); }, { rootMargin: '80px' }).observe(nb);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (!running) { R.resize(); R.render(simT - spinBase); } }).observe(nb);
    else window.addEventListener('resize', function () { if (!running) { R.resize(); R.render(simT - spinBase); } });
    var onRM = function () { if (reduceMQ.matches) still(); else play(); };
    if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onRM); else if (reduceMQ.addListener) reduceMQ.addListener(onRM);
    play();
  }

  function start() {
    if (started) return; started = true;
    cv.style.opacity = '0';
    var pLand = fetch(URL_LAND).then(function (r) { if (!r.ok) throw new Error('land'); return r.json(); });
    var pThree = hasWebGL2() ? import(URL_THREE).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([pLand, pThree]).then(function (r) { boot(r[1], r[0]); }).catch(function () { /* sem dados: a área fica vazia, o texto segue intacto */ });
  }

  if ('IntersectionObserver' in window) {
    var lio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { lio.disconnect(); start(); } }, { rootMargin: '900px 0px' });
    lio.observe(nb);
  } else start();
})();
