/**
 * @file fog.js — v66 map discovery (Age-of-Empires style fog of war) for NEW players.
 * World map + minimap start fogged; driving reveals a radius around the truck. Fog bitmap: 1 bit per FOG_C x FOG_C tiles,
 * saved per 32x32-cell chunk (only touched chunks, base64) in the save (d.fog). Fast-travel places become 'discovered'
 * when you first get near them (toast); only discovered places are map icons / fast-travel targets. Homes & yards need an
 * actual visit (small radius). Old saves (no d.fog) and the account "sonjames" are fully revealed. Dev: ?fog=off, BigRig.fog.revealAll().
 */
const FOG_C = 8,
  FOG_W = MW / FOG_C,
  FOG_H = MH / FOG_C,
  FOG_CH = 32;
const FOG = {
  on: true, // false = everything revealed
  bits: new Uint8Array(FOG_W * FOG_H),
  disc: new Set(),
  okey: new WeakMap(),
  dirty: true,
  tex: null,
  texHi: null,
  t: 0,
  revealM: 190, // metres revealed round the truck
  discM: 130, // metres to discover a place
  visitM: 45, // homes / yards: must actually visit
};
function fogDev() {
  try {
    if (/[?&]fog=off\b/.test(location.search)) return true;
    const n = (localStorage.getItem("bigrig.name") || "").trim().toLowerCase();
    if (n === "sonjames") return true;
    const a = typeof ACC !== "undefined" && ACC && (ACC.user || ACC.name);
    if (a && String(a.name || a.username || a).trim().toLowerCase() === "sonjames") return true;
  } catch (e) {}
  return false;
}
function fogActive() {
  return FOG.on && !fogDev();
}
function fogKey(o, mx, my) {
  return (o.name || o.id || "?") + "@" + Math.round(mx) + "," + Math.round(my);
}
function fogIsHome(o, kind) {
  return /home|yard/i.test(kind || "") && !/agent/i.test(kind || "");
}
// metres -> revealed?
function fogSeen(mx, my) {
  if (!fogActive()) return true;
  const i = Math.floor(mx / M_T / FOG_C),
    j = Math.floor(my / M_T / FOG_C);
  if (i < 0 || j < 0 || i >= FOG_W || j >= FOG_H) return false;
  return FOG.bits[i + j * FOG_W] === 1;
}
function fogKnownObj(o) {
  if (!fogActive() || !o) return true;
  const k = FOG.okey.get(o);
  return k ? FOG.disc.has(k) : true; // not a map place (e.g. route point): unaffected
}
function fogReveal(mx, my, rM) {
  const ci = mx / M_T / FOG_C,
    cj = my / M_T / FOG_C,
    r = rM / M_T / FOG_C;
  let ch = false;
  for (let j = Math.max(0, Math.floor(cj - r)); j <= Math.min(FOG_H - 1, Math.ceil(cj + r)); j++)
    for (let i = Math.max(0, Math.floor(ci - r)); i <= Math.min(FOG_W - 1, Math.ceil(ci + r)); i++) {
      const k = i + j * FOG_W;
      if (!FOG.bits[k] && Math.hypot(i + 0.5 - ci, j + 0.5 - cj) <= r) {
        FOG.bits[k] = 1;
        ch = true;
      }
    }
  if (ch) FOG.dirty = true;
  return ch;
}
const FOG_Q = [];
let FOG_QT = 0;
function fogToast(name) {
  FOG_Q.push(name);
  if (!FOG_QT) fogToastNext();
}
function fogToastNext() {
  const name = FOG_Q.shift();
  if (name === undefined) {
    FOG_QT = 0;
    return;
  }
  FOG_QT = setTimeout(fogToastNext, 2200);
  fogToastShow(name);
}
function fogToastShow(name) {
  if (typeof uiInit === "function") uiInit();
  if (typeof uiRoot === "undefined" || !uiRoot) return;
  const d = document.createElement("div");
  d.className = "toast fogd";
  d.innerHTML = '<span style="color:#f5b82e;letter-spacing:1px;font-size:11px">DISCOVERED</span><br>';
  d.appendChild(document.createTextNode(name));
  uiRoot.appendChild(d);
  setTimeout(() => d.remove(), 2150);
  if (!document.getElementById("fogcss")) {
    const s = document.createElement("style");
    s.id = "fogcss";
    s.textContent =
      ".toast.fogd{top:auto;bottom:110px;text-align:center;font-size:15px;padding:8px 18px;line-height:1.25}body.touch .toast.fogd{bottom:46%}";
    document.head.appendChild(s);
  }
}
// scan every place (original, unfiltered list): map object -> key, discover what's near the truck
function fogScan(silent) {
  const tx = truck.x,
    ty = truck.y,
    act = fogActive(),
    found = [];
  FOG_MPL((o, mx, my, kind) => {
    if (!o) return;
    const k = fogKey(o, mx, my);
    FOG.okey.set(o, k);
    if (!act || FOG.disc.has(k)) return;
    const r = fogIsHome(o, kind) ? FOG.visitM : FOG.discM;
    if (Math.hypot(mx - tx, my - ty) < r) {
      FOG.disc.add(k);
      if (!fogIsHome(o, kind)) fogReveal(mx, my, 60);
      found.push((o.brand && o.brand.name) || o.name || kind);
    }
  });
  if (!silent)
    for (const n of found.slice(0, 4)) {
      fogToast(n);
      if (typeof BigRig !== "undefined" && BigRig.emit) BigRig.emit("discovered", { name: n });
    }
  return found;
}
function fogTick() {
  if (typeof world === "undefined" || !world.ready || typeof truck === "undefined") return;
  if (!fogActive()) return;
  fogReveal(truck.x, truck.y, FOG.revealM);
  fogScan(false);
}
// ---------- save / load
function fogSave() {
  if (!FOG.on) return { all: 1 };
  const ch = {},
    n = FOG_W / FOG_CH;
  for (let cj = 0; cj < FOG_H / FOG_CH; cj++)
    for (let ci = 0; ci < n; ci++) {
      const b = new Uint8Array((FOG_CH * FOG_CH) / 8);
      let any = 0;
      for (let y = 0; y < FOG_CH; y++)
        for (let x = 0; x < FOG_CH; x++)
          if (FOG.bits[ci * FOG_CH + x + (cj * FOG_CH + y) * FOG_W]) {
            const q = x + y * FOG_CH;
            b[q >> 3] |= 1 << (q & 7);
            any = 1;
          }
      if (any) ch[ci + "," + cj] = btoa(String.fromCharCode.apply(null, b));
    }
  return { v: 1, c: FOG_C, ch, d: [...FOG.disc] };
}
function fogLoad(f) {
  FOG.bits.fill(0);
  FOG.disc.clear();
  FOG.dirty = true;
  if (!f || f.all) {
    FOG.on = false; // existing save from before fog (or revealed): everything revealed
    return;
  }
  FOG.on = true;
  for (const k in f.ch || {}) {
    const [ci, cj] = k.split(",").map(Number),
      s = atob(f.ch[k]);
    for (let q = 0; q < FOG_CH * FOG_CH; q++)
      if (s.charCodeAt(q >> 3) & (1 << (q & 7)))
        FOG.bits[ci * FOG_CH + (q % FOG_CH) + (cj * FOG_CH + ((q / FOG_CH) | 0)) * FOG_W] = 1;
  }
  for (const k of f.d || []) FOG.disc.add(k);
}
// ---------- drawing: soft, dark, lightly textured; one cached texture rebuilt when the fog changes
let FOG_NOISE = null;
function fogNoise() {
  if (FOG_NOISE) return FOG_NOISE;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"),
    im = g.createImageData(128, 128),
    R = mulberry ? mulberry(77) : Math.random;
  for (let i = 0; i < 128 * 128; i++) {
    const v = 14 + R() * 22;
    im.data[i * 4] = v * 0.8;
    im.data[i * 4 + 1] = v * 0.95;
    im.data[i * 4 + 2] = v * 1.25;
    im.data[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  // soft cloudy blotches on top
  for (let k = 0; k < 40; k++) {
    const x = R() * 128,
      y = R() * 128,
      r = 10 + R() * 30,
      gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(60,75,100,0.18)");
    gr.addColorStop(1, "rgba(60,75,100,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  return (FOG_NOISE = c);
}
function fogTex() {
  const hi = typeof gfxHi === "function" ? gfxHi() : true;
  if (FOG.tex && !FOG.dirty && FOG.texHi === hi) return FOG.tex;
  const m = document.createElement("canvas");
  m.width = FOG_W;
  m.height = FOG_H;
  const mg = m.getContext("2d"),
    im = mg.createImageData(FOG_W, FOG_H);
  for (let i = 0; i < FOG.bits.length; i++) {
    im.data[i * 4 + 3] = FOG.bits[i] ? 255 : 0;
  }
  mg.putImageData(im, 0, 0);
  const S = hi ? 4 : 2,
    c = FOG.tex || document.createElement("canvas");
  c.width = FOG_W * S;
  c.height = FOG_H * S;
  const g = c.getContext("2d");
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "#070a11";
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-out"; // punch the revealed cells out (soft edged)
  g.imageSmoothingEnabled = true;
  if (hi && "filter" in g) g.filter = "blur(" + 2.2 * S + "px)";
  g.drawImage(m, 0, 0, c.width, c.height);
  g.filter = "none";
  g.globalCompositeOperation = "source-over";
  FOG.tex = c;
  FOG.texHi = hi;
  FOG.dirty = false;
  return c;
}
// tile -> screen mapping: screen = ox + t*sc
let FOG_L = null;
function fogDraw(ox, oy, sc, clip) {
  if (!fogActive()) return;
  const t = fogTex(),
    hi = FOG.texHi,
    [cx, cy, cw, ch] = clip;
  if (!FOG_L) FOG_L = document.createElement("canvas");
  const L = FOG_L;
  if (L.width < cw || L.height < ch) {
    L.width = Math.ceil(cw);
    L.height = Math.ceil(ch);
  }
  const g = L.getContext("2d");
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, L.width, L.height);
  g.fillStyle = "#070a11"; // beyond the world edge: always fog
  g.fillRect(0, 0, cw, ch);
  g.clearRect(ox - cx, oy - cy, MW * sc, MH * sc);
  g.imageSmoothingEnabled = true;
  g.drawImage(t, ox - cx, oy - cy, MW * sc, MH * sc);
  if (hi) {
    // slow drifting cloud texture in screen space (not pixel art: soft 128px noise scaled up)
    g.globalCompositeOperation = "source-atop";
    const p = g.createPattern(fogNoise(), "repeat"),
      k = 2.5,
      d = ((typeof timeS === "number" ? timeS : 0) * 4) % (128 * k);
    if (p.setTransform) p.setTransform(new DOMMatrix([k, 0, 0, k, d - cx, -cy * 0.5]));
    g.globalAlpha = 0.55;
    g.fillStyle = p;
    g.fillRect(0, 0, cw, ch);
    g.globalAlpha = 1;
  }
  ctx.save();
  ctx.globalAlpha = 0.985;
  ctx.drawImage(L, 0, 0, cw, ch, cx, cy, cw, ch);
  ctx.restore();
}
// ---------- hooks (wrap the existing global functions)
const FOG_MPL = mapPOIList;
mapPOIList = function (cb) {
  FOG_MPL((o, mx, my, kind) => {
    if (!fogActive()) return cb(o, mx, my, kind);
    const k = fogKey(o, mx, my);
    FOG.okey.set(o, k);
    if (FOG.disc.has(k)) cb(o, mx, my, kind);
  });
};
const FOG_FT = fastTravel;
const FOG_MSG = "Undiscovered \u2014 drive there first to unlock fast travel";
fastTravel = function (dp, at) {
  if (fogActive() && dp) {
    if (!FOG.okey.has(dp)) fogScan(true);
    if (!fogKnownObj(dp)) {
      flash(FOG_MSG);
      return false;
    }
  }
  return FOG_FT(dp, at);
};
BigRig.fastTravel = fastTravel;
const FOG_FTB = ftBlock;
ftBlock = function (o, peek) {
  if (fogActive() && o && !fogKnownObj(o)) return FOG_MSG;
  return FOG_FTB(o, peek);
};
setInterval(fogTick, 250);
BigRig.fog = {
  state: FOG,
  active: fogActive,
  seen: fogSeen,
  known: fogKnownObj,
  scan: fogScan,
  save: fogSave,
  load: fogLoad,
  revealAll() {
    FOG.on = false;
    FOG.dirty = true;
    if (typeof saveGame === "function") saveGame();
  },
  reset() {
    fogLoad({ v: 1, ch: {}, d: [] });
  },
};
if (window.__fogPend) fogLoad(window.__fogPend[0]);
