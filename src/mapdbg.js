/**
 * @file mapdbg.js — phone map crash logger (James 25 Oct: mobile Chrome "Aw, Snap!" on the map, no USB debugging).
 * ?mapdbg=1 turns it on (remembered in localStorage until ?mapdbg=0). While the map is open it samples every 200 ms into a
 * 200-entry ring buffer (zoom, centre, pan speed, day/night, sharp/low-detail, cache sizes + MB, canvases, JS heap, last
 * action, errors), persists it to localStorage every second and on pagehide / visibilitychange / freeze / error. On the
 * next load, if the map was open with no clean close, a banner offers "Copy log" / "Share log". A small live HUD shows the
 * numbers while the map is open. Nothing is sent anywhere.
 * Exposes (globals): MDBG
 */
const MDBG = (() => {
  const KEY = "bigrig.mapdbg", ON = "bigrig.mapdbg.on", BUILD = "__BUILD_ID__";
  let on = false;
  const S0 = { hud: false };
  try {
    const q = /[?&]mapdbg=([01])/.exec(location.search || "");
    if (q) localStorage.setItem(ON, q[1]);
    on = localStorage.getItem(ON) === "1";
    // staging: crash logging (not the HUD) is always on so crashes are reported automatically; ?mapdbg=0 still turns it off
    S0.hud = on;
    if (!on && /staging/.test(location.pathname) && localStorage.getItem(ON) !== "0") on = true;
  } catch (e) {}
  const S = { showHud: S0.hud, on, buf: [], errs: [], act: "load", open: false, t0: Date.now(), hud: null, live: [] };
  if (!on) return S;
  // track canvases created from now on (WeakRef: never keeps one alive)
  try {
    const ce = Document.prototype.createElement;
    Document.prototype.createElement = function (t) {
      const e = ce.apply(this, arguments);
      if (typeof WeakRef === "function" && String(t).toLowerCase() === "canvas") {
        S.live.push(new WeakRef(e));
        if (S.live.length > 4000) S.live = S.live.filter((w) => { const c = w.deref(); return c && c.width; });
      }
      return e;
    };
  } catch (e) {}
  // log every big canvas allocation (>= 0.5 MB) with where it came from, so a spike in the log can be traced to its code
  S.big = [];
  try {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "height");
    Object.defineProperty(HTMLCanvasElement.prototype, "height", {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(v) {
        d.set.call(this, v);
        const b = this.width * this.height * 4;
        if (b >= 524288) {
          const st = (new Error().stack || "").split("\n").slice(2, 5).map((l) => l.trim().replace(/^at /, "").replace(/\(?(https?|file):[^)]*\//, "").slice(0, 70)).join(" < ");
          S.big.push([Date.now() - S.t0, this.width + "x" + this.height, st, S.open ? 1 : 0]);
          if (S.big.length > 40) S.big.shift();
        }
      },
    });
  } catch (e) {}
  const MB = (px) => Math.round((px * 4) / 1e5) / 10;
  const px = (c) => (c && c.width ? c.width * c.height : 0);
  function canv() {
    const held = new Set(), add = (c) => c && c.width && held.add(c);
    try {
      add(typeof MINIMAP !== "undefined" && MINIMAP);
      if (typeof chunkCache !== "undefined") for (const c of chunkCache.values()) add(c);
      if (typeof chunkLo !== "undefined") for (const c of chunkLo.values()) add(c);
      if (typeof MAPC !== "undefined") for (const c of MAPC.cache.values()) add(c);
      if (typeof NM !== "undefined") { add(NM.base); add(NM.lit); add(NM.glow); }
      if (typeof OV !== "undefined") for (const s of OV.sheets) add(s.c);
      if (typeof OVL !== "undefined" && OVL.L) for (const o of OVL.L) { add(o.c); add(o.n); }
      for (const c of document.querySelectorAll("canvas")) add(c);
    } catch (e) {}
    let h = 0;
    for (const c of held) h += px(c);
    let l = 0, n = 0;
    for (const w of S.live) { const c = w.deref(); if (c && c.width) { l += px(c); n++; } }
    return { held: MB(h), live: MB(l), n };
  }
  function sample(kind) {
    const b = typeof bigmap !== "undefined" ? bigmap : {};
    const c = canv(), pm = performance.memory;
    const o = {
      t: Date.now() - S.t0, k: kind || "s", a: S.act,
      z: +(b.z || 0).toFixed(2), cx: Math.round(b.cx || 0), cy: Math.round(b.cy || 0),
      pv: Math.round(Math.hypot((b.cx || 0) - (S.lcx ?? b.cx ?? 0), (b.cy || 0) - (S.lcy ?? b.cy ?? 0)) * (b.z || 1)),
      night: typeof nmK === "function" ? +nmK().toFixed(2) : -1, det: b.detail ? 1 : 0,
      mapc: typeof MAPC !== "undefined" ? MAPC.cache.size : -1, cc: typeof chunkCache !== "undefined" ? chunkCache.size : -1,
      lo: typeof chunkLo !== "undefined" ? chunkLo.size : -1, nm: typeof NM !== "undefined" ? (NM.base ? 2 : NM.built ? 1 : 0) : -1,
      cvHeld: c.held, cvLive: c.live, cvN: c.n,
      mainPx: typeof cv !== "undefined" ? cv.width + "x" + cv.height : "", gpuMB: Math.round((c.held + (typeof cv !== "undefined" ? MB(px(cv)) * 2 : 0)) * 10) / 10,
      heap: pm ? Math.round(pm.usedJSHeapSize / 1e6) : -1, lim: pm ? Math.round(pm.jsHeapSizeLimit / 1e6) : -1,
    };
    S.lcx = b.cx; S.lcy = b.cy;
    S.buf.push(o);
    if (S.buf.length > 200) S.buf.shift();
    return o;
  }
  function header() {
    let mc = null;
    try { mc = typeof MEMCAP !== "undefined" ? MEMCAP : null; } catch (e) {}
    return { build: BUILD, ua: navigator.userAgent, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight,
      dm: navigator.deviceMemory || null, lowmem: typeof LOWMEM !== "undefined" ? LOWMEM : null, memcap: mc,
      VW: typeof VW !== "undefined" ? VW : null, VH: typeof VH !== "undefined" ? VH : null };
  }
  function save(why) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, why, at: new Date().toISOString(), open: S.open, clean: !S.open, hdr: header(), errs: S.errs.slice(-20), big: S.big, buf: S.buf }));
    } catch (e) {}
  }
  // ---- previous run: unclean exit while the map was open?
  let prev = null;
  try {
    const raw = localStorage.getItem(KEY);
    prev = JSON.parse(raw || "null");
    // keep an unclean (crashed) log aside so opening the map again does not overwrite it before it is copied
    if (prev && prev.open) localStorage.setItem(KEY + ".crash", raw);
    else prev = JSON.parse(localStorage.getItem(KEY + ".crash") || "null") || prev;
  } catch (e) {}
  const text = (d) => JSON.stringify(d);
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = t; ta.style.cssText = "position:fixed;left:0;top:0;opacity:0";
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch (e) { return false; }
  }
  function banner(d) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:#3a1010;color:#fff;border:2px solid #ff6b6b;border-radius:10px;padding:10px;font:14px system-ui;box-shadow:0 4px 18px #0008";
    const crashed = d.open;
    el.innerHTML = `<b>${crashed ? "Map may have crashed" : "Map debug log from last session"}</b> <span style="opacity:.8;font-size:12px">(${d.buf.length} samples, ${d.why}, ${d.at})</span><br>`;
    const mk = (label, fn) => { const b = document.createElement("button"); b.textContent = label; b.style.cssText = "margin:8px 8px 0 0;padding:8px 12px;font:600 14px system-ui;border-radius:8px;border:0;background:#ffd23c;color:#222"; b.onclick = fn; el.appendChild(b); return b; };
    const cb = mk("Copy log", async () => { cb.textContent = (await copy(text(d))) ? "Copied ✓ — paste it in chat" : "Copy failed — use Share"; });
    if (navigator.share) mk("Share log", () => navigator.share({ title: "Big Rig map log", text: text(d) }).catch(() => {}));
    mk("Dismiss", () => { el.remove(); try { localStorage.removeItem(KEY + ".crash"); } catch (e) {} });
    document.body.appendChild(el);
  }
  // ---- automatic crash report (Supabase table crash_reports via the insert-only report_crash RPC; publishable key only)
  const SENT = KEY + ".sent";
  function scrub(t) {
    return t.replace(/eyJ[\w-]{8,}\.[\w-]+\.[\w-]+/g, "[jwt]").replace(/sb_(secret|publishable)_[\w-]+/g, "[key]")
      .replace(/("(?:access_token|refresh_token|token|password|apikey|authorization)"\s*:\s*)"[^"]*"/gi, '$1"[redacted]"');
  }
  function toast(msg, ok) {
    const t = document.createElement("div");
    t.textContent = msg;
    S.lastToast = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;padding:8px 14px;border-radius:8px;font:600 13px system-ui;color:#fff;pointer-events:none;background:" + (ok ? "#1d6b35" : "#7a2020");
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }
  async function report(d) {
    const rid = (d.hdr && d.hdr.build) + "-" + d.at;
    try { if ((localStorage.getItem(SENT) || "").split(",").includes(rid)) return; } catch (e) {}
    if (typeof ACC === "undefined" || !ACC.url) return;
    let ok = false;
    try {
      const body = scrub(JSON.stringify({ p: Object.assign({ rid, page: location.origin + location.pathname }, d) }));
      const r = await fetch(ACC.url + "/rest/v1/rpc/report_crash", {
        method: "POST", headers: { "Content-Type": "application/json", apikey: ACC.key, Authorization: "Bearer " + ACC.key }, body,
      });
      ok = r.ok;
    } catch (e) {}
    if (ok) try { localStorage.setItem(SENT, ((localStorage.getItem(SENT) || "").split(",").slice(-20).concat(rid)).join(",")); } catch (e) {}
    toast(ok ? "Crash report sent" : "Crash report failed to send (Copy log still works)", ok);
  }
  S.report = report;
  const showPrev = () => {
    if (!(prev && prev.buf && prev.buf.length)) return;
    if (prev.open) report(prev);
    if (S.showHud) banner(prev);
  };
  if (document.body) setTimeout(showPrev, 1500); else addEventListener("DOMContentLoaded", () => setTimeout(showPrev, 1500));
  S.prev = prev;
  S.copyPrev = () => prev && copy(text(prev));
  // ---- live HUD
  function hud(o) {
    if (!S.showHud || !o) return;
    if (!S.hud) {
      S.hud = document.createElement("div");
      S.hud.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:99998;background:#000c;color:#7dff9a;font:11px/1.25 ui-monospace,monospace;padding:4px 6px;border-radius:6px;pointer-events:none;white-space:pre";
      document.body.appendChild(S.hud);
    }
    S.hud.style.display = S.open ? "block" : "none";
    S.hud.textContent = `MAPDBG heap ${o.heap}/${o.lim}MB  canvas held ${o.cvHeld} live ${o.cvLive}MB (${o.cvN}) gpu~${o.gpuMB}MB\nz ${o.z} ${o.det ? "SHARP" : "low"} ${o.night > 0.01 ? "NIGHT" : "day"} nm${o.nm} pv ${o.pv}  mapc ${o.mapc} cc ${o.cc} lo ${o.lo}  ${o.a}`;
  }
  // ---- hooks
  const err = (m) => { S.errs.push([Date.now() - S.t0, String(m).slice(0, 300)]); if (S.errs.length > 50) S.errs.shift(); if (S.open) { sample("err"); save("error"); } };
  addEventListener("error", (e) => err((e.error && e.error.stack) || e.message));
  addEventListener("unhandledrejection", (e) => err("rejection: " + ((e.reason && e.reason.stack) || e.reason)));
  addEventListener("pagehide", () => { sample("pagehide"); S.open = false; save("pagehide"); });
  addEventListener("visibilitychange", () => { sample("vis:" + document.visibilityState); save("visibility"); });
  document.addEventListener("freeze", () => { sample("freeze"); save("freeze"); });
  setTimeout(() => {
    try {
      const o0 = openMap, c0 = closeMap, z0 = mapZoomTo;
      openMap = function () { const r = o0.apply(this, arguments); if (bigmap.open) { S.open = true; S.act = "open"; S.buf = []; sample("open"); save("open"); } return r; };
      closeMap = function () { S.act = "close"; sample("close"); S.open = false; const r = c0.apply(this, arguments); save("close"); hud(S.buf[S.buf.length - 1]); return r; };
      mapZoomTo = function () { S.act = "zoom"; return z0.apply(this, arguments); };
    } catch (e) { S.hookErr = String(e); }
    let last = 0;
    setInterval(() => {
      if (!S.open) return;
      if (typeof bigmap !== "undefined" && !bigmap.open) { S.open = false; save("closed"); hud(S.buf[S.buf.length - 1] || {}); return; }
      const o = sample();
      if (o.pv > 0 && S.act !== "zoom") S.act = "pan";
      hud(o);
      if (Date.now() - last > 1000) { last = Date.now(); save("tick"); }
    }, 200);
  }, 0);
  return S;
})();
