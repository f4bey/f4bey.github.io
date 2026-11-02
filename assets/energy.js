// Simulated energy-management dashboard. All data is generated in the browser.
(function () {
  var root = document.getElementById('ems');
  if (!root) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Hierarchy (shares of parent load) ----
  var TREE = {
    id: 'plant', name: 'Demo Plant', type: 'Plant', base: 2400, children: [
      { id: 'hallA', name: 'Production Hall A', type: 'Building', share: .55, children: [
        { id: 'l1', name: 'Line 1 · SMT', type: 'Line', share: .42, children: [
          { id: 'm1', name: 'Reflow oven', type: 'Machine', share: .48 },
          { id: 'm2', name: 'Pick & place', type: 'Machine', share: .30 },
          { id: 'm3', name: 'Inspection (AOI)', type: 'Machine', share: .22 } ] },
        { id: 'l2', name: 'Line 2 · Assembly', type: 'Line', share: .33, children: [
          { id: 'm4', name: 'Screwdriving robots', type: 'Machine', share: .40 },
          { id: 'm5', name: 'Press-fit station', type: 'Machine', share: .35 },
          { id: 'm6', name: 'End-of-line test', type: 'Machine', share: .25 } ] },
        { id: 'l3', name: 'Compressed air', type: 'Line', share: .25, children: [
          { id: 'm7', name: 'Compressor 1', type: 'Machine', share: .55 },
          { id: 'm8', name: 'Compressor 2', type: 'Machine', share: .45 } ] } ] },
      { id: 'hallB', name: 'Production Hall B', type: 'Building', share: .30, children: [
        { id: 'l4', name: 'Line 3 · Machining', type: 'Line', share: .60, children: [
          { id: 'm9', name: 'CNC centre 1', type: 'Machine', share: .5 },
          { id: 'm10', name: 'CNC centre 2', type: 'Machine', share: .5 } ] },
        { id: 'l5', name: 'Paint shop', type: 'Line', share: .40, children: [
          { id: 'm11', name: 'Curing oven', type: 'Machine', share: .65 },
          { id: 'm12', name: 'Spray booth', type: 'Machine', share: .35 } ] } ] },
      { id: 'util', name: 'Offices & Utilities', type: 'Building', share: .15, children: [
        { id: 'u1', name: 'HVAC', type: 'Line', share: .6 },
        { id: 'u2', name: 'Lighting & IT', type: 'Line', share: .4 } ] }
    ]
  };
  (function link(n, parent) {
    n.parent = parent;
    if (parent) n.base = parent.base * n.share;
    var h = 0; for (var i = 0; i < n.id.length; i++) h = (h * 31 + n.id.charCodeAt(i)) % 9973;
    n.seed = h;
    (n.children || []).forEach(function (c) { link(c, n); });
  })(TREE, null);

  // ---- Signal model: 1 tick = 2 simulated minutes ----
  var TICKS_PER_DAY = 720, HIST = 120, AHEAD = 40;
  function rnd(seed, i) { var x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); }
  function daily(i) { var d = (i % TICKS_PER_DAY) / TICKS_PER_DAY; return 0.5 - 0.5 * Math.cos((d - 0.08) * 2 * Math.PI); }
  function forecast(n, i) { return n.base * (0.58 + 0.34 * daily(i) + 0.04 * Math.sin(i / 9 + n.seed)); }
  function actual(n, i) {
    var noise = (rnd(n.seed, i) - 0.5) * 0.07 + (rnd(n.seed + 7, Math.floor(i / 6)) - 0.5) * 0.05;
    var spike = rnd(n.seed + 3, Math.floor(i / 25)) > 0.86 ? 0.12 * Math.sin((i % 25) / 25 * Math.PI) : 0;
    return forecast(n, i) * (1 + noise + spike);
  }
  function limit(n) { return n.base * 1.0; }

  // ---- State ----
  var now = new Date(); var startTick = Math.floor((now.getHours() * 60 + now.getMinutes()) / 2) + TICKS_PER_DAY * 3;
  var tick = startTick, node = TREE, hover = null, showForecast = true;

  // ---- Elements ----
  var crumbs = root.querySelector('.ems-crumbs'), kpis = root.querySelector('.ems-kpis');
  var list = root.querySelector('.ems-list'), canvas = root.querySelector('canvas');
  var tip = root.querySelector('.ems-tip'), alertEl = root.querySelector('.ems-alert');
  var fcToggle = root.querySelector('#ems-forecast'), table = root.querySelector('.ems-table tbody');
  var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = 1, C = {};

  function readColors() {
    var cs = getComputedStyle(root);
    ['--g1', '--g2', '--text', '--muted', '--hair', '--bg', '--warn'].forEach(function (k) { C[k] = cs.getPropertyValue(k).trim(); });
  }
  function resize() {
    var r = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  function fmtKW(v) { return v >= 1000 ? (v / 1000).toFixed(2) + ' MW' : Math.round(v) + ' kW'; }
  function clock(i) { var m = (i % TICKS_PER_DAY) * 2; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

  // ---- Render pieces ----
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
  var rowEls = [];
  function buildList() {
    list.innerHTML = ''; rowEls = [];
    var head = root.querySelector('.ems-list-head');
    if (!node.children) {
      head.textContent = 'Machine level';
      list.innerHTML = '<p class="ems-leaf">You\'ve reached the most granular level. In a real system this is where shutdown and over-consumption analyses start.</p>';
      return;
    }
    head.textContent = 'Breakdown · click to drill down';
    node.children.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ems-row';
      b.innerHTML = '<span class="ems-row-top"><span class="ems-row-name">' + c.name + '<small>' + c.type + '</small></span><span class="ems-row-val"></span></span>' +
        '<span class="ems-bar"><span></span></span>';
      b.addEventListener('click', function () { go(c); });
      list.appendChild(b);
      rowEls.push({ node: c, val: b.querySelector('.ems-row-val'), bar: b.querySelector('.ems-bar span') });
    });
  }
  function renderList() {
    if (!rowEls.length) return;
    var total = rowEls.reduce(function (s, r) { return s + actual(r.node, tick); }, 0);
    rowEls.forEach(function (r) {
      var v = actual(r.node, tick);
      r.val.textContent = fmtKW(v);
      r.bar.style.width = (v / total * 100).toFixed(1) + '%';
    });
  }
  function renderKPIs() {
    var cur = actual(node, tick), fc = forecast(node, tick);
    var dayStart = tick - (tick % TICKS_PER_DAY), energy = 0, peak = 0;
    for (var i = dayStart; i <= tick; i++) { var a = actual(node, i); energy += a * (2 / 60); peak = Math.max(peak, a); }
    var dev = (cur - fc) / fc * 100;
    var vals = [fmtKW(cur), (energy / 1000).toFixed(1) + ' MWh', (dev >= 0 ? '+' : '−') + Math.abs(dev).toFixed(1) + ' %', fmtKW(peak)];
    kpis.querySelectorAll('b').forEach(function (b, i) { b.textContent = vals[i]; });
    var near = cur > limit(node) * 0.97;
    alertEl.hidden = !near;
  }
  function renderTable() {
    var rows = '';
    for (var i = tick - 10; i <= tick; i += 2) rows += '<tr><td>' + clock(i) + '</td><td>' + fmtKW(actual(node, i)) + '</td><td>' + fmtKW(forecast(node, i)) + '</td></tr>';
    table.innerHTML = rows;
  }

  function drawChart() {
    var padL = 56, padR = 14, padT = 14, padB = 28;
    var pw = W - padL - padR, ph = H - padT - padB;
    var from = tick - HIST, to = tick + (showForecast ? AHEAD : 0);
    var lim = limit(node), maxV = lim * 1.15, minV = 0;
    var x = function (i) { return padL + (i - from) / (to - from) * pw; };
    var y = function (v) { return padT + ph - (v - minV) / (maxV - minV) * ph; };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = '12px Inter, -apple-system, sans-serif';

    // grid + y labels
    ctx.strokeStyle = C['--hair']; ctx.lineWidth = 1; ctx.fillStyle = C['--muted']; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var v = maxV / 4 * g, yy = Math.round(y(v)) + .5;
      ctx.globalAlpha = g === 0 ? 1 : .5; ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillText(fmtKW(v), padL - 8, yy);
    }
    // x labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var i = from; i <= to; i++) if (i % 30 === 0) ctx.fillText(clock(i), x(i), H - padB + 8);

    // now marker
    ctx.strokeStyle = C['--hair']; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x(tick) + .5, padT); ctx.lineTo(x(tick) + .5, padT + ph); ctx.stroke(); ctx.setLineDash([]);

    // peak limit
    ctx.strokeStyle = C['--warn']; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(padL, y(lim)); ctx.lineTo(W - padR, y(lim)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C['--muted']; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('Peak limit', padL + 6, y(lim) - 4);

    // forecast (dashed) over full range
    if (showForecast) {
      ctx.strokeStyle = C['--g1']; ctx.globalAlpha = .55; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); for (var j = from; j <= to; j++) { var fx = x(j), fy = y(forecast(node, j)); j === from ? ctx.moveTo(fx, fy) : ctx.lineTo(fx, fy); } ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // actual area + line
    var grad = ctx.createLinearGradient(0, padT, 0, padT + ph);
    grad.addColorStop(0, hexA(C['--g1'], .18)); grad.addColorStop(1, hexA(C['--g1'], 0));
    ctx.beginPath(); ctx.moveTo(x(from), y(0));
    for (var k = from; k <= tick; k++) ctx.lineTo(x(k), y(actual(node, k)));
    ctx.lineTo(x(tick), y(0)); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = C['--g1']; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); for (var k2 = from; k2 <= tick; k2++) { var ax = x(k2), ay = y(actual(node, k2)); k2 === from ? ctx.moveTo(ax, ay) : ctx.lineTo(ax, ay); } ctx.stroke();
    // live dot
    var lx = x(tick), ly = y(actual(node, tick));
    ctx.fillStyle = C['--bg']; ctx.beginPath(); ctx.arc(lx, ly, 6, 0, 7); ctx.fill();
    ctx.fillStyle = C['--g1']; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 7); ctx.fill();

    // direct labels
    ctx.font = '600 12px Inter, -apple-system, sans-serif'; ctx.fillStyle = C['--text']; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('Actual', lx - 10, ly - 8);
    if (showForecast && W > 520) { ctx.font = '12px Inter, -apple-system, sans-serif'; ctx.fillStyle = C['--muted']; ctx.textAlign = 'right'; ctx.fillText('Forecast', W - padR - 2, y(forecast(node, to)) - 8); }

    // hover crosshair
    if (hover !== null) {
      var hi = Math.round(from + (hover - padL) / pw * (to - from));
      hi = Math.max(from, Math.min(to, hi));
      var hx = x(hi);
      ctx.strokeStyle = C['--muted']; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + .5, padT); ctx.lineTo(hx + .5, padT + ph); ctx.stroke();
      var html = '<strong>' + clock(hi) + (hi > tick ? ' · forecast' : '') + '</strong>';
      if (hi <= tick) {
        var av = actual(node, hi);
        ctx.fillStyle = C['--bg']; ctx.beginPath(); ctx.arc(hx, y(av), 6, 0, 7); ctx.fill();
        ctx.fillStyle = C['--g1']; ctx.beginPath(); ctx.arc(hx, y(av), 4, 0, 7); ctx.fill();
        html += '<span><i class="sw solid"></i>Actual ' + fmtKW(av) + '</span>';
      }
      if (showForecast) html += '<span><i class="sw dash"></i>Forecast ' + fmtKW(forecast(node, hi)) + '</span>';
      tip.innerHTML = html; tip.hidden = false;
      var tw = tip.offsetWidth; tip.style.left = Math.min(W - tw - 4, Math.max(4, hx + 12)) + 'px'; tip.style.top = (padT + 6) + 'px';
    } else tip.hidden = true;
  }
  function hexA(c, a) {
    var m = c.match(/^#([0-9a-f]{6})$/i); if (!m) return 'rgba(0,113,227,' + a + ')';
    var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function renderAll() { renderKPIs(); renderList(); renderTable(); drawChart(); }
  function go(n) { node = n; renderCrumbs(); buildList(); renderAll(); }

  canvas.addEventListener('pointermove', function (e) { var r = canvas.getBoundingClientRect(); hover = e.clientX - r.left; drawChart(); });
  canvas.addEventListener('pointerleave', function () { hover = null; drawChart(); });
  fcToggle.addEventListener('change', function () { showForecast = fcToggle.checked; drawChart(); });

  readColors(); resize(); go(TREE);
  addEventListener('resize', function () { resize(); drawChart(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { readColors(); drawChart(); });

  var running = false, timer = null;
  new IntersectionObserver(function (es) {
    if (es[0].isIntersecting && !running && !reduce) {
      running = true; timer = setInterval(function () { tick++; renderAll(); }, 1500);
    } else if (!es[0].isIntersecting && running) { running = false; clearInterval(timer); }
  }, { threshold: .1 }).observe(root);
})();
