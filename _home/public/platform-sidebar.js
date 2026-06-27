/*
 * platform-sidebar.js — the claude-experiments platform navigation chrome.
 *
 * Served once from the home app at /platform-sidebar.js and reachable from any
 * experiment (Caddy routes unmatched paths to _home). Each "platform feature"
 * surface (the home dashboard + promoted experiments) loads this with
 * <script src="/platform-sidebar.js" defer>. It renders a hamburger button and an
 * off-canvas left sidebar listing the platform features from /api/platform-features.
 *
 * Everything lives inside a Shadow DOM so the host app's CSS and this widget can't
 * affect each other. No build step, framework-agnostic (works in Next + static apps).
 */
(function () {
  "use strict";
  if (window.__platformSidebar) return; // guard against double-injection
  window.__platformSidebar = true;

  const WIDTH = 284; // panel width (px)
  const EDGE = 28; // left-edge zone that starts an open-drag (px)

  // init() is referenced before its declaration only via these calls, which run
  // after WIDTH/EDGE are initialized above (function decl is hoisted; the consts
  // it closes over must already exist — hence they're declared first).
  if (!document.body) {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    // Pull in the shared subpage chrome (the "← Home" convention) so every surface —
    // dashboard pages and promoted experiments alike — styles it identically, with no
    // per-app CSS. This is a FALLBACK: Next surfaces link it statically in their <head>
    // (render-blocking, no flash), so only inject when it isn't already present. Match
    // by href, since a static/React-managed tag won't carry our data attribute.
    if (!document.querySelector('link[rel="stylesheet"][href*="platform-chrome.css"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/platform-chrome.css";
      css.setAttribute("data-platform-chrome", "");
      document.head.appendChild(css);
    }

    const host = document.createElement("div");
    host.id = "platform-sidebar-root";
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = template();

    // Stop horizontal overscroll from driving browser back/forward navigation
    // (Chromium). iOS Safari's edge-swipe-back is handled in onStart below.
    document.documentElement.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";

    const ham = root.querySelector(".ham");
    const scrim = root.querySelector(".scrim");
    const panel = root.querySelector(".panel");
    const list = root.querySelector(".list");

    let open = false;
    function setOpen(v) {
      open = v;
      root.host.classList.toggle("open", v);
      ham.setAttribute("aria-expanded", String(v));
      // Clear any inline drag transform so the CSS class controls the position.
      panel.style.transform = "";
      scrim.style.opacity = "";
      panel.style.transition = "";
      scrim.style.transition = "";
    }

    ham.addEventListener("click", () => setOpen(!open));
    scrim.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) setOpen(false);
    });

    // --- swipe: edge-drag to open, drag-left to close ---
    let dragging = false;
    let decided = false; // have we committed to a horizontal drag?
    let startX = 0;
    let startY = 0;
    let base = 0; // panel translateX at gesture start (0 open, -WIDTH closed)

    function onStart(e) {
      const t = e.touches[0];
      // Touches on our own shadow UI (hamburger / scrim / panel) retarget to the
      // host at the document level. Don't treat a tap on the hamburger as a drag.
      const onSelf = e.target === host;
      if (open) {
        base = 0; // close-drag (on the panel/scrim)
      } else if (!onSelf && t.clientX <= EDGE) {
        base = -WIDTH; // edge-open drag on the app content
        // Claim the left-edge gesture so the browser doesn't fire its
        // swipe-to-go-back. Needs a non-passive listener (see below).
        if (e.cancelable) e.preventDefault();
      } else {
        return; // hamburger taps, or non-edge touches — leave them alone
      }
      dragging = true;
      decided = false;
      startX = t.clientX;
      startY = t.clientY;
    }
    function onMove(e) {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          dragging = false; // vertical scroll — let the host handle it
          return;
        }
        decided = true;
        panel.style.transition = "none";
        scrim.style.transition = "none";
        root.host.classList.add("dragging");
      }
      e.preventDefault();
      let x = Math.max(-WIDTH, Math.min(0, base + dx));
      panel.style.transform = "translateX(" + x + "px)";
      scrim.style.opacity = String((1 + x / WIDTH) * 1); // 0 closed → 1 open
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      root.host.classList.remove("dragging");
      if (!decided) return;
      const current = currentTranslate(panel);
      setOpen(current > -WIDTH / 2);
    }

    document.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);

    // --- populate from the manifest ---
    fetch("/api/platform-features/") // trailing slash: _home sets trailingSlash, avoids a 308 hop
      .then((r) => (r.ok ? r.json() : { features: [] }))
      .then((data) => render(list, data.features || [], () => setOpen(false)))
      .catch(() => render(list, [], () => setOpen(false)));

    // Re-highlight the active item on client-side navigation. The home app uses
    // next/link soft nav (e.g. a subpage's "← Home" link), which changes the URL
    // without reloading the page — so render() never re-runs and the old item would
    // stay highlighted. Re-apply active state whenever the URL changes.
    watchNavigation(() => applyActive(list));
  }

  function currentTranslate(el) {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return m.m41; // translateX
  }

  // Patch history + popstate so we learn about client-side route changes (SPA soft
  // navs don't fire any standard "navigated" event). Idempotent per page load.
  function watchNavigation(cb) {
    for (const m of ["pushState", "replaceState"]) {
      const orig = history[m];
      history[m] = function () {
        const r = orig.apply(this, arguments);
        cb();
        return r;
      };
    }
    window.addEventListener("popstate", cb);
  }

  // Highlight the item whose href is the longest prefix of the current path. Reads
  // hrefs off the live DOM so it can re-run on navigation without rebuilding the list.
  function applyActive(list) {
    const path = location.pathname;
    const items = list.querySelectorAll(".item");
    let activeEl = null;
    let best = -1;
    items.forEach((a) => {
      const h = a.getAttribute("href") || "/";
      const matches = h === "/" ? path === "/" : path.startsWith(h.replace(/\/$/, ""));
      if (matches && h.length > best) {
        best = h.length;
        activeEl = a;
      }
    });
    items.forEach((a) => a.classList.toggle("active", a === activeEl));
  }

  function render(list, features, onNavigate) {
    list.textContent = "";
    for (const f of features) {
      const a = document.createElement("a");
      a.className = "item";
      a.href = f.href || "/";
      a.addEventListener("click", onNavigate);
      const icon = document.createElement("span");
      icon.className = "icon";
      const ic = f.icon || "•";
      if (typeof ic === "string" && ic.startsWith("/")) {
        const img = document.createElement("img");
        img.src = ic;
        img.alt = "";
        icon.appendChild(img);
      } else {
        icon.textContent = ic;
      }
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = f.label || f.slug || "Untitled";
      a.appendChild(icon);
      a.appendChild(label);
      list.appendChild(a);
    }
    if (!features.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No platform features yet.";
      list.appendChild(empty);
    }
    applyActive(list);
  }

  function template() {
    return `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; }
  .ham {
    position: fixed;
    top: max(10px, env(safe-area-inset-top));
    left: max(10px, env(safe-area-inset-left));
    width: 42px; height: 42px;
    display: grid; place-items: center;
    border-radius: 12px;
    background: rgba(20, 27, 39, 0.72);
    color: #e6edf3;
    border: 1px solid rgba(76, 154, 255, 0.35);
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    font: 20px/1 ui-sans-serif, system-ui, sans-serif;
    z-index: 2147483646; cursor: pointer;
    transition: opacity .2s ease, transform .2s ease;
  }
  :host(.open) .ham { opacity: 0; pointer-events: none; transform: translateX(-8px); }
  .scrim {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    opacity: 0; pointer-events: none;
    transition: opacity .25s ease;
    z-index: 2147483646;
  }
  :host(.open) .scrim { opacity: 1; pointer-events: auto; }
  .panel {
    position: fixed; top: 0; left: 0; bottom: 0;
    width: ${WIDTH}px; max-width: 84vw;
    background: #0d1320;
    border-right: 1px solid #1f2a3a;
    transform: translateX(-100%);
    transition: transform .28s cubic-bezier(.22,.61,.36,1);
    z-index: 2147483647;
    display: flex; flex-direction: column;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    box-shadow: 6px 0 24px -10px rgba(0,0,0,.8);
    font: 16px/1.3 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  :host(.open) .panel { transform: translateX(0); }
  :host(.dragging) .ham { transition: none; }
  .head {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px; color: #e6edf3;
    padding: 18px 18px 12px;
    border-bottom: 1px solid #1f2a3a;
    letter-spacing: .2px;
  }
  .list { padding: 8px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 12px; border-radius: 10px;
    color: #cdd6e2; text-decoration: none;
    min-height: 48px;
  }
  .item:active { background: #18212f; }
  .item.active { background: rgba(76,154,255,0.16); color: #e6edf3; }
  .item .icon {
    width: 28px; height: 28px; flex: 0 0 auto;
    display: grid; place-items: center; font-size: 20px;
  }
  .item .icon img {
    width: 28px; height: 28px; border-radius: 6px; object-fit: cover; display: block;
  }
  .item .label { font-size: 16px; }
  .empty { color: #8b98a9; font-size: 14px; padding: 16px; }
</style>
<button class="ham" aria-label="Open menu" aria-expanded="false">☰</button>
<div class="scrim"></div>
<aside class="panel" role="navigation" aria-label="Platform features">
  <div class="head">Experiments</div>
  <nav class="list"></nav>
</aside>`;
  }
})();
