// Scroll-driven motion: word-by-word headings, staggered children, hero parallax.
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('motion');

  // Split section headings into words
  document.querySelectorAll('.reveal h2').forEach(function (h) {
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map(function (w, i) { return '<span class="w" aria-hidden="true" style="--i:' + i + '">' + w + '</span>'; }).join(' ');
  });

  // Stagger index for grouped children
  document.querySelectorAll('.stagger').forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i); });
  });

  // Hero: photo shrinks and content fades as you scroll past
  var hero = document.querySelector('.hero'), img = hero && hero.querySelector('.portrait'), inner = hero && hero.querySelector('.wrap');
  var ticking = false;
  function update() {
    ticking = false;
    if (!hero) return;
    var h = hero.offsetHeight, y = Math.min(Math.max(scrollY, 0), h), k = y / h;
    if (img) img.style.transform = 'translateY(' + (k * 40) + 'px) scale(' + (1 - k * 0.25) + ')';
    if (inner) { inner.style.opacity = String(1 - k * 0.9); inner.style.transform = 'translateY(' + (k * 60) + 'px)'; }
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();
