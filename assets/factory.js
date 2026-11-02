// Animated isometric plant for the hero. Pure SVG + requestAnimationFrame, no dependencies.
(function () {
  var host = document.getElementById('plant');
  if (!host) return;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var U = 14, CX = Math.cos(Math.PI / 6), SY = 0.5;

  // ---------- iso helpers ----------
  function P(x, y, z) { return [(x - y) * CX * U, (x + y) * SY * U - (z || 0) * U]; }
  function pts(arr) { return arr.map(function (p) { var q = P(p[0], p[1], p[2]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '); }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function poly(parent, arr, cls) { return el('polygon', { points: pts(arr), 'class': cls }, parent); }
  // material = prefix of CSS classes: m-<name>-t / -l / -r
  function box(parent, x, y, z, w, d, h, mat) {
    var g = el('g', {}, parent);
    poly(g, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], 'm-' + mat + '-l');
    poly(g, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], 'm-' + mat + '-r');
    poly(g, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], 'm-' + mat + '-t');
    return g;
  }
  function mover(parent) { var g = el('g', {}, parent); g.at = function (x, y, z) { var a = P(x, y, z), o = P(0, 0, 0); g.setAttribute('transform', 'translate(' + (a[0] - o[0]).toFixed(1) + ',' + (a[1] - o[1]).toFixed(1) + ')'); }; return g; }
  function zone(name) { var g = el('g', { 'class': 'zone', 'data-zone': name }, svg); return g; }

  // ---------- canvas ----------
  var corners = [P(-2, -3, 6), P(46, -3, 6), P(46, 31, 0), P(-2, 31, 0), P(-2, -3, 0), P(46, -3, 0)];
  var minX = Math.min.apply(null, corners.map(function (c) { return c[0]; })), maxX = Math.max.apply(null, corners.map(function (c) { return c[0]; }));
  var minY = Math.min.apply(null, corners.map(function (c) { return c[1]; })), maxY = Math.max.apply(null, corners.map(function (c) { return c[1]; }));
  var svg = el('svg', { viewBox: [minX, minY, maxX - minX, maxY - minY].map(function (v) { return v.toFixed(0); }).join(' '), role: 'img', 'aria-label': 'Animated illustration of a smart factory with production lines, robots, warehouse, trucks, solar panels and battery storage' }, host);
  var defs = el('defs', {}, svg);
  var lg = el('linearGradient', { id: 'pvShine', x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
  el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0' }, lg);
  el('stop', { offset: '.5', 'stop-color': '#fff', 'stop-opacity': '.55' }, lg);
  el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0' }, lg);

  // ground plate
  var ground = el('g', {}, svg);
  box(ground, -1, -1, -0.6, 46, 31, 0.6, 'ground');
  // road (right side) and apron
  poly(ground, [[39.6, -1, 0.01], [44.6, -1, 0.01], [44.6, 30, 0.01], [39.6, 30, 0.01]], 'road');
  for (var r = 0; r < 30; r += 3) poly(ground, [[42, r, .02], [42.2, r, .02], [42.2, r + 1.6, .02], [42, r + 1.6, .02]], 'road-mark');
  poly(ground, [[37.6, 8.6, 0.015], [39.6, 8.6, 0.015], [39.6, 13.4, 0.015], [37.6, 13.4, 0.015]], 'apron');

  // ---------- PRODUCTION HALL ----------
  var zProd = zone('production');
  box(zProd, 2, 2, 0, 20, 12, 0.25, 'floor');
  box(zProd, 2, 1.6, 0, 20, 0.4, 4.2, 'wall');      // back wall
  box(zProd, 1.6, 1.6, 0, 0.4, 12.4, 4.2, 'wall');  // left wall
  // wall windows
  for (var wx = 4; wx < 21; wx += 3) poly(zProd, [[wx, 2.001, 2.4], [wx + 1.8, 2.001, 2.4], [wx + 1.8, 2.001, 3.6], [wx, 2.001, 3.6]], 'window');
  // floor markings (aisle)
  poly(zProd, [[3, 11.6, .26], [21.5, 11.6, .26], [21.5, 11.75, .26], [3, 11.75, .26]], 'mark');
  poly(zProd, [[3, 13.6, .26], [21.5, 13.6, .26], [21.5, 13.75, .26], [3, 13.75, .26]], 'mark');
  // conveyors
  var LINES = [5, 9];
  LINES.forEach(function (ly) {
    box(zProd, 3.5, ly, .25, 17.5, 1, .55, 'conv');
    for (var lx = 4; lx < 21; lx += 1.5) poly(zProd, [[lx, ly, .81], [lx + .08, ly, .81], [lx + .08, ly + 1, .81], [lx, ly + 1, .81]], 'conv-slat');
  });
  // parcels (moving)
  var parcels = [];
  LINES.forEach(function (ly, li) {
    for (var k = 0; k < 7; k++) {
      var m = mover(zProd); box(m, 0, 0, 0, .6, .6, .5, li ? 'parcel2' : 'parcel'); parcels.push({ m: m, y: ly + .2, off: k / 7, li: li });
    }
  });
  // stations over the lines (drawn after parcels so parcels pass "through")
  var STATIONS = [[7.5, 2.2], [12.5, 1.6], [17, 2.4]];
  var stationGlow = [];
  LINES.forEach(function (ly) {
    STATIONS.forEach(function (s, si) {
      box(zProd, s[0], ly - .35, .25, s[1], 1.7, 1.9, 'machine');
      var led = poly(zProd, [[s[0] + s[1] - .7, ly + 1.351, 1.55], [s[0] + s[1] - .25, ly + 1.351, 1.55], [s[0] + s[1] - .25, ly + 1.351, 1.8], [s[0] + s[1] - .7, ly + 1.351, 1.8]], 'led ok');
      stationGlow.push(led);
      poly(zProd, [[s[0] + .25, ly + 1.351, .7], [s[0] + s[1] - .9, ly + 1.351, .7], [s[0] + s[1] - .9, ly + 1.351, 1.5], [s[0] + .25, ly + 1.351, 1.5]], 'screen');
    });
  });
  // robot arms between the lines
  var robots = [];
  [[10.6, 7.5], [15.6, 7.5]].forEach(function (rp, i) {
    box(zProd, rp[0] - .45, rp[1] - .45, .25, .9, .9, .5, 'robot-base');
    var g = el('g', { 'class': 'arm' }, zProd);
    var a1 = el('line', { 'class': 'arm-seg' }, g), a2 = el('line', { 'class': 'arm-seg thin' }, g);
    var j1 = el('circle', { r: 3.2, 'class': 'arm-joint' }, g), j2 = el('circle', { r: 2.6, 'class': 'arm-joint' }, g), tip = el('circle', { r: 2.2, 'class': 'arm-tip' }, g);
    robots.push({ x: rp[0], y: rp[1], a1: a1, a2: a2, j1: j1, j2: j2, tip: tip, ph: i * 1.7 });
  });
  // AGVs on the aisle
  var agvs = [];
  for (var a = 0; a < 2; a++) {
    var m = mover(zProd); box(m, 0, 0, 0, 1.3, .8, .35, 'agv'); var load = mover(m); box(load, .3, .1, .35, .6, .6, .5, 'parcel');
    agvs.push({ m: m, load: load, off: a * .5 });
  }

  // ---------- WAREHOUSE ----------
  var zWh = zone('warehouse');
  box(zWh, 24, 2, 0, 14, 12, 0.25, 'floor');
  box(zWh, 24, 1.6, 0, 14, 0.4, 5, 'wall');
  box(zWh, 23.6, 1.6, 0, 0.4, 12.4, 5, 'wall');
  // racks
  [3, 5.8].forEach(function (ry) {
    for (var rx = 25; rx < 36; rx += 2.2) {
      box(zWh, rx, ry, .25, .15, 1.2, 3.6, 'rack'); // upright
      for (var lvl = 0; lvl < 3; lvl++) {
        box(zWh, rx, ry, .25 + lvl * 1.2 + .9, 2.2, 1.2, .08, 'rack');
        if ((rx * 7 + lvl * 3 + ry) % 5 > 1) box(zWh, rx + .35, ry + .2, .25 + lvl * 1.2 + .98, 1.3, .8, .7, (lvl + rx) % 2 ? 'parcel' : 'parcel2');
      }
    }
  });
  poly(zWh, [[25, 8.6, .26], [37.5, 8.6, .26], [37.5, 8.75, .26], [25, 8.75, .26]], 'mark');
  // dock doors on right edge
  box(zWh, 37.7, 9.2, 0, .3, 4, .9, 'dock');
  // forklift
  var fork = mover(zWh); box(fork, 0, 0, 0, 1.4, .9, .6, 'forklift'); box(fork, .2, .15, .6, .6, .6, .6, 'forklift'); box(fork, 1.4, .05, 0, .12, .8, 1.5, 'mast');
  var forkLoad = mover(fork); box(forkLoad, 1.55, .1, .25, .7, .7, .55, 'parcel');

  // ---------- TRUCK ----------
  var zTruck = zone('warehouse');
  var truck = mover(zTruck);
  [[1.2], [5.2], [7.9]].forEach(function (wy) { box(truck, .15, wy[0], 0, 2.0, .7, .45, 'wheel'); });
  box(truck, 0, 0, .35, 2.3, 7, 2.5, 'trailer');
  box(truck, .1, 7.1, .35, 2.1, 1.9, 1.9, 'cab');
  poly(truck, [[.25, 9.001, 1.35], [2.05, 9.001, 1.35], [2.05, 9.001, 2.05], [.25, 9.001, 2.05]], 'window');

  // ---------- OFFICE + HVAC ----------
  var zFac = zone('facility');
  box(zFac, 2, 17, 0, 9, 8, 3.4, 'office');
  for (var fx = 2.6; fx < 10.5; fx += 1.4) poly(zFac, [[fx, 25.001, 1.1], [fx + .9, 25.001, 1.1], [fx + .9, 25.001, 2.7], [fx, 25.001, 2.7]], 'window');
  for (var fy = 17.6; fy < 24.6; fy += 1.4) poly(zFac, [[11.001, fy, 1.1], [11.001, fy + .9, 1.1], [11.001, fy + .9, 2.7], [11.001, fy, 2.7]], 'window');
  var fans = [];
  [[3.5, 18.5], [6.5, 18.5], [3.5, 21.5]].forEach(function (hp) {
    box(zFac, hp[0], hp[1], 3.4, 2.2, 2.2, .8, 'hvac');
    var c = P(hp[0] + 1.1, hp[1] + 1.1, 4.21);
    var fan = el('g', { transform: 'translate(' + c[0].toFixed(1) + ',' + c[1].toFixed(1) + ') scale(1,.58)' }, zFac);
    el('circle', { r: 11, 'class': 'fan-ring' }, fan);
    var blades = el('g', { 'class': 'fan-blades' }, fan);
    for (var b = 0; b < 3; b++) el('path', { d: 'M0,0 L9,-2.4 L9,2.4 Z', transform: 'rotate(' + b * 120 + ')' }, blades);
    fans.push(blades);
  });
  // compressed-air / utility container next to hall
  box(zFac, 19, 15, 0, 3, 1.6, 1.6, 'utility');

  // ---------- ENERGY: PV + BATTERY ----------
  var zEn = zone('energy');
  var pvShines = [];
  for (var px = 14; px < 26; px += 3.2) {
    for (var py = 18; py < 27; py += 2.6) {
      poly(zEn, [[px, py + 1.6, .55], [px + 2.8, py + 1.6, .55], [px + 2.8, py, 1.35], [px, py, 1.35]], 'pv');
      poly(zEn, [[px + 1.4, py + 1.6, .56], [px + 1.42, py + 1.6, .56], [px + 1.42, py, 1.36], [px + 1.4, py, 1.36]], 'pv-line');
      poly(zEn, [[px, py + .8, .96], [px + 2.8, py + .8, .96], [px + 2.8, py + .82, .95], [px, py + .82, .95]], 'pv-line');
      var sh = poly(zEn, [[px, py + 1.6, .56], [px + 2.8, py + 1.6, .56], [px + 2.8, py, 1.36], [px, py, 1.36]], 'pv-shine');
      pvShines.push({ el: sh, k: (px - 14) / 12 + (py - 18) / 18 });
    }
  }
  var batt = [];
  [[29, 18], [29, 21.2]].forEach(function (bp) {
    box(zEn, bp[0], bp[1], 0, 5.5, 2.4, 2.4, 'battery');
    var cells = [];
    for (var c2 = 0; c2 < 5; c2++) cells.push(poly(zEn, [[34.501, bp[1] + .3 + c2 * .38, .6], [34.501, bp[1] + .6 + c2 * .38, .6], [34.501, bp[1] + .6 + c2 * .38, 1.8], [34.501, bp[1] + .3 + c2 * .38, 1.8]], 'cell'));
    batt.push(cells);
  });
  // energy flow paths
  function path3(points) { return 'M' + points.map(function (p) { var q = P(p[0], p[1], p[2]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' L'); }
  var flowPV = el('path', { d: path3([[26.5, 22.5, .2], [28.6, 22.5, .2], [28.6, 20.5, .2]]), 'class': 'flow pv' }, zEn);
  var flowOut = el('path', { d: path3([[31, 17.8, .2], [31, 15.5, .2], [22.5, 15.5, .2], [22.5, 13.5, .2]]), 'class': 'flow out' }, zEn);

  // trees
  var trees = el('g', {}, svg);
  [[0, 27], [1.5, 28.6], [12.5, 27.6], [36.5, 26], [37.8, 24.4], [27, 27.5], [-0.2, 15.5]].forEach(function (t) {
    var c = P(t[0], t[1], 0);
    el('ellipse', { cx: c[0], cy: c[1], rx: 9, ry: 4.5, 'class': 'tree-shadow' }, trees);
    el('circle', { cx: c[0], cy: c[1] - 12, r: 9, 'class': 'tree' }, trees);
  });

  // ---------- HOTSPOTS ----------
  var TOPICS = {
    production: { n: 1, title: 'Manufacturing operations platforms', text: 'One view of every line and machine – output, status and energy per unit, from plant level down to the station.', link: '#demo', cta: 'Try the live demo', at: [12, 4, 4.6] },
    integration: { n: 2, title: 'Shop-floor data & integration', text: 'Robots, AGVs and machines connected to SAP S/4HANA and enterprise IT through standardized, secure architectures.', link: '#focus', cta: 'See focus areas', at: [15.6, 7.5, 2.6], zone: 'production' },
    warehouse: { n: 3, title: 'Supply chain & partner management', text: 'From industrializing eAxle suppliers to sourcing the VW Group\'s global connectivity – commercial depth that meets operations.', link: '#experience', cta: 'View experience', at: [31, 4, 5.4] },
    energy: { n: 4, title: 'Energy & resource efficiency', text: 'PV, storage and smart load management – forecasting and optimization turn energy into a production advantage.', link: '#demo', cta: 'Open facility view', at: [20, 21, 2], view: 'facilities' },
    facility: { n: 5, title: 'Facility management', text: 'HVAC, compressed air and building systems – the second audience every plant platform has to serve.', link: '#demo', cta: 'Open facility view', at: [6.5, 21, 5], view: 'facilities' },
    rollout: { n: 6, title: 'Global rollouts & operating models', text: 'Products rolled out across plants in EMEA, APAC and the Americas – with enablement, operations and partners that scale.', link: '#impact', cta: 'See global footprint', at: [42, 4, 3.6], zone: 'warehouse' }
  };
  var hotLayer = el('g', { 'class': 'hotspots' }, svg);
  var card = document.createElement('div'); card.className = 'plant-card'; card.hidden = true; host.appendChild(card);
  var activeKey = null, pinned = false;
  Object.keys(TOPICS).forEach(function (key) {
    var t = TOPICS[key], c = P(t.at[0], t.at[1], t.at[2]);
    var g = el('g', { 'class': 'hot', transform: 'translate(' + c[0].toFixed(1) + ',' + c[1].toFixed(1) + ')', tabindex: '0', role: 'button', 'aria-label': t.title }, hotLayer);
    var gi = el('g', { 'class': 'hot-in' }, g);
    el('circle', { r: 15, 'class': 'hot-pulse' }, gi);
    el('circle', { r: 10, 'class': 'hot-dot' }, gi);
    var tx = el('text', { 'class': 'hot-n', 'text-anchor': 'middle', dy: '4' }, gi); tx.textContent = t.n;
    g.addEventListener('mouseenter', function () { if (!pinned) show(key); });
    g.addEventListener('mouseleave', function () { if (!pinned) hide(); });
    g.addEventListener('focus', function () { show(key); });
    g.addEventListener('blur', function () { if (!pinned) hide(); });
    g.addEventListener('click', function (e) { e.stopPropagation(); if (pinned && activeKey === key) { pinned = false; hide(); } else { pinned = true; show(key); } });
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(key); } });
    t.g = g;
  });
  // hovering a zone also opens its topic
  svg.querySelectorAll('.zone').forEach(function (z) {
    var key = z.dataset.zone === 'facility' ? 'facility' : z.dataset.zone;
    if (!TOPICS[key]) return;
    z.addEventListener('mouseenter', function () { if (!pinned) show(key); });
    z.addEventListener('mouseleave', function () { if (!pinned) hide(); });
    z.addEventListener('click', function (e) { e.stopPropagation(); pinned = true; show(key); });
  });
  document.addEventListener('click', function (e) { if (pinned && !card.contains(e.target)) { pinned = false; hide(); } });

  function show(key) {
    var t = TOPICS[key]; activeKey = key;
    var zoneName = t.zone || key;
    host.classList.add('focus');
    svg.querySelectorAll('.zone').forEach(function (z) { z.classList.toggle('on', z.dataset.zone === zoneName); });
    Object.keys(TOPICS).forEach(function (k) { TOPICS[k].g.classList.toggle('on', k === key); });
    card.innerHTML = '<span class="pc-n">' + t.n + '</span><strong>' + t.title + '</strong><p>' + t.text + '</p><a href="' + t.link + '">' + t.cta + ' ›</a>';
    card.querySelector('a').addEventListener('click', function (e) { e.preventDefault(); go(key); });
    card.hidden = false;
    var hb = host.getBoundingClientRect(), gb = t.g.getBoundingClientRect();
    var left = gb.left - hb.left + gb.width / 2, top = gb.top - hb.top;
    var cw = card.offsetWidth, ch = card.offsetHeight;
    left = Math.max(8, Math.min(hb.width - cw - 8, left - cw / 2));
    top = top - ch - 14 < 0 ? gb.bottom - hb.top + 14 : top - ch - 14;
    card.style.left = left + 'px'; card.style.top = top + 'px';
  }
  function hide() {
    activeKey = null; host.classList.remove('focus'); card.hidden = true;
    svg.querySelectorAll('.zone').forEach(function (z) { z.classList.remove('on'); });
    Object.keys(TOPICS).forEach(function (k) { TOPICS[k].g.classList.remove('on'); });
  }
  function go(key) {
    var t = TOPICS[key]; pinned = false; hide();
    if (t.view) { var vb = document.querySelector('[data-view="' + t.view + '"]'); if (vb) vb.click(); }
    var target = document.querySelector(t.link); if (target) target.scrollIntoView({ behavior: 'smooth' });
  }

  // ---------- animation ----------
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function frame(t) {
    var s = t / 1000;
    // parcels on conveyors
    parcels.forEach(function (p) {
      var k = (s * (p.li ? .045 : .055) + p.off) % 1, x = 3.6 + k * 16.6;
      p.m.at(x, p.y, .8);
      var inside = STATIONS.some(function (st) { return x + .6 > st[0] + .1 && x < st[0] + st[1] - .1; });
      p.m.style.opacity = inside ? 0 : 1;
    });
    // station LEDs blink occasionally
    stationGlow.forEach(function (l, i) { var on = Math.sin(s * 2 + i * 1.3) > -0.85; l.setAttribute('class', 'led ' + (on ? 'ok' : 'busy')); });
    // robot arms
    robots.forEach(function (r) {
      var ang = Math.sin(s * 1.1 + r.ph) * 1.6, lift = .3 + .25 * Math.sin(s * 2.2 + r.ph);
      var b = P(r.x, r.y, .75), e1 = P(r.x + Math.cos(ang) * 1.3, r.y + Math.sin(ang) * 1.3, 1.9 + lift);
      var e2 = P(r.x + Math.cos(ang) * 2.4, r.y + Math.sin(ang) * 2.4, 1.2 + lift * .5);
      r.a1.setAttribute('x1', b[0]); r.a1.setAttribute('y1', b[1]); r.a1.setAttribute('x2', e1[0]); r.a1.setAttribute('y2', e1[1]);
      r.a2.setAttribute('x1', e1[0]); r.a2.setAttribute('y1', e1[1]); r.a2.setAttribute('x2', e2[0]); r.a2.setAttribute('y2', e2[1]);
      r.j1.setAttribute('cx', b[0]); r.j1.setAttribute('cy', b[1]); r.j2.setAttribute('cx', e1[0]); r.j2.setAttribute('cy', e1[1]);
      r.tip.setAttribute('cx', e2[0]); r.tip.setAttribute('cy', e2[1]);
    });
    // AGVs ping-pong along the aisle into the warehouse
    agvs.forEach(function (a) {
      var k = (s * .035 + a.off) % 1, dir = k < .5, q = ease(dir ? k * 2 : (1 - k) * 2);
      a.m.at(lerp(3.5, 30.5, q), dir ? 12.1 : 12.9, .26);
      a.load.style.opacity = dir ? 1 : 0;
    });
    // forklift: dock <-> rack aisle, picks load at dock
    var fk = (s * .05) % 1, fq = ease(fk < .5 ? fk * 2 : (1 - fk) * 2);
    fork.at(lerp(26, 35.6, fq), 9.6, .26);
    forkLoad.style.opacity = fk < .5 ? 0 : 1;
    // truck: arrive, dock, leave
    var tc = (s * .04) % 1, ty;
    if (tc < .25) ty = lerp(31, 7.4, ease(tc / .25));
    else if (tc < .7) ty = 7.4;
    else ty = lerp(7.4, -16, ease((tc - .7) / .3));
    truck.at(40.6, ty, 0);
    truck.style.opacity = (ty > 26 || ty < -6) ? Math.max(0, 1 - Math.abs(ty > 26 ? ty - 26 : -6 - ty) / 5) : 1;
    // HVAC fans
    fans.forEach(function (f, i) { f.setAttribute('transform', 'rotate(' + ((s * (220 + i * 40)) % 360).toFixed(1) + ')'); });
    // PV shimmer
    pvShines.forEach(function (p) { var v = Math.max(0, Math.sin((s * .6 - p.k) * 2)); p.el.style.opacity = (v * v * .55).toFixed(2); });
    // battery charge cycle
    var lvl = (Math.sin(s * .25) + 1) / 2;
    batt.forEach(function (cells) { cells.forEach(function (c, i) { c.setAttribute('class', 'cell' + (i / 5 < lvl ? ' on' : '')); }); });
    // flows
    flowPV.style.strokeDashoffset = (-s * 40 % 1000).toFixed(1);
    flowOut.style.strokeDashoffset = (-s * 30 % 1000).toFixed(1);
  }

  function sizeCheck() { host.classList.toggle('small', host.getBoundingClientRect().width < 640); }
  sizeCheck(); addEventListener('resize', sizeCheck);
  var scrollStart = null;
  addEventListener('scroll', function () {
    if (card.hidden || !host.classList.contains('small')) { scrollStart = null; return; }
    if (scrollStart === null) scrollStart = scrollY;
    if (Math.abs(scrollY - scrollStart) > 120) { pinned = false; hide(); scrollStart = null; }
  }, { passive: true });

  var running = false;
  function loop(t) { frame(t); if (running) requestAnimationFrame(loop); }
  frame(4000);
  if (!reduce) {
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (!running) { running = true; requestAnimationFrame(loop); } }
      else running = false;
    }, { threshold: .05 }).observe(host);
  }
})();
