/* Seção "Como trabalhamos" — troca entre as 3 etapas (Entender · Planejar · Executar e evoluir).
   - Seleção manual sempre disponível: botões (clique/toque), setas do teclado, deslize no painel.
   - Ao entrar na tela, o painel avança sozinho UMA vez (1 → 2 → 3). Qualquer interação do visitante cancela.
   - Sem movimento automático se o visitante prefere movimento reduzido.
   - Estado exposto em data-state="1|2|3" na <section id="como-trabalhamos">; todo o visual é CSS. */
(function(){
  'use strict';
  var root=document.getElementById('como-trabalhamos');
  if(!root) return;
  var tabs=[].slice.call(root.querySelectorAll('.ct-tab'));
  var stage=root.querySelector('.ct-stage');
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DWELL=5600; /* tempo em cada etapa durante a apresentação automática (ms) */
  var state=1,interacted=false,visible=false,timer=null;

  function set(n){
    n=Math.max(1,Math.min(3,n)); state=n;
    root.setAttribute('data-state',String(n));
    tabs.forEach(function(t,i){var on=(i+1===n);t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;});
  }
  function stop(){interacted=true;clearTimeout(timer);}
  function schedule(){
    clearTimeout(timer);
    if(interacted||reduce||!visible||state>=3) return;
    timer=setTimeout(function(){ if(interacted||!visible) return; set(state+1); schedule(); },DWELL);
  }
  function go(n,focus){ stop(); set(n); if(focus) tabs[state-1].focus(); }

  tabs.forEach(function(t,i){
    t.addEventListener('click',function(){go(i+1,false);});
    t.addEventListener('keydown',function(e){
      var k=e.key, n=null;
      if(k==='ArrowRight'||k==='ArrowDown') n=state+1;
      else if(k==='ArrowLeft'||k==='ArrowUp') n=state-1;
      else if(k==='Home') n=1; else if(k==='End') n=3;
      if(n!==null){e.preventDefault();go(n,true);}
    });
  });

  /* deslize horizontal no painel (toque) */
  if(stage){
    var sx=0,sy=0;
    stage.addEventListener('touchstart',function(e){var t=e.changedTouches[0];sx=t.clientX;sy=t.clientY;},{passive:true});
    stage.addEventListener('touchend',function(e){
      var t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;
      if(Math.abs(dx)>50&&Math.abs(dy)<40) go(state+(dx<0?1:-1),false);
    },{passive:true});
  }

  /* apresentação automática só quando o painel está visível */
  if('IntersectionObserver' in window && stage){
    new IntersectionObserver(function(es){
      visible=es[0].isIntersecting;
      if(visible) schedule(); else clearTimeout(timer);
    },{threshold:.45}).observe(stage);
  }
  set(1);
})();
