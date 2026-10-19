/**
 * @file gfxcity.js — GRAPHICS overhaul (v51, straight top-down, no outlines): city mood after the night concept.
 *   Stage A roads: baked asphalt wear on every road tile (cracks, tar-sealed joints, patches, oil stains, tyre tracks
 *   along the lanes, shallow puddle patches), kept faint so daytime stays clean; at night on high quality the puddles
 *   and the wet road reflect the real lights (warm street lamps, signal heads in their current colour).
 *   Stage B rooftops: skylights + vents baked on flat roofs, lit skylights and steam at night (high).
 *   Stage C light + colour: teal night grade under warm lamps, faint haze, stronger headlight cones (gfx.js).
 *   Stage D vehicles: clear-coat sheen, rounded flanks and a sky streak baked into every AI vehicle / trailer art.
 * Exposes (globals): GC, gcHash, gcPuddle, gcRoadWear, gcWetNight, gcNearLamp, gcSigLamps, GC_LAMP, GC_SIGC, gcRoofBits, gcRoofBake, gcRoofLive, GC_TEAL,
 *   GC_HAZE, gcVehGloss
 * Depends on: render.js (renderChunk, CHUNK), world.js (G, T, TILE, idx, inb, world.roadH/roadV), daynight.js (DN,
 *   drawNight, dnGlow, slZone, SL, slOn), gfx.js (gfxHi, GFX, gfxGradeAt), gfx3d.js (G3), traffic.js
 *   (makeCarArt, makeVanArt, makeBusArt, makeBoxArt, makeTractorArt, makeTrailerArtAI), weather.js (WX)
 * Load order: after gfx3d.js in build.py (wraps renderChunk outermost, drawNight). Shared global scope.
 */
