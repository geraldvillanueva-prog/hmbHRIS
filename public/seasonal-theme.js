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
      return { name: 'New Year', blue: '#b8860b', accent: '#d4af37', effect: 'confetti', scene: 'newyear',
        bgGradient: 'linear-gradient(160deg, #0d0d0d 0%, #3e2f0a 55%, #d4af37 100%)',
        greeting: '🎉 Happy New Year!',
        decorations: [ {emoji:'🎉', corner:'bottom-right', size:52, anim:'bob'} ] };
    }
    if (between(210, 214)) {
      return { name: "Valentine's", blue: '#c2185b', accent: '#e91e63', effect: 'hearts', scene: 'valentines',
        bgGradient: 'linear-gradient(160deg, #4a0e2e 0%, #c2185b 55%, #ff8a9e 100%)',
        greeting: '💝 Happy Valentine\'s Day!',
        decorations: [ {emoji:'🌹', corner:'bottom-left', size:50, anim:'sway'} ] };
    }
    if (between(1001, 1101)) {
      // All of October — Halloween/Undas gets its own full month, clearly
      // ahead of Christmas starting in November (rather than Christmas
      // starting back in September and Halloween just interrupting it
      // for a few days in between).
      return { name: 'Undas / Halloween', blue: '#6a1b9a', accent: '#e65100', effect: 'leaves', scene: 'halloween',
        bgGradient: 'linear-gradient(160deg, #1a0a2e 0%, #4a148c 45%, #e65100 100%)',
        greeting: '👻 Happy Halloween!', countdownTo: 'christmas',
        decorations: [
          {emoji:'👻', corner:'top-right',   size:58, anim:'float'},
          {emoji:'🎃', corner:'bottom-left', size:56, anim:'bob'}
        ] };
    }
    if (between(901, 930) || between(1102, 1229)) {
      // Early September (the very start of the PH "Ber months"), then
      // picking back up right after Halloween ends through late December.
      return { name: 'Christmas Season', blue: '#c62828', accent: '#2e7d32', effect: 'snow', scene: 'christmas',
        bgGradient: 'linear-gradient(160deg, #6d0000 0%, #c62828 45%, #1b5e20 100%)',
        greeting: '🎄 Merry Christmas!', countdownTo: 'christmas',
        decorations: [
          {emoji:'🎄', corner:'bottom-left',  size:66, anim:'sway'},
          {emoji:'🎅', corner:'bottom-right', size:60, anim:'bob'}
        ] };
    }
    if (between(301, 531)) {
      return { name: 'Summer', blue: '#e65100', accent: '#f9a825', effect: null, scene: 'summer',
        bgGradient: 'linear-gradient(160deg, #ff8f00 0%, #ffd54f 55%, #87ceeb 100%)',
        greeting: '☀️ Happy Summer!',
        decorations: [ {emoji:'🌴', corner:'bottom-left', size:54, anim:'sway'} ] };
    }
    if (between(601, 831)) {
      return { name: 'Rainy Season', blue: '#37474f', accent: '#1565c0', effect: 'rain', scene: 'rainy',
        bgGradient: 'linear-gradient(160deg, #263238 0%, #455a64 55%, #78909c 100%)',
        greeting: '☔ Stay dry out there!',
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

  // ---- 2b. Actual background change (not just corner decorations) -----
  // The login page (index.html) has a video background with a dark dim
  // overlay on top of it — on that page, we tint the overlay with the
  // season's gradient instead of its usual flat dark tint, at partial
  // opacity so the video is still visible underneath, just moodier.
  // The other three pages (admin/employee/supervisor) have a plain flat
  // background — there, the gradient becomes the actual page background,
  // which is the part that makes the season genuinely change the page
  // rather than just adding small decorations on top of an unchanged one.
  if (theme.bgGradient) {
    var dimOverlay = document.querySelector('.bg-dim-overlay');
    if (dimOverlay) {
      dimOverlay.style.background = theme.bgGradient;
      dimOverlay.style.opacity = '0.6';
    } else {
      document.documentElement.style.background = theme.bgGradient;
      document.documentElement.style.backgroundAttachment = 'fixed';
      if (document.body) {
        document.body.style.background = 'transparent';
      } else {
        window.addEventListener('DOMContentLoaded', function () {
          document.body.style.background = 'transparent';
        });
      }
    }
  }

  // ---- 3. Decorative effect (optional per theme) -----------------------
  if (theme.effect) {
    startEffect(theme.effect);
  }

  // ---- 3b. Themed corner decorations (tree+Santa, ghost+pumpkin, etc.) --
  if (theme.decorations && theme.decorations.length) {
    renderDecorations(theme.decorations);
  }

  // ---- 3c. A large, rich illustrated corner scene (pine branches +
  // glossy ornaments, a spooky branch + bats, etc.) — this is the part
  // that makes the theme feel like a real visual takeover rather than a
  // couple of small added icons.
  if (theme.scene) {
    renderSeasonalScene(theme.scene);
  }

  // ---- 3d. Greeting banner — "Merry Christmas!", "Happy Halloween!" etc.
  // Login-page only: inside the actual HRIS (admin/employee/supervisor),
  // this sat right on top of the real navigation tabs, which looked broken
  // rather than festive. .login-wrap only exists on the login page, so
  // it's a reliable way to tell the two apart.
  var isLoginPage = !!document.querySelector('.login-wrap');
  if (theme.greeting && isLoginPage) {
    renderGreeting(theme.greeting, theme);
  }

  // ---- 3e. Countdown — large, subtle background text counting down to
  // a specific date (currently only wired up for Christmas -> Dec 25).
  if (theme.countdownTo) {
    renderCountdown(theme.countdownTo);
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
  // A large, bold, theme-colored greeting banner near the top of the
  // page — "Merry Christmas!", "Happy Halloween!", etc. Big and stylized
  // on purpose (gradient text fill + glow), the way a festive card would
  // treat its title, rather than a small discreet badge.
  function renderGreeting(text, theme) {
    var el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:fixed;top:4%;left:50%;transform:translateX(-50%);'
      + 'z-index:99996;pointer-events:none;text-align:center;width:90%;max-width:700px;'
      + 'font-family:\'Fraunces\',Georgia,serif;font-weight:700;'
      + 'font-size:clamp(28px,6vw,58px);letter-spacing:.01em;line-height:1.1;'
      + 'background:linear-gradient(135deg,' + theme.accent + ',' + theme.blue + ');'
      + '-webkit-background-clip:text;background-clip:text;color:transparent;'
      + 'filter:drop-shadow(0 2px 10px rgba(0,0,0,0.35)) drop-shadow(0 0 22px ' + theme.accent + '88);'
      + 'opacity:0;transition:opacity 1.2s ease, top 1.2s ease';
    document.documentElement.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; el.style.top = '5%'; });
  }

  // A large, low-opacity number sitting in the page background, counting
  // down to a specific date. Deliberately subtle (low opacity, behind
  // everything) — it's meant to read as a background design touch, not
  // compete with the actual login form or app content in front of it.
  function renderCountdown(targetName) {
    var today = new Date();
    var year = today.getFullYear();
    var target;
    if (targetName === 'christmas') {
      target = new Date(year, 11, 25); // Dec 25, month is 0-indexed
      if (today > target) target = new Date(year + 1, 11, 25); // already passed this year
    } else {
      return;
    }
    var msPerDay = 1000 * 60 * 60 * 24;
    var daysLeft = Math.ceil((target - today) / msPerDay);
    var label = daysLeft <= 0 ? 'Merry Christmas! 🎄' : daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' until Christmas';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;bottom:4%;left:50%;transform:translateX(-50%);'
      + 'z-index:1;pointer-events:none;text-align:center;opacity:0;transition:opacity 1.5s ease';
    wrap.innerHTML = '<div style="font-family:\'IBM Plex Sans\',sans-serif;font-weight:800;'
      + 'font-size:clamp(18px,4vw,42px);color:rgba(255,255,255,0.32);line-height:1.2;letter-spacing:.01em;white-space:nowrap">'
      + label + '</div>';
    document.documentElement.appendChild(wrap);
    requestAnimationFrame(function () { wrap.style.opacity = '1'; });
  }

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

  // A large, illustrated corner scene — pine branches with glossy
  // ornament baubles for Christmas, a spooky branch with bats and a
  // glowing jack-o-lantern for Halloween, etc. Built as original SVG
  // illustration (gradients for the glossy ball look, layered shapes for
  // branches) rather than a stock photo, so there's no licensing concern,
  // while still giving the rich, full-corner visual weight you'd get from
  // a real photo. Anchored to the bottom-right corner, growing diagonally
  // into the page — large enough to read as a real scene, not an icon.
  function renderSeasonalScene(sceneName) {
    var svgInner = sceneSvgContent(sceneName);
    if (!svgInner) return;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;bottom:0;right:0;width:360px;height:360px;'
      + 'max-width:45vw;max-height:45vw;pointer-events:none;z-index:99995;'
      + 'opacity:0;transition:opacity 1.2s ease';
    wrap.innerHTML = '<svg viewBox="0 0 360 360" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">' + svgInner + '</svg>';
    document.documentElement.appendChild(wrap);
    requestAnimationFrame(function () { wrap.style.opacity = '1'; });
  }

  function sceneSvgContent(sceneName) {
    if (sceneName === 'christmas') {
      return ''
        + '<defs>'
        + '  <radialGradient id="szn-orn-red" cx="35%" cy="28%" r="75%">'
        + '    <stop offset="0%" stop-color="#ff8a80"/><stop offset="45%" stop-color="#e53935"/><stop offset="100%" stop-color="#8e0000"/>'
        + '  </radialGradient>'
        + '  <radialGradient id="szn-orn-teal" cx="35%" cy="28%" r="75%">'
        + '    <stop offset="0%" stop-color="#80e8d8"/><stop offset="45%" stop-color="#00897b"/><stop offset="100%" stop-color="#004d40"/>'
        + '  </radialGradient>'
        + '  <radialGradient id="szn-orn-gold" cx="35%" cy="28%" r="75%">'
        + '    <stop offset="0%" stop-color="#fff3b0"/><stop offset="45%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8a6d1a"/>'
        + '  </radialGradient>'
        + '</defs>'
        // Pine branch clusters fanning from the bottom-right corner
        + '<g opacity="0.95">'
        + branchCluster(330, 350, -35) + branchCluster(300, 330, -55) + branchCluster(250, 340, -15)
        + branchCluster(355, 300, -70) + branchCluster(200, 355, 5)
        + '</g>'
        // Berries
        + '<circle cx="255" cy="305" r="5" fill="#c62828"/><circle cx="268" cy="298" r="5" fill="#c62828"/>'
        + '<circle cx="195" cy="330" r="4" fill="#c62828"/>'
        // Glossy ornament baubles, varied size
        + '<circle cx="230" cy="250" r="26" fill="url(#szn-orn-red)"/>'
        + '<circle cx="290" cy="220" r="22" fill="url(#szn-orn-teal)"/>'
        + '<circle cx="180" cy="285" r="19" fill="url(#szn-orn-gold)"/>'
        + '<circle cx="310" cy="285" r="15" fill="url(#szn-orn-red)"/>'
        // Little ornament caps
        + '<rect x="226" y="222" width="8" height="6" rx="2" fill="#d4af37"/>'
        + '<rect x="286" y="196" width="7" height="5" rx="2" fill="#d4af37"/>'
        // Ribbon bow near the corner
        + '<path d="M300 330 Q270 310 290 340 Q270 330 300 355 Q330 330 310 340 Q330 310 300 330 Z" fill="#c62828" stroke="#8e0000" stroke-width="2"/>'
        + '<circle cx="300" cy="332" r="6" fill="#8e0000"/>';
    }
    if (sceneName === 'halloween') {
      return ''
        + '<defs>'
        + '  <radialGradient id="szn-pumpkin" cx="35%" cy="28%" r="75%">'
        + '    <stop offset="0%" stop-color="#ffb74d"/><stop offset="55%" stop-color="#e65100"/><stop offset="100%" stop-color="#8d3800"/>'
        + '  </radialGradient>'
        + '  <radialGradient id="szn-glow" cx="50%" cy="50%" r="50%">'
        + '    <stop offset="0%" stop-color="#ffcc80" stop-opacity="0.8"/><stop offset="100%" stop-color="#ffcc80" stop-opacity="0"/>'
        + '  </radialGradient>'
        + '</defs>'
        // Bare twisted branches
        + '<g stroke="#3e2723" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.9">'
        + '  <path d="M360 360 L300 300 Q280 270 255 275 Q235 278 220 255"/>'
        + '  <path d="M300 300 Q320 280 345 285"/>'
        + '  <path d="M255 275 Q245 250 260 230"/>'
        + '</g>'
        // Glow behind the pumpkin
        + '<circle cx="250" cy="300" r="70" fill="url(#szn-glow)"/>'
        // Jack-o-lantern
        + '<ellipse cx="250" cy="305" rx="38" ry="30" fill="url(#szn-pumpkin)"/>'
        + '<rect x="244" y="270" width="10" height="14" rx="3" fill="#4e342e"/>'
        + '<polygon points="236,298 246,292 246,304" fill="#2b1a12"/>'
        + '<polygon points="264,298 254,292 254,304" fill="#2b1a12"/>'
        + '<path d="M232 318 Q250 332 268 318 Q250 326 232 318 Z" fill="#2b1a12"/>'
        // Bats
        + '<g fill="#1a1a1a" opacity="0.9">'
        + '  <path d="M80 60 Q95 45 100 60 Q105 45 120 60 Q108 58 100 68 Q92 58 80 60 Z"/>'
        + '  <path d="M140 100 Q152 88 156 100 Q160 88 172 100 Q163 98 156 106 Q150 98 140 100 Z"/>'
        + '</g>';
    }
    if (sceneName === 'newyear') {
      return ''
        + '<defs><radialGradient id="szn-burst" cx="50%" cy="50%" r="50%">'
        + '<stop offset="0%" stop-color="#fff3b0" stop-opacity="0.9"/><stop offset="100%" stop-color="#fff3b0" stop-opacity="0"/>'
        + '</radialGradient></defs>'
        + '<circle cx="300" cy="300" r="90" fill="url(#szn-burst)"/>'
        + '<g stroke="#d4af37" stroke-width="3" opacity="0.85">'
        + sparkLines(300, 300, 60, 10)
        + '</g>'
        + '<circle cx="300" cy="300" r="5" fill="#d4af37"/>';
    }
    if (sceneName === 'valentines') {
      return ''
        + '<defs><radialGradient id="szn-rose" cx="35%" cy="28%" r="75%">'
        + '<stop offset="0%" stop-color="#ff8a9e"/><stop offset="55%" stop-color="#e91e63"/><stop offset="100%" stop-color="#880e4f"/>'
        + '</radialGradient></defs>'
        + '<g stroke="#2e7d32" stroke-width="5" fill="none"><path d="M300 360 Q290 300 310 260"/><path d="M260 360 Q275 310 265 270"/></g>'
        + '<ellipse cx="300" cy="255" rx="20" ry="16" fill="url(#szn-rose)"/>'
        + '<ellipse cx="265" cy="265" rx="16" ry="13" fill="url(#szn-rose)"/>';
    }
    if (sceneName === 'summer') {
      return ''
        + '<defs><radialGradient id="szn-sun" cx="50%" cy="50%" r="50%">'
        + '<stop offset="0%" stop-color="#fff59d"/><stop offset="100%" stop-color="#f9a825"/>'
        + '</radialGradient></defs>'
        + '<circle cx="300" cy="80" r="34" fill="url(#szn-sun)"/>'
        + '<g stroke="#f9a825" stroke-width="4"><line x1="300" y1="25" x2="300" y2="5"/><line x1="345" y1="80" x2="360" y2="80"/></g>'
        + '<g fill="#2e7d32"><path d="M60 360 Q80 280 70 220 Q110 290 100 360 Z"/><path d="M60 360 Q40 280 55 220 Q15 290 25 360 Z"/></g>';
    }
    if (sceneName === 'rainy') {
      return ''
        + '<ellipse cx="260" cy="90" rx="55" ry="26" fill="#cfd8dc"/>'
        + '<ellipse cx="310" cy="105" rx="40" ry="20" fill="#b0bec5"/>'
        + '<g stroke="#64b5f6" stroke-width="3" stroke-linecap="round" opacity="0.8">'
        + '  <line x1="250" y1="140" x2="240" y2="175"/><line x1="280" y1="145" x2="270" y2="180"/>'
        + '  <line x1="310" y1="140" x2="300" y2="175"/>'
        + '</g>';
    }
    return '';
  }
  function branchCluster(x, y, angle) {
    return '<g transform="translate(' + x + ',' + y + ') rotate(' + angle + ')">'
      + '<ellipse cx="0" cy="0" rx="45" ry="11" fill="#1b5e20"/>'
      + '<ellipse cx="-15" cy="-8" rx="32" ry="9" fill="#2e7d32" transform="rotate(-18)"/>'
      + '<ellipse cx="-15" cy="8" rx="32" ry="9" fill="#2e7d32" transform="rotate(18)"/>'
      + '</g>';
  }
  function sparkLines(cx, cy, len, count) {
    var out = '';
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 * i) / count;
      var x1 = cx + Math.cos(a) * 20, y1 = cy + Math.sin(a) * 20;
      var x2 = cx + Math.cos(a) * len, y2 = cy + Math.sin(a) * len;
      out += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    }
    return out;
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
