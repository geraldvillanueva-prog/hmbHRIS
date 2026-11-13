/* HMB HRIS — "a new version was installed" notice.
 *
 * Shared by the admin, employee and supervisor pages. When a page has been left open across a deploy, it can be running OLD code
 * against a NEWER server — which is how stale pages used to overwrite newer data. This asks the server which version is live
 * (every ~90 seconds, and whenever the tab becomes visible again) and, if it changed since this page loaded, shows a banner asking
 * the person to refresh. It never refreshes by itself (that could throw away something half-typed).
 *
 * Sets window.__hrisStale = true once a newer version is detected; the admin page uses it to ask before saving from an old page.
 */
(function () {
  if (window.__hrisVersionCheck) return;
  window.__hrisVersionCheck = true;
  window.__hrisStale = false;
  var base = null, shown = false, POLL_MS = 90 * 1000;

  function stamp(j) { return String(j.version) + '|' + String(j.assets); }

  function showBanner() {
    window.__hrisStale = true;
    if (shown) return;
    shown = true;
    var bar = document.createElement('div');
    bar.id = 'hris-update-banner';
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483000;background:#b26a00;color:#fff;' +
      'font:600 13px/1.4 Arial,Helvetica,sans-serif;padding:9px 14px;display:flex;gap:12px;align-items:center;' +
      'justify-content:center;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    var msg = document.createElement('span');
    msg.textContent = '\uD83D\uDD04 HMB HRIS was just updated. Finish what you are doing, then refresh this page so you are not working on an old version.';
    var go = document.createElement('button');
    go.type = 'button'; go.id = 'hris-update-refresh'; go.textContent = 'Refresh now';
    go.style.cssText = 'background:#fff;color:#7a4700;border:0;border-radius:5px;padding:5px 12px;font:700 12px Arial,sans-serif;cursor:pointer';
    go.onclick = function () { location.reload(); };
    var x = document.createElement('button');
    x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '\u2715';
    x.style.cssText = 'background:transparent;color:#fff;border:0;font:700 14px Arial,sans-serif;cursor:pointer;padding:2px 6px';
    x.onclick = function () { bar.style.display = 'none'; };
    bar.appendChild(msg); bar.appendChild(go); bar.appendChild(x);
    (document.body || document.documentElement).appendChild(bar);
  }

  function check() {
    return fetch('/api/version', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (base === null) { base = stamp(j); window.HRIS_VERSION = j.version; return; }
        if (stamp(j) !== base) showBanner();
      })
      .catch(function () { /* offline or server restarting: say nothing, try again later */ });
  }

  check();
  setInterval(check, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  window.addEventListener('focus', check);
})();
