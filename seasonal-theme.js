/* ============================================================
   HMB HRIS — Seasonal Theme
   Shared by index.html (login), admin.html, employee.html,
   supervisor.html. One file, so all four pages always agree on
   what "today's theme" is — no risk of four copies drifting out
   of sync as occasions get added or adjusted over time.

   What it does:
   1. Picks a theme for today's date from the calendar below.
   2. Overrides a couple of CSS variables (--blue, --accent) that
      every page already defines, so buttons/links/highlights
      pick up the seasonal color without touching each page's
      own stylesheet.
   3. Draws a very light, non-blocking decorative effect (falling
      snow, confetti, etc.) on a full-screen canvas that never
      intercepts clicks (pointer-events: none) and pauses itself
      if the tab isn't visible, so it never costs battery/CPU in
      the background.

   Kept deliberately light-touch: this is a work tool people use
   daily for payroll and HR tasks, not a consumer app, so effects
   are subtle (a handful of slow-moving particles, low opacity)
   rather than flashy. Anyone who finds it distracting can turn
   it off entirely — see the dismiss button it adds, bottom-right.
   ============================================================ */
(function () {
  'use strict';

  // ---- 1. Season calendar --------------------------------------------
  // Checked in order; the first match wins. Short, specific occasions
  // are listed before the long background seasons so e.g. Halloween
  // (Oct 28–Nov 1) takes precedence over the Christmas/Ber-months
  // season that would otherwise also cover that week.
  function getTodaysTheme(date) {
    var m = date.getMonth() + 1; // 1-12
    var d = date.getDate();
    var md = m * 100 + d; // e.g. Feb 14 -> 214, Dec 30 -> 1230

    function between(from, to) { return md >= from && md <= to; }

    if (between(1230, 1231) || between(101, 102)) {
      return { name: 'New Year', blue: '#b8860b', accent: '#d4af37', effect: 'confetti',
        decorations: [ {emoji:'🎉', corner:'bottom-right', size:52, anim:'bob'} ] };
    }
    if (between(210, 214)) {
      return { name: "Valentine's", blue: '#c2185b', accent: '#e91e63', effect: 'hearts',
        decorations: [ {emoji:'🌹', corner:'bottom-left', size:50, anim:'sway'} ] };
    }
    if (between(1028, 1101)) {
      return { name: 'Undas / Halloween', blue: '#6a1b9a', accent: '#e65100', effect: 'leaves',
        decorations: [
          {emoji:'👻', corner:'top-right',   size:58, anim:'float'},
          {emoji:'🎃', corner:'bottom-left', size:56, anim:'bob'}
        ] };
    }
    if (between(901, 1229)) {
      // The Philippines' famous "Ber months" — the long Christmas season.
      return { name: 'Christmas Season', blue: '#c62828', accent: '#2e7d32', effect: 'snow',
        decorations: [
          {emoji:'🎄', corner:'bottom-left',  size:66, anim:'sway'},
          {emoji:'🎅', corner:'bottom-right', size:60, anim:'bob'}
        ] };
    }
    if (between(301, 531)) {
      return { name: 'Summer', blue: '#e65100', accent: '#f9a825', effect: null,
        decorations: [ {emoji:'🌴', corner:'bottom-left', size:54, anim:'sway'} ] };
    }
    if (between(601, 831)) {
      return { name: 'Rainy Season', blue: '#37474f', accent: '#1565c0', effect: 'rain',
        decorations: [ {emoji:'☂️', corner:'bottom-right', size:50, anim:'sway'} ] };
    }
    // Jan 3 – Feb 9, and Sep 1 handled above — anything left over
    // (early Jan after New Year, and most of Feb) gets the normal theme.
    return null;
  }

  var theme = getTodaysTheme(new Date());

  // Respect a per-browser opt-out (the dismiss button below sets this).
  try {
    if (localStorage.getItem('hmb_seasonal_theme_off') === '1') theme = null;
  } catch (e) { /* localStorage unavailable — just proceed with the theme */ }

  if (!theme) return; // Nothing to do today — leave every page exactly as-is.

  // ---- 2. Color override ----------------------------------------------
  document.documentElement.style.setProperty('--blue', theme.blue);
  document.documentElement.style.setProperty('--accent', theme.accent);

  // ---- 3. Decorative effect (optional per theme) -----------------------
  if (theme.effect) {
    startEffect(theme.effect);
  }

  // ---- 3b. Themed corner decorations (tree+Santa, ghost+pumpkin, etc.) --
  if (theme.decorations && theme.decorations.length) {
    renderDecorations(theme.decorations);
  }

  // Small, unobtrusive control to turn this off, in case anyone finds
  // it distracting during actual work. Bottom-right, out of the way.
  var btn = document.createElement('button');
  btn.textContent = '✨ ' + theme.name + ' — turn off';
  btn.setAttribute('aria-label', 'Turn off seasonal theme');
  btn.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:99998;'
    + 'font-family:sans-serif;font-size:11px;padding:5px 10px;border-radius:20px;'
    + 'border:1px solid rgba(0,0,0,0.15);background:rgba(255,255,255,0.9);'
    + 'color:#444;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.15);opacity:0.75';
  btn.onmouseenter = function () { btn.style.opacity = '1'; };
  btn.onmouseleave = function () { btn.style.opacity = '0.75'; };
  btn.onclick = function () {
    try { localStorage.setItem('hmb_seasonal_theme_off', '1'); } catch (e) {}
    location.reload();
  };
  if (document.body) document.body.appendChild(btn);
  else window.addEventListener('DOMContentLoaded', function () { document.body.appendChild(btn); });

  // ---- Effect engine: one small canvas-particle system, reused for
  // every effect type by just changing what each particle looks like
  // and how it drifts. ---------------------------------------------------
  // Large emoji "mascots" (Christmas tree + Santa, ghost + pumpkin, etc.)
  // placed in corners, out of the way of anything clickable. Separate
  // from the falling-particle effect above — these are fixed decorations
  // with a gentle idle animation, not moving across the screen.
  function renderDecorations(decorations) {
    var style = document.createElement('style');
    style.textContent =
      '@keyframes szn-sway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}'
      + '@keyframes szn-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}'
      + '@keyframes szn-float{0%,100%{transform:translate(0,0)}50%{transform:translate(-8px,-14px)}}';
    document.head.appendChild(style);

    var cornerCss = {
      'bottom-left':  'bottom:50px;left:14px;',
      'bottom-right': 'bottom:50px;right:14px;',
      'top-left':     'top:14px;left:14px;',
      'top-right':    'top:14px;right:14px;'
    };
    var animName = { sway:'szn-sway', bob:'szn-bob', float:'szn-float' };
    var animDuration = { sway:'3.2s', bob:'2.4s', float:'4s' };

    decorations.forEach(function (d) {
      var el = document.createElement('div');
      el.textContent = d.emoji;
      el.style.cssText = 'position:fixed;z-index:99996;pointer-events:none;'
        + 'font-size:' + d.size + 'px;line-height:1;'
        + (cornerCss[d.corner] || cornerCss['bottom-left'])
        + 'transform-origin:bottom center;'
        + 'animation:' + (animName[d.anim] || 'szn-bob') + ' ' + (animDuration[d.anim] || '3s') + ' ease-in-out infinite;'
        + 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));';
      document.documentElement.appendChild(el);
    });
  }

  function startEffect(kind) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;'
      + 'pointer-events:none;z-index:99997';
    document.documentElement.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var w, h, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    var COUNT = 26; // deliberately sparse — this should read as a subtle
                     // touch, not a distracting animation covering the screen
    var particles = [];
    for (var i = 0; i < COUNT; i++) particles.push(makeParticle(true));

    function makeParticle(initial) {
      var base = { x: Math.random() * w, y: initial ? Math.random() * h : -20 };
      if (kind === 'snow') {
        return Object.assign(base, { r: 2 + Math.random() * 3, vy: 0.4 + Math.random() * 0.6, vx: Math.random() * 0.4 - 0.2, o: 0.4 + Math.random() * 0.4 });
      }
      if (kind === 'confetti') {
        var colors = ['#d4af37', '#b8860b', '#fff', '#0a1628'];
        return Object.assign(base, { size: 4 + Math.random() * 4, vy: 1 + Math.random() * 1.5, vx: Math.random() * 1 - 0.5, rot: Math.random() * 360, vr: Math.random() * 6 - 3, color: colors[i % colors.length] });
      }
      if (kind === 'hearts') {
        return Object.assign(base, { size: 8 + Math.random() * 8, vy: 0.3 + Math.random() * 0.5, vx: Math.sin(base.y) * 0.3, o: 0.35 + Math.random() * 0.35 });
      }
      if (kind === 'leaves') {
        var lcolors = ['#e65100', '#bf360c', '#f9a825'];
        return Object.assign(base, { size: 6 + Math.random() * 5, vy: 0.5 + Math.random() * 0.7, vx: Math.random() * 0.6 - 0.3, rot: Math.random() * 360, vr: Math.random() * 4 - 2, color: lcolors[i % lcolors.length] });
      }
      if (kind === 'rain') {
        return Object.assign(base, { len: 8 + Math.random() * 8, vy: 4 + Math.random() * 3, o: 0.15 + Math.random() * 0.15 });
      }
    }

    var running = true;
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden; // pause entirely when the tab isn't visible
      if (running) requestAnimationFrame(tick);
    });

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.y += p.vy; p.x += p.vx || 0;
        if (p.rot !== undefined) p.rot += p.vr;
        if (p.y > h + 20) { particles[i] = makeParticle(false); continue; }

        ctx.save();
        if (kind === 'snow') {
          ctx.globalAlpha = p.o;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        } else if (kind === 'confetti') {
          ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (kind === 'hearts') {
          ctx.globalAlpha = p.o; ctx.fillStyle = '#e91e63';
          drawHeart(ctx, p.x, p.y, p.size);
        } else if (kind === 'leaves') {
          ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size / 2, 0, 0, 7); ctx.fill();
        } else if (kind === 'rain') {
          ctx.globalAlpha = p.o; ctx.strokeStyle = '#90caf9'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len); ctx.stroke();
        }
        ctx.restore();
      }
      requestAnimationFrame(tick);
    }
    function drawHeart(c, x, y, s) {
      c.beginPath();
      c.moveTo(x, y + s / 4);
      c.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s / 4);
      c.bezierCurveTo(x - s / 2, y + s / 2, x, y + s / 2, x, y + s);
      c.bezierCurveTo(x, y + s / 2, x + s / 2, y + s / 2, x + s / 2, y + s / 4);
      c.bezierCurveTo(x + s / 2, y, x, y, x, y + s / 4);
      c.fill();
    }
    requestAnimationFrame(tick);
  }
})();
