// Dotted, draggable globe rendered on <canvas>. No dependencies.
// Land dots are pre-computed from Natural Earth (public domain) in land-dots.json.
(function () {
  var canvas = document.getElementById('globe');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEG = Math.PI / 180;

  // Illustrative region-level markers (not specific sites)
  var HQ = { name: 'Stuttgart', lon: 9.18, lat: 48.78, region: 'EMEA' };
  var MARKERS = [
    { lon: -3.7, lat: 40.4, region: 'EMEA' }, { lon: 19.0, lat: 47.5, region: 'EMEA' },
    { lon: 2.35, lat: 48.86, region: 'EMEA' }, { lon: 28.9, lat: 41.0, region: 'EMEA' },
    { lon: 120.6, lat: 31.3, region: 'APAC' }, { lon: 77.6, lat: 12.97, region: 'APAC' },
    { lon: 139.7, lat: 35.7, region: 'APAC' }, { lon: 100.3, lat: 5.4, region: 'APAC' },
    { lon: -84.4, lat: 33.75, region: 'Americas' }, { lon: -100.3, lat: 25.7, region: 'Americas' },
    { lon: -46.6, lat: -23.5, region: 'Americas' }, { lon: -83.0, lat: 42.3, region: 'Americas' }
  ];
  var REGION_VIEW = { EMEA: [-15, 22], APAC: [-105, 18], Americas: [75, 18], ALL: [-10, 20] };

  var dots = [], W = 0, H = 0, R = 0, dpr = 1;
  var rotLon = -10, rotLat = 20, velLon = 0, targetLon = null, targetLat = null;
  var dragging = false, lastX = 0, lastY = 0, visible = false, t0 = performance.now();
  var colors = {};

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.land = cs.getPropertyValue('--globe-land').trim() || '#9aa0a8';
    colors.g1 = cs.getPropertyValue('--g1').trim();
    colors.g2 = cs.getPropertyValue('--g2').trim();
    colors.g3 = cs.getPropertyValue('--g3').trim();
    colors.rim = cs.getPropertyValue('--hair').trim();
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    R = Math.min(W, H) / 2 * 0.86;
  }

  function project(lon, lat) {
    var l = (lon + rotLon) * DEG, p = lat * DEG, p0 = rotLat * DEG;
    var cosp = Math.cos(p);
    var x = cosp * Math.sin(l);
    var y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cosp * Math.cos(l);
    var z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cosp * Math.cos(l);
    return [W / 2 + x * R, H / 2 - y * R, z];
  }

  function slerp(a, b, t) { // great-circle interpolation in lon/lat degrees
    var la1 = a.lat * DEG, lo1 = a.lon * DEG, la2 = b.lat * DEG, lo2 = b.lon * DEG;
    var v1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
    var v2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
    var d = Math.acos(Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2])));
    if (d < 1e-6) return [a.lon, a.lat, 0];
    var s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    var v = [s1 * v1[0] + s2 * v2[0], s1 * v1[1] + s2 * v2[1], s1 * v1[2] + s2 * v2[2]];
    var lift = 1 + Math.sin(Math.PI * t) * d * 0.18; // arc altitude
    return [Math.atan2(v[1], v[0]) / DEG, Math.asin(v[2]) / DEG, lift];
  }

  function draw(now) {
    var t = (now - t0) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // soft halo
    var halo = ctx.createRadialGradient(W / 2, H / 2, R * 0.85, W / 2, H / 2, R * 1.08);
    halo.addColorStop(0, 'rgba(0,163,163,0)');
    halo.addColorStop(1, 'rgba(0,163,163,0.10)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * 1.08, 0, Math.PI * 2); ctx.fill();

    // land dots
    ctx.fillStyle = colors.land;
    var size = Math.max(1, R / 210);
    for (var i = 0; i < dots.length; i += 2) {
      var p = project(dots[i], dots[i + 1]);
      if (p[2] <= 0) continue;
      ctx.globalAlpha = 0.25 + 0.6 * p[2];
      ctx.fillRect(p[0] - size / 2, p[1] - size / 2, size * (0.6 + p[2] * 0.6), size * (0.6 + p[2] * 0.6));
    }
    ctx.globalAlpha = 1;

    // arcs HQ -> markers
    MARKERS.forEach(function (m, idx) {
      var grad = m.region === 'EMEA' ? colors.g1 : m.region === 'APAC' ? colors.g2 : colors.g3;
      var phase = reduce ? 1 : ((t * 0.35 + idx * 0.13) % 1.6) / 1.2;
      var head = Math.min(1, phase);
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); var started = false;
      for (var s = 0; s <= 40; s++) {
        var k = s / 40; if (k > head) break;
        var g = slerp(HQ, m, k), pr = project(g[0], g[1]);
        var x = W / 2 + (pr[0] - W / 2) * g[2], y = H / 2 + (pr[1] - H / 2) * g[2];
        if (pr[2] < -0.05) { started = false; continue; }
        ctx.globalAlpha = 0.25 + 0.55 * Math.max(0, pr[2]);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      // marker
      var mp = project(m.lon, m.lat);
      if (mp[2] > 0) {
        var pulse = reduce ? 0 : (t * 0.8 + idx * 0.2) % 1;
        ctx.fillStyle = grad;
        ctx.globalAlpha = (1 - pulse) * 0.35 * mp[2];
        ctx.beginPath(); ctx.arc(mp[0], mp[1], 4 + pulse * 10, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = mp[2];
        ctx.beginPath(); ctx.arc(mp[0], mp[1], 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // HQ
    var hp = project(HQ.lon, HQ.lat);
    if (hp[2] > 0) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hp[0], hp[1], 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colors.g1; ctx.beginPath(); ctx.arc(hp[0], hp[1], 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function step(now) {
    if (!dragging) {
      if (targetLon !== null) {
        var d = ((targetLon - rotLon + 540) % 360) - 180;
        rotLon += d * 0.06; rotLat += (targetLat - rotLat) * 0.06;
        if (Math.abs(d) < 0.2 && Math.abs(targetLat - rotLat) < 0.2) targetLon = targetLat = null;
      } else {
        velLon *= 0.95;
        rotLon += velLon + (reduce ? 0 : 0.06);
      }
    }
    draw(now);
    if (visible) requestAnimationFrame(step);
  }

  function start() { if (!visible) { visible = true; requestAnimationFrame(step); } }

  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; targetLon = null; lastX = e.clientX; lastY = e.clientY; velLon = 0;
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('grabbing');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velLon = dx * 0.25; rotLon += velLon;
    rotLat = Math.max(-60, Math.min(60, rotLat + dy * 0.25));
  });
  function end() { dragging = false; canvas.classList.remove('grabbing'); }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  document.querySelectorAll('[data-region]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = REGION_VIEW[b.dataset.region];
      targetLon = v[0]; targetLat = v[1];
      document.querySelectorAll('[data-region]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    });
  });

  readColors(); resize();
  addEventListener('resize', function () { resize(); if (!visible) draw(performance.now()); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);

  fetch('assets/land-dots.json').then(function (r) { return r.json(); }).then(function (arr) {
    dots = new Float32Array(arr.length);
    for (var i = 0; i < arr.length; i++) dots[i] = arr[i] / 10;
    draw(performance.now());
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) start(); else visible = false;
    }, { threshold: 0.05 });
    io.observe(canvas);
  }).catch(function () { canvas.closest('.globe-wrap').classList.add('no-data'); });
})();
