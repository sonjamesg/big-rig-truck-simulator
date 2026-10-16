"use strict";
// ===================== v27 home / title screen: animated night-road backdrop, green loading bar, settings panel, version footer =====================
(function () {
  const css = `#overlay{background:#070b13!important}
#overlay>*:not(#homeBg){position:relative;z-index:1}
#homeBg{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block}
#overlay .go.wait{background:#5b5f68!important;color:#c9ccd2!important;animation:none!important;opacity:.75;cursor:default}
#loadBox{width:min(440px,86%);margin:16px auto 4px;text-align:center;padding:10px 14px 8px;border-radius:12px;background:rgba(8,12,20,.72);border:1px solid rgba(125,255,138,.18);box-shadow:0 6px 18px rgba(0,0,0,.4)}
#loadTrack{position:relative;height:16px;border-radius:9px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.22);overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.6)}
#loadFill{position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:9px;background:linear-gradient(180deg,#7dff8a,#2fc147 55%,#1f9a34);box-shadow:0 0 12px rgba(80,255,110,.55);transition:width .35s ease-out}
#loadFill::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.18) 0 8px,transparent 8px 16px);animation:ldStripe .8s linear infinite}
#loadBox.done #loadFill::after{animation:none;opacity:0}
@keyframes ldStripe{to{background-position:22px 0}}
#loadRow{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;font-size:13px;color:#cfe8d2}
#loadPct{font-weight:900;color:#7dff8a;font-variant-numeric:tabular-nums;font-size:15px;text-shadow:0 0 8px rgba(80,255,110,.5)}
#overlay #loadBox #loading{margin:0!important;opacity:.9!important;font-size:13px!important;display:block!important;text-align:left}
#setPanel{margin:16px auto 6px;padding:10px 18px;border-radius:14px;background:rgba(14,20,32,.78);border:1px solid rgba(245,184,46,.35);box-shadow:0 8px 24px rgba(0,0,0,.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;flex-direction:column;gap:8px;align-items:stretch;min-width:min(300px,86vw)}
#setPanel .sph{font-size:11px;letter-spacing:3px;font-weight:800;color:#f5b82e;opacity:.85;text-align:left}
#setPanel>*:not(.sph){margin:0!important;justify-content:space-between!important}
#homeVer{position:relative;margin-top:14px;padding-bottom:4px;font-size:10px;letter-spacing:1px;opacity:.45;color:#cfd6e0}
body.touch #overlay #loadBox{width:min(380px,90vw)}
@media (orientation:landscape) and (max-height:500px){ body.touch #overlay #logo{max-height:30vh!important} body.touch #overlay #loadBox{margin-top:10px} body.touch #setPanel{margin-top:10px;padding:8px 14px} }
#overlay.hidden,body.touch #overlay.hidden{display:none!important}
body:has(#overlay:not(.hidden)) #hudbtns,body:has(#overlay:not(.hidden)) #mpbadge{display:none!important}
@media (orientation:landscape) and (max-height:500px){
 body.touch #overlay{display:grid!important;grid-template-columns:1fr 1fr;grid-auto-rows:min-content;column-gap:18px;row-gap:6px;align-content:center;justify-items:center;padding:10px 18px!important}
 body.touch #overlay>*{grid-column:1;margin-top:0!important;margin-bottom:0!important}
 body.touch #overlay>#homeBg{grid-column:auto}
 body.touch #overlay>#lobby,body.touch #overlay>#wbCard,body.touch #overlay>#setPanel{grid-column:2}
 body.touch #overlay>#lobby{grid-row:1/span 3;align-self:center} body.touch #overlay>#setPanel{grid-row:4/span 2;align-self:start}
 body.touch #overlay>#logo{grid-row:1/span 3;max-height:44vh!important;max-width:40vw!important}
 body.touch #overlay>#loadBox{grid-row:4;width:min(380px,44vw)!important}
 body.touch #overlay>#homeVer{grid-column:1/span 2;grid-row:6}
 body.touch #lobby,body.touch #wbCard{width:min(44vw,400px)!important;gap:6px!important}
 body.touch #lobby .row{flex-direction:row!important;align-items:center!important;gap:6px!important}
 body.touch #lobby .row>*{width:auto!important;flex:1 1 0;min-width:0}
 body.touch #lobby .row>span{flex:0 0 auto}
 body.touch #lobby .lb{padding:7px 10px!important;font-size:13px!important;min-height:36px}
 body.touch #lobby input{padding:6px 10px!important;min-height:36px;font-size:16px}
 body.touch #setPanel{width:min(44vw,400px);min-width:0;padding:6px 14px!important;gap:4px} body.touch #setPanel .sph{display:none}
}`;
  const st = document.createElement("style");
  st.id = "homeCss";
  st.textContent = css;
  document.head.appendChild(st);
  const ov = document.getElementById("overlay"),
    ld = document.getElementById("loading"),
    go = ov && ov.querySelector(".go");
  if (go && !(typeof world !== "undefined" && world.ready)) go.classList.add("wait");
  if (ld) {
    const b = document.createElement("div");
    b.id = "loadBox";
    b.innerHTML = '<div id="loadTrack"><div id="loadFill"></div></div><div id="loadRow"></div>';
    ld.parentNode.insertBefore(b, ld);
    const r = b.querySelector("#loadRow");
    r.appendChild(ld);
    const pc = document.createElement("span");
    pc.id = "loadPct";
    pc.textContent = "0%";
    r.appendChild(pc);
    ld.textContent = "Starting\u2026";
  }
  window.homeSize = function () {
    try {
      const n = performance.getEntriesByType("navigation")[0];
      if (!n) return "";
      const mb = (b) => (b / 1048576).toFixed(1) + " MB",
        d = n.decodedBodySize || 0,
        t = n.transferSize || 0;
      if (!d) return "";
      return " \u00b7 " + mb(t > 1000 ? t : d);
    } catch (e) {
      return "";
    }
  };
  window.homeProgress = function (p, txt) {
    p = Math.max(0, Math.min(100, Math.round(p)));
    const f = document.getElementById("loadFill"),
      pc = document.getElementById("loadPct"),
      l = document.getElementById("loading");
    if (f) f.style.width = p + "%";
    if (pc) pc.textContent = p + "%" + homeSize();
    if (l && txt) l.textContent = txt;
    if (p >= 100) {
      const bx = document.getElementById("loadBox");
      if (bx) bx.classList.add("done");
      const g = ov && ov.querySelector(".go");
      if (g) {
        g.classList.remove("wait");
        g.removeAttribute("aria-disabled");
      }
    }
  };
  if (go) go.setAttribute("aria-disabled", "true");
  // backdrop: dusk sky, city skyline with lit windows, a motorway with street lamps and passing headlights / tail lights (light: ~30 fps, DPR capped, stops when hidden)
  const c = document.createElement("canvas");
  c.id = "homeBg";
  if (ov) ov.insertBefore(c, ov.firstChild);
  const g = c.getContext("2d");
  let W = 0,
    H = 0,
    sky = null,
    bld = [],
    cars = [],
    lastT = 0;
  function rnd(s) {
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  function setup() {
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    W = Math.max(1, c.clientWidth);
    H = Math.max(1, c.clientHeight);
    c.width = (W * dpr) | 0;
    c.height = (H * dpr) | 0;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = rnd(7);
    bld = [];
    let x = -10;
    while (x < W + 10) {
      const w = 18 + R() * 42,
        h = (0.08 + R() * 0.22) * H * (R() < 0.15 ? 1.8 : 1);
      const win = [];
      for (let yy = 6; yy < h - 6; yy += 9)
        for (let xx = 4; xx < w - 5; xx += 8)
          if (R() < 0.32) win.push([xx, yy, R() < 0.8 ? "#ffcf7a" : "#cfe6ff"]);
      bld.push({ x, w, h, win });
      x += w + 2 + R() * 6;
    }
    sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#05080f");
    sky.addColorStop(0.45, "#101a30");
    sky.addColorStop(0.62, "#2a2440");
    sky.addColorStop(0.66, "#3a2a3a");
    sky.addColorStop(1, "#06090f");
    cars = [];
    const R2 = rnd(11);
    for (let i = 0; i < 9; i++)
      cars.push({ x: R2() * W, dir: i % 2 ? 1 : -1, v: 40 + R2() * 70, lorry: R2() < 0.35 });
  }
  function draw(t) {
    if (!ov || ov.classList.contains("hidden")) {
      requestAnimationFrame(draw);
      return;
    }
    if (t - lastT < 15) {
      requestAnimationFrame(draw);
      return;
    }
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    if (c.clientWidth !== W || c.clientHeight !== H) setup();
    const hz = H * 0.64;
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // skyline
    for (const b of bld) {
      g.fillStyle = "#0b111d";
      g.fillRect(b.x, hz - b.h, b.w, b.h);
      for (const w of b.win) {
        g.fillStyle = w[2];
        g.globalAlpha = 0.55;
        g.fillRect(b.x + w[0], hz - b.h + w[1], 3, 4);
      }
      g.globalAlpha = 1;
    }
    const gl = g.createRadialGradient(W / 2, hz, 0, W / 2, hz, W * 0.6);
    gl.addColorStop(0, "rgba(255,150,60,.18)");
    gl.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = gl;
    g.fillRect(0, hz - H * 0.4, W, H * 0.5);
    // road
    const ry = hz + H * 0.06,
      rh = H * 0.09;
    g.fillStyle = "#14171d";
    g.fillRect(0, ry, W, rh);
    g.fillStyle = "#2b2f37";
    g.fillRect(0, ry - 2, W, 2);
    g.fillRect(0, ry + rh, W, 2);
    g.fillStyle = "rgba(240,240,240,.35)";
    const off = (t * 0.06) % 40;
    for (let x = -off; x < W; x += 40) g.fillRect(x, ry + rh / 2 - 1, 20, 2);
    // lamps
    for (let x = 20; x < W; x += 110) {
      g.fillStyle = "#1d222b";
      g.fillRect(x, ry - H * 0.09, 2, H * 0.09);
      g.fillRect(x, ry - H * 0.09, 12, 2);
      const lg = g.createRadialGradient(
        x + 11,
        ry - H * 0.09 + 3,
        0,
        x + 11,
        ry - H * 0.09 + 3,
        34,
      );
      lg.addColorStop(0, "rgba(255,190,90,.55)");
      lg.addColorStop(1, "rgba(255,190,90,0)");
      g.fillStyle = lg;
      g.fillRect(x - 24, ry - H * 0.09 - 30, 70, 70);
    }
    // traffic (left-hand driving: nearer lane travels right-to-left? UK: viewer-side lane goes left->right)
    for (const k of cars) {
      k.x += k.dir * k.v * dt;
      if (k.x > W + 80) k.x = -80;
      if (k.x < -80) k.x = W + 80;
      const y = k.dir > 0 ? ry + rh * 0.72 : ry + rh * 0.28,
        L = k.lorry ? 46 : 22;
      g.fillStyle = "#0a0c10";
      g.fillRect(k.x - L / 2, y - 4, L, 8);
      const fx = k.dir > 0 ? k.x + L / 2 : k.x - L / 2,
        rx = k.dir > 0 ? k.x - L / 2 : k.x + L / 2;
      g.save();
      g.globalCompositeOperation = "lighter";
      const bl = k.lorry ? 90 : 70,
        hg = g.createLinearGradient(fx, y, fx + k.dir * bl, y);
      hg.addColorStop(0, "rgba(255,240,200,.35)");
      hg.addColorStop(1, "rgba(255,240,200,0)");
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(fx, y - 2);
      g.lineTo(fx + k.dir * bl, y - 7);
      g.lineTo(fx + k.dir * bl, y + 7);
      g.lineTo(fx, y + 2);
      g.closePath();
      g.fill();
      g.restore();
      g.fillStyle = "#fff6dc";
      g.fillRect(fx - (k.dir > 0 ? 2 : 0), y - 3, 2, 2);
      g.fillRect(fx - (k.dir > 0 ? 2 : 0), y + 1, 2, 2);
      g.fillStyle = "rgba(255,40,30,.95)";
      g.fillRect(rx - (k.dir > 0 ? 0 : 2), y - 3, 2, 2);
      g.fillRect(rx - (k.dir > 0 ? 0 : 2), y + 1, 2, 2);
      if (k.lorry) {
        g.fillStyle = "rgba(255,170,40,.9)";
        for (let q = 6; q < L - 6; q += 10) g.fillRect(k.x - L / 2 + q, y - 4, 2, 1);
      }
    }
    // foreground fade
    const fg = g.createLinearGradient(0, ry + rh, 0, H);
    fg.addColorStop(0, "rgba(6,9,15,.6)");
    fg.addColorStop(1, "#05070c");
    g.fillStyle = fg;
    g.fillRect(0, ry + rh + 2, W, H);
    // readability vignette behind the content
    const vg = g.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.7);
    vg.addColorStop(0, "rgba(5,8,14,.55)");
    vg.addColorStop(1, "rgba(5,8,14,0)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    requestAnimationFrame(draw);
  }
  if (ov) requestAnimationFrame(draw);
  addEventListener("load", () => {
    if (!ov) return; // group the on-screen settings (volume / vibration) into one panel
    const parts = [document.getElementById("volM"), document.getElementById("vibM")]
      .map((e) => e && e.closest("#overlay>*"))
      .filter(Boolean);
    if (parts.length && !document.getElementById("setPanel")) {
      const p = document.createElement("div");
      p.id = "setPanel";
      p.innerHTML = '<div class="sph">SETTINGS</div>';
      parts[0].parentNode.insertBefore(p, parts[0]);
      for (const e of parts) p.appendChild(e);
      for (const ev of ["pointerdown", "click", "touchstart"])
        p.addEventListener(ev, (e) => e.stopPropagation());
    }
    if (!document.getElementById("homeVer")) {
      const v = document.createElement("div");
      v.id = "homeVer";
      v.textContent = (window.BIGRIG_VERSION || "") + " \u2022 web preview";
      ov.appendChild(v);
    }
  });
})();
