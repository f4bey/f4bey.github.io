// Simulated manufacturing operations dashboard with two audiences:
// Production (output vs. plan, energy per unit) and Facilities (load vs. peak limit).
// All data is generated in the browser.
(function () {
  var root = document.getElementById('ems');
  if (!root) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TICKS_PER_DAY = 720, HIST = 120, AHEAD = 40; // 1 tick = 2 simulated minutes

  function rnd(seed, i) { var x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); }
  function minuteOfDay(i) { return (i % TICKS_PER_DAY) * 2; }
  function clock(i) { var m = minuteOfDay(i); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function link(n, parent) {
    n.parent = parent;
    var h = 0; for (var i = 0; i < n.id.length; i++) h = (h * 31 + n.id.charCodeAt(i)) % 9973;
    n.seed = h;
    if (parent && n.share) { n.base = parent.base * n.share; if (parent.kw) n.kw = parent.kw * n.share; }
    (n.children || []).forEach(function (c) { link(c, n); });
    return n;
  }

  // ---------- Production view ----------
  // Three-shift plan with breaks; actual output has micro-stops and occasional downtime.
  function shiftPlan(i) {
    var m = minuteOfDay(i) % 480; // 8h shifts starting 06:00/14:00/22:00 approximated
    var brk = (m > 235 && m < 265) ? 0.15 : 1; // break mid-shift
    var change = (m < 12 || m > 470) ? 0.6 : 1; // shift handover
    return brk * change;
  }
  var PROD = link({
    id: 'p-plant', name: 'Demo Plant', type: 'Plant', base: 1200, kw: 1300, children: [
      { id: 'p-l1', name: 'Line 1 · SMT', type: 'Line', share: .30, machines: ['Printer', 'Pick & place', 'Reflow oven', 'AOI'] },
      { id: 'p-l2', name: 'Line 2 · Assembly', type: 'Line', share: .28, machines: ['Screwdriving robot', 'Press-fit', 'Labeling'] },
      { id: 'p-l3', name: 'Line 3 · Machining', type: 'Line', share: .22, machines: ['CNC centre 1', 'CNC centre 2', 'Washer'] },
      { id: 'p-l4', name: 'Line 4 · End-of-line test', type: 'Line', share: .20, machines: ['Function test', 'Packaging'] }
    ]
  }, null);
  function downtime(n, i) { // returns 0..1 availability for a line
    if (!n.parent) return null;
    var block = Math.floor(i / 30), r = rnd(n.seed + 11, block);
    if (r > 0.88) { var pos = i % 30; if (pos > 8 && pos < 8 + Math.floor(r * 30) % 12 + 4) return 0.05; }
    return 1;
  }
  function prodPlan(n, i) { return n.base * shiftPlan(i); }
  function prodActual(n, i) {
    if (n.children) return n.children.reduce(function (s, c) { return s + prodActual(c, i); }, 0);
    var a = downtime(n, i), noise = 1 + (rnd(n.seed, i) - 0.5) * 0.08 - 0.04;
    return Math.max(0, prodPlan(n, i) * a * noise);
  }
  function prodKW(n, i) { // energy draw: idle base + load proportional to output
    if (n.children) return n.children.reduce(function (s, c) { return s + prodKW(c, i); }, 0);
    var util = prodActual(n, i) / Math.max(1, n.base);
    return n.kw * (0.38 + 0.62 * util);
  }
  function lineStatus(n, i) {
    var a = downtime(n, i), p = shiftPlan(i);
    if (a !== null && a < 0.5) return { t: 'Downtime', c: 'bad' };
    if (p < 0.5) return { t: 'Break', c: 'idle' };
    return { t: 'Running', c: 'ok' };
  }
  var fmtUnits = function (v) { return Math.round(v).toLocaleString('en-US') + ' u/h'; };
  var VIEW_PROD = {
    tree: PROD, unitLabel: 'units/h', fmt: fmtUnits,
    actual: prodActual, ref: prodPlan, refLabel: 'Plan', limit: null,
    kpiLabels: ['Output now', 'Output today', 'vs. plan', 'Energy per unit'],
    kpis: function (n, t) {
      var dayStart = t - (t % TICKS_PER_DAY), units = 0, kwh = 0, plan = 0;
      for (var i = dayStart; i <= t; i++) { var a = prodActual(n, i); units += a / 30; plan += prodPlan(n, i) / 30; kwh += prodKW(n, i) / 30; }
      var dev = (units - plan) / Math.max(1, plan) * 100;
      return [fmtUnits(prodActual(n, t)), Math.round(units).toLocaleString('en-US') + ' units', (dev >= 0 ? '+' : '−') + Math.abs(dev).toFixed(1) + ' %', (kwh / Math.max(1, units)).toFixed(2) + ' kWh'];
    },
    alert: function (n, t) {
      var lines = n.children ? n.children : [n];
      var down = lines.filter(function (l) { return lineStatus(l, t).t === 'Downtime'; });
      return down.length ? (down.length === 1 ? down[0].name.split(' · ')[0] + ' down' : down.length + ' lines down') : null;
    },
    rowValue: function (c, t) { return fmtUnits(prodActual(c, t)); },
    rowShare: function (c, t) { return prodActual(c, t); },
    rowExtra: function (c, t) { var s = lineStatus(c, t); return '<em class="st ' + s.c + '">' + s.t + '</em>'; },
    leaf: function (n, t) {
      var s = lineStatus(n, t);
      return '<div class="ems-machines">' + n.machines.map(function (m, k) {
        var st = s.t === 'Running' && rnd(n.seed + k, Math.floor(t / 8)) > 0.9 ? { t: 'Micro-stop', c: 'idle' } : s;
        return '<div class="ems-machine"><span>' + m + '</span><em class="st ' + st.c + '">' + st.t + '</em></div>';
      }).join('') + '</div><p class="ems-leaf">At line level, a real system links to MES data for OEE, scrap and downtime reasons – and shows the energy cost of every stop.</p>';
    },
    note: 'Production view: output against shift plan, with energy per unit as a shared KPI.'
  };

  // ---------- Facilities view ----------
  var FAC = link({
    id: 'f-site', name: 'Demo Site', type: 'Site', base: 2400, children: [
      { id: 'f-a', name: 'Production Hall A', type: 'Building', share: .50, children: [
        { id: 'f-a1', name: 'Compressed air', type: 'System', share: .34 },
        { id: 'f-a2', name: 'HVAC & cleanroom', type: 'System', share: .30 },
        { id: 'f-a3', name: 'Process cooling', type: 'System', share: .22 },
        { id: 'f-a4', name: 'Lighting', type: 'System', share: .14 } ] },
      { id: 'f-b', name: 'Production Hall B', type: 'Building', share: .34, children: [
        { id: 'f-b1', name: 'Compressed air', type: 'System', share: .40 },
        { id: 'f-b2', name: 'HVAC', type: 'System', share: .36 },
        { id: 'f-b3', name: 'Lighting', type: 'System', share: .24 } ] },
      { id: 'f-c', name: 'Offices & Logistics', type: 'Building', share: .16, children: [
        { id: 'f-c1', name: 'HVAC', type: 'System', share: .55 },
        { id: 'f-c2', name: 'Lighting & IT', type: 'System', share: .45 } ] }
    ]
  }, null);
  function daily(i) { var d = (i % TICKS_PER_DAY) / TICKS_PER_DAY; return 0.5 - 0.5 * Math.cos((d - 0.08) * 2 * Math.PI); }
  function facForecast(n, i) { return n.base * (0.58 + 0.34 * daily(i) + 0.04 * Math.sin(i / 9 + n.seed)); }
  function facActual(n, i) {
    var noise = (rnd(n.seed, i) - 0.5) * 0.07 + (rnd(n.seed + 7, Math.floor(i / 6)) - 0.5) * 0.05;
    var spike = rnd(n.seed + 3, Math.floor(i / 25)) > 0.86 ? 0.12 * Math.sin((i % 25) / 25 * Math.PI) : 0;
    return facForecast(n, i) * (1 + noise + spike);
  }
  var fmtKW = function (v) { return v >= 1000 ? (v / 1000).toFixed(2) + ' MW' : Math.round(v) + ' kW'; };
  var VIEW_FAC = {
    tree: FAC, unitLabel: 'kW', fmt: fmtKW,
    actual: facActual, ref: facForecast, refLabel: 'Forecast', limit: function (n) { return n.base; },
    kpiLabels: ['Current load', 'Energy today', 'vs. forecast', 'Peak today'],
    kpis: function (n, t) {
      var dayStart = t - (t % TICKS_PER_DAY), e = 0, peak = 0;
      for (var i = dayStart; i <= t; i++) { var a = facActual(n, i); e += a / 30; peak = Math.max(peak, a); }
      var cur = facActual(n, t), fc = facForecast(n, t), dev = (cur - fc) / fc * 100;
      return [fmtKW(cur), (e / 1000).toFixed(1) + ' MWh', (dev >= 0 ? '+' : '−') + Math.abs(dev).toFixed(1) + ' %', fmtKW(peak)];
    },
    alert: function (n, t) { return facActual(n, t) > n.base * 0.97 ? 'Near peak limit' : null; },
    rowValue: function (c, t) { return fmtKW(facActual(c, t)); },
    rowShare: function (c, t) { return facActual(c, t); },
    rowExtra: function () { return ''; },
    leaf: function () { return '<p class="ems-leaf">System level reached. This is where facility teams spot leaks, idle consumption outside production hours and load-shifting potential.</p>'; },
    note: 'Facilities view: site load against forecast and peak limit, down to individual building systems.'
  };

  var VIEWS = { production: VIEW_PROD, facilities: VIEW_FAC };

  // ---------- State & elements ----------
  var now = new Date();
  var tick = Math.floor((now.getHours() * 60 + now.getMinutes()) / 2) + TICKS_PER_DAY * 3;
  var view = VIEW_PROD, node = view.tree, hover = null, showRef = true;
  var crumbs = root.querySelector('.ems-crumbs'), kpis = root.querySelector('.ems-kpis');
  var list = root.querySelector('.ems-list'), canvas = root.querySelector('canvas');
  var tip = root.querySelector('.ems-tip'), alertEl = root.querySelector('.ems-alert');
  var refToggle = root.querySelector('#ems-forecast'), refToggleLabel = root.querySelector('.ems-ref-label');
  var table = root.querySelector('.ems-table'), noteEl = root.querySelector('.ems-note');
  var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = 1, C = {}, rowEls = [];

  function readColors() {
    var cs = getComputedStyle(root);
    ['--g1', '--g2', '--text', '--muted', '--hair', '--bg', '--warn'].forEach(function (k) { C[k] = cs.getPropertyValue(k).trim(); });
  }
  function resize() {
    var r = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  function hexA(c, a) {
    var m = c.match(/^#([0-9a-f]{6})$/i); if (!m) return 'rgba(0,113,227,' + a + ')';
    var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function renderCrumbs() {
    var path = []; for (var n = node; n; n = n.parent) path.unshift(n);
    crumbs.innerHTML = '';
    path.forEach(function (n, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = n.name;
      if (i === path.length - 1) b.setAttribute('aria-current', 'true');
      else b.addEventListener('click', function () { go(n); });
      crumbs.appendChild(b);
      if (i < path.length - 1) { var s = document.createElement('span'); s.textContent = '›'; s.setAttribute('aria-hidden', 'true'); crumbs.appendChild(s); }
    });
  }
  function buildList() {
    list.innerHTML = ''; rowEls = [];
    var head = root.querySelector('.ems-list-head');
    if (!node.children) { head.textContent = node.type === 'Line' ? 'Machines on this line' : 'System level'; return; }
    head.textContent = 'Breakdown · click to drill down';
    node.children.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ems-row';
      b.innerHTML = '<span class="ems-row-top"><span class="ems-row-name">' + c.name + '<small>' + c.type + ' <span class="x"></span></small></span><span class="ems-row-val"></span></span><span class="ems-bar"><span></span></span>';
      b.addEventListener('click', function () { go(c); });
      list.appendChild(b);
      rowEls.push({ node: c, val: b.querySelector('.ems-row-val'), bar: b.querySelector('.ems-bar span'), x: b.querySelector('.x') });
    });
  }
  function renderList() {
    if (!node.children) { list.innerHTML = view.leaf(node, tick); return; }
    var total = rowEls.reduce(function (s, r) { return s + view.rowShare(r.node, tick); }, 0) || 1;
    rowEls.forEach(function (r) {
      r.val.textContent = view.rowValue(r.node, tick);
      r.bar.style.width = (view.rowShare(r.node, tick) / total * 100).toFixed(1) + '%';
      r.x.innerHTML = view.rowExtra(r.node, tick);
    });
  }
  function renderKPIs() {
    var vals = view.kpis(node, tick);
    kpis.querySelectorAll('div').forEach(function (d, i) { d.querySelector('span').textContent = view.kpiLabels[i]; d.querySelector('b').textContent = vals[i]; });
    var a = view.alert(node, tick); alertEl.hidden = !a; if (a) alertEl.textContent = a;
  }
  function renderTable() {
    var rows = '';
    for (var i = tick - 10; i <= tick; i += 2) rows += '<tr><td>' + clock(i) + '</td><td>' + view.fmt(view.actual(node, i)) + '</td><td>' + view.fmt(view.ref(node, i)) + '</td></tr>';
    table.querySelector('thead').innerHTML = '<tr><th>Time</th><th>Actual</th><th>' + view.refLabel + '</th></tr>';
    table.querySelector('tbody').innerHTML = rows;
  }

  function drawChart() {
    var padL = 64, padR = 14, padT = 14, padB = 28, pw = W - padL - padR, ph = H - padT - padB;
    var from = tick - HIST, to = tick + (showRef ? AHEAD : 0);
    var top = 0; for (var s = from; s <= to; s++) top = Math.max(top, view.ref(node, s), s <= tick ? view.actual(node, s) : 0);
    var lim = view.limit ? view.limit(node) : null; if (lim) top = Math.max(top, lim);
    var maxV = top * 1.15;
    var x = function (i) { return padL + (i - from) / (to - from) * pw; };
    var y = function (v) { return padT + ph - v / maxV * ph; };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = '12px Inter, -apple-system, sans-serif';
    ctx.strokeStyle = C['--hair']; ctx.lineWidth = 1; ctx.fillStyle = C['--muted']; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var v = maxV / 4 * g, yy = Math.round(y(v)) + .5;
      ctx.globalAlpha = g === 0 ? 1 : .5; ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillText(view.fmt(v), padL - 8, yy);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var i = from; i <= to; i++) if (i % 30 === 0) ctx.fillText(clock(i), x(i), H - padB + 8);
    ctx.strokeStyle = C['--hair']; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x(tick) + .5, padT); ctx.lineTo(x(tick) + .5, padT + ph); ctx.stroke(); ctx.setLineDash([]);
    if (lim) {
      ctx.strokeStyle = C['--warn']; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(padL, y(lim)); ctx.lineTo(W - padR, y(lim)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C['--muted']; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('Peak limit', padL + 6, y(lim) - 4);
    }
    if (showRef) {
      ctx.strokeStyle = C['--g1']; ctx.globalAlpha = .55; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); for (var j = from; j <= to; j++) { var fx = x(j), fy = y(view.ref(node, j)); j === from ? ctx.moveTo(fx, fy) : ctx.lineTo(fx, fy); } ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    var grad = ctx.createLinearGradient(0, padT, 0, padT + ph);
    grad.addColorStop(0, hexA(C['--g1'], .18)); grad.addColorStop(1, hexA(C['--g1'], 0));
    ctx.beginPath(); ctx.moveTo(x(from), y(0));
    for (var k = from; k <= tick; k++) ctx.lineTo(x(k), y(view.actual(node, k)));
    ctx.lineTo(x(tick), y(0)); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = C['--g1']; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); for (var k2 = from; k2 <= tick; k2++) { var ax = x(k2), ay = y(view.actual(node, k2)); k2 === from ? ctx.moveTo(ax, ay) : ctx.lineTo(ax, ay); } ctx.stroke();
    var lx = x(tick), ly = y(view.actual(node, tick));
    ctx.fillStyle = C['--bg']; ctx.beginPath(); ctx.arc(lx, ly, 6, 0, 7); ctx.fill();
    ctx.fillStyle = C['--g1']; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 7); ctx.fill();
    ctx.font = '600 12px Inter, -apple-system, sans-serif'; ctx.fillStyle = C['--text']; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('Actual', lx - 10, Math.max(padT + 14, ly - 8));
    if (showRef && W > 520) { ctx.font = '12px Inter, -apple-system, sans-serif'; ctx.fillStyle = C['--muted']; ctx.fillText(view.refLabel, W - padR - 2, y(view.ref(node, to)) - 8); }
    if (hover !== null) {
      var hi = Math.max(from, Math.min(to, Math.round(from + (hover - padL) / pw * (to - from)))), hx = x(hi);
      ctx.strokeStyle = C['--muted']; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + .5, padT); ctx.lineTo(hx + .5, padT + ph); ctx.stroke();
      var html = '<strong>' + clock(hi) + (hi > tick ? ' · ahead' : '') + '</strong>';
      if (hi <= tick) {
        var av = view.actual(node, hi);
        ctx.fillStyle = C['--bg']; ctx.beginPath(); ctx.arc(hx, y(av), 6, 0, 7); ctx.fill();
        ctx.fillStyle = C['--g1']; ctx.beginPath(); ctx.arc(hx, y(av), 4, 0, 7); ctx.fill();
        html += '<span><i class="sw"></i>Actual ' + view.fmt(av) + '</span>';
      }
      if (showRef) html += '<span><i class="sw dash"></i>' + view.refLabel + ' ' + view.fmt(view.ref(node, hi)) + '</span>';
      tip.innerHTML = html; tip.hidden = false;
      tip.style.left = Math.min(W - tip.offsetWidth - 4, Math.max(4, hx + 12)) + 'px'; tip.style.top = (padT + 6) + 'px';
    } else tip.hidden = true;
  }

  function renderAll() { renderKPIs(); renderList(); renderTable(); drawChart(); }
  function go(n) { node = n; renderCrumbs(); buildList(); renderAll(); }
  function setView(name) {
    view = VIEWS[name];
    root.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === name); });
    root.querySelector('.legend .ref').textContent = view.refLabel;
    root.querySelector('.legend .lim').hidden = !view.limit;
    refToggleLabel.textContent = 'Show ' + view.refLabel.toLowerCase();
    noteEl.textContent = view.note;
    go(view.tree);
  }

  root.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
  canvas.addEventListener('pointermove', function (e) { var r = canvas.getBoundingClientRect(); hover = e.clientX - r.left; drawChart(); });
  canvas.addEventListener('pointerleave', function () { hover = null; drawChart(); });
  refToggle.addEventListener('change', function () { showRef = refToggle.checked; drawChart(); });

  readColors(); resize(); setView('production');
  addEventListener('resize', function () { resize(); drawChart(); });

  var running = false, timer = null;
  new IntersectionObserver(function (es) {
    if (es[0].isIntersecting && !running && !reduce) { running = true; timer = setInterval(function () { tick++; renderAll(); }, 1500); }
    else if (!es[0].isIntersecting && running) { running = false; clearInterval(timer); }
  }, { threshold: .1 }).observe(root);
})();