const GC = {
  pal: ["rgba(255,60,200,1)", "rgba(40,220,255,1)", "rgba(255,170,60,1)"],
  zc: new Map(),
};
function gcHash(x, y, k) {
  let h = (x * 374761393 + y * 668265263 + (k || 0) * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const gcIsRoad = (tx, ty) => inb(tx, ty) && G[idx(tx, ty)] === T.ROAD;
// puddle on a road tile (deterministic): null or [x, y, rx, ry] in world px
function gcPuddle(tx, ty) {
  if (gcHash(tx, ty, 7) > 0.1 || !gcIsRoad(tx, ty)) return null;
  const i = idx(tx, ty),
    hz = world.roadH[i] >= 0 && world.roadV[i] < 0,
    r = 5 + gcHash(tx, ty, 8) * 7;
  return [
    tx * TILE + 8 + gcHash(tx, ty, 9) * 16,
    ty * TILE + 8 + gcHash(tx, ty, 10) * 16,
    hz ? r * 1.8 : r,
    hz ? r : r * 1.8,
  ];
}
// baked wear on one road tile (g is the chunk canvas, px/py the tile's top-left in chunk px)
function gcRoadWear(g, tx, ty, px, py) {
  const H = (k) => gcHash(tx, ty, k),
    i = idx(tx, ty),
    hz = world.roadH[i] >= 0 && world.roadV[i] < 0,
    vt = world.roadV[i] >= 0 && world.roadH[i] < 0;
  // tyre tracks: two darker bands per lane, along the road
  if (hz || vt) {
    g.fillStyle = "rgba(10,10,12," + (0.07 + H(1) * 0.05).toFixed(3) + ")";
    for (const o of [7, 12, 20, 25]) {
      const w = 2.2 + H(o) * 1.2;
      if (hz) g.fillRect(px, py + o, TILE, w);
      else g.fillRect(px + o, py, w, TILE);
    }
  }
  // tar-sealed cracks (thin, dark, a little glossy)
  if (H(2) < 0.32) {
    g.strokeStyle = "rgba(12,12,14,0.45)";
    g.lineWidth = 1;
    g.beginPath();
    let x = px + H(3) * TILE,
      y = py + H(4) * TILE;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (H(20 + k) - 0.5) * 12;
      y += (H(30 + k) - 0.5) * 12;
      g.lineTo(x, y);
      if (H(40 + k) < 0.3) {
        g.moveTo(x, y);
        g.lineTo(x + (H(50 + k) - 0.5) * 8, y + (H(60 + k) - 0.5) * 8);
        g.moveTo(x, y);
      }
    }
    g.stroke();
  }
  // asphalt patch repair
  if (H(5) < 0.06) {
    g.fillStyle = "rgba(20,20,24,0.16)";
    g.fillRect(px + H(11) * 12, py + H(12) * 12, 10 + H(13) * 14, 8 + H(14) * 12);
  }
  // oil stain
  if (H(6) < 0.1) {
    const cx = px + 6 + H(15) * 20,
      cy = py + 6 + H(16) * 20,
      r = 3 + H(17) * 5,
      gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, "rgba(8,8,10,0.36)");
    gr.addColorStop(1, "rgba(8,8,10,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, r * 1.3, r, H(18) * 3, 0, 7);
    g.fill();
  }
  // shallow puddle patch: darker, smoother asphalt with a faint sky sheen
  const p = gcPuddle(tx, ty);
  if (p) {
    const cx = p[0] - tx * TILE + px,
      cy = p[1] - ty * TILE + py;
    g.fillStyle = "rgba(18,22,30,0.2)";
    g.beginPath();
    g.ellipse(cx, cy, p[2], p[3], 0, 0, 7);
    g.fill();
    g.fillStyle = "rgba(180,200,220,0.06)";
    g.beginPath();
    g.ellipse(cx - p[2] * 0.2, cy - p[3] * 0.2, p[2] * 0.6, p[3] * 0.5, 0, 0, 7);
    g.fill();
  }
}
{
  const rc = renderChunk;
  renderChunk = function (cx, cy) {
    const c = rc.apply(this, arguments);
    if (GFX.off.wear) return c;
    const g = c.getContext("2d"),
      N = CHUNK / TILE;
    g.save();
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const tx = cx * N + i,
          ty = cy * N + j;
        if (gcIsRoad(tx, ty)) gcRoadWear(g, tx, ty, i * TILE, j * TILE);
      }
    g.restore();
    return c;
  };
}
// zone of a tile, cached per 8x8 tile block (slZone walks the city list)
function gcZone(tx, ty) {
  const k = (tx >> 3) + "," + (ty >> 3);
  let z = GC.zc.get(k);
  if (z === undefined) GC.zc.set(k, (z = slZone(tx, ty)));
  return z;
}
// night, high quality: the wet road reflects the lights that are really there (v53b, James 19 Oct: no random magenta /
// green pools). Puddles mirror the nearest street lamp (warm) or else only a faint sky sheen; lamp pools are warm smears
// under the lamp heads; every signal head lights the road under it in its current colour (DN.sig, filled by drawOverhead
// this frame). Wetness (WX.wet) scales the reflections; dry roads keep a faint trace.
const GC_LAMP = "rgba(255,212,150,1)",
  GC_SIGC = { r: "rgba(255,40,30,1)", a: "rgba(255,170,30,1)", g: "rgba(60,255,110,1)" };
