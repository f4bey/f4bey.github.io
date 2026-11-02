// Spotlight-style command palette (Cmd/Ctrl + K)
(function () {
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var ICON = {
    go: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
  };
  function section(id) { return function () { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }); }; }
  function mode(m) { return function () { var b = document.querySelector('.mode button[data-mode="' + m + '"]'); if (b) b.click(); }; }
  var CMDS = [
    { group: 'Navigate', label: 'About', icon: 'go', run: section('about'), keys: 'profile bio' },
    { group: 'Navigate', label: 'Global footprint', icon: 'globe', run: section('impact'), keys: 'globe map world regions' },
    { group: 'Navigate', label: 'Focus areas', icon: 'go', run: section('focus'), keys: 'value expertise' },
    { group: 'Navigate', label: 'Energy dashboard demo', icon: 'bolt', run: section('demo'), keys: 'ems live chart energy' },
    { group: 'Navigate', label: 'Experience', icon: 'go', run: section('experience'), keys: 'career cv jobs bosch porsche' },
    { group: 'Navigate', label: 'Education', icon: 'go', run: section('education'), keys: 'university degree master' },
    { group: 'Navigate', label: 'Skills', icon: 'go', run: section('skills'), keys: 'toolbox languages' },
    { group: 'Navigate', label: 'Contact', icon: 'mail', run: section('contact'), keys: 'message email form' },
    { group: 'Mode', label: 'Switch to Personal mode', icon: 'user', run: mode('personal'), keys: 'private sport dog travel hobbies' },
    { group: 'Mode', label: 'Switch to Professional mode', icon: 'user', run: mode('professional'), keys: 'work business' },
    { group: 'Actions', label: 'Open LinkedIn profile', icon: 'link', run: function () { window.open('https://www.linkedin.com/in/fabianschuerg', '_blank', 'noopener'); }, keys: 'social network' },
    { group: 'Actions', label: 'Write me a message', icon: 'mail', run: function () { section('contact')(); setTimeout(function () { var f = document.getElementById('f-name'); if (f) f.focus({ preventScroll: true }); }, 700); }, keys: 'contact email' },
    { group: 'Actions', label: 'Copy link to this page', icon: 'copy', run: function () { if (navigator.clipboard) navigator.clipboard.writeText(location.origin + location.pathname); }, keys: 'share url' },
    { group: 'Actions', label: 'Privacy policy', icon: 'shield', run: function () { location.href = 'privacy.html'; }, keys: 'gdpr data' }
  ];

  var overlay = document.createElement('div');
  overlay.className = 'cmdk'; overlay.hidden = true;
  overlay.innerHTML =
    '<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command menu">' +
      '<div class="cmdk-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input type="text" placeholder="Search or jump to…" aria-label="Search commands" autocomplete="off" spellcheck="false"><kbd>esc</kbd></div>' +
      '<div class="cmdk-list" role="listbox"></div>' +
      '<div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>' + (isMac ? '⌘' : 'Ctrl') + '</kbd><kbd>K</kbd> toggle</span></div>' +
    '</div>';
  document.body.appendChild(overlay);
  var input = overlay.querySelector('input'), listEl = overlay.querySelector('.cmdk-list');
  var items = [], active = 0, lastFocus = null;

  function score(c, q) {
    if (!q) return 1;
    var hay = (c.label + ' ' + c.keys + ' ' + c.group).toLowerCase(), qi = 0, s = 0, run = 0;
    if (hay.indexOf(q) > -1) return 100 - hay.indexOf(q);
    for (var i = 0; i < hay.length && qi < q.length; i++) { if (hay[i] === q[qi]) { qi++; run++; s += run; } else run = 0; }
    return qi === q.length ? s : 0;
  }
  function render() {
    var q = input.value.trim().toLowerCase();
    items = CMDS.map(function (c) { return { c: c, s: score(c, q) }; }).filter(function (x) { return x.s > 0; });
    if (q) items.sort(function (a, b) { return b.s - a.s; });
    active = Math.min(active, Math.max(0, items.length - 1));
    var html = '', g = null;
    items.forEach(function (x, i) {
      if (!q && x.c.group !== g) { g = x.c.group; html += '<div class="cmdk-group">' + g + '</div>'; }
      html += '<div class="cmdk-item' + (i === active ? ' on' : '') + '" role="option" aria-selected="' + (i === active) + '" data-i="' + i + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[x.c.icon] + '</svg><span>' + x.c.label + '</span></div>';
    });
    listEl.innerHTML = html || '<div class="cmdk-empty">No results</div>';
    var on = listEl.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function open() { lastFocus = document.activeElement; overlay.hidden = false; requestAnimationFrame(function () { overlay.classList.add('show'); }); input.value = ''; active = 0; render(); input.focus(); document.documentElement.style.overflow = 'hidden'; }
  function close() { overlay.classList.remove('show'); document.documentElement.style.overflow = ''; setTimeout(function () { overlay.hidden = true; }, 180); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  function exec(i) { var x = items[i]; if (!x) return; close(); setTimeout(x.c.run, 60); }

  input.addEventListener('input', function () { active = 0; render(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, items.length); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(1, items.length); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  listEl.addEventListener('mousemove', function (e) { var it = e.target.closest('.cmdk-item'); if (it && +it.dataset.i !== active) { active = +it.dataset.i; render(); } });
  listEl.addEventListener('click', function (e) { var it = e.target.closest('.cmdk-item'); if (it) exec(+it.dataset.i); });
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay.hidden ? open() : close(); }
  });
  var trigger = document.getElementById('cmdk-open');
  if (trigger) {
    trigger.querySelector('kbd').textContent = isMac ? '⌘K' : 'Ctrl K';
    trigger.addEventListener('click', open);
  }
})();
