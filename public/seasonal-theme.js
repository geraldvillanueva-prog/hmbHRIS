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

  // ---- SWITCHES -------------------------------------------------------
  // SEASONAL_BACKGROUND_ENABLED: a static, season-matched PICTURE behind the
  //   login page — nothing animated, no decorations, greeting or costume.
  //   Login page only; the HRIS pages keep their plain background so tables
  //   stay readable.
  // SEASONAL_THEME_ENABLED: the full festive layer (theme colors, falling
  //   petals/snow, corner decorations, greeting, countdown, mascot costume).
  //   Off for a professional look.
  var SEASONAL_BACKGROUND_ENABLED = true;
  var SEASONAL_THEME_ENABLED = false;

  // Optional: use your own licensed photo for a season instead of the
  // built-in illustration. Put the file in the public folder and list it here,
  // e.g.  halloween: { url: '/bg/halloween.jpg', dark: true, base: '#1a0a2e' }
  // ("dark: true" turns the logo text white; "base" is the color shown while
  // the photo loads.) Scene names: halloween, christmas, newyear, valentines,
  // summer, rainy.
  var SEASON_PHOTO_OVERRIDE = {};

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
        greeting: '🎉 Happy New Year!', costume: 'partyhat',
        decorations: [ {emoji:'🎉', corner:'bottom-right', size:52, anim:'bob'} ] };
    }
    if (between(210, 214)) {
      return { name: "Valentine's", blue: '#c2185b', accent: '#e91e63', effect: 'hearts', scene: 'valentines',
        bgGradient: 'linear-gradient(160deg, #4a0e2e 0%, #c2185b 55%, #ff8a9e 100%)',
        greeting: '💝 Happy Valentine\'s Day!', costume: 'flowercrown',
        decorations: [ {emoji:'🌹', corner:'bottom-left', size:50, anim:'sway'} ] };
    }
    if (between(1001, 1101)) {
      // All of October — Halloween/Undas gets its own full month, clearly
      // ahead of Christmas starting in November (rather than Christmas
      // starting back in September and Halloween just interrupting it
      // for a few days in between).
      return { name: 'Undas / Halloween', blue: '#6a1b9a', accent: '#e65100', effect: 'leaves', scene: 'halloween',
        bgGradient: 'linear-gradient(160deg, #1a0a2e 0%, #4a148c 45%, #e65100 100%)',
        greeting: '👻 Happy Halloween!', countdownTo: 'christmas', costume: 'witchhat',
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
        greeting: '🎄 Merry Christmas!', countdownTo: 'christmas', costume: 'santahat',
        decorations: [
          {emoji:'🎄', corner:'bottom-left',  size:66, anim:'sway'},
          {emoji:'🎅', corner:'bottom-right', size:60, anim:'bob'}
        ] };
    }
    if (between(301, 531)) {
      return { name: 'Summer', blue: '#e65100', accent: '#f9a825', effect: null, scene: 'summer',
        bgGradient: 'linear-gradient(160deg, #ff8f00 0%, #ffd54f 55%, #87ceeb 100%)',
        greeting: '☀️ Happy Summer!', costume: 'sunglasses',
        decorations: [ {emoji:'🌴', corner:'bottom-left', size:54, anim:'sway'} ] };
    }
    if (between(601, 831)) {
      return { name: 'Rainy Season', blue: '#37474f', accent: '#1565c0', effect: 'rain', scene: 'rainy',
        bgGradient: 'linear-gradient(160deg, #263238 0%, #455a64 55%, #78909c 100%)',
        greeting: '☔ Stay dry out there!', costume: 'rainhat',
        decorations: [ {emoji:'☂️', corner:'bottom-right', size:50, anim:'sway'} ] };
    }
    // Jan 3 – Feb 9, and Sep 1 handled above — anything left over
    // (early Jan after New Year, and most of Feb) gets the normal theme.
    return null;
  }

  var theme = getTodaysTheme(new Date());

  // .login-wrap only exists on index.html — this is how every
  // "could this hurt readability on a page full of real work" decision
  // below tells the login screen apart from the dense admin/employee/
  // supervisor app pages.
  var isLoginPage = !!document.querySelector('.login-wrap');

  // ---- 0. Seasonal background PICTURE (login page only) ----------------
  var pictureApplied = false;
  if (SEASONAL_BACKGROUND_ENABLED && isLoginPage && theme && theme.scene) {
    pictureApplied = applySeasonPicture(theme.scene);
  }

  // Everything below is the full festive layer.
  if (!SEASONAL_THEME_ENABLED) return;

  // Respect a per-browser opt-out (the dismiss button below sets this).
  try {
    if (localStorage.getItem('hmb_seasonal_theme_off') === '1') theme = null;
  } catch (e) { /* localStorage unavailable — just proceed with the theme */ }

  if (!theme) return; // Nothing to do today — leave every page exactly as-is.

  // ---- 2. Color override ----------------------------------------------
  // Safe everywhere — this only tints buttons/links a little, nowhere
  // near the contrast-sensitive territory of a data table's text.
  document.documentElement.style.setProperty('--blue', theme.blue);
  document.documentElement.style.setProperty('--accent', theme.accent);

  // ---- 2b. Actual background change — LOGIN PAGE ONLY -------------------
  // A vivid full-page gradient looks great on the login screen, but
  // sitting behind a dense table (Employee Time Logs, payroll grids, etc.)
  // it wrecks text contrast and makes real work hard to read. So this
  // only ever applies here, never on the three actual app pages.
  if (theme.bgGradient && isLoginPage && !pictureApplied) {
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

  // ---- 3. Decorative effect (optional per theme) -----------------------
  // Login page only — inside the HRIS the falling petals/snow drift over
  // tables and forms while people are working.
  if (theme.effect && isLoginPage) {
    startEffect(theme.effect);
  }

  // ---- 3b. Themed corner decorations (tree+Santa, ghost+pumpkin, etc.) --
  // Inside the HRIS, anything pinned to a top corner lands on the header
  // (the ghost was covering the Sign Out button), so only bottom-corner
  // decorations are shown there. The login page keeps all of them.
  var cornerDecos = (theme.decorations || []).filter(function (d) {
    return isLoginPage || String(d.corner).indexOf('top') !== 0;
  });
  if (cornerDecos.length) {
    renderDecorations(cornerDecos);
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
  // rather than festive.
  if (theme.greeting && isLoginPage) {
    renderGreeting(theme.greeting, theme);
  }

  // ---- 3e. Countdown — large, subtle background text counting down to
  // a specific date. Login-page only, for the same reason as the greeting
  // above — it was overlapping real table rows (Employee Time Logs, etc.)
  // on the app pages, which made data harder to read rather than festive.
  if (theme.countdownTo && isLoginPage) {
    renderCountdown(theme.countdownTo);
  }

  // ---- 3f. A costume piece on the login page's animated mascot ---------
  // Login-page only — #dogCanvas (the hand-drawn, animated "not peeking"
  // character) only exists there in the first place.
  if (theme.costume && isLoginPage) {
    renderCostume(theme.costume);
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

  // Dresses up the login page's hand-drawn "not peeking" character for
  // the season. Rather than editing that character's own procedural
  // canvas-drawing code (risky — it's a fairly intricate animation state
  // machine), this overlays a small SVG costume piece positioned using
  // the canvas's actual on-page bounding box, tracked on resize so it
  // stays aligned with the character's head.
  function renderCostume(kind) {
    var canvas = document.getElementById('dogCanvas');
    if (!canvas) return;
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;z-index:10000;pointer-events:none;transform-origin:50% 100%';
    el.innerHTML = costumeSvg(kind);
    document.documentElement.appendChild(el);

    function position() {
      var r = canvas.getBoundingClientRect();
      // These fractions are tuned to the character's head sitting near
      // the top third of its 200x200 canvas, ears included.
      var size = r.width * 0.46;
      el.style.width = size + 'px';
      el.style.left = (r.left + r.width * 0.5 - size / 2) + 'px';
      el.style.top = (r.top + r.height * 0.02) + 'px';
    }
    position();
    window.addEventListener('resize', position);
  }

  function costumeSvg(kind) {
    if (kind === 'witchhat') {
      return '<svg viewBox="0 0 100 90" width="100%" style="display:block">'
        + '<ellipse cx="50" cy="78" rx="42" ry="9" fill="#2b1a3d"/>'
        + '<path d="M50 5 L78 72 L22 72 Z" fill="#3d2a5c"/>'
        + '<rect x="24" y="63" width="52" height="11" rx="3" fill="#8e44ad"/>'
        + '<circle cx="50" cy="68" r="4" fill="#d4af37"/>'
        + '</svg>';
    }
    if (kind === 'santahat') {
      return '<svg viewBox="0 0 100 90" width="100%" style="display:block">'
        + '<path d="M22 72 Q20 30 55 12 Q85 25 78 60 Q60 68 22 72 Z" fill="#c62828"/>'
        + '<circle cx="80" cy="18" r="9" fill="#fff"/>'
        + '<rect x="14" y="62" width="68" height="16" rx="8" fill="#fff"/>'
        + '</svg>';
    }
    if (kind === 'partyhat') {
      return '<svg viewBox="0 0 100 90" width="100%" style="display:block">'
        + '<path d="M50 8 L76 74 L24 74 Z" fill="#d4af37"/>'
        + '<path d="M50 8 L58 30 L42 30 Z" fill="#fff8e1" opacity="0.5"/>'
        + '<rect x="24" y="66" width="52" height="10" rx="3" fill="#8e6d1a"/>'
        + '<circle cx="50" cy="10" r="5" fill="#fff"/>'
        + '</svg>';
    }
    if (kind === 'flowercrown') {
      return '<svg viewBox="0 0 100 60" width="100%" style="display:block">'
        + '<g>'
        + flowerAt(20,40) + flowerAt(40,28) + flowerAt(60,28) + flowerAt(80,40)
        + '</g>'
        + '<path d="M18 42 Q50 20 82 42" stroke="#2e7d32" stroke-width="4" fill="none"/>'
        + '</svg>';
    }
    if (kind === 'sunglasses') {
      return '<svg viewBox="0 0 100 50" width="100%" style="display:block">'
        + '<circle cx="30" cy="25" r="18" fill="#263238"/>'
        + '<circle cx="70" cy="25" r="18" fill="#263238"/>'
        + '<rect x="44" y="21" width="12" height="6" fill="#263238"/>'
        + '<circle cx="24" cy="19" r="4" fill="#546e7a" opacity="0.7"/>'
        + '</svg>';
    }
    if (kind === 'rainhat') {
      return '<svg viewBox="0 0 100 70" width="100%" style="display:block">'
        + '<ellipse cx="50" cy="50" rx="46" ry="11" fill="#1565c0"/>'
        + '<path d="M28 50 Q28 14 50 12 Q72 14 72 50 Z" fill="#1976d2"/>'
        + '</svg>';
    }
    return '';
  }
  function flowerAt(x, y) {
    return '<g transform="translate(' + x + ',' + y + ')">'
      + '<circle cx="0" cy="-7" r="5" fill="#f48fb1"/><circle cx="7" cy="0" r="5" fill="#f48fb1"/>'
      + '<circle cx="0" cy="7" r="5" fill="#f48fb1"/><circle cx="-7" cy="0" r="5" fill="#f48fb1"/>'
      + '<circle cx="0" cy="0" r="4" fill="#fff59d"/>'
      + '</g>';
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

  // Paints the season's picture as the page background. Scenes are original
  // illustrations drawn as SVG (so there is no stock-photo licensing question
  // and no extra files to deploy), anchored to the bottom and scaled to cover.
  function applySeasonPicture(scene) {
    var pic = SEASON_PHOTO_OVERRIDE[scene] || seasonPictures()[scene];
    if (!pic) return false;
    var css = pic.url
      ? 'url("' + pic.url + '")'
      : 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pic.svg) + '")';
    var target = document.body || document.documentElement;
    if (pic.base) target.style.backgroundColor = pic.base;
    target.style.backgroundImage = css;
    target.style.backgroundSize = 'cover';
    target.style.backgroundPosition = 'center bottom';
    target.style.backgroundRepeat = 'no-repeat';
    target.style.backgroundAttachment = 'fixed';
    // Dark pictures need light logo text; index.html styles .bg-dark for that.
    if (pic.dark) document.documentElement.classList.add('bg-dark');
    return true;
  }
  function seasonPictures() {
    return {
      halloween: { dark: true, base: '#1a0a2e', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" preserveAspectRatio=\"xMidYMax slice\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#0d0720\"/><stop offset=\".55\" stop-color=\"#34124f\"/><stop offset=\".86\" stop-color=\"#8f3a22\"/><stop offset=\"1\" stop-color=\"#d0651b\"/></linearGradient><radialGradient id=\"m\"><stop offset=\"0\" stop-color=\"#ffe9b8\" stop-opacity=\".55\"/><stop offset=\"1\" stop-color=\"#ffe9b8\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"g\"><stop offset=\"0\" stop-color=\"#ffb347\" stop-opacity=\".65\"/><stop offset=\"1\" stop-color=\"#ff7a00\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"p\" cx=\".4\" cy=\".35\" r=\".75\"><stop offset=\"0\" stop-color=\"#ffa24a\"/><stop offset=\".6\" stop-color=\"#e8680f\"/><stop offset=\"1\" stop-color=\"#8e3a05\"/></radialGradient></defs><rect width=\"1600\" height=\"900\" fill=\"url(#s)\"/><path d=\"M180,189h.1M936,263h.1M66,161h.1M158,472h.1M93,294h.1M198,376h.1M246,388h.1M1450,236h.1M1095,155h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M222,54h.1M1059,66h.1M189,370h.1M1262,454h.1M1508,331h.1M67,321h.1M53,295h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M1212,71h.1M228,304h.1M1418,368h.1M388,339h.1M99,119h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M716,198h.1M839,413h.1M388,374h.1M767,240h.1M5,326h.1M542,81h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M318,159h.1M1456,312h.1M1262,270h.1M380,46h.1M1147,224h.1M858,209h.1M1132,115h.1M475,461h.1M1423,118h.1M1430,465h.1M1266,191h.1M225,23h.1M435,364h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M1528,101h.1M1294,100h.1M588,159h.1M634,310h.1M945,410h.1M294,218h.1M750,451h.1M226,11h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M569,98h.1M728,384h.1M322,78h.1M907,295h.1M106,120h.1M444,131h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M138,255h.1M1562,477h.1M896,449h.1M1276,291h.1M408,367h.1M838,344h.1M681,341h.1M1073,340h.1M1495,108h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M150,93h.1M1113,46h.1M1377,471h.1M713,477h.1M332,118h.1M337,16h.1M1053,201h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><circle cx=\"1250\" cy=\"210\" r=\"320\" fill=\"url(#m)\"/><circle cx=\"1250\" cy=\"210\" r=\"92\" fill=\"#f6ecc9\"/><circle cx=\"1222\" cy=\"190\" r=\"14\" fill=\"#e2d2a0\" opacity=\".55\"/><circle cx=\"1278\" cy=\"238\" r=\"20\" fill=\"#e2d2a0\" opacity=\".5\"/><circle cx=\"1262\" cy=\"168\" r=\"9\" fill=\"#e2d2a0\" opacity=\".5\"/><path d=\"M-170,900 L-170,613 Q-170,613 -85,648 Q0,682 85,646 Q170,610 255,633 Q340,656 425,672 Q510,687 595,660 Q680,634 765,637 Q850,640 935,641 Q1020,643 1105,666 Q1190,690 1275,678 Q1360,667 1445,674 Q1530,680 1615,644 Q1700,608 1785,640 L1870,900 Z\" fill=\"#3b1550\" opacity=\"0.95\"/><path transform=\"translate(1090,150) scale(0.9)\" d=\"M0,0 Q8,-16 18,-4 Q22,-12 28,-2 Q34,-12 38,-4 Q48,-16 56,0 Q46,-3 38,8 Q28,2 18,8 Q10,-3 0,0Z\" fill=\"#07030d\"/><path transform=\"translate(1360,110) scale(0.7)\" d=\"M0,0 Q8,-16 18,-4 Q22,-12 28,-2 Q34,-12 38,-4 Q48,-16 56,0 Q46,-3 38,8 Q28,2 18,8 Q10,-3 0,0Z\" fill=\"#07030d\"/><path transform=\"translate(1000,250) scale(0.6)\" d=\"M0,0 Q8,-16 18,-4 Q22,-12 28,-2 Q34,-12 38,-4 Q48,-16 56,0 Q46,-3 38,8 Q28,2 18,8 Q10,-3 0,0Z\" fill=\"#07030d\"/><path transform=\"translate(1450,300) scale(0.55)\" d=\"M0,0 Q8,-16 18,-4 Q22,-12 28,-2 Q34,-12 38,-4 Q48,-16 56,0 Q46,-3 38,8 Q28,2 18,8 Q10,-3 0,0Z\" fill=\"#07030d\"/><path transform=\"translate(1180,330) scale(0.5)\" d=\"M0,0 Q8,-16 18,-4 Q22,-12 28,-2 Q34,-12 38,-4 Q48,-16 56,0 Q46,-3 38,8 Q28,2 18,8 Q10,-3 0,0Z\" fill=\"#07030d\"/><path d=\"M-170,900 L-170,732 Q-170,732 -85,730 Q0,728 85,743 Q170,757 255,754 Q340,751 425,758 Q510,764 595,758 Q680,752 765,758 Q850,764 935,747 Q1020,730 1105,734 Q1190,739 1275,747 Q1360,755 1445,743 Q1530,732 1615,721 Q1700,710 1785,725 L1870,900 Z\" fill=\"#1d0b2c\" opacity=\"1\"/><path d=\"M527,547L541,575M527,547L555,549M527,547L538,573M533,512L563,517M533,512L551,488M533,512L559,523M521,458L549,463M521,458L541,433M489,429L514,407M489,429L482,400M491,433L514,444M491,433L515,427M478,400L504,387M478,400L485,370M478,400L501,389M440,370L469,355M440,370L437,342M405,377L402,352M405,377L380,365M451,359L481,364M451,359L479,346M451,359L485,370M432,320L468,304M432,320L436,283M432,320L461,293M355,295L368,267M355,295L346,264M324,304L318,274M324,304L294,289M324,304L318,273M338,281L378,261M338,281L350,241M338,281L379,270M282,277L285,236M282,277L248,251M282,277L285,239M222,316L221,283M222,316L196,298M222,316L225,286M192,357L163,337M192,357L166,379M245,384L277,384M245,384L264,358M245,384L274,393M222,355L241,329M222,355L215,324M182,343L207,332M182,343L186,315M182,343L208,334M136,342L129,314M136,342L107,329M136,342L130,309M38,329L55,296M38,329L23,295M38,329L45,292M3,350L-12,317M3,350L-31,350M3,350L-18,317M-2,363L4,331M-2,363L-29,342M-2,363L-8,330M-26,393L-56,376M-26,393L-61,399M-26,393L-53,370M-59,407L-47,377M-59,407L-75,375M-104,436L-130,411M-104,436L-138,435M-104,436L-121,407M-102,454L-103,421M-102,454L-129,436M-102,454L-110,421M-123,489L-154,479M-123,489L-153,505M-123,489L-152,473M-128,516L-136,479M-128,516L-163,505M-128,516L-139,478M-145,564L-181,558M-145,564L-174,591M-132,638L-166,634M-132,638L-152,671M-111,660L-136,680M-111,660L-120,697M-111,660L-141,677\" stroke=\"#07030d\" stroke-width=\"3.6\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M496,522L527,547M496,522L533,512M481,470L521,458M481,470L489,429M457,432L491,433M457,432L478,400M424,408L440,370M424,408L405,377M408,364L451,359M408,364L432,320M348,339L355,295M348,339L324,304M303,324L338,281M303,324L282,277M238,357L222,316M238,357L192,357M207,395L245,384M207,395L222,355M161,375L182,343M161,375L136,342M44,377L38,329M44,377L3,350M20,402L-2,363M20,402L-26,393M-59,454L-59,407M-59,454L-104,436M-77,488L-102,454M-77,488L-123,489M-97,555L-128,516M-97,555L-145,564M-87,620L-132,638M-87,620L-111,660\" stroke=\"#07030d\" stroke-width=\"5.7\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M443,507L496,522M443,507L481,470M418,461L457,432M418,461L424,408M357,397L408,364M357,397L348,339M285,390L303,324M285,390L238,357M166,427L207,395M166,427L161,375M71,431L44,377M71,431L20,402M-20,507L-59,454M-20,507L-77,488M-37,576L-97,555M-37,576L-87,620\" stroke=\"#07030d\" stroke-width=\"7.8\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M376,519L443,507M376,519L418,461M319,466L357,397M319,466L285,390M129,488L166,427M129,488L71,431M43,557L-20,507M43,557L-37,576\" stroke=\"#07030d\" stroke-width=\"9.9\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M298,573L376,519M298,573L319,466M143,588L129,488M143,588L43,557\" stroke=\"#07030d\" stroke-width=\"12.0\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M230,691L298,573M230,691L143,588\" stroke=\"#07030d\" stroke-width=\"14.1\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M250,860L230,691\" stroke=\"#07030d\" stroke-width=\"16.2\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1697,610L1698,638M1697,610L1723,628M1697,610L1693,640M1722,583L1743,603M1722,583L1752,574M1722,583L1749,598M1738,524L1763,548M1738,524L1766,506M1738,524L1768,538M1716,482L1745,462M1716,482L1715,449M1683,483L1701,501M1683,483L1707,476M1671,450L1696,444M1671,450L1674,422M1671,450L1693,438M1645,421L1672,411M1645,421L1663,396M1645,421L1676,420M1611,409L1621,383M1611,409L1590,389M1611,409L1615,385M1645,462L1661,489M1645,462L1677,462M1645,462L1668,484M1634,412L1660,400M1634,412L1633,380M1595,370L1628,357M1595,370L1603,339M1559,368L1566,341M1559,368L1542,348M1559,368L1570,340M1477,336L1503,313M1477,336L1472,302M1477,336L1505,311M1441,346L1436,312M1441,346L1407,333M1417,360L1416,326M1417,360L1390,337M1391,385L1363,362M1391,385L1355,387M1501,396L1530,401M1501,396L1521,378M1477,375L1499,353M1477,375L1467,346M1477,375L1499,354M1465,364L1492,353M1465,364L1474,337M1465,364L1498,358M1423,355L1423,320M1423,355L1400,336M1423,355L1427,320M1397,376L1422,360M1397,376L1405,348M1361,368L1370,342M1361,368L1342,345M1315,394L1324,368M1315,394L1297,375M1290,422L1267,402M1290,422L1265,436M1290,422L1266,408M1307,417L1321,399M1307,417L1304,396M1307,417L1327,402M1286,420L1292,398M1286,420L1269,405M1261,423L1263,399M1261,423L1244,408M1261,423L1267,398M1238,441L1217,423M1238,441L1213,449M1234,453L1239,429M1234,453L1218,435M1234,453L1243,429M1210,470L1193,453M1210,470L1186,468M1210,470L1193,451M1187,513L1171,488M1187,513L1158,521M1191,543L1163,541M1191,543L1177,563\" stroke=\"#07030d\" stroke-width=\"3.6\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1681,574L1697,610M1681,574L1722,583M1693,520L1738,524M1693,520L1716,482M1647,476L1683,483M1647,476L1671,450M1615,445L1645,421M1615,445L1611,409M1608,445L1645,462M1608,445L1634,412M1570,405L1595,370M1570,405L1559,368M1470,384L1477,336M1470,384L1441,346M1433,403L1417,360M1433,403L1391,385M1464,413L1501,396M1464,413L1477,375M1437,395L1465,364M1437,395L1423,355M1374,405L1397,376M1374,405L1361,368M1327,426L1315,394M1327,426L1290,422M1299,448L1307,417M1299,448L1286,420M1272,454L1261,423M1272,454L1238,441M1243,485L1234,453M1243,485L1210,470M1221,528L1187,513M1221,528L1191,543\" stroke=\"#07030d\" stroke-width=\"5.7\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1639,545L1681,574M1639,545L1693,520M1603,491L1647,476M1603,491L1615,445M1558,458L1608,445M1558,458L1570,405M1478,444L1470,384M1478,444L1433,403M1429,450L1464,413M1429,450L1437,395M1367,455L1374,405M1367,455L1327,426M1304,489L1299,448M1304,489L1272,454M1271,522L1243,485M1271,522L1221,528\" stroke=\"#07030d\" stroke-width=\"7.8\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1565,548L1639,545M1565,548L1603,491M1513,511L1558,458M1513,511L1478,444M1400,512L1429,450M1400,512L1367,455M1330,542L1304,489M1330,542L1271,522\" stroke=\"#07030d\" stroke-width=\"9.9\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1495,605L1565,548M1495,605L1513,511M1394,596L1400,512M1394,596L1330,542\" stroke=\"#07030d\" stroke-width=\"12.0\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1435,711L1495,605M1435,711L1394,596\" stroke=\"#07030d\" stroke-width=\"14.1\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1420,860L1435,711\" stroke=\"#07030d\" stroke-width=\"16.2\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M304,702L314,725M304,702L330,705M304,702L314,730M302,660L325,658M302,660L316,638M284,635L305,636M284,635L301,621M267,619L280,603M267,619L267,597M254,603L280,603M254,603L268,584M230,584L246,562M230,584L225,559M230,584L248,566M189,576L205,556M189,576L180,553M189,576L206,556M153,588L144,566M153,588L130,581M153,588L138,566M212,630L231,645M212,630L238,628M212,630L232,646M201,591L223,577M201,591L199,565M165,572L188,566M165,572L176,551M134,566L135,544M134,566L121,550M134,566L139,544M92,570L111,558M92,570L87,544M92,570L113,556M64,568L65,542M64,568L46,554M21,593L25,569M21,593L2,582M21,593L22,569M9,615L-6,598M9,615L-12,624M9,615L-9,605\" stroke=\"#07030d\" stroke-width=\"3.6\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M276,679L304,702M276,679L302,660M257,647L284,635M257,647L267,619M223,618L254,603M223,618L230,584M179,607L189,576M179,607L153,588M180,622L212,630M180,622L201,591M143,595L165,572M143,595L134,566M77,598L92,570M77,598L64,568M37,621L21,593M37,621L9,615\" stroke=\"#07030d\" stroke-width=\"5.7\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M231,679L276,679M231,679L257,647M195,649L223,618M195,649L179,607M136,639L180,622M136,639L143,595M73,640L77,598M73,640L37,621\" stroke=\"#07030d\" stroke-width=\"7.8\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M177,707L231,679M177,707L195,649M105,691L136,639M105,691L73,640\" stroke=\"#07030d\" stroke-width=\"9.9\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M117,772L177,707M117,772L105,691\" stroke=\"#07030d\" stroke-width=\"12.0\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M95,880L117,772\" stroke=\"#07030d\" stroke-width=\"14.1\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M-170,900 L-170,841 Q-170,841 -85,830 Q0,818 85,831 Q170,843 255,847 Q340,851 425,840 Q510,828 595,830 Q680,833 765,824 Q850,816 935,821 Q1020,827 1105,838 Q1190,850 1275,838 Q1360,826 1445,835 Q1530,844 1615,847 Q1700,850 1785,834 L1870,900 Z\" fill=\"#0d0516\" opacity=\"1\"/><ellipse cx=\"430\" cy=\"850\" rx=\"48\" ry=\"38.400000000000006\" fill=\"url(#p)\"/><ellipse cx=\"406.0\" cy=\"854\" rx=\"26.400000000000002\" ry=\"36.480000000000004\" fill=\"url(#p)\"/><ellipse cx=\"454.0\" cy=\"854\" rx=\"26.400000000000002\" ry=\"36.480000000000004\" fill=\"url(#p)\"/><path d=\"M408,813 Q398,850 408,887\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M430,813 Q430,850 430,887\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M452,813 Q462,850 452,887\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M424,813 L427,796 L437,797 L436,813Z\" fill=\"#3d2a10\"/><circle cx=\"430\" cy=\"850\" r=\"72.0\" fill=\"url(#g)\"/><polygon points=\"406,838 420,838 413,826\" fill=\"#ffd36b\"/><polygon points=\"440,838 454,838 447,826\" fill=\"#ffd36b\"/><path d=\"M404,856 L416,867 L424,859 L436,868 L444,859 L456,856 L449,874 L411,874Z\" fill=\"#ffd36b\"/><ellipse cx=\"520\" cy=\"870\" rx=\"32\" ry=\"25.6\" fill=\"url(#p)\"/><ellipse cx=\"504.0\" cy=\"874\" rx=\"17.6\" ry=\"24.32\" fill=\"url(#p)\"/><ellipse cx=\"536.0\" cy=\"874\" rx=\"17.6\" ry=\"24.32\" fill=\"url(#p)\"/><path d=\"M506,845 Q498,870 506,895\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M520,845 Q520,870 520,895\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M534,845 Q542,870 534,895\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M514,845 L517,834 L527,835 L526,845Z\" fill=\"#3d2a10\"/><ellipse cx=\"1130\" cy=\"858\" rx=\"52\" ry=\"41.6\" fill=\"url(#p)\"/><ellipse cx=\"1104.0\" cy=\"862\" rx=\"28.6\" ry=\"39.52\" fill=\"url(#p)\"/><ellipse cx=\"1156.0\" cy=\"862\" rx=\"28.6\" ry=\"39.52\" fill=\"url(#p)\"/><path d=\"M1107,817 Q1095,858 1107,899\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M1130,817 Q1130,858 1130,899\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M1153,817 Q1165,858 1153,899\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M1124,817 L1127,800 L1137,801 L1136,817Z\" fill=\"#3d2a10\"/><circle cx=\"1130\" cy=\"858\" r=\"78.0\" fill=\"url(#g)\"/><polygon points=\"1104,845 1120,845 1112,832\" fill=\"#ffd36b\"/><polygon points=\"1140,845 1156,845 1148,832\" fill=\"#ffd36b\"/><path d=\"M1101,864 L1114,876 L1124,867 L1136,878 L1146,867 L1159,864 L1151,884 L1109,884Z\" fill=\"#ffd36b\"/><ellipse cx=\"1235\" cy=\"876\" rx=\"34\" ry=\"27.200000000000003\" fill=\"url(#p)\"/><ellipse cx=\"1218.0\" cy=\"880\" rx=\"18.700000000000003\" ry=\"25.84\" fill=\"url(#p)\"/><ellipse cx=\"1252.0\" cy=\"880\" rx=\"18.700000000000003\" ry=\"25.84\" fill=\"url(#p)\"/><path d=\"M1220,849 Q1212,876 1220,903\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M1235,849 Q1235,876 1235,903\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M1250,849 Q1258,876 1250,903\" stroke=\"#7a3004\" stroke-width=\"2\" fill=\"none\" opacity=\".45\"/><path d=\"M1229,849 L1232,838 L1242,839 L1241,849Z\" fill=\"#3d2a10\"/><ellipse cx=\"800\" cy=\"820\" rx=\"900\" ry=\"40\" fill=\"#e8dcff\" opacity=\".07\"/></svg>" },
      christmas: { dark: true, base: '#0d2447', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" preserveAspectRatio=\"xMidYMax slice\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#06122a\"/><stop offset=\".6\" stop-color=\"#14355f\"/><stop offset=\"1\" stop-color=\"#3d74a3\"/></linearGradient><radialGradient id=\"m\"><stop offset=\"0\" stop-color=\"#dfeeff\" stop-opacity=\".5\"/><stop offset=\"1\" stop-color=\"#dfeeff\" stop-opacity=\"0\"/></radialGradient></defs><rect width=\"1600\" height=\"900\" fill=\"url(#s)\"/><path d=\"M632,20h.1M865,240h.1M1344,397h.1M1505,149h.1M1181,167h.1M266,169h.1M1311,363h.1M241,74h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M585,24h.1M60,182h.1M1516,265h.1M923,167h.1M596,230h.1M790,92h.1M420,2h.1M164,238h.1M1518,258h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M145,178h.1M891,56h.1M705,46h.1M983,62h.1M1309,311h.1M828,149h.1M1264,198h.1M363,83h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M289,244h.1M684,132h.1M1263,344h.1M1184,192h.1M628,168h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M95,87h.1M1248,34h.1M373,204h.1M1375,399h.1M37,399h.1M477,270h.1M1353,218h.1M968,145h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M579,104h.1M264,144h.1M1035,417h.1M235,228h.1M1018,258h.1M1528,153h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M792,144h.1M560,209h.1M1063,25h.1M664,151h.1M591,238h.1M424,348h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M974,31h.1M63,281h.1M1147,373h.1M964,199h.1M137,43h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M1015,26h.1M1589,196h.1M1235,224h.1M999,378h.1M1455,144h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><circle cx=\"300\" cy=\"170\" r=\"200\" fill=\"url(#m)\"/><circle cx=\"300\" cy=\"170\" r=\"52\" fill=\"#eef5ff\"/><path d=\"M-170,900 L-170,611 Q-170,611 -85,619 Q0,627 85,598 Q170,570 255,580 Q340,591 425,604 Q510,617 595,596 Q680,576 765,604 Q850,631 935,613 Q1020,595 1105,603 Q1190,611 1275,589 Q1360,567 1445,601 Q1530,636 1615,627 Q1700,618 1785,607 L1870,900 Z\" fill=\"#6f8fb8\" opacity=\"0.95\"/><path d=\"M1189,524L1180,580L1198,580ZM254,496L238,580L270,580ZM44,508L31,580L57,580ZM745,506L731,580L758,580ZM979,508L966,580L992,580ZM759,498L743,580L775,580ZM249,510L237,580L262,580ZM34,502L20,580L49,580ZM1162,523L1153,580L1171,580ZM1199,522L1190,580L1209,580ZM1578,520L1569,580L1588,580ZM1398,526L1390,580L1407,580ZM340,511L328,580L353,580ZM1222,516L1211,580L1233,580ZM871,501L856,580L886,580ZM97,504L83,580L112,580ZM1436,506L1423,580L1450,580ZM1304,510L1292,580L1316,580ZM1323,499L1308,580L1339,580ZM209,522L200,580L219,580ZM817,500L802,580L832,580ZM1242,508L1229,580L1255,580ZM1242,522L1232,580L1251,580ZM226,507L213,580L240,580ZM193,524L184,580L201,580ZM1092,510L1079,580L1104,580ZM772,502L758,580L786,580ZM1413,525L1404,580L1422,580ZM306,525L297,580L315,580ZM156,512L145,580L168,580ZM45,499L29,580L60,580ZM101,516L90,580L112,580ZM1557,508L1544,580L1570,580ZM319,518L309,580L330,580ZM813,502L798,580L828,580ZM812,519L802,580L823,580ZM837,499L822,580L852,580ZM1484,498L1469,580L1500,580ZM1428,520L1418,580L1438,580ZM716,514L704,580L728,580ZM628,517L617,580L639,580ZM1074,513L1062,580L1086,580ZM340,517L330,580L351,580ZM196,502L181,580L210,580ZM1503,507L1490,580L1517,580ZM586,519L576,580L596,580Z\" fill=\"#0b2a3d\" opacity=\".55\"/><path d=\"M-170,900 L-170,665 Q-170,665 -85,676 Q0,688 85,698 Q170,707 255,684 Q340,662 425,689 Q510,717 595,692 Q680,666 765,684 Q850,702 935,686 Q1020,671 1105,688 Q1190,704 1275,715 Q1360,725 1445,704 Q1530,683 1615,684 Q1700,684 1785,682 L1870,900 Z\" fill=\"#9fb9d8\" opacity=\"1\"/><ellipse cx=\"470\" cy=\"715\" rx=\"240\" ry=\"48\" fill=\"#b8cde6\"/><rect x=\"430\" y=\"668\" width=\"70\" height=\"46\" fill=\"#4a2f1c\"/><polygon points=\"422,670 465,636 508,670\" fill=\"#2a1a10\"/><polygon points=\"422,670 465,636 508,670\" fill=\"#f4f9ff\" opacity=\".9\" transform=\"translate(0,-5) scale(1,.9) translate(0,60)\"/><rect x=\"448\" y=\"682\" width=\"16\" height=\"16\" fill=\"#ffcf6b\"/><circle cx=\"456\" cy=\"690\" r=\"26\" fill=\"#ffcf6b\" opacity=\".18\"/><rect x=\"480\" y=\"640\" width=\"10\" height=\"22\" fill=\"#4a2f1c\"/><path d=\"M-170,900 L-170,767 Q-170,767 -85,775 Q0,782 85,782 Q170,781 255,784 Q340,788 425,795 Q510,801 595,792 Q680,784 765,787 Q850,791 935,785 Q1020,779 1105,797 Q1190,816 1275,792 Q1360,768 1445,791 Q1530,813 1615,794 Q1700,775 1785,793 L1870,900 Z\" fill=\"#d6e4f4\" opacity=\"1\"/><rect x=\"150\" y=\"854\" width=\"20\" height=\"33\" fill=\"#2a1a10\"/><polygon points=\"160,550 114,689 206,689\" fill=\"#0e4030\"/><path d=\"M160,550 L142,605 Q151,592 160,608 Q169,592 178,605Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"121\" cy=\"685\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"121\" cy=\"685\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"141\" cy=\"685\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"141\" cy=\"685\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"160\" cy=\"685\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"160\" cy=\"685\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"179\" cy=\"685\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"179\" cy=\"685\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"199\" cy=\"685\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"199\" cy=\"685\" r=\"3.2\" fill=\"#ff5252\"/><polygon points=\"160,616 94,755 226,755\" fill=\"#0e4030\"/><path d=\"M160,616 L133,671 Q147,658 160,674 Q173,658 187,671Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"104\" cy=\"751\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"104\" cy=\"751\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"132\" cy=\"751\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"132\" cy=\"751\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"160\" cy=\"751\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"160\" cy=\"751\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"188\" cy=\"751\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"188\" cy=\"751\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"216\" cy=\"751\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"216\" cy=\"751\" r=\"3.2\" fill=\"#ffd54f\"/><polygon points=\"160,682 73,821 247,821\" fill=\"#0e4030\"/><path d=\"M160,682 L125,737 Q143,724 160,740 Q177,724 195,737Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"87\" cy=\"817\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"87\" cy=\"817\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"123\" cy=\"817\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"123\" cy=\"817\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"160\" cy=\"817\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"160\" cy=\"817\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"197\" cy=\"817\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"197\" cy=\"817\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"233\" cy=\"817\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"233\" cy=\"817\" r=\"3.2\" fill=\"#64b5f6\"/><polygon points=\"160,748 53,887 267,887\" fill=\"#0e4030\"/><path d=\"M160,748 L117,803 Q139,790 160,806 Q181,790 203,803Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"70\" cy=\"883\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"70\" cy=\"883\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"115\" cy=\"883\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"115\" cy=\"883\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"160\" cy=\"883\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"160\" cy=\"883\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"205\" cy=\"883\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"205\" cy=\"883\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"250\" cy=\"883\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"250\" cy=\"883\" r=\"3.2\" fill=\"#ffffff\"/><polygon points=\"160,532 166,550 154,550\" fill=\"#ffd54f\"/><rect x=\"1429\" y=\"851\" width=\"22\" height=\"36\" fill=\"#2a1a10\"/><polygon points=\"1440,520 1390,671 1490,671\" fill=\"#0e4030\"/><path d=\"M1440,520 L1420,580 Q1430,565 1440,584 Q1450,565 1460,580Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1398\" cy=\"667\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1398\" cy=\"667\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1419\" cy=\"667\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1419\" cy=\"667\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1440\" cy=\"667\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1440\" cy=\"667\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1461\" cy=\"667\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1461\" cy=\"667\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1482\" cy=\"667\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1482\" cy=\"667\" r=\"3.2\" fill=\"#ff5252\"/><polygon points=\"1440,592 1367,743 1513,743\" fill=\"#0e4030\"/><path d=\"M1440,592 L1411,652 Q1425,637 1440,656 Q1455,637 1469,652Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1379\" cy=\"739\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1379\" cy=\"739\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1410\" cy=\"739\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1410\" cy=\"739\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1440\" cy=\"739\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1440\" cy=\"739\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1470\" cy=\"739\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1470\" cy=\"739\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1501\" cy=\"739\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1501\" cy=\"739\" r=\"3.2\" fill=\"#ffd54f\"/><polygon points=\"1440,664 1345,815 1535,815\" fill=\"#0e4030\"/><path d=\"M1440,664 L1402,724 Q1421,709 1440,728 Q1459,709 1478,724Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1360\" cy=\"811\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1360\" cy=\"811\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1400\" cy=\"811\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1400\" cy=\"811\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1440\" cy=\"811\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1440\" cy=\"811\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1480\" cy=\"811\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1480\" cy=\"811\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1520\" cy=\"811\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1520\" cy=\"811\" r=\"3.2\" fill=\"#64b5f6\"/><polygon points=\"1440,736 1323,887 1557,887\" fill=\"#0e4030\"/><path d=\"M1440,736 L1393,796 Q1417,781 1440,800 Q1463,781 1487,796Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1342\" cy=\"883\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1342\" cy=\"883\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1391\" cy=\"883\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1391\" cy=\"883\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1440\" cy=\"883\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1440\" cy=\"883\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1489\" cy=\"883\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1489\" cy=\"883\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1538\" cy=\"883\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1538\" cy=\"883\" r=\"3.2\" fill=\"#ffffff\"/><polygon points=\"1440,502 1446,520 1434,520\" fill=\"#ffd54f\"/><rect x=\"32\" y=\"860\" width=\"16\" height=\"25\" fill=\"#2a1a10\"/><polygon points=\"40,630 5,735 75,735\" fill=\"#0e4030\"/><path d=\"M40,630 L26,672 Q33,662 40,674 Q47,662 54,672Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"11\" cy=\"731\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"11\" cy=\"731\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"25\" cy=\"731\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"25\" cy=\"731\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"40\" cy=\"731\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"40\" cy=\"731\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"55\" cy=\"731\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"55\" cy=\"731\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"69\" cy=\"731\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"69\" cy=\"731\" r=\"3.2\" fill=\"#ff5252\"/><polygon points=\"40,680 -10,785 90,785\" fill=\"#0e4030\"/><path d=\"M40,680 L20,722 Q30,712 40,724 Q50,712 60,722Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"-2\" cy=\"781\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"-2\" cy=\"781\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"19\" cy=\"781\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"19\" cy=\"781\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"40\" cy=\"781\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"40\" cy=\"781\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"61\" cy=\"781\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"61\" cy=\"781\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"82\" cy=\"781\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"82\" cy=\"781\" r=\"3.2\" fill=\"#ffd54f\"/><polygon points=\"40,730 -26,835 106,835\" fill=\"#0e4030\"/><path d=\"M40,730 L14,772 Q27,762 40,774 Q53,762 66,772Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"-15\" cy=\"831\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"-15\" cy=\"831\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"12\" cy=\"831\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"12\" cy=\"831\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"40\" cy=\"831\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"40\" cy=\"831\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"68\" cy=\"831\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"68\" cy=\"831\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"95\" cy=\"831\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"95\" cy=\"831\" r=\"3.2\" fill=\"#64b5f6\"/><polygon points=\"40,780 -41,885 121,885\" fill=\"#0e4030\"/><path d=\"M40,780 L7,822 Q24,812 40,824 Q56,812 73,822Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"-28\" cy=\"881\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"-28\" cy=\"881\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"6\" cy=\"881\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"6\" cy=\"881\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"40\" cy=\"881\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"40\" cy=\"881\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"74\" cy=\"881\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"74\" cy=\"881\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"108\" cy=\"881\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"108\" cy=\"881\" r=\"3.2\" fill=\"#ffffff\"/><polygon points=\"40,612 46,630 34,630\" fill=\"#ffd54f\"/><rect x=\"1552\" y=\"858\" width=\"17\" height=\"27\" fill=\"#2a1a10\"/><polygon points=\"1560,610 1522,723 1598,723\" fill=\"#0e4030\"/><path d=\"M1560,610 L1545,655 Q1552,644 1560,658 Q1568,644 1575,655Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1528\" cy=\"719\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1528\" cy=\"719\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1544\" cy=\"719\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1544\" cy=\"719\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1560\" cy=\"719\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1560\" cy=\"719\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1576\" cy=\"719\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1576\" cy=\"719\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1592\" cy=\"719\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1592\" cy=\"719\" r=\"3.2\" fill=\"#ff5252\"/><polygon points=\"1560,664 1506,777 1614,777\" fill=\"#0e4030\"/><path d=\"M1560,664 L1538,709 Q1549,698 1560,712 Q1571,698 1582,709Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1514\" cy=\"773\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1514\" cy=\"773\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1537\" cy=\"773\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1537\" cy=\"773\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1560\" cy=\"773\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1560\" cy=\"773\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1583\" cy=\"773\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1583\" cy=\"773\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1606\" cy=\"773\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1606\" cy=\"773\" r=\"3.2\" fill=\"#ffd54f\"/><polygon points=\"1560,718 1489,831 1631,831\" fill=\"#0e4030\"/><path d=\"M1560,718 L1532,763 Q1546,752 1560,766 Q1574,752 1588,763Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1500\" cy=\"827\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1500\" cy=\"827\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1530\" cy=\"827\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1530\" cy=\"827\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1560\" cy=\"827\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1560\" cy=\"827\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1590\" cy=\"827\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1590\" cy=\"827\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1620\" cy=\"827\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1620\" cy=\"827\" r=\"3.2\" fill=\"#64b5f6\"/><polygon points=\"1560,772 1472,885 1648,885\" fill=\"#0e4030\"/><path d=\"M1560,772 L1525,817 Q1542,806 1560,820 Q1578,806 1595,817Z\" fill=\"#f4f9ff\" opacity=\".95\"/><circle cx=\"1486\" cy=\"881\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1486\" cy=\"881\" r=\"3.2\" fill=\"#ffffff\"/><circle cx=\"1523\" cy=\"881\" r=\"9\" fill=\"#ff5252\" opacity=\".28\"/><circle cx=\"1523\" cy=\"881\" r=\"3.2\" fill=\"#ff5252\"/><circle cx=\"1560\" cy=\"881\" r=\"9\" fill=\"#ffd54f\" opacity=\".28\"/><circle cx=\"1560\" cy=\"881\" r=\"3.2\" fill=\"#ffd54f\"/><circle cx=\"1597\" cy=\"881\" r=\"9\" fill=\"#64b5f6\" opacity=\".28\"/><circle cx=\"1597\" cy=\"881\" r=\"3.2\" fill=\"#64b5f6\"/><circle cx=\"1634\" cy=\"881\" r=\"9\" fill=\"#ffffff\" opacity=\".28\"/><circle cx=\"1634\" cy=\"881\" r=\"3.2\" fill=\"#ffffff\"/><polygon points=\"1560,592 1566,610 1554,610\" fill=\"#ffd54f\"/><rect x=\"294\" y=\"834\" width=\"12\" height=\"20\" fill=\"#2a1a10\"/><polygon points=\"300,650 273,734 327,734\" fill=\"#0f3d2c\"/><path d=\"M300,650 L289,684 Q295,675 300,685 Q305,675 311,684Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"300,690 261,774 339,774\" fill=\"#0f3d2c\"/><path d=\"M300,690 L284,724 Q292,715 300,725 Q308,715 316,724Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"300,730 249,814 351,814\" fill=\"#0f3d2c\"/><path d=\"M300,730 L280,764 Q290,755 300,765 Q310,755 320,764Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"300,770 237,854 363,854\" fill=\"#0f3d2c\"/><path d=\"M300,770 L275,804 Q287,795 300,805 Q313,795 325,804Z\" fill=\"#f4f9ff\" opacity=\".95\"/><rect x=\"1283\" y=\"832\" width=\"13\" height=\"22\" fill=\"#2a1a10\"/><polygon points=\"1290,630 1260,722 1320,722\" fill=\"#0f3d2c\"/><path d=\"M1290,630 L1278,667 Q1284,658 1290,669 Q1296,658 1302,667Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"1290,674 1247,766 1333,766\" fill=\"#0f3d2c\"/><path d=\"M1290,674 L1273,711 Q1281,702 1290,713 Q1299,702 1307,711Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"1290,718 1234,810 1346,810\" fill=\"#0f3d2c\"/><path d=\"M1290,718 L1268,755 Q1279,746 1290,757 Q1301,746 1312,755Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"1290,762 1221,854 1359,854\" fill=\"#0f3d2c\"/><path d=\"M1290,762 L1262,799 Q1276,790 1290,801 Q1304,790 1318,799Z\" fill=\"#f4f9ff\" opacity=\".95\"/><rect x=\"1176\" y=\"838\" width=\"9\" height=\"15\" fill=\"#2a1a10\"/><polygon points=\"1180,700 1160,763 1200,763\" fill=\"#0f3d2c\"/><path d=\"M1180,700 L1172,725 Q1176,719 1180,726 Q1184,719 1188,725Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"1180,730 1151,793 1209,793\" fill=\"#0f3d2c\"/><path d=\"M1180,730 L1168,755 Q1174,749 1180,756 Q1186,749 1192,755Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"1180,760 1142,823 1218,823\" fill=\"#0f3d2c\"/><path d=\"M1180,760 L1165,785 Q1172,779 1180,786 Q1188,779 1195,785Z\" fill=\"#f4f9ff\" opacity=\".95\"/><polygon points=\"1180,790 1133,853 1227,853\" fill=\"#0f3d2c\"/><path d=\"M1180,790 L1161,815 Q1171,809 1180,816 Q1189,809 1199,815Z\" fill=\"#f4f9ff\" opacity=\".95\"/><path d=\"M-170,900 L-170,837 Q-170,837 -85,840 Q0,843 85,853 Q170,863 255,851 Q340,840 425,849 Q510,858 595,859 Q680,860 765,861 Q850,861 935,858 Q1020,856 1105,860 Q1190,864 1275,856 Q1360,847 1445,849 Q1530,851 1615,851 Q1700,850 1785,850 L1870,900 Z\" fill=\"#f2f7fd\" opacity=\"1\"/><path d=\"M446,720h.1M543,498h.1M25,660h.1M1053,585h.1M1332,636h.1M571,1h.1M759,452h.1M230,528h.1M479,567h.1M455,557h.1M766,615h.1M777,875h.1M463,69h.1M797,789h.1M255,855h.1M519,304h.1M1504,176h.1M83,596h.1M1299,568h.1M412,601h.1M789,626h.1M1523,446h.1M174,70h.1M601,418h.1\" stroke=\"#fff\" stroke-width=\"5\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M1432,242h.1M555,16h.1M713,237h.1M1337,503h.1M376,681h.1M413,513h.1M444,871h.1M842,492h.1M1127,277h.1M1183,454h.1M1552,281h.1M305,587h.1M672,797h.1M866,402h.1M312,57h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M142,234h.1M469,414h.1M1532,768h.1M1428,706h.1M1040,414h.1M1012,178h.1M348,441h.1M319,880h.1M464,335h.1M1393,345h.1M805,567h.1M234,354h.1M96,354h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M107,776h.1M464,450h.1M823,221h.1M648,313h.1M1456,678h.1M1322,526h.1M1002,613h.1M1193,426h.1M531,586h.1M399,239h.1M273,373h.1M120,451h.1M1506,650h.1M621,201h.1M17,271h.1M608,692h.1\" stroke=\"#fff\" stroke-width=\"7\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M207,474h.1M1073,254h.1M518,31h.1M1070,108h.1M352,816h.1M713,859h.1M784,66h.1M1018,629h.1\" stroke=\"#fff\" stroke-width=\"5\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M1551,236h.1M1492,566h.1M23,563h.1M808,4h.1M1320,644h.1M67,573h.1M930,128h.1M547,82h.1M434,224h.1M52,639h.1M247,470h.1M372,828h.1M113,472h.1M797,607h.1M744,239h.1M776,819h.1M1559,128h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M873,800h.1M1100,884h.1M1223,649h.1M994,120h.1M1590,348h.1M1524,119h.1M649,654h.1M304,336h.1M721,677h.1M777,821h.1M650,215h.1M1556,224h.1M136,699h.1M580,357h.1M1172,898h.1M1343,886h.1M397,563h.1M581,301h.1\" stroke=\"#fff\" stroke-width=\"7\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M261,76h.1M5,718h.1M602,109h.1M1598,530h.1M1209,769h.1M409,665h.1M223,173h.1M1534,580h.1M140,635h.1M1180,427h.1\" stroke=\"#fff\" stroke-width=\"5\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M687,631h.1M1530,579h.1M1437,83h.1M457,419h.1M447,101h.1M325,73h.1M336,243h.1M486,115h.1M748,281h.1\" stroke=\"#fff\" stroke-width=\"7\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/></svg>" },
      newyear: { dark: true, base: '#0a1030', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" preserveAspectRatio=\"xMidYMax slice\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#02030a\"/><stop offset=\".6\" stop-color=\"#0b1236\"/><stop offset=\"1\" stop-color=\"#2a2150\"/></linearGradient><radialGradient id=\"bg\"><stop offset=\"0\" stop-color=\"#ffe9a8\" stop-opacity=\".35\"/><stop offset=\"1\" stop-color=\"#ffe9a8\" stop-opacity=\"0\"/></radialGradient></defs><rect width=\"1600\" height=\"900\" fill=\"url(#s)\"/><path d=\"M1371,328h.1M1368,80h.1M1182,273h.1M614,166h.1M725,403h.1M217,162h.1M126,20h.1M915,55h.1M499,14h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M1008,333h.1M539,131h.1M1597,8h.1M469,74h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M485,38h.1M172,122h.1M1213,50h.1M1593,253h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M67,413h.1M389,253h.1M315,399h.1M627,177h.1M983,118h.1M1106,245h.1M120,28h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M1331,27h.1M1024,210h.1M732,117h.1M1132,132h.1M1576,323h.1M67,61h.1M497,96h.1M1161,67h.1M202,201h.1\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M1407,252h.1M1356,0h.1M752,412h.1M432,408h.1M820,107h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><path d=\"M705,354h.1M117,264h.1M15,256h.1M117,38h.1M219,30h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.7\" fill=\"none\"/><path d=\"M462,29h.1M162,25h.1M27,113h.1M56,8h.1\" stroke=\"#fff\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\"0.95\" fill=\"none\"/><path d=\"M1091,79h.1M97,74h.1M1426,412h.1\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\"0.45\" fill=\"none\"/><circle cx=\"380\" cy=\"270\" r=\"153\" fill=\"url(#bg)\"/><path d=\"M428,270L540,270M426,281L533,305M423,291L512,333M417,300L518,380M410,307L486,403M401,313L445,404M391,316L419,443M380,318L380,426M369,316L347,414M359,313L310,415M350,307L288,385M343,300L244,378M337,291L221,347M334,281L238,302M332,270L219,270M334,259L239,238M337,249L230,198M343,240L257,172M350,233L290,157M359,227L316,138M369,224L347,126M380,222L380,122M391,224L414,121M401,227L449,127M410,233L477,148M417,240L518,160M423,249L531,197M426,259L536,234M406,273L468,279M404,281L461,309M398,289L442,334M391,294L417,351M382,296L386,355M373,295L358,348M365,291L333,335M358,285L300,325M355,276L301,290M354,267L286,261M356,259L297,230M362,251L318,207M369,246L340,182M378,244L374,184M387,245L402,191M395,249L433,196M402,255L454,220M405,264L471,247\" stroke=\"#f5c542\" stroke-width=\"2.2\" stroke-linecap=\"round\" opacity=\".85\" fill=\"none\"/><path d=\"M540,270h.1M533,305h.1M512,333h.1M518,380h.1M486,403h.1M445,404h.1M419,443h.1M380,426h.1M347,414h.1M310,415h.1M288,385h.1M244,378h.1M221,347h.1M238,302h.1M219,270h.1M239,238h.1M230,198h.1M257,172h.1M290,157h.1M316,138h.1M347,126h.1M380,122h.1M414,121h.1M449,127h.1M477,148h.1M518,160h.1M531,197h.1M536,234h.1M468,279h.1M461,309h.1M442,334h.1M417,351h.1M386,355h.1M358,348h.1M333,335h.1M300,325h.1M301,290h.1M286,261h.1M297,230h.1M318,207h.1M340,182h.1M374,184h.1M402,191h.1M433,196h.1M454,220h.1M471,247h.1\" stroke=\"#f5c542\" stroke-width=\"6\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"380\" cy=\"270\" r=\"5\" fill=\"#fff\"/><circle cx=\"1210\" cy=\"210\" r=\"171\" fill=\"url(#bg)\"/><path d=\"M1263,210L1385,210M1262,222L1402,254M1258,233L1373,288M1252,243L1343,316M1243,252L1320,348M1233,258L1284,364M1222,262L1251,391M1210,263L1210,402M1198,262L1168,395M1187,258L1137,362M1177,252L1104,343M1168,243L1077,316M1162,233L1033,295M1158,222L1045,248M1157,210L1043,210M1158,198L1040,171M1162,187L1034,125M1168,177L1083,108M1177,168L1108,82M1187,162L1124,31M1198,158L1167,22M1210,157L1210,44M1222,158L1250,35M1233,162L1295,33M1243,168L1330,59M1252,177L1348,100M1258,187L1373,131M1262,198L1392,168M1239,213L1313,220M1236,223L1306,256M1230,231L1281,283M1222,237L1249,297M1212,239L1218,316M1202,238L1184,301M1193,234L1151,292M1186,226L1125,268M1182,217L1118,233M1181,207L1114,200M1184,197L1118,166M1190,189L1140,138M1198,183L1168,117M1208,181L1203,113M1218,182L1235,121M1227,186L1271,125M1234,194L1288,157M1238,203L1312,184\" stroke=\"#eef3ff\" stroke-width=\"2.2\" stroke-linecap=\"round\" opacity=\".85\" fill=\"none\"/><path d=\"M1385,210h.1M1402,254h.1M1373,288h.1M1343,316h.1M1320,348h.1M1284,364h.1M1251,391h.1M1210,402h.1M1168,395h.1M1137,362h.1M1104,343h.1M1077,316h.1M1033,295h.1M1045,248h.1M1043,210h.1M1040,171h.1M1034,125h.1M1083,108h.1M1108,82h.1M1124,31h.1M1167,22h.1M1210,44h.1M1250,35h.1M1295,33h.1M1330,59h.1M1348,100h.1M1373,131h.1M1392,168h.1M1313,220h.1M1306,256h.1M1281,283h.1M1249,297h.1M1218,316h.1M1184,301h.1M1151,292h.1M1125,268h.1M1118,233h.1M1114,200h.1M1118,166h.1M1140,138h.1M1168,117h.1M1203,113h.1M1235,121h.1M1271,125h.1M1288,157h.1M1312,184h.1\" stroke=\"#eef3ff\" stroke-width=\"6\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"1210\" cy=\"210\" r=\"5\" fill=\"#fff\"/><circle cx=\"1010\" cy=\"70\" r=\"86\" fill=\"url(#bg)\"/><path d=\"M1037,70L1106,70M1036,76L1107,92M1034,82L1085,106M1031,87L1075,122M1027,91L1067,141M1022,94L1050,154M1016,96L1030,156M1010,97L1010,152M1004,96L991,152M998,94L968,157M993,91L957,137M989,87L936,129M986,82L924,111M984,76L921,90M983,70L929,70M984,64L927,51M986,58L924,29M989,53L939,13M993,49L948,-7M998,46L971,-11M1004,44L988,-27M1010,43L1010,-14M1016,44L1032,-24M1022,46L1051,-15M1027,49L1063,4M1031,53L1079,15M1034,58L1098,28M1036,64L1096,50M1025,71L1059,75M1023,76L1052,90M1020,80L1047,108M1016,83L1028,111M1011,85L1014,120M1006,84L996,119M1001,82L981,110M998,78L966,100M996,74L963,82M995,69L962,65M997,64L961,46M1000,60L978,37M1004,57L988,21M1009,55L1006,17M1014,56L1025,18M1019,58L1037,33M1022,62L1049,44M1024,66L1057,58\" stroke=\"#ff9e80\" stroke-width=\"2.2\" stroke-linecap=\"round\" opacity=\".85\" fill=\"none\"/><path d=\"M1106,70h.1M1107,92h.1M1085,106h.1M1075,122h.1M1067,141h.1M1050,154h.1M1030,156h.1M1010,152h.1M991,152h.1M968,157h.1M957,137h.1M936,129h.1M924,111h.1M921,90h.1M929,70h.1M927,51h.1M924,29h.1M939,13h.1M948,-7h.1M971,-11h.1M988,-27h.1M1010,-14h.1M1032,-24h.1M1051,-15h.1M1063,4h.1M1079,15h.1M1098,28h.1M1096,50h.1M1059,75h.1M1052,90h.1M1047,108h.1M1028,111h.1M1014,120h.1M996,119h.1M981,110h.1M966,100h.1M963,82h.1M962,65h.1M961,46h.1M978,37h.1M988,21h.1M1006,17h.1M1025,18h.1M1037,33h.1M1049,44h.1M1057,58h.1\" stroke=\"#ff9e80\" stroke-width=\"6\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"1010\" cy=\"70\" r=\"5\" fill=\"#fff\"/><circle cx=\"1400\" cy=\"470\" r=\"99\" fill=\"url(#bg)\"/><path d=\"M1431,470L1495,470M1430,477L1498,492M1428,483L1504,520M1424,489L1489,541M1419,494L1462,548M1413,498L1447,568M1407,500L1421,561M1400,501L1400,575M1393,500L1379,562M1387,498L1356,561M1381,494L1336,550M1376,489L1322,532M1372,483L1298,519M1370,477L1304,492M1369,470L1287,470M1370,463L1300,447M1372,457L1315,429M1376,451L1318,404M1381,446L1332,385M1387,442L1351,368M1393,440L1377,369M1400,439L1400,355M1407,440L1425,360M1413,442L1446,375M1419,446L1468,385M1424,451L1481,406M1428,457L1502,421M1430,463L1504,446M1417,472L1459,476M1415,477L1455,496M1412,482L1440,511M1407,485L1424,523M1401,487L1405,531M1395,486L1384,526M1390,484L1369,513M1386,480L1352,502M1384,474L1340,485M1383,468L1346,465M1385,463L1346,444M1388,458L1356,425M1393,455L1375,414M1399,453L1396,411M1405,454L1415,417M1410,456L1431,427M1414,460L1448,437M1416,466L1453,457\" stroke=\"#f5c542\" stroke-width=\"2.2\" stroke-linecap=\"round\" opacity=\".85\" fill=\"none\"/><path d=\"M1495,470h.1M1498,492h.1M1504,520h.1M1489,541h.1M1462,548h.1M1447,568h.1M1421,561h.1M1400,575h.1M1379,562h.1M1356,561h.1M1336,550h.1M1322,532h.1M1298,519h.1M1304,492h.1M1287,470h.1M1300,447h.1M1315,429h.1M1318,404h.1M1332,385h.1M1351,368h.1M1377,369h.1M1400,355h.1M1425,360h.1M1446,375h.1M1468,385h.1M1481,406h.1M1502,421h.1M1504,446h.1M1459,476h.1M1455,496h.1M1440,511h.1M1424,523h.1M1405,531h.1M1384,526h.1M1369,513h.1M1352,502h.1M1340,485h.1M1346,465h.1M1346,444h.1M1356,425h.1M1375,414h.1M1396,411h.1M1415,417h.1M1431,427h.1M1448,437h.1M1453,457h.1\" stroke=\"#f5c542\" stroke-width=\"6\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"1400\" cy=\"470\" r=\"5\" fill=\"#fff\"/><circle cx=\"190\" cy=\"500\" r=\"94\" fill=\"url(#bg)\"/><path d=\"M219,500L290,500M219,507L285,522M216,513L273,540M213,518L260,556M208,523L251,576M203,526L234,591M197,529L210,588M190,529L190,609M183,529L168,598M177,526L142,599M172,523L133,572M167,518L119,557M164,513L106,540M161,507L84,524M161,500L91,500M161,493L84,476M164,487L94,454M167,482L114,439M172,477L131,426M177,474L147,410M183,471L169,406M190,471L190,392M197,471L214,394M203,474L237,402M208,477L253,422M213,482L262,443M216,487L278,457M219,493L278,480M206,502L242,505M205,507L242,525M201,512L232,543M197,515L210,545M191,516L194,551M186,516L177,547M181,513L159,543M177,509L143,532M174,504L140,513M174,498L135,495M175,493L141,476M179,488L151,460M183,485L166,446M189,484L186,444M194,484L206,445M199,487L223,454M203,491L239,467M206,496L238,488\" stroke=\"#9fd0ff\" stroke-width=\"2.2\" stroke-linecap=\"round\" opacity=\".85\" fill=\"none\"/><path d=\"M290,500h.1M285,522h.1M273,540h.1M260,556h.1M251,576h.1M234,591h.1M210,588h.1M190,609h.1M168,598h.1M142,599h.1M133,572h.1M119,557h.1M106,540h.1M84,524h.1M91,500h.1M84,476h.1M94,454h.1M114,439h.1M131,426h.1M147,410h.1M169,406h.1M190,392h.1M214,394h.1M237,402h.1M253,422h.1M262,443h.1M278,457h.1M278,480h.1M242,505h.1M242,525h.1M232,543h.1M210,545h.1M194,551h.1M177,547h.1M159,543h.1M143,532h.1M140,513h.1M135,495h.1M141,476h.1M151,460h.1M166,446h.1M186,444h.1M206,445h.1M223,454h.1M239,467h.1M238,488h.1\" stroke=\"#9fd0ff\" stroke-width=\"6\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"190\" cy=\"500\" r=\"5\" fill=\"#fff\"/><circle cx=\"260\" cy=\"95\" r=\"76\" fill=\"url(#bg)\"/><path d=\"M284,95L343,95M283,100L344,114M281,105L335,131M279,110L324,146M275,114L314,163M270,116L295,168M265,118L277,169M260,119L260,171M255,118L242,174M250,116L224,169M245,114L214,153M241,110L191,150M239,105L185,131M237,100L184,112M236,95L185,95M237,90L180,77M239,85L181,57M241,80L201,48M245,76L207,28M250,74L227,27M255,72L244,23M260,71L260,8M265,72L277,22M270,74L292,29M275,76L309,33M279,80L322,45M281,85L340,57M283,90L339,77M273,96L306,100M272,101L297,113M269,104L292,128M265,107L279,138M261,108L263,136M256,108L248,138M252,106L235,130M249,102L221,122M247,98L218,106M247,94L214,90M248,89L219,75M251,86L230,64M255,83L240,50M259,82L256,48M264,82L273,50M268,84L286,59M271,88L293,72M273,92L305,83\" stroke=\"#ffd9a0\" stroke-width=\"2.2\" stroke-linecap=\"round\" opacity=\".85\" fill=\"none\"/><path d=\"M343,95h.1M344,114h.1M335,131h.1M324,146h.1M314,163h.1M295,168h.1M277,169h.1M260,171h.1M242,174h.1M224,169h.1M214,153h.1M191,150h.1M185,131h.1M184,112h.1M185,95h.1M180,77h.1M181,57h.1M201,48h.1M207,28h.1M227,27h.1M244,23h.1M260,8h.1M277,22h.1M292,29h.1M309,33h.1M322,45h.1M340,57h.1M339,77h.1M306,100h.1M297,113h.1M292,128h.1M279,138h.1M263,136h.1M248,138h.1M235,130h.1M221,122h.1M218,106h.1M214,90h.1M219,75h.1M230,64h.1M240,50h.1M256,48h.1M273,50h.1M286,59h.1M293,72h.1M305,83h.1\" stroke=\"#ffd9a0\" stroke-width=\"6\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"260\" cy=\"95\" r=\"5\" fill=\"#fff\"/><path d=\"M981,504 L983,509 L988,511 L983,512 L981,517 L980,512 L975,511 L980,509Z\" fill=\"#ffe08a\" opacity=\"0.49\"/><path d=\"M184,125 L185,128 L189,130 L185,131 L184,134 L183,131 L179,130 L183,128Z\" fill=\"#ffe08a\" opacity=\"0.54\"/><path d=\"M1077,337 L1078,340 L1081,341 L1078,343 L1077,346 L1076,343 L1072,341 L1076,340Z\" fill=\"#ffe08a\" opacity=\"0.74\"/><path d=\"M124,84 L126,89 L130,90 L126,92 L124,96 L123,92 L118,90 L123,89Z\" fill=\"#ffe08a\" opacity=\"0.61\"/><path d=\"M567,143 L569,148 L573,149 L569,151 L567,155 L566,151 L561,149 L566,148Z\" fill=\"#ffe08a\" opacity=\"0.72\"/><path d=\"M65,138 L67,143 L71,144 L67,146 L65,150 L64,146 L59,144 L64,143Z\" fill=\"#ffe08a\" opacity=\"0.58\"/><path d=\"M592,512 L594,518 L599,519 L594,521 L592,526 L591,521 L585,519 L591,518Z\" fill=\"#ffe08a\" opacity=\"0.45\"/><path d=\"M1268,204 L1269,207 L1272,208 L1269,209 L1268,213 L1267,209 L1263,208 L1267,207Z\" fill=\"#ffe08a\" opacity=\"0.82\"/><path d=\"M1401,504 L1403,510 L1410,513 L1403,515 L1401,521 L1399,515 L1392,513 L1399,510Z\" fill=\"#ffe08a\" opacity=\"0.68\"/><path d=\"M306,338 L307,343 L311,344 L307,345 L306,350 L304,345 L300,344 L304,343Z\" fill=\"#ffe08a\" opacity=\"0.78\"/><path d=\"M447,93 L449,99 L455,100 L449,102 L447,108 L445,102 L440,100 L445,99Z\" fill=\"#ffe08a\" opacity=\"0.48\"/><path d=\"M1494,104 L1495,108 L1500,109 L1495,111 L1494,115 L1493,111 L1488,109 L1493,108Z\" fill=\"#ffe08a\" opacity=\"0.67\"/><path d=\"M592,260 L593,263 L597,264 L593,266 L592,269 L591,266 L587,264 L591,263Z\" fill=\"#ffe08a\" opacity=\"0.50\"/><path d=\"M296,449 L297,453 L301,455 L297,456 L296,460 L294,456 L290,455 L294,453Z\" fill=\"#ffe08a\" opacity=\"0.45\"/><path d=\"M1421,547 L1423,553 L1429,555 L1423,557 L1421,564 L1419,557 L1412,555 L1419,553Z\" fill=\"#ffe08a\" opacity=\"0.42\"/><path d=\"M437,534 L438,539 L442,540 L438,541 L437,545 L435,541 L431,540 L435,539Z\" fill=\"#ffe08a\" opacity=\"0.51\"/><path d=\"M650,130 L651,134 L654,135 L651,136 L650,139 L649,136 L645,135 L649,134Z\" fill=\"#ffe08a\" opacity=\"0.66\"/><path d=\"M796,146 L797,150 L801,151 L797,152 L796,155 L795,152 L792,151 L795,150Z\" fill=\"#ffe08a\" opacity=\"0.60\"/><path d=\"M920,95 L921,99 L924,100 L921,101 L920,104 L919,101 L915,100 L919,99Z\" fill=\"#ffe08a\" opacity=\"0.52\"/><path d=\"M710,295 L712,301 L718,302 L712,304 L710,310 L708,304 L702,302 L708,301Z\" fill=\"#ffe08a\" opacity=\"0.72\"/><path d=\"M17,169 L19,173 L23,174 L19,176 L17,180 L16,176 L12,174 L16,173Z\" fill=\"#ffe08a\" opacity=\"0.57\"/><path d=\"M865,250 L866,255 L871,256 L866,258 L865,263 L863,258 L858,256 L863,255Z\" fill=\"#ffe08a\" opacity=\"0.82\"/><path d=\"M159,264 L161,269 L167,271 L161,273 L159,278 L158,273 L152,271 L158,269Z\" fill=\"#ffe08a\" opacity=\"0.67\"/><path d=\"M1069,531 L1071,535 L1075,537 L1071,538 L1069,543 L1068,538 L1064,537 L1068,535Z\" fill=\"#ffe08a\" opacity=\"0.87\"/><path d=\"M617,536 L620,542 L626,544 L620,547 L617,553 L615,547 L609,544 L615,542Z\" fill=\"#ffe08a\" opacity=\"0.67\"/><path d=\"M954,257 L956,262 L961,263 L956,265 L954,270 L953,265 L948,263 L953,262Z\" fill=\"#ffe08a\" opacity=\"0.54\"/><path d=\"M638,196 L639,201 L644,202 L639,204 L638,209 L636,204 L631,202 L636,201Z\" fill=\"#ffe08a\" opacity=\"0.64\"/><path d=\"M432,516 L433,521 L439,523 L433,525 L432,531 L430,525 L424,523 L430,521Z\" fill=\"#ffe08a\" opacity=\"0.77\"/><path d=\"M43,435 L45,440 L50,442 L45,443 L43,449 L41,443 L36,442 L41,440Z\" fill=\"#ffe08a\" opacity=\"0.72\"/><path d=\"M654,392 L655,395 L658,396 L655,397 L654,400 L653,397 L650,396 L653,395Z\" fill=\"#ffe08a\" opacity=\"0.56\"/><path d=\"M636,335 L638,341 L644,343 L638,344 L636,350 L635,344 L629,343 L635,341Z\" fill=\"#ffe08a\" opacity=\"0.56\"/><path d=\"M1276,149 L1278,154 L1284,156 L1278,158 L1276,164 L1274,158 L1269,156 L1274,154Z\" fill=\"#ffe08a\" opacity=\"0.53\"/><path d=\"M1209,59 L1210,63 L1213,64 L1210,65 L1209,68 L1208,65 L1204,64 L1208,63Z\" fill=\"#ffe08a\" opacity=\"0.81\"/><path d=\"M1455,106 L1457,113 L1464,115 L1457,117 L1455,124 L1453,117 L1446,115 L1453,113Z\" fill=\"#ffe08a\" opacity=\"0.52\"/><path d=\"M1130,60 L1132,65 L1136,66 L1132,68 L1130,72 L1129,68 L1124,66 L1129,65Z\" fill=\"#ffe08a\" opacity=\"0.46\"/><path d=\"M1378,221 L1379,224 L1383,225 L1379,227 L1378,230 L1377,227 L1373,225 L1377,224Z\" fill=\"#ffe08a\" opacity=\"0.58\"/><path d=\"M224,250 L225,255 L231,257 L225,259 L224,264 L222,259 L217,257 L222,255Z\" fill=\"#ffe08a\" opacity=\"0.72\"/><path d=\"M1091,222 L1093,227 L1099,229 L1093,231 L1091,237 L1089,231 L1083,229 L1089,227Z\" fill=\"#ffe08a\" opacity=\"0.81\"/><path d=\"M219,186 L220,190 L224,191 L220,192 L219,196 L218,192 L215,191 L218,190Z\" fill=\"#ffe08a\" opacity=\"0.64\"/><path d=\"M805,194 L806,199 L811,200 L806,202 L805,207 L803,202 L798,200 L803,199Z\" fill=\"#ffe08a\" opacity=\"0.82\"/><rect x=\"-20\" y=\"712\" width=\"64\" height=\"193\" fill=\"#05070f\"/><rect x=\"46\" y=\"789\" width=\"78\" height=\"116\" fill=\"#05070f\"/><rect x=\"124\" y=\"717\" width=\"88\" height=\"188\" fill=\"#05070f\"/><rect x=\"217\" y=\"797\" width=\"79\" height=\"108\" fill=\"#05070f\"/><rect x=\"296\" y=\"763\" width=\"56\" height=\"142\" fill=\"#05070f\"/><rect x=\"354\" y=\"754\" width=\"75\" height=\"151\" fill=\"#05070f\"/><rect x=\"433\" y=\"759\" width=\"90\" height=\"146\" fill=\"#05070f\"/><rect x=\"529\" y=\"710\" width=\"106\" height=\"195\" fill=\"#05070f\"/><rect x=\"640\" y=\"789\" width=\"56\" height=\"116\" fill=\"#05070f\"/><rect x=\"700\" y=\"740\" width=\"96\" height=\"165\" fill=\"#05070f\"/><rect x=\"799\" y=\"780\" width=\"52\" height=\"125\" fill=\"#05070f\"/><rect x=\"851\" y=\"781\" width=\"86\" height=\"124\" fill=\"#05070f\"/><rect x=\"941\" y=\"684\" width=\"66\" height=\"221\" fill=\"#05070f\"/><rect x=\"1012\" y=\"788\" width=\"96\" height=\"117\" fill=\"#05070f\"/><rect x=\"1107\" y=\"752\" width=\"90\" height=\"153\" fill=\"#05070f\"/><rect x=\"1198\" y=\"661\" width=\"62\" height=\"244\" fill=\"#05070f\"/><rect x=\"1262\" y=\"669\" width=\"97\" height=\"236\" fill=\"#05070f\"/><rect x=\"1359\" y=\"673\" width=\"66\" height=\"232\" fill=\"#05070f\"/><rect x=\"1428\" y=\"727\" width=\"53\" height=\"178\" fill=\"#05070f\"/><rect x=\"1484\" y=\"784\" width=\"82\" height=\"121\" fill=\"#05070f\"/><rect x=\"1568\" y=\"708\" width=\"99\" height=\"197\" fill=\"#05070f\"/><path d=\"M24,726h7v10h-7zM24,770h7v10h-7zM24,792h7v10h-7zM6,814h7v10h-7zM24,814h7v10h-7zM6,858h7v10h-7zM71,846h7v10h-7zM89,846h7v10h-7zM132,775h7v10h-7zM150,819h7v10h-7zM242,810h7v10h-7zM224,854h7v10h-7zM260,854h7v10h-7zM278,854h7v10h-7zM303,776h7v10h-7zM339,820h7v10h-7zM321,842h7v10h-7zM303,864h7v10h-7zM398,767h7v10h-7zM380,789h7v10h-7zM416,789h7v10h-7zM416,811h7v10h-7zM380,833h7v10h-7zM362,855h7v10h-7zM398,855h7v10h-7zM416,855h7v10h-7zM416,877h7v10h-7zM495,794h7v10h-7zM495,816h7v10h-7zM495,838h7v10h-7zM590,745h7v10h-7zM554,767h7v10h-7zM572,767h7v10h-7zM590,789h7v10h-7zM608,833h7v10h-7zM572,855h7v10h-7zM554,877h7v10h-7zM590,877h7v10h-7zM608,877h7v10h-7zM684,825h7v10h-7zM648,869h7v10h-7zM666,869h7v10h-7zM684,869h7v10h-7zM707,753h7v10h-7zM707,797h7v10h-7zM725,797h7v10h-7zM743,797h7v10h-7zM743,819h7v10h-7zM761,841h7v10h-7zM779,863h7v10h-7zM825,793h7v10h-7zM807,881h7v10h-7zM859,795h7v10h-7zM877,795h7v10h-7zM859,817h7v10h-7zM877,817h7v10h-7zM859,861h7v10h-7zM877,861h7v10h-7zM895,861h7v10h-7zM967,719h7v10h-7zM985,741h7v10h-7zM985,763h7v10h-7zM985,829h7v10h-7zM985,873h7v10h-7zM1073,802h7v10h-7zM1055,846h7v10h-7zM1091,846h7v10h-7zM1073,868h7v10h-7zM1151,765h7v10h-7zM1151,809h7v10h-7zM1133,853h7v10h-7zM1169,853h7v10h-7zM1133,875h7v10h-7zM1206,674h7v10h-7zM1206,718h7v10h-7zM1206,806h7v10h-7zM1224,806h7v10h-7zM1206,850h7v10h-7zM1305,704h7v10h-7zM1341,748h7v10h-7zM1305,770h7v10h-7zM1323,770h7v10h-7zM1269,792h7v10h-7zM1287,814h7v10h-7zM1305,814h7v10h-7zM1287,836h7v10h-7zM1323,858h7v10h-7zM1305,880h7v10h-7zM1384,686h7v10h-7zM1402,818h7v10h-7zM1384,840h7v10h-7zM1435,763h7v10h-7zM1435,785h7v10h-7zM1453,807h7v10h-7zM1453,829h7v10h-7zM1453,851h7v10h-7zM1509,797h7v10h-7zM1527,797h7v10h-7zM1491,819h7v10h-7zM1527,819h7v10h-7zM1545,841h7v10h-7zM1509,863h7v10h-7zM1527,863h7v10h-7zM1545,885h7v10h-7zM1575,744h7v10h-7zM1611,788h7v10h-7zM1647,788h7v10h-7zM1647,832h7v10h-7zM1575,854h7v10h-7zM1593,854h7v10h-7zM1593,876h7v10h-7z\" fill=\"#ffd77a\" opacity=\".8\"/></svg>" },
      valentines: { dark: false, base: '#ffc4d6', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" preserveAspectRatio=\"xMidYMax slice\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffe6ee\"/><stop offset=\".55\" stop-color=\"#ffc4d6\"/><stop offset=\"1\" stop-color=\"#ff9fbd\"/></linearGradient><radialGradient id=\"l\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".7\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"/></radialGradient></defs><rect width=\"1600\" height=\"900\" fill=\"url(#s)\"/><circle cx=\"800\" cy=\"200\" r=\"520\" fill=\"url(#l)\"/><circle cx=\"997\" cy=\"668\" r=\"59\" fill=\"#fff\" opacity=\"0.21\"/><circle cx=\"1184\" cy=\"830\" r=\"20\" fill=\"#fff\" opacity=\"0.15\"/><circle cx=\"1509\" cy=\"584\" r=\"65\" fill=\"#fff\" opacity=\"0.10\"/><circle cx=\"751\" cy=\"222\" r=\"46\" fill=\"#fff\" opacity=\"0.16\"/><circle cx=\"21\" cy=\"195\" r=\"33\" fill=\"#fff\" opacity=\"0.21\"/><circle cx=\"1225\" cy=\"144\" r=\"59\" fill=\"#fff\" opacity=\"0.10\"/><circle cx=\"988\" cy=\"114\" r=\"18\" fill=\"#fff\" opacity=\"0.20\"/><circle cx=\"335\" cy=\"194\" r=\"69\" fill=\"#fff\" opacity=\"0.20\"/><circle cx=\"463\" cy=\"865\" r=\"46\" fill=\"#fff\" opacity=\"0.17\"/><circle cx=\"328\" cy=\"847\" r=\"54\" fill=\"#fff\" opacity=\"0.22\"/><circle cx=\"1430\" cy=\"269\" r=\"37\" fill=\"#fff\" opacity=\"0.10\"/><circle cx=\"233\" cy=\"59\" r=\"34\" fill=\"#fff\" opacity=\"0.16\"/><circle cx=\"5\" cy=\"610\" r=\"36\" fill=\"#fff\" opacity=\"0.12\"/><circle cx=\"1310\" cy=\"433\" r=\"34\" fill=\"#fff\" opacity=\"0.15\"/><circle cx=\"1127\" cy=\"51\" r=\"69\" fill=\"#fff\" opacity=\"0.08\"/><circle cx=\"1200\" cy=\"760\" r=\"19\" fill=\"#fff\" opacity=\"0.19\"/><circle cx=\"586\" cy=\"521\" r=\"18\" fill=\"#fff\" opacity=\"0.09\"/><circle cx=\"289\" cy=\"860\" r=\"28\" fill=\"#fff\" opacity=\"0.19\"/><circle cx=\"1487\" cy=\"848\" r=\"36\" fill=\"#fff\" opacity=\"0.13\"/><circle cx=\"840\" cy=\"698\" r=\"24\" fill=\"#fff\" opacity=\"0.18\"/><circle cx=\"1276\" cy=\"774\" r=\"20\" fill=\"#fff\" opacity=\"0.21\"/><circle cx=\"146\" cy=\"307\" r=\"50\" fill=\"#fff\" opacity=\"0.21\"/><path transform=\"rotate(-6.401618934966216 60 80)\" d=\"M60,251 C-187,61 -73,-91 60,14 C193,-91 307,61 60,251Z\" fill=\"#ff7da1\" opacity=\"0.28\"/><path transform=\"rotate(16.967904777111627 1560 120)\" d=\"M1560,273 C1339,103 1441,-33 1560,61 C1679,-33 1781,103 1560,273Z\" fill=\"#ff7da1\" opacity=\"0.28\"/><path transform=\"rotate(1.8057614839295546 1500 820)\" d=\"M1500,1000 C1240,800 1360,640 1500,750 C1640,640 1760,800 1500,1000Z\" fill=\"#ff7da1\" opacity=\"0.28\"/><path transform=\"rotate(-7.501985226283722 90 840)\" d=\"M90,1002 C-144,822 -36,678 90,777 C216,678 324,822 90,1002Z\" fill=\"#ff7da1\" opacity=\"0.28\"/><path transform=\"rotate(-19.66338950109808 284 70)\" d=\"M284,97 C245,67 263,44 284,60 C305,44 323,67 284,97Z\" fill=\"#ff8fab\" opacity=\"0.55\"/><path transform=\"rotate(1.877721516206723 78 888)\" d=\"M78,908 C49,886 62,868 78,880 C93,868 106,886 78,908Z\" fill=\"#ffd0dd\" opacity=\"0.19\"/><path transform=\"rotate(8.454120573538603 550 225)\" d=\"M550,271 C484,220 514,179 550,207 C586,179 616,220 550,271Z\" fill=\"#ff5a85\" opacity=\"0.20\"/><path transform=\"rotate(18.952039745415405 52 444)\" d=\"M52,498 C-25,438 10,390 52,423 C94,390 130,438 52,498Z\" fill=\"#ff5a85\" opacity=\"0.54\"/><path transform=\"rotate(-4.825944856022939 212 807)\" d=\"M212,845 C158,803 183,769 212,792 C242,769 267,803 212,845Z\" fill=\"#ff5a85\" opacity=\"0.34\"/><path transform=\"rotate(-2.623324844001335 1352 265)\" d=\"M1352,285 C1324,263 1337,246 1352,258 C1367,246 1379,263 1352,285Z\" fill=\"#ff5a85\" opacity=\"0.54\"/><path transform=\"rotate(-1.1736227918715052 781 657)\" d=\"M781,690 C733,653 755,624 781,644 C807,624 829,653 781,690Z\" fill=\"#ff8fab\" opacity=\"0.35\"/><path transform=\"rotate(1.7781039308733426 180 740)\" d=\"M180,793 C103,734 139,687 180,719 C221,687 257,734 180,793Z\" fill=\"#ff5a85\" opacity=\"0.41\"/><path transform=\"rotate(-12.75063248835492 542 80)\" d=\"M542,115 C491,76 514,45 542,67 C569,45 592,76 542,115Z\" fill=\"#ff8fab\" opacity=\"0.20\"/><path transform=\"rotate(-26.0781620551663 569 529)\" d=\"M569,577 C499,523 531,480 569,510 C607,480 639,523 569,577Z\" fill=\"#ff8fab\" opacity=\"0.31\"/><path transform=\"rotate(15.10585849682667 449 437)\" d=\"M449,481 C385,432 415,393 449,420 C484,393 513,432 449,481Z\" fill=\"#ff8fab\" opacity=\"0.53\"/><path transform=\"rotate(-1.4389846426882613 286 767)\" d=\"M286,795 C246,764 264,739 286,756 C308,739 326,764 286,795Z\" fill=\"#ff8fab\" opacity=\"0.30\"/><path transform=\"rotate(9.723735903703073 462 450)\" d=\"M462,475 C426,448 443,425 462,441 C482,425 498,448 462,475Z\" fill=\"#ff8fab\" opacity=\"0.31\"/><path transform=\"rotate(-8.39747151992723 1181 745)\" d=\"M1181,787 C1120,741 1148,704 1181,729 C1213,704 1241,741 1181,787Z\" fill=\"#ff5a85\" opacity=\"0.50\"/><path transform=\"rotate(1.0158081050519598 1562 861)\" d=\"M1562,904 C1499,856 1528,817 1562,844 C1596,817 1625,856 1562,904Z\" fill=\"#ff5a85\" opacity=\"0.25\"/><path transform=\"rotate(-23.58514314664571 1366 255)\" d=\"M1366,283 C1324,251 1344,226 1366,243 C1389,226 1408,251 1366,283Z\" fill=\"#ffd0dd\" opacity=\"0.24\"/><path transform=\"rotate(-4.4356462884746435 929 599)\" d=\"M929,647 C860,594 892,551 929,580 C966,551 998,594 929,647Z\" fill=\"#ff8fab\" opacity=\"0.45\"/><path transform=\"rotate(8.406555549216222 256 397)\" d=\"M256,411 C236,395 245,383 256,392 C267,383 276,395 256,411Z\" fill=\"#ff5a85\" opacity=\"0.46\"/><path transform=\"rotate(26.866557513695845 1150 888)\" d=\"M1150,909 C1120,886 1133,867 1150,880 C1166,867 1179,886 1150,909Z\" fill=\"#ff5a85\" opacity=\"0.20\"/><path transform=\"rotate(-17.17183429966896 508 163)\" d=\"M508,182 C481,161 493,145 508,156 C522,145 535,161 508,182Z\" fill=\"#ffffff\" opacity=\"0.33\"/><path transform=\"rotate(-16.55548979849071 1060 65)\" d=\"M1060,93 C1019,62 1038,36 1060,54 C1082,36 1101,62 1060,93Z\" fill=\"#ff8fab\" opacity=\"0.18\"/><path transform=\"rotate(-21.55583144295291 446 369)\" d=\"M446,400 C401,366 422,338 446,357 C470,338 490,366 446,400Z\" fill=\"#ff8fab\" opacity=\"0.54\"/><path transform=\"rotate(0.7082711086042615 482 266)\" d=\"M482,303 C428,262 453,228 482,251 C511,228 536,262 482,303Z\" fill=\"#ff8fab\" opacity=\"0.53\"/><path transform=\"rotate(7.968606339019516 671 732)\" d=\"M671,781 C599,726 632,682 671,712 C709,682 742,726 671,781Z\" fill=\"#ff8fab\" opacity=\"0.35\"/><path transform=\"rotate(-16.84718634033332 612 429)\" d=\"M612,449 C584,427 597,410 612,422 C628,410 641,427 612,449Z\" fill=\"#ff5a85\" opacity=\"0.41\"/><path transform=\"rotate(-21.956572992664867 1430 1)\" d=\"M1430,29 C1389,-2 1407,-28 1430,-10 C1452,-28 1471,-2 1430,29Z\" fill=\"#ff5a85\" opacity=\"0.30\"/><path transform=\"rotate(26.69410405065721 903 386)\" d=\"M903,438 C828,380 862,334 903,366 C943,334 978,380 903,438Z\" fill=\"#ffd0dd\" opacity=\"0.29\"/><path transform=\"rotate(23.169846958708263 608 865)\" d=\"M608,921 C526,859 564,809 608,843 C651,809 689,859 608,921Z\" fill=\"#ff8fab\" opacity=\"0.45\"/><path transform=\"rotate(24.929859631653756 402 18)\" d=\"M402,44 C364,15 381,-8 402,8 C422,-8 439,15 402,44Z\" fill=\"#ff8fab\" opacity=\"0.36\"/><path transform=\"rotate(6.814450843680888 763 110)\" d=\"M763,135 C726,107 743,84 763,100 C783,84 800,107 763,135Z\" fill=\"#ffd0dd\" opacity=\"0.27\"/><path transform=\"rotate(-1.1033907694844913 218 353)\" d=\"M218,368 C198,352 207,339 218,348 C230,339 239,352 218,368Z\" fill=\"#ff8fab\" opacity=\"0.27\"/><path transform=\"rotate(19.25918251772878 59 441)\" d=\"M59,475 C10,437 32,407 59,428 C85,407 108,437 59,475Z\" fill=\"#ff8fab\" opacity=\"0.29\"/><path transform=\"rotate(5.815808544434219 759 580)\" d=\"M759,620 C702,576 728,540 759,565 C790,540 817,576 759,620Z\" fill=\"#ffffff\" opacity=\"0.19\"/><path transform=\"rotate(6.360005085334485 452 637)\" d=\"M452,655 C425,635 438,619 452,630 C466,619 478,635 452,655Z\" fill=\"#ffffff\" opacity=\"0.35\"/><path transform=\"rotate(-25.959980844268024 1192 532)\" d=\"M1192,561 C1150,529 1170,503 1192,521 C1214,503 1234,529 1192,561Z\" fill=\"#ff8fab\" opacity=\"0.38\"/><path transform=\"rotate(-17.293958896283893 172 619)\" d=\"M172,662 C109,614 138,575 172,602 C206,575 235,614 172,662Z\" fill=\"#ffd0dd\" opacity=\"0.47\"/><path transform=\"rotate(7.4051793540746615 921 637)\" d=\"M921,669 C875,634 896,606 921,625 C946,606 967,634 921,669Z\" fill=\"#ffd0dd\" opacity=\"0.50\"/><path transform=\"rotate(12.298128686861816 761 614)\" d=\"M761,665 C688,608 722,564 761,594 C800,564 834,608 761,665Z\" fill=\"#ff8fab\" opacity=\"0.35\"/><path transform=\"rotate(15.623872460707467 486 3)\" d=\"M486,50 C418,-2 450,-44 486,-15 C522,-44 553,-2 486,50Z\" fill=\"#ff8fab\" opacity=\"0.42\"/><path transform=\"rotate(10.933035006741719 498 149)\" d=\"M498,183 C449,145 471,115 498,136 C524,115 546,145 498,183Z\" fill=\"#ffd0dd\" opacity=\"0.54\"/><path transform=\"rotate(-25.28097161776214 681 487)\" d=\"M681,524 C628,483 652,450 681,473 C710,450 734,483 681,524Z\" fill=\"#ff5a85\" opacity=\"0.28\"/><path transform=\"rotate(-9.349110540259474 101 848)\" d=\"M101,864 C77,846 88,832 101,842 C113,832 124,846 101,864Z\" fill=\"#ffd0dd\" opacity=\"0.54\"/><path transform=\"rotate(19.15550773480507 1122 44)\" d=\"M1122,102 C1039,38 1077,-14 1122,22 C1167,-14 1205,38 1122,102Z\" fill=\"#ff5a85\" opacity=\"0.41\"/><path transform=\"rotate(27.666973057237286 178 805)\" d=\"M178,855 C106,800 139,756 178,786 C217,756 250,800 178,855Z\" fill=\"#ffd0dd\" opacity=\"0.24\"/><path transform=\"rotate(6.854682594059206 662 145)\" d=\"M662,185 C604,141 631,105 662,129 C693,105 720,141 662,185Z\" fill=\"#ffffff\" opacity=\"0.39\"/><path transform=\"rotate(3.9817865506881454 1193 252)\" d=\"M1193,294 C1132,247 1160,210 1193,235 C1226,210 1254,247 1193,294Z\" fill=\"#ffffff\" opacity=\"0.45\"/><ellipse cx=\"1406\" cy=\"831\" rx=\"22\" ry=\"11\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(12 1406 831)\"/><ellipse cx=\"783\" cy=\"895\" rx=\"21\" ry=\"9\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(24 783 895)\"/><ellipse cx=\"242\" cy=\"871\" rx=\"23\" ry=\"15\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(7 242 871)\"/><ellipse cx=\"993\" cy=\"841\" rx=\"24\" ry=\"11\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(30 993 841)\"/><ellipse cx=\"827\" cy=\"831\" rx=\"19\" ry=\"12\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(28 827 831)\"/><ellipse cx=\"287\" cy=\"877\" rx=\"25\" ry=\"10\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(20 287 877)\"/><ellipse cx=\"146\" cy=\"830\" rx=\"24\" ry=\"11\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(45 146 830)\"/><ellipse cx=\"769\" cy=\"846\" rx=\"27\" ry=\"9\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(27 769 846)\"/><ellipse cx=\"86\" cy=\"832\" rx=\"29\" ry=\"14\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-33 86 832)\"/><ellipse cx=\"186\" cy=\"898\" rx=\"25\" ry=\"15\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-43 186 898)\"/><ellipse cx=\"1000\" cy=\"848\" rx=\"19\" ry=\"11\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(14 1000 848)\"/><ellipse cx=\"558\" cy=\"851\" rx=\"18\" ry=\"15\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(18 558 851)\"/><ellipse cx=\"1287\" cy=\"855\" rx=\"28\" ry=\"13\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(11 1287 855)\"/><ellipse cx=\"917\" cy=\"879\" rx=\"22\" ry=\"10\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-56 917 879)\"/><ellipse cx=\"324\" cy=\"823\" rx=\"28\" ry=\"12\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(31 324 823)\"/><ellipse cx=\"1\" cy=\"858\" rx=\"28\" ry=\"13\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-9 1 858)\"/><ellipse cx=\"745\" cy=\"828\" rx=\"18\" ry=\"10\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-15 745 828)\"/><ellipse cx=\"617\" cy=\"890\" rx=\"18\" ry=\"11\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-27 617 890)\"/><ellipse cx=\"258\" cy=\"843\" rx=\"19\" ry=\"12\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-56 258 843)\"/><ellipse cx=\"1479\" cy=\"850\" rx=\"29\" ry=\"14\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(21 1479 850)\"/><ellipse cx=\"755\" cy=\"896\" rx=\"18\" ry=\"14\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-25 755 896)\"/><ellipse cx=\"1079\" cy=\"878\" rx=\"18\" ry=\"10\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-57 1079 878)\"/><ellipse cx=\"369\" cy=\"826\" rx=\"22\" ry=\"16\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(-16 369 826)\"/><ellipse cx=\"499\" cy=\"857\" rx=\"20\" ry=\"14\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(26 499 857)\"/><ellipse cx=\"261\" cy=\"839\" rx=\"25\" ry=\"16\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(18 261 839)\"/><ellipse cx=\"689\" cy=\"898\" rx=\"16\" ry=\"9\" fill=\"#e8517a\" opacity=\".5\" transform=\"rotate(34 689 898)\"/></svg>" },
      summer: { dark: false, base: '#8fd0f5', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" preserveAspectRatio=\"xMidYMax slice\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#3f9fe6\"/><stop offset=\".55\" stop-color=\"#8fd0f5\"/><stop offset=\"1\" stop-color=\"#fff0c4\"/></linearGradient><radialGradient id=\"u\"><stop offset=\"0\" stop-color=\"#fff6c0\" stop-opacity=\".9\"/><stop offset=\"1\" stop-color=\"#fff6c0\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"o\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#27b0d6\"/><stop offset=\"1\" stop-color=\"#0a7ba8\"/></linearGradient><linearGradient id=\"d\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#f6dfa8\"/><stop offset=\"1\" stop-color=\"#e6bf74\"/></linearGradient></defs><rect width=\"1600\" height=\"900\" fill=\"url(#s)\"/><circle cx=\"1260\" cy=\"230\" r=\"300\" fill=\"url(#u)\"/><circle cx=\"1260\" cy=\"230\" r=\"78\" fill=\"#fff4b8\"/><g fill=\"#fff\" opacity=\".92\"><ellipse cx=\"300\" cy=\"170\" rx=\"90\" ry=\"26\"/><ellipse cx=\"260\" cy=\"156\" rx=\"48\" ry=\"24\"/><ellipse cx=\"330\" cy=\"150\" rx=\"56\" ry=\"28\"/></g><g fill=\"#fff\" opacity=\".92\"><ellipse cx=\"640\" cy=\"110\" rx=\"72.0\" ry=\"20.8\"/><ellipse cx=\"608.0\" cy=\"98.8\" rx=\"38.400000000000006\" ry=\"19.200000000000003\"/><ellipse cx=\"664.0\" cy=\"94.0\" rx=\"44.800000000000004\" ry=\"22.400000000000002\"/></g><g fill=\"#fff\" opacity=\".92\"><ellipse cx=\"980\" cy=\"260\" rx=\"81.0\" ry=\"23.400000000000002\"/><ellipse cx=\"944.0\" cy=\"247.4\" rx=\"43.2\" ry=\"21.6\"/><ellipse cx=\"1007.0\" cy=\"242.0\" rx=\"50.4\" ry=\"25.2\"/></g><g fill=\"#fff\" opacity=\".92\"><ellipse cx=\"1480\" cy=\"90\" rx=\"62.99999999999999\" ry=\"18.2\"/><ellipse cx=\"1452.0\" cy=\"80.2\" rx=\"33.599999999999994\" ry=\"16.799999999999997\"/><ellipse cx=\"1501.0\" cy=\"76.0\" rx=\"39.199999999999996\" ry=\"19.599999999999998\"/></g><rect x=\"0\" y=\"560\" width=\"1600\" height=\"170\" fill=\"url(#o)\"/><ellipse cx=\"1260\" cy=\"640\" rx=\"110\" ry=\"80\" fill=\"url(#u)\" opacity=\".55\"/><path d=\"M381,657 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.38\"/><path d=\"M966,669 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.27\"/><path d=\"M21,701 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.34\"/><path d=\"M375,724 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.41\"/><path d=\"M1338,646 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.47\"/><path d=\"M241,670 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.55\"/><path d=\"M837,686 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.48\"/><path d=\"M102,689 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.46\"/><path d=\"M482,580 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.55\"/><path d=\"M756,683 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.56\"/><path d=\"M1143,713 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.39\"/><path d=\"M1281,642 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.58\"/><path d=\"M1406,590 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.30\"/><path d=\"M347,720 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.40\"/><path d=\"M1003,620 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.43\"/><path d=\"M617,628 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.45\"/><path d=\"M935,711 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.49\"/><path d=\"M1486,703 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.60\"/><path d=\"M1074,599 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.55\"/><path d=\"M1543,711 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.45\"/><path d=\"M1142,607 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.54\"/><path d=\"M918,618 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.27\"/><path d=\"M1366,723 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.28\"/><path d=\"M1281,637 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.30\"/><path d=\"M470,690 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.56\"/><path d=\"M71,667 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.27\"/><path d=\"M1150,625 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.56\"/><path d=\"M1569,651 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.60\"/><path d=\"M495,587 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.46\"/><path d=\"M50,605 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.39\"/><path d=\"M977,598 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.26\"/><path d=\"M1388,622 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.59\"/><path d=\"M1435,632 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.41\"/><path d=\"M832,672 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.46\"/><path d=\"M895,668 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.58\"/><path d=\"M811,640 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.50\"/><path d=\"M380,620 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.59\"/><path d=\"M834,657 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.25\"/><path d=\"M664,662 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.26\"/><path d=\"M985,670 q10,-5 20,0 q10,5 20,0\" stroke=\"#d8f3ff\" stroke-width=\"2\" fill=\"none\" opacity=\"0.27\"/><polygon points=\"520,556 520,520 545,556\" fill=\"#fff\"/><polygon points=\"515,556 515,530 500,556\" fill=\"#f2f2f2\"/><rect x=\"500\" y=\"556\" width=\"48\" height=\"5\" fill=\"#8a5a2b\"/><path d=\"M0,700 Q400,660 800,690 T1600,680 L1600,900 L0,900Z\" fill=\"url(#d)\"/><path d=\"M0,790 Q500,760 1000,785 T1600,775\" stroke=\"#d1a85e\" stroke-width=\"3\" fill=\"none\" opacity=\".5\"/><path d=\"M150,880 Q244,675 260,470\" stroke=\"#3a2a1a\" stroke-width=\"16\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M260,470 Q166,383 63,511 Q157,434 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M260,470 Q200,342 107,417 Q167,382 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M260,470 Q250,323 192,358 Q201,341 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M260,470 Q319,341 328,358 Q270,323 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M260,470 Q353,382 413,417 Q320,342 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M260,470 Q363,434 457,511 Q354,383 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M260,470 Q345,485 448,614 Q363,436 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M260,470 Q157,436 72,614 Q175,485 260,470Z\" fill=\"#1f6b3a\"/><path d=\"M1480,890 Q1378,665 1360,440\" stroke=\"#3a2a1a\" stroke-width=\"16\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M1360,440 Q1261,349 1153,483 Q1252,402 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M1360,440 Q1297,305 1199,385 Q1262,347 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M1360,440 Q1350,286 1288,322 Q1298,304 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M1360,440 Q1422,304 1432,322 Q1370,286 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M1360,440 Q1458,347 1521,385 Q1423,305 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M1360,440 Q1468,402 1567,483 Q1459,349 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M1360,440 Q1449,455 1557,592 Q1468,404 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M1360,440 Q1252,404 1163,592 Q1271,455 1360,440Z\" fill=\"#1a5e33\"/><path d=\"M60,900 Q43,730 40,560\" stroke=\"#3a2a1a\" stroke-width=\"16\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M40,560 Q-26,499 -98,589 Q-32,535 40,560Z\" fill=\"#27803f\"/><path d=\"M40,560 Q-2,470 -67,523 Q-25,498 40,560Z\" fill=\"#27803f\"/><path d=\"M40,560 Q33,457 -8,482 Q-1,470 40,560Z\" fill=\"#27803f\"/><path d=\"M40,560 Q81,470 88,482 Q47,457 40,560Z\" fill=\"#27803f\"/><path d=\"M40,560 Q105,498 147,523 Q82,470 40,560Z\" fill=\"#27803f\"/><path d=\"M40,560 Q112,535 178,589 Q106,499 40,560Z\" fill=\"#27803f\"/><path d=\"M40,560 Q100,570 172,661 Q112,536 40,560Z\" fill=\"#27803f\"/><path d=\"M40,560 Q-32,536 -92,661 Q-20,570 40,560Z\" fill=\"#27803f\"/></svg>" },
      rainy: { dark: false, base: '#a3b3c0', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" preserveAspectRatio=\"xMidYMax slice\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#6f8394\"/><stop offset=\".55\" stop-color=\"#a3b3c0\"/><stop offset=\"1\" stop-color=\"#d5dfe6\"/></linearGradient></defs><rect width=\"1600\" height=\"900\" fill=\"url(#s)\"/><g fill=\"#5f7282\" opacity=\"0.9\"><ellipse cx=\"260\" cy=\"110\" rx=\"240.0\" ry=\"64.0\"/><ellipse cx=\"148.0\" cy=\"74.8\" rx=\"128.0\" ry=\"60.800000000000004\"/><ellipse cx=\"340.0\" cy=\"62.0\" rx=\"153.60000000000002\" ry=\"70.4\"/></g><g fill=\"#667a8a\" opacity=\"0.9\"><ellipse cx=\"780\" cy=\"70\" rx=\"270.0\" ry=\"72.0\"/><ellipse cx=\"654.0\" cy=\"30.4\" rx=\"144.0\" ry=\"68.4\"/><ellipse cx=\"870.0\" cy=\"16.0\" rx=\"172.8\" ry=\"79.2\"/></g><g fill=\"#5f7282\" opacity=\"0.9\"><ellipse cx=\"1300\" cy=\"120\" rx=\"255.0\" ry=\"68.0\"/><ellipse cx=\"1181.0\" cy=\"82.6\" rx=\"136.0\" ry=\"64.6\"/><ellipse cx=\"1385.0\" cy=\"69.0\" rx=\"163.2\" ry=\"74.8\"/></g><g fill=\"#7a8d9c\" opacity=\"0.8\"><ellipse cx=\"520\" cy=\"230\" rx=\"195.0\" ry=\"52.0\"/><ellipse cx=\"429.0\" cy=\"201.4\" rx=\"104.0\" ry=\"49.4\"/><ellipse cx=\"585.0\" cy=\"191.0\" rx=\"124.80000000000001\" ry=\"57.2\"/></g><g fill=\"#7a8d9c\" opacity=\"0.8\"><ellipse cx=\"1040\" cy=\"250\" rx=\"210.0\" ry=\"56.0\"/><ellipse cx=\"942.0\" cy=\"219.2\" rx=\"112.0\" ry=\"53.199999999999996\"/><ellipse cx=\"1110.0\" cy=\"208.0\" rx=\"134.39999999999998\" ry=\"61.599999999999994\"/></g><g fill=\"#8798a6\" opacity=\"0.7\"><ellipse cx=\"1480\" cy=\"300\" rx=\"165.0\" ry=\"44.0\"/><ellipse cx=\"1403.0\" cy=\"275.8\" rx=\"88.0\" ry=\"41.800000000000004\"/><ellipse cx=\"1535.0\" cy=\"267.0\" rx=\"105.60000000000001\" ry=\"48.400000000000006\"/></g><g fill=\"#8798a6\" opacity=\"0.7\"><ellipse cx=\"120\" cy=\"320\" rx=\"165.0\" ry=\"44.0\"/><ellipse cx=\"43.0\" cy=\"295.8\" rx=\"88.0\" ry=\"41.800000000000004\"/><ellipse cx=\"175.0\" cy=\"287.0\" rx=\"105.60000000000001\" ry=\"48.400000000000006\"/></g><path d=\"M-170,900 L-170,637 Q-170,637 -85,633 Q0,630 85,620 Q170,611 255,640 Q340,669 425,635 Q510,601 595,620 Q680,640 765,656 Q850,672 935,639 Q1020,606 1105,625 Q1190,644 1275,647 Q1360,649 1445,626 Q1530,603 1615,617 Q1700,630 1785,643 L1870,900 Z\" fill=\"#8da2b2\" opacity=\"0.7\"/><path d=\"M-170,900 L-170,717 Q-170,717 -85,726 Q0,734 85,716 Q170,698 255,701 Q340,703 425,699 Q510,695 595,708 Q680,720 765,734 Q850,747 935,736 Q1020,726 1105,732 Q1190,738 1275,725 Q1360,713 1445,724 Q1530,736 1615,715 Q1700,695 1785,701 L1870,900 Z\" fill=\"#6d8394\" opacity=\"1\"/><ellipse cx=\"180\" cy=\"780\" rx=\"150\" ry=\"95\" fill=\"#3d5a4a\"/><ellipse cx=\"210\" cy=\"740\" rx=\"105\" ry=\"66\" fill=\"#4a6b58\"/><rect x=\"174\" y=\"840\" width=\"12\" height=\"80\" fill=\"#2d2118\"/><ellipse cx=\"1440\" cy=\"790\" rx=\"170\" ry=\"105\" fill=\"#3d5a4a\"/><ellipse cx=\"1470\" cy=\"750\" rx=\"119\" ry=\"74\" fill=\"#4a6b58\"/><rect x=\"1434\" y=\"850\" width=\"12\" height=\"80\" fill=\"#2d2118\"/><path d=\"M-170,900 L-170,821 Q-170,821 -85,821 Q0,822 85,817 Q170,812 255,807 Q340,802 425,805 Q510,808 595,807 Q680,806 765,807 Q850,808 935,816 Q1020,825 1105,815 Q1190,805 1275,816 Q1360,827 1445,827 Q1530,827 1615,814 Q1700,801 1785,806 L1870,900 Z\" fill=\"#4d6070\" opacity=\"1\"/><ellipse cx=\"500\" cy=\"860\" rx=\"110\" ry=\"12\" fill=\"#a9bdca\" opacity=\".55\"/><ellipse cx=\"1100\" cy=\"870\" rx=\"130\" ry=\"12\" fill=\"#a9bdca\" opacity=\".55\"/><ellipse cx=\"820\" cy=\"885\" rx=\"90\" ry=\"12\" fill=\"#a9bdca\" opacity=\".55\"/><path d=\"M736,1L726,39M-86,53L-97,95M1517,188L1505,231M1273,418L1261,464M676,472L667,509M1547,76L1540,103M1428,399L1419,433M1328,323L1317,365M864,684L852,731M827,797L820,824M258,458L245,509M1040,838L1032,869M1555,822L1541,875M-50,237L-56,263M366,833L358,864M-79,231L-91,276M517,388L508,425M711,209L701,245M825,364L811,417M973,608L962,651M575,238L564,279M750,767L743,794M1527,251L1520,279M152,721L143,756M-21,26L-35,79M99,311L91,342M1471,500L1464,528M228,823L215,874M628,516L620,549\" stroke=\"#eef5fa\" stroke-width=\"1.2\" opacity=\"0.6\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M-93,653L-102,684M193,516L180,569M1396,415L1389,444M1226,176L1219,202M1137,577L1130,604M699,451L692,478M-0,222L-9,257M788,644L778,682M1224,569L1216,597M1491,610L1481,650M1102,271L1093,308M1484,71L1471,121M1161,165L1154,192M593,665L581,711M1088,653L1080,684M59,564L45,617M594,609L585,642M213,-1L202,42M336,493L328,523M208,43L194,95M883,228L876,258M1428,160L1420,189M34,107L24,142M1039,99L1027,148M1536,663L1526,702M317,478L308,515M827,140L820,168M953,74L941,120M1385,818L1378,847\" stroke=\"#eef5fa\" stroke-width=\"1.2\" opacity=\"0.45\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M44,417L31,469M1505,-0L1497,28M1237,774L1223,826M858,755L845,806M648,144L638,181M1571,257L1564,285M159,314L145,367M1441,63L1431,100M1020,343L1010,379M741,252L733,280M792,251L778,301M995,256L984,301M382,63L371,104M935,692L927,719M828,697L821,727M1115,587L1104,630M740,153L726,207M701,163L691,201M572,856L559,908M468,649L455,701M1578,801L1571,828M1421,283L1414,311M294,547L280,599M1240,667L1227,716M991,382L977,435M-97,28L-105,61M52,201L41,243M1272,840L1265,867M266,783L259,811M168,453L155,503M1186,661L1176,701\" stroke=\"#eef5fa\" stroke-width=\"1.8\" opacity=\"0.3\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M577,542L569,571M522,573L511,616M257,155L243,207M720,813L709,854M822,244L810,291M1389,12L1378,54M463,638L453,674M245,583L235,621M1539,469L1525,521M1297,196L1287,235M434,718L421,769M535,659L523,709M1589,690L1579,730M1555,635L1545,675M238,575L227,620M1343,148L1331,196M1134,-2L1121,48M1475,479L1467,510M623,635L613,670M452,554L444,583M15,502L6,537M475,156L468,184M448,51L435,101M25,492L14,535M963,110L950,163\" stroke=\"#eef5fa\" stroke-width=\"2.4\" opacity=\"0.3\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M844,514L836,544M277,217L264,266M384,435L377,463M1154,354L1146,386M-17,376L-29,424M-75,683L-84,717M372,826L360,873M900,686L888,731M888,495L878,533M75,596L65,634M934,140L927,167M44,263L34,302M1560,308L1547,354M1199,683L1188,723M1079,428L1067,477M1415,209L1406,242M983,680L970,732M881,157L870,200M237,396L225,440M442,400L428,451M1205,206L1198,234M806,260L794,306M262,671L252,708M238,753L225,803M494,247L482,292M122,116L112,155M-40,661L-54,713M7,597L-4,642M895,800L883,845\" stroke=\"#eef5fa\" stroke-width=\"1.8\" opacity=\"0.6\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1591,858L1584,888M534,737L525,773M100,350L93,380M293,704L281,751M34,245L23,284M190,459L182,490M1039,351L1030,384M217,447L203,500M1037,345L1028,379M777,340L769,370M370,236L361,274M176,818L165,861M661,767L648,819M1163,718L1154,753M366,295L354,343M229,105L217,152M1470,239L1461,272M1106,808L1096,845M559,425L550,460M1198,3L1190,35\" stroke=\"#eef5fa\" stroke-width=\"2.4\" opacity=\"0.45\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M1375,77L1361,127M336,436L328,467M-50,367L-60,404M1020,101L1009,145M1073,296L1065,329M192,249L178,300M1352,491L1343,523M949,431L939,471M1597,630L1586,674M1,484L-10,524M9,84L-3,130M769,369L758,410M750,508L737,557M1387,637L1377,677M773,207L762,247M1417,793L1405,841M1373,343L1366,371M-73,145L-81,175M1121,504L1114,532M1028,830L1020,862M1402,640L1390,687\" stroke=\"#eef5fa\" stroke-width=\"1.8\" opacity=\"0.45\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M544,515L537,541M191,722L182,755M347,125L339,154M799,133L788,176M1053,338L1045,366M153,320L142,359M1418,571L1408,609M787,305L776,349M554,593L542,641M-95,788L-103,819M384,435L374,474M1125,204L1116,238M449,785L439,827M904,538L893,578M668,697L658,735M179,584L172,613M1412,664L1402,703M1318,214L1304,268M509,799L501,827M1251,215L1244,245M607,227L595,272M626,603L617,639M210,306L198,353M452,52L443,86M148,443L135,495\" stroke=\"#eef5fa\" stroke-width=\"1.2\" opacity=\"0.3\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M796,545L783,593M1536,508L1522,560M1274,331L1264,370M385,404L377,435M1328,605L1319,641M1094,149L1083,193M1171,71L1158,122M1085,451L1072,504M1214,122L1200,176M326,308L318,340M1084,204L1070,258M302,113L289,164M-37,711L-45,742M884,803L872,848M1532,68L1523,103M1155,662L1141,716M832,326L820,373M351,852L337,904M552,43L538,96M1064,724L1055,758M1546,542L1534,589\" stroke=\"#eef5fa\" stroke-width=\"2.4\" opacity=\"0.6\" stroke-linecap=\"round\" fill=\"none\"/></svg>" },
    };
  }
})();