function gcNearLamp(x, y, R) {
  if (!SL.grid) return null;
  const C = SL.cell;
  let best = null,
    bd = R;
  for (let cy = Math.floor((y - R) / C); cy <= Math.floor((y + R) / C); cy++)
    for (let cx = Math.floor((x - R) / C); cx <= Math.floor((x + R) / C); cx++) {
      const a = SL.grid.get(cx + "," + cy);
      if (a)
        for (const l of a) {
          const d = Math.hypot(l.hx - x, l.hy - y);
          if (d < bd) {
            bd = d;
            best = l;
          }
        }
    }
  return best ? [best, bd] : null;
}
// lit lamps of one DN.sig entry: [[x, y, colour key]]
function gcSigLamps(s) {
  const c = Math.cos(s.a),
    n = Math.sin(s.a),
    at = (k, col) => [s.x + c * k, s.y + n * k, col];
  if (s.ped) return [[s.x, s.y, s.g ? "g" : "r"]];
  const st = s.uk ? s.st : s,
    k = s.uk ? 7 : 8,
    out = [];
  if (st.red) out.push(at(k, "r"));
  if (st.amb) out.push(at(0, "a"));
  if (st.disc || st.arrows.length) out.push(at(-k, "g"));
  return out;
}
function gcWetNight(vx0, vy0, vx1, vy1, z) {
  const K = DN.dark;
  if (K < 0.08 || !gfxHi() || GFX.off.wet) return;
  const wet = 0.3 + 0.7 * Math.min(1, WX.wet || 0);
  ctx.save();
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  const gz = (col, x, y, rx, ry, a) => {
    if (a < 0.01) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(dnGlow(col), (x - vx0 - rx) * z, (y - vy0 - ry) * z, rx * 2 * z, ry * 2 * z);
  };
  const t0x = Math.floor(vx0 / TILE),
    t1x = Math.ceil(vx1 / TILE),
    t0y = Math.floor(vy0 / TILE),
    t1y = Math.ceil(vy1 / TILE);
  if (z > 0.35)
    for (let ty = t0y; ty <= t1y; ty++)
      for (let tx = t0x; tx <= t1x; tx++) {
        const p = gcPuddle(tx, ty);
        if (!p) continue;
        const nl = gcNearLamp(p[0], p[1], 150),
          so = nl ? slOn(nl[0]) * (1 - nl[1] / 150) : 0;
        gz(GC_LAMP, p[0], p[1], p[2] * 2, p[3] * 2, 0.55 * so * K * wet);
        gz(
          "rgba(200,215,235,1)",
          p[0] - p[2] * 0.25,
          p[1] - p[3] * 0.25,
          p[2] * 0.5,
          p[3] * 0.4,
          0.18 * K * wet,
        );
      }
  if (SL.grid) {
    const C = SL.cell;
    for (let cy = Math.floor((vy0 - 200) / C); cy <= Math.floor((vy1 + 200) / C); cy++)
      for (let cx = Math.floor((vx0 - 200) / C); cx <= Math.floor((vx1 + 200) / C); cx++) {
        const a = SL.grid.get(cx + "," + cy);
        if (!a) continue;
        for (const l of a) {
          if (l.hx < vx0 - 160 || l.hx > vx1 + 160 || l.hy < vy0 - 160 || l.hy > vy1 + 160)
            continue;
          const so = slOn(l);
          if (so < 0.05) continue;
          const zc = gcZone(Math.floor(l.hx / TILE), Math.floor(l.hy / TILE));
          gz(GC_LAMP, l.hx, l.hy, 60, 60, (zc === 0 ? 0.2 : zc === 1 ? 0.16 : 0.1) * so * K * wet);
        }
      }
  }
  for (const s of DN.sig || []) {
    if (s.x < vx0 - 60 || s.x > vx1 + 60 || s.y < vy0 - 60 || s.y > vy1 + 60) continue;
    for (const [x, y, c] of gcSigLamps(s))
      gz(GC_SIGC[c], x, y, s.ped ? 9 : 16, s.ped ? 9 : 16, (s.ped ? 0.25 : 0.4) * K * wet);
  }
  ctx.restore();
}
{
  const dn = drawNight;
  drawNight = function (vx0, vy0, vx1, vy1, z) {
    dn.apply(this, arguments);
    gcWetNight(vx0, vy0, vx1, vy1, z);
  };
}
// ---------------------------------------------------------------- stage B: rooftops (baked details + night skylights + steam)
// deterministic roof furniture for one building: skylights [x, y, w, h, colour], vents [x, y, r, steams]
function gcRoofBits(o) {
  if (o.gcRB !== undefined) return o.gcRB;
  let rb = null;
  if (o.kind === "bldg" && o.style !== "house" && o.style !== "stadium" && o.w >= 44 && o.h >= 40) {
    const H = (k) => gcHash(Math.round(o.x), Math.round(o.y), k),
      top = o.y + 6,
      bot = o.y + o.h * 0.58, // stay above the street-side facade strip
      sk = [],
      vt = [];
    const ns = o.w * o.h > 9000 ? 2 : 1;
    for (let i = 0; i < ns; i++) {
      const w = 14 + H(1 + i) * 14,
        h = 9 + H(3 + i) * 8;
      if (bot - top < h + 4) break;
      sk.push([
        o.x + 6 + H(5 + i) * (o.w - w - 12),
        top + H(7 + i) * (bot - top - h),
        w,
        h,
        H(9 + i) < 0.12 ? -1 : (H(11 + i) * 3) | 0, // -1: dark (unlit) skylight
      ]);
    }
    const nv = 1 + ((H(13) * 3) | 0);
    for (let i = 0; i < nv; i++)
      vt.push([
        o.x + 8 + H(15 + i) * (o.w - 16),
        top + 2 + H(19 + i) * (bot - top - 4),
        3 + H(23 + i) * 2.5,
        H(27 + i) < 0.45,
      ]);
    rb = { sk, vt };
  }
  o.gcRB = rb;
  return rb;
}
function gcRoofBake(g, o) {
  const rb = gcRoofBits(o);
  if (!rb) return;
  for (const s of rb.sk) {
    // flat skylight: frame, glazing bars, glass with a soft sheen
    g.fillStyle = "#3a3f47";
    g.fillRect(s[0] - 1.5, s[1] - 1.5, s[2] + 3, s[3] + 3);
    const gr = g.createLinearGradient(s[0], s[1], s[0] + s[2], s[1] + s[3]);
    gr.addColorStop(0, "#5f7d93");
    gr.addColorStop(0.5, "#86a6bb");
    gr.addColorStop(1, "#4d6a80");
    g.fillStyle = gr;
    g.fillRect(s[0], s[1], s[2], s[3]);
    g.fillStyle = "rgba(30,36,44,0.8)";
    for (let x = s[0] + 5; x < s[0] + s[2] - 2; x += 5) g.fillRect(x, s[1], 1, s[3]);
  }
  for (const v of rb.vt) {
    // round extract vent with a fan
    g.fillStyle = "#4b5058";
    g.beginPath();
    g.arc(v[0], v[1], v[2] + 1.5, 0, 7);
    g.fill();
    g.fillStyle = "#23262b";
    g.beginPath();
    g.arc(v[0], v[1], v[2], 0, 7);
    g.fill();
    g.strokeStyle = "#7c828a";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(v[0] - v[2], v[1]);
    g.lineTo(v[0] + v[2], v[1]);
    g.moveTo(v[0], v[1] - v[2]);
    g.lineTo(v[0], v[1] + v[2]);
    g.stroke();
  }
}
{
  const dob = drawObject;
  drawObject = function (g, o) {
    const r = dob.apply(this, arguments);
    if (o.kind === "bldg" && !GFX.off.roofs) gcRoofBake(g, o);
    return r;
  };
}
// buildings in view (shared by the skylight glow and steam passes)
function gcViewBldgs(vx0, vy0, vx1, vy1) {
  const seen = new Set(),
    B = [];
  for (let y = Math.floor(vy0 / CHUNK); y <= Math.floor(vy1 / CHUNK); y++)
    for (let x = Math.floor(vx0 / CHUNK); x <= Math.floor(vx1 / CHUNK); x++) {
      const a = world.chunkObjs.get(x + "," + y);
      if (a)
        for (const o of a)
          if (
            o.kind === "bldg" &&
            !seen.has(o) &&
            o.x < vx1 &&
            o.x + o.w > vx0 &&
            o.y < vy1 &&
            o.y + o.h > vy0
          ) {
            seen.add(o);
            if (gcRoofBits(o)) B.push(o);
          }
    }
  return B;
}
// roof point -> world point (follows the 3D roof lift of gfx3d.js)
function gcRoofPt(o, x, y, cx, cy) {
  if (typeof G3 === "undefined" || !G3.off.has(o)) return [x, y, 1];
  const k = Math.min(0.6, o.height / G3_HCAM);
  return [cx + (x - cx) * (1 + k), cy + (y - cy) * (1 + k), 1 + k];
}
// high quality: lit skylights (flat colour panels + soft glow, never outlines) at night, steam from vents day and night
function gcRoofLive(vx0, vy0, vx1, vy1, z) {
  if (!gfxHi() || GFX.off.roofs || z < 0.4) return;
  const K = DN.dark,
    B = gcViewBldgs(vx0, vy0, vx1, vy1),
    cx = (vx0 + vx1) / 2,
    cy = (vy0 + vy1) / 2,
    hh = gameT < 12 ? gameT + 24 : gameT;
  ctx.save();
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  const S = (x, y) => [(x - vx0) * z, (y - vy0) * z];
  if (K > 0.05) {
    ctx.globalCompositeOperation = "lighter";
    for (const o of B)
      for (const s of o.gcRB.sk) {
        if (s[4] < 0) continue;
        // late at night some go dark
        if (hh > 24.5 + gcHash(Math.round(s[0]), Math.round(s[1]), 3) * 5) continue;
        const p = gcRoofPt(o, s[0], s[1], cx, cy),
          a = S(p[0], p[1]),
          w = s[2] * p[2] * z,
          h = s[3] * p[2] * z,
          col = GC.pal[s[4]];
        ctx.globalAlpha = 0.75 * K;
        ctx.fillStyle = col;
        ctx.fillRect(a[0], a[1], w, h);
        ctx.globalAlpha = 0.35 * K;
        const R = Math.max(w, h) * 1.6;
        ctx.drawImage(dnGlow(col), a[0] + w / 2 - R, a[1] + h / 2 - R, R * 2, R * 2);
      }
  }
  // steam: soft puffs drifting with the wind, a little brighter (lit from below) at night
  ctx.globalCompositeOperation = "source-over";
  const ws = 1 + (typeof WX !== "undefined" ? +WX.wind || 0 : 0) * 1.5,
    wd = [0.8 * ws, -0.35 * ws],
    col = K > 0.3 ? "rgba(170,175,190,1)" : "rgba(235,238,242,1)";
  let n = 0;
  for (const o of B)
    for (const v of o.gcRB.vt) {
      if (!v[3] || n++ > 40) continue;
      const p = gcRoofPt(o, v[0], v[1], cx, cy);
      for (let k = 0; k < 4; k++) {
        const t = (timeS * 0.22 + k / 4 + gcHash(Math.round(v[0]), Math.round(v[1]), 2)) % 1,
          x = p[0] + wd[0] * t * 46,
          y = p[1] + wd[1] * t * 46,
          r = (4 + t * 16) * z,
          a = S(x, y);
        ctx.globalAlpha = 0.22 * (1 - t) * Math.min(1, t * 5);
        ctx.drawImage(dnGlow(col), a[0] - r, a[1] - r, r * 2, r * 2);
      }
    }
  ctx.restore();
}
{
  const dn = drawNight;
  drawNight = function (vx0, vy0, vx1, vy1, z) {
    dn.apply(this, arguments);
    gcRoofLive(vx0, vy0, vx1, vy1, z);
  };
}
// ---------------------------------------------------------------- stage C: light + colour (high quality)
// night grade: teal shadows (multiply) under warm lamps, plus a faint cool haze wash; day keyframes are untouched
const GC_TEAL = [120, 196, 214],
  GC_HAZE = [40, 92, 112];
{
  const ga = gfxGradeAt;
  gfxGradeAt = function (h) {
    const g = ga.apply(this, arguments),
      K = DN.dark;
    if (!gfxHi() || GFX.off.grade || K < 0.02) return g;
    const t = Math.min(1, K * 1.2),
      ma = 0.24 * t,
      w = g.ma + ma > 0 ? ma / (g.ma + ma) : 1;
    return {
      mul: g.mul.map((v, i) => Math.round(v + (GC_TEAL[i] - v) * w)),
      ma: Math.max(g.ma, ma),
      add: g.aa > 0.005 ? g.add : GC_HAZE,
      aa: Math.max(g.aa, 0.05 * t),
    };
  };
}
// ---------------------------------------------------------------- stage D: richer vehicle art (baked once per art canvas)
// clear-coat sheen, rounded side shading and a faint sky reflection streak, all clipped to the body
// pixels (source-atop) so every existing car / van / bus / lorry / trailer silhouette keeps its shape
function gcVehGloss(c) {
  if (!c || !c.getContext || c.gcG || GFX.off.vgloss) return c;
  c.gcG = 1;
  const g = c.getContext("2d"),
    W = c.width,
    H = c.height;
  g.save();
  g.globalCompositeOperation = "source-atop";
  // rounded flanks: darker toward both sides
  let gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, "rgba(0,0,0,0.28)");
  gr.addColorStop(0.18, "rgba(0,0,0,0)");
  gr.addColorStop(0.82, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // clear-coat: soft highlight down the spine, top-left lit like the rest of the art
  gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0.25, "rgba(255,255,255,0)");
  gr.addColorStop(0.42, "rgba(255,255,255,0.16)");
  gr.addColorStop(0.55, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // sky reflection streak across the body (diagonal), very faint
  g.translate(W / 2, H / 2);
  g.rotate(-0.5);
  g.fillStyle = "rgba(200,230,255,0.07)";
  g.fillRect(-W, -H * 0.06, W * 2, H * 0.05);
  g.fillRect(-W, H * 0.12, W * 2, H * 0.02);
  g.restore();
  return c;
}
{
  const w = (f) =>
    function () {
      return gcVehGloss(f.apply(this, arguments));
    };
  makeCarArt = w(makeCarArt);
  makeVanArt = w(makeVanArt);
  makeBusArt = w(makeBusArt);
  makeBoxArt = w(makeBoxArt);
  makeTractorArt = w(makeTractorArt);
  makeTrailerArtAI = w(makeTrailerArtAI);
}
