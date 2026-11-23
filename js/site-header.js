/* Cabeçalho padrão da Humanize: fundo ao rolar + painel de navegação lateral */
(function () {
  'use strict';
  var header = document.getElementById('siteHeader');
  var toggle = document.getElementById('menuToggle');
  var panel = document.getElementById('menuPanel');
  var overlay = document.getElementById('mpOverlay');
  var closeBtn = document.getElementById('mpClose');
  if (!header || !toggle || !panel || !overlay || !closeBtn) return;

  function onScroll() { header.classList.toggle('is-stuck', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var behind = [header, document.querySelector('main'), document.querySelector('footer')].filter(Boolean);
  function isOpen() { return panel.classList.contains('is-open'); }
  function apply(open) {
    panel.classList.toggle('is-open', open);
    overlay.classList.toggle('is-open', open);
    if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    behind.forEach(function (el) { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
    document.body.classList.toggle('is-locked', open);
  }
  function setOpen(open) { apply(open); if (open) closeBtn.focus(); else toggle.focus(); }
  function closeMenu() { if (isOpen()) setOpen(false); }

  toggle.addEventListener('click', function () { setOpen(!isOpen()); });
  closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);
  /* ao escolher um link, fecha sem devolver o foco ao botão, para a rolagem seguir o link */
  panel.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { apply(false); }); });
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key === 'Tab') {
      var f = panel.querySelectorAll('a[href],button'), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
