/* Seção Cases — portfólio editorial: um case por vez, com virada de página.
   - Usa os <article class="case"> que já existem no HTML (nada é recriado).
   - Desktop/tablet: a página atual gira em torno da borda esquerda (CSS 3D, perspective) com sombra de dobra,
     revelando o próximo case por baixo. Voltar faz o caminho inverso.
   - Mobile (≤700px): deslocamento lateral + leve rotação + fade. Suporte a deslize (swipe).
   - Movimento reduzido: troca simples, sem 3D.
   - Sem autoplay, sem captura de scroll, sem navegação circular. Web Animations API (nenhuma biblioteca). */
(function(){
  'use strict';
  var book=document.querySelector('#cases .cases');
  if(!book) return;
  var pages=[].slice.call(book.querySelectorAll('.case'));
  var total=pages.length; if(total<2) return;
  var mqReduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqMobile=window.matchMedia('(max-width: 700px)');
  var idx=0,busy=false;
  var pad=function(n){return (n<10?'0':'')+n;};

  /* controles */
  var nav=document.createElement('div'); nav.className='cs-nav';
  nav.innerHTML='<p class="cs-count" aria-live="polite" aria-atomic="true" style="margin:0"><b></b> / '+pad(total)+'</p>'+
    '<div class="cs-btns">'+
    '<button type="button" class="cs-btn cs-prev" aria-label="Case anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>'+
    '<button type="button" class="cs-btn cs-next" aria-label="Próximo case"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>';
  book.parentNode.insertBefore(nav,book.nextSibling);
  var shade=document.createElement('div'); shade.className='cs-shade'; shade.setAttribute('aria-hidden','true'); book.appendChild(shade);
  var count=nav.querySelector('b'),prev=nav.querySelector('.cs-prev'),next=nav.querySelector('.cs-next');

  pages.forEach(function(p,i){ p.setAttribute('role','group'); p.setAttribute('aria-roledescription','página'); p.setAttribute('aria-label','Case '+(i+1)+' de '+total); });

  function show(i){
    pages.forEach(function(p,k){
      var on=(k===i);
      p.classList.toggle('is-current',on); p.classList.remove('is-turning');
      p.style.zIndex=on?'2':'';
      if(on){p.removeAttribute('inert');p.removeAttribute('aria-hidden');} else {p.setAttribute('inert','');p.setAttribute('aria-hidden','true');}
    });
    count.textContent=pad(i+1); prev.disabled=(i===0); next.disabled=(i===total-1);
  }

  function anim(el,frames,opts){ try{return el.animate(frames,opts);}catch(e){return null;} }

  function go(to){
    if(busy||to<0||to>=total||to===idx) return;
    var from=pages[idx],target=pages[to],fwd=to>idx,dur=mqMobile.matches?600:820;
    idx=to;
    count.textContent=pad(to+1); prev.disabled=(to===0); next.disabled=(to===total-1);
    if(mqReduce.matches||!from.animate){ show(to); return; }
    busy=true;
    var turning=fwd?from:target;   /* a página que gira fica por cima */
    var below=fwd?target:from;
    below.classList.add('is-turning'); turning.classList.add('is-turning');
    below.style.zIndex='1'; turning.style.zIndex='3';
    below.removeAttribute('inert'); target.removeAttribute('inert');
    var ease='cubic-bezier(.55,.06,.25,1)',a=[];
    if(mqMobile.matches){
      var s=fwd?1:-1;
      a.push(anim(from,[{transform:'none',opacity:1},{transform:'translateX('+(-s*9)+'%) rotate('+(-s*1.6)+'deg)',opacity:0}],{duration:dur,easing:ease,fill:'forwards'}));
      a.push(anim(target,[{transform:'translateX('+(s*9)+'%) rotate('+(s*1.6)+'deg)',opacity:0},{transform:'none',opacity:1}],{duration:dur,easing:ease,fill:'forwards'}));
    }else{
      /* página que gira: borda esquerda como dobradiça */
      var rot=fwd?[{transform:'rotateY(0deg)',opacity:1},{transform:'rotateY(-52deg)',opacity:1,offset:.62},{transform:'rotateY(-84deg)',opacity:0}]
                 :[{transform:'rotateY(-84deg)',opacity:0},{transform:'rotateY(-52deg)',opacity:1,offset:.38},{transform:'rotateY(0deg)',opacity:1}];
      a.push(anim(turning,rot,{duration:dur,easing:fwd?ease:'cubic-bezier(.25,.06,.45,1)',fill:'forwards'}));
      /* página de baixo: acomoda-se em profundidade */
      var sett=fwd?[{transform:'scale(.965) translateZ(-30px)',filter:'brightness(.93)'},{transform:'none',filter:'none'}]
                  :[{transform:'none',filter:'none'},{transform:'scale(.965) translateZ(-30px)',filter:'brightness(.93)'}];
      a.push(anim(below,sett,{duration:dur,easing:'ease',fill:'forwards'}));
      a.push(anim(shade,[{opacity:0},{opacity:.95,offset:.45},{opacity:0}],{duration:dur,easing:'ease-in-out'}));
    }
    var done=0,need=a.filter(Boolean).length;
    function end(){
      a.forEach(function(x){ if(x) x.cancel(); });
      show(to); busy=false;
    }
    a.forEach(function(x){ if(x) x.onfinish=function(){ if(++done>=need) end(); }; });
    if(!need) end();
  }

  next.addEventListener('click',function(){go(idx+1);});
  prev.addEventListener('click',function(){go(idx-1);});

  /* teclado: setas funcionam com o foco dentro da área de cases */
  var sec=document.getElementById('cases');
  sec.addEventListener('keydown',function(e){
    if(e.altKey||e.ctrlKey||e.metaKey) return;
    if(e.key==='ArrowRight'){ e.preventDefault(); go(idx+1); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); go(idx-1); }
  });

  /* swipe horizontal (celular/tablet) sem bloquear a rolagem vertical */
  var sx=0,sy=0;
  book.addEventListener('touchstart',function(e){var t=e.changedTouches[0];sx=t.clientX;sy=t.clientY;},{passive:true});
  book.addEventListener('touchend',function(e){
    var t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dx)>55&&Math.abs(dy)<45) go(idx+(dx<0?1:-1));
  },{passive:true});

  show(0);
})();
