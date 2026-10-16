/**
 * @file milbase.js — SANDVALE MILITARY BASE (replaces Sandvale Intl): layout + roads (generator), fence/tower/building/vehicle art,
 *   military trailers, AI military traffic + gate barriers, helicopters, rifle range + parade soldiers, floodlights + searchlights
 * Exposes (globals): MB, MB_HP, mbRoads, mbGen, mbDepotOpts, mbSolidM, mbKind, mbDress, mbTrailerCanvas, MB_TRL, mbUpdate,
 *   mbDrawLow, mbDrawHigh, mbDrawNight (+ mb* helpers)
 * Depends on: world.js (set/get/fill, T, TILE, M_T), traffic.js (vCanvas, VS, shadowOf, spawnVehicle, makeCarArt),
 *   render.js (shade, CUR_CHUNK), sites.js (OBJX), port.js (aiGoal), porttrucks.js (ptSegAt), daynight.js (DN, dnLight)
 * Load order: after airport.js in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 * World data (world.milbase) is plain data saved in src/map/; everything animated is a pure function of timeS.
 */
// ---------------------------------------------------------------- layout (tiles)
const MB = {
  x0: 1072,
  y0: 162,
  x1: 1442,
  y1: 338,
  gx0: 1246,
  gx1: 1254, // gap in the south fence for the gate avenue
  av: 1248, // gate avenue (2-way, 4 tiles: x1248..1251) from the spine down to the external road at y353
  barY: 335.5,
  rt: { bars: [0, 0], mil: 0, spT: 3, err: null },
};
const MB_HP = [
  [1092, 180],
  [1116, 180],
  [1140, 180],
  [1092, 204],
  [1116, 204],
  [1140, 204],
];
// roads laid before the junction pass (so AI traffic + sat nav use them). All 4 tiles wide (one lane each way).
function mbRoads(road) {
  const L = [
    ["h", 220, 1078, 1437], // spine
    ["h", 296, 1082, 1433], // south street
    ["h", 328, 1082, 1433], // south perimeter road
    ["v", 1078, 224, 331], // west ring
    ["v", 1434, 224, 331], // east ring
    ["v", MB.av, 224, 352], // gate avenue -> external road (y353)
  ];
  for (const [d, a, b0, b1] of L) {
    const sg = road(d, a, b0, b1, 4, "town");
    sg.mil = 1;
  }
}
// depots.js: the base depot (custom bay rows, no default shed)
function mbDepotOpts() {
  const D = world.milbase && world.milbase.depot;
  if (!D) return null;
  return {
    D,
    opts: {
      keep: true,
      rows: D.rows,
      entrance: { x: D.ent[0] * M_T, y: D.ent[1] * M_T },
      yardAt: [1262, 243],
    },
  };
}
function mbInside(tx, ty) {
  return tx >= MB.x0 - 2 && tx <= MB.x1 + 2 && ty >= MB.y0 - 2 && ty <= 352;
}
// ---------------------------------------------------------------- collision (player)
function mbSolidM(mx, my) {
  const B = world.milbase;
  if (!B) return false;
  const x = mx / M_T,
    y = my / M_T;
  if (x < B.x0 - 1 || x > B.x1 + 1 || y < B.y0 - 1 || y > B.y1 + 1) return false;
  const e = 0.18;
  if ((Math.abs(x - B.x0) < e || Math.abs(x - B.x1) < e) && y > B.y0 - e && y < B.y1 + e)
    return true;
  if (Math.abs(y - B.y0) < e && x > B.x0 - e && x < B.x1 + e) return true;
  if (Math.abs(y - B.y1) < e && x > B.x0 - e && x < B.x1 + e && (x < MB.gx0 || x > MB.gx1))
    return true;
  // closed gate barriers
  if (Math.abs(y - MB.barY) < 0.12 && x > MB.av && x < MB.av + 4) {
    const k = x < MB.av + 2 ? 0 : 1;
    if (MB.rt.bars[k] < 0.5) return true;
  }
  for (const s of B.sol) if (x > s[0] && x < s[2] && y > s[1] && y < s[3]) return true;
  return false;
}
// ---------------------------------------------------------------- generator (airport stage)
function mbGen(objs) {
  const B = (world.milbase = {
    name: "Sandvale Military Base",
    x0: MB.x0,
    y0: MB.y0,
    x1: MB.x1,
    y1: MB.y1,
    sol: [],
    lights: [],
    search: [],
  });
  const r = mulberry(91731),
    T_ = TILE,
    P = (v) => v * T_;
  const isRd = (x, y) => {
    const t = get(x, y);
    return t === T.ROAD || t === T.BRIDGE;
  };
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i],
      x = o.x / T_,
      y = o.y / T_;
    if (
      x > 1064 &&
      x < 1450 &&
      y > 154 &&
      y < 344 &&
      !/^(kerb|boxj|appr|ldrop|curve|paint)$/.test(o.kind)
    )
      objs.splice(i, 1);
  }
  const area = (x0, y0, x1, y1, t) => {
    for (let y = Math.floor(y0); y < y1; y++)
      for (let x = Math.floor(x0); x < x1; x++) if (inb(x, y) && !isRd(x, y)) set(x, y, t);
  };
  area(MB.x0 - 2, MB.y0 - 2, MB.x1 + 2, MB.y1 + 1, T.SAND);
  area(MB.x0, MB.y0, MB.x1, MB.y1, T.GRASS);
  for (let y = MB.y0 - 6; y < 353; y++)
    for (let x = MB.x0 - 6; x < MB.x1 + 6; x++)
      if (inb(x, y) && (y < MB.y1 + 4 || (x > 1236 && x < 1266))) world.reserved[idx(x, y)] = 1;
  const O = (t, x0, y0, x1, y1, ex, zz) =>
    objs.push(
      Object.assign(
        {
          kind: "mb",
          t,
          x: P(x0),
          y: P(y0),
          w: P(x1 - x0),
          h: P(y1 - y0),
          zz: zz ?? 0,
          seed: (r() * 1e9) | 0,
        },
        ex || {},
      ),
    );
  const pad = (x0, y0, x1, y1, col, ex) => {
    area(x0, y0, x1, y1, T.CONC);
    O("conc", x0, y0, x1, y1, Object.assign({ col }, ex || {}), -0.2);
  };
  const solid = (x0, y0, x1, y1) => B.sol.push([x0, y0, x1, y1]);
  const bld = (x0, y0, x1, y1, col, name, roof, ex) => {
    area(x0, y0, x1, y1, T.BLDG);
    O("bld", x0, y0, x1, y1, Object.assign({ col, name, roof, height: 34 }, ex || {}), 2);
  };
  const veh = (vk, cx, cy, a, ex) => {
    O(
      "veh",
      cx - 3,
      cy - 3,
      cx + 3,
      cy + 3,
      Object.assign({ vk, a, cx: P(cx), cy: P(cy), height: 20 }, ex || {}),
      1,
    );
    const L =
        {
          lr: 4.6,
          fox: 5.4,
          man: 8,
          mant: 8,
          tank: 9.8,
          car: 4.6,
          amb: 4.6,
          low: 20.5,
          lowe: 20.5,
        }[vk] || 5,
      W = { tank: 3.6, low: 3, lowe: 3 }[vk] || 2.4,
      hl = L / M_T / 2,
      hw = W / M_T / 2,
      ve = Math.abs(Math.sin(a)) > 0.7;
    solid(cx - (ve ? hl : hw), cy - (ve ? hw : hl), cx + (ve ? hl : hw), cy + (ve ? hw : hl));
  };
  const tree = (x, y, rr) =>
    objs.push({
      kind: "tree",
      x: P(x),
      y: P(y),
      r: rr * 12 + r() * 4,
      sp: r() < 0.3 ? 1 : 0,
      seed: (r() * 1e9) | 0,
    });
  const light = (x, y, rad) => {
    B.lights.push([x, y, rad || 9]);
    O("flood", x - 0.4, y - 0.4, x + 0.4, y + 0.4, { lx: x, ly: y }, 2.2);
  };
  O("worn", MB.x0, MB.y0, MB.x1, MB.y1, {}, -0.4);
  // ---- north row: helipads + control tower
  pad(1080, 166, 1168, 216, "#96968f", { slab: 6 });
  MB_HP.forEach(([x, y], i) =>
    O(
      "hpad",
      x - 6.6,
      y - 6.6,
      x + 6.6,
      y + 6.6,
      { n: i + 1, cx: P(x), cy: P(y), amber: i >= 3 },
      -0.1,
    ),
  );
  bld(1154, 168, 1166, 176, "#9a958a", "TOWER", "f", { icon: "tower" });
  O("txt", 1146, 212.5, 1168, 215.5, { s: "HELICOPTER LANDING SITE", c: "#ffd23f" }, 0.5);
  for (const [x, y] of [
    [1081, 167],
    [1167, 167],
    [1081, 215],
    [1167, 215],
    [1128, 192],
  ])
    light(x, y, 10);
  // ---- rifle range (firing W -> E)
  area(1182, 166, 1328, 216, T.SAND);
  O("range", 1182, 166, 1328, 216, {}, -0.2);
  area(1320, 166, 1328, 216, T.HEDGE); // earth butts (solid)
  O("shelter", 1183, 167, 1190, 215, { height: 20 }, 2.4);
  for (const [x, y] of [
    [1183, 166.5],
    [1327, 166.5],
    [1183, 215.5],
    [1327, 215.5],
  ])
    light(x, y, 8);
  // ---- HQ + parade ground
  bld(1344, 168, 1378, 190, "#96805f", "HQ", "p", { big: 1 });
  pad(1384, 168, 1432, 214, "#a7a59c", { parade: 1 });
  O("dais", 1404, 170.6, 1414, 174, {}, 0.6);
  solid(1404, 170.6, 1414, 174);
  O("flag", 1398, 170, 1400, 172, { height: 80 }, 2.5);
  for (const [x, y] of [
    [1385, 169],
    [1431, 169],
    [1385, 213],
    [1431, 213],
  ])
    light(x, y, 10);
  for (let x = 1346; x < 1378; x += 6) tree(x, 194, 1.1);
  // ---- west block: fuel depot + vehicle wash
  pad(1086, 228, 1136, 262, "#a8a496", { hazard: 1 });
  [1094, 1106, 1118, 1130].forEach((x, i) => {
    O("tankf", x - 4.8, 233.2, x + 4.8, 242.8, { n: i + 1, height: 30 }, 2);
    for (let y = 234; y < 242; y++)
      for (let xx = x - 4; xx < x + 4; xx++)
        if (Math.hypot(xx + 0.5 - x, y + 0.5 - 238) < 4.3) set(xx, y, T.TANK);
  });
  O("sand", 1087, 244.6, 1135, 245.6, { horiz: 1 }, 1.5);
  area(1087, 244.6, 1135, 245.6, T.HEDGE);
  for (let i = 0; i < 3; i++)
    bld(1093 + i * 14, 250, 1101 + i * 14, 255, "#9a9a94", "PUMP " + (i + 1), "f", { small: 1 });
  veh("mant", 1100, 258.5, Math.PI / 2);
  veh("mant", 1128, 258.5, -Math.PI / 2);
  O("txt", 1092, 260.2, 1130, 261.8, { s: "FUEL DEPOT \u2022 NO SMOKING", c: "#ffd23f" }, 0.5);
  pad(1140, 228, 1168, 262, "#7f8f9b", { wash: 1 });
  bld(1140, 228, 1168, 234, "#60707e", "VEHICLE WASH", "f");
  veh("man", 1148, 248, 0);
  veh("fox", 1160, 246, 0);
  light(1137, 229, 9);
  light(1137, 261, 9);
  // ---- barracks + mess / gym / chapel
  [
    [1086, 266],
    [1128, 266],
    [1086, 281],
    [1128, 281],
  ].forEach(([x, y], i) => bld(x, y, x + 38, y + 10, "#96785e", "BARRACKS " + "ABCD"[i], "p"));
  for (let x = 1088; x < 1168; x += 6) tree(x, 293.5, 0.8);
  bld(1086, 303, 1116, 325, "#866f58", "MESS HALL", "p");
  bld(1120, 303, 1146, 318, "#6e767c", "GYM", "f", { units: 3 });
  O("pt", 1121, 319.5, 1145, 325.5, {}, -0.1);
  bld(1150, 305, 1166, 318, "#b0a082", "CHAPEL", "p", { icon: "cross" });
  for (const x of [1152, 1158, 1164]) tree(x, 323, 1);
  // ---- motor pool (camo nets) + workshop + staff car park
  pad(1184, 228, 1242, 266, "#96968f", {});
  for (let row = 0; row < 3; row++) {
    const y = 230 + row * 12;
    for (let cc = 0; cc < 9; cc++)
      veh(
        (row + cc) % 3 ? "man" : cc % 2 ? "fox" : "lr",
        1187 + cc * 6,
        y + 4.5,
        row % 2 ? Math.PI : 0,
      );
    O("net", 1185, y, 1241, y + 9.4, {}, 2.6);
  }
  pad(1184, 266, 1242, 292, "#8e908a", {});
  bld(1186, 268, 1240, 289, "#66705a", "VEHICLE WORKSHOP", "f", { units: 6, doors: 5 });
  light(1185, 291, 9);
  light(1241, 291, 9);
  pad(1184, 303, 1242, 326, "#787a7c", { bays: [1185.15, 305.5, 24, 3, 2.3, 7] });
  const CC = ["#c8c8cd", "#1e3c78", "#961e1e", "#28282c", "#e6e6e6", "#5a646e", "#c8a028"];
  for (let row = 0; row < 3; row++)
    for (let cc = 0; cc < 24; cc++)
      if ((cc * 5 + row * 3) % 7 !== 2)
        veh("car", 1186.3 + cc * 2.3, 305.5 + row * 7, row % 2 ? Math.PI : 0, {
          col: CC[(cc + row * 2) % 7],
        });
  light(1185, 304, 9);
  light(1241, 325, 9);
  // ---- military depot (registered by depots.js via mbDepotOpts): shed, ARMY container stack, 3 rows of bays, AFV hardstand + staging
  pad(1258, 228, 1330, 292, "#989892", {});
  area(1292, 224, 1310, 228, T.CONC);
  O("conc", 1292, 224, 1310, 228, { col: "#989892" }, -0.2);
  bld(1260, 229, 1290, 241, "#5a6446", "MILITARY DEPOT", "f", { units: 3, doors: 3 });
  for (let rr = 0; rr < 2; rr++)
    for (let cc = 0; cc < 4; cc++) {
      const x = 1293 + cc * 9,
        y = 230 + rr * 4.5;
      O("cstack", x, y, x + 8.4, y + 3.6, { height: 26 }, 2);
      area(x, y, x + 8.4, y + 3.6, T.CONT);
    }
  O("hard", 1296, 244, 1328, 290, {}, -0.1);
  for (let i = 0; i < 6; i++)
    veh("tank", 1301 + (i % 3) * 8, 250 + ((i / 3) | 0) * 5.5, 0, { ta: ((i * 37) % 60) - 30 });
  for (let i = 0; i < 4; i++) veh(i % 2 ? "lowe" : "low", 1313, 266 + i * 6, Math.PI / 2);
  O("txt", 1260, 290.3, 1292, 291.7, { s: "TRAILER BAYS \u2022 REVERSE IN", c: "#f0f0e6" }, 0.5);
  for (const [x, y] of [
    [1259, 229],
    [1329, 229],
    [1259, 291],
    [1329, 291],
    [1294, 262],
  ])
    light(x, y, 11);
  B.depot = {
    x: 1258,
    y: 228,
    w: 72,
    h: 64,
    rows: [250, 266, 282].map((y) => ({ x0: 1260, y0: y, y1: y + 4.6, n: 18, bw: 1.75 })),
    ent: [1301, 226],
  };
  // ---- armoury, medical, officers' mess, NAAFI, accommodation
  pad(1334, 228, 1364, 254, "#a09c92", {});
  bld(1338, 231, 1360, 246, "#60645c", "ARMOURY", "f", { units: 2 });
  for (const s of [
    [1336, 229, 1362, 230, 1],
    [1336, 229, 1337, 252, 0],
    [1361, 229, 1362, 252, 0],
  ]) {
    O("sand", s[0], s[1], s[2], s[3], { horiz: s[4] }, 1.5);
    area(s[0], s[1], s[2], s[3], T.HEDGE);
  }
  light(1337, 230.5, 8);
  light(1361, 230.5, 8);
  pad(1368, 228, 1400, 254, "#b0b0aa", {});
  bld(1370, 230, 1398, 246, "#e6e4dc", "MEDICAL CENTRE", "f", { icon: "redcross" });
  veh("amb", 1374, 250.5, 0);
  veh("amb", 1381, 250.5, 0);
  bld(1406, 230, 1430, 246, "#a06e56", "OFFICERS' MESS", "p");
  for (const x of [1407, 1413, 1419, 1425, 1430]) tree(x, 249.5, 1);
  pad(1408, 252, 1430, 260, "#8c8a84", { bays: [1408.7, 256, 7, 1, 2.6, 0] });
  for (let i = 0; i < 7; i++) veh("car", 1410 + i * 2.6, 256, 0, { col: CC[i] });
  pad(1334, 258, 1372, 292, "#7c7e80", { bays: [1336.75, 280, 12, 2, 2.5, 6] });
  bld(1336, 260, 1370, 274, "#3c5a8c", "NAAFI SHOP", "f", { units: 3, awn: "#c8283a" });
  for (let row = 0; row < 2; row++)
    for (let cc = 0; cc < 12; cc++)
      if ((cc + row) % 4)
        veh("car", 1338 + cc * 2.5, 280 + row * 6, row ? 0 : Math.PI, {
          col: CC[(cc * 3 + row) % 7],
        });
  for (let i = 0; i < 9; i++) tree(1376 + (i % 3) * 9, 262 + ((i / 3) | 0) * 10, 1.3);
  bld(1406, 266, 1430, 278, "#96785e", "ACCOM E", "p");
  bld(1406, 280, 1430, 291, "#96785e", "ACCOM F", "p");
  [
    [1258, 304],
    [1300, 304],
    [1342, 304],
    [1384, 304],
    [1258, 317],
    [1300, 317],
    [1342, 317],
    [1384, 317],
  ].forEach(([x, y], i) =>
    bld(x, y, x + 38, y + 10, i % 2 ? "#92785e" : "#8a7458", "ACCOM " + "GHIJKLMN"[i], "p"),
  );
  for (let x = 1260; x < 1430; x += 7) tree(x, 302, 0.75);
  for (let x = 1086; x < 1430; x += 9)
    if (x < 1240 || (x > 1262 && (x < 1290 || x > 1312))) tree(x, x % 2 ? 226.6 : 217.4, 0.7);
  // ---- gate complex (inside the fence, either side of the avenue)
  bld(1238, 332.5, 1246, 337, "#7c765c", "GUARD", "f", { small: 1 });
  bld(1253, 332.5, 1262, 337, "#7c765c", "PASS OFFICE", "f", { small: 1 });
  O("gate", 1244, 325, 1256, 345, {}, 0.4);
  O("sign", 1232, 340, 1246, 346, { height: 10 }, 2.5);
  for (const [x, y] of [
    [1245, 338.5],
    [1253, 338.5],
    [1247, 348],
    [1253, 348],
  ])
    light(x, y, 10);
  // ---- perimeter fence (40-tile pieces) + corner towers (+ searchlights)
  const F = (x0, y0, x1, y1) =>
    O(
      "fence",
      Math.min(x0, x1) - 0.4,
      Math.min(y0, y1) - 0.4,
      Math.max(x0, x1) + 0.4,
      Math.max(y0, y1) + 0.4,
      { ax: x0, ay: y0, bx: x1, by: y1, height: 14 },
      2.8,
    );
  const seg = (x0, y0, x1, y1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 40);
    for (let k = 0; k < n; k++)
      F(
        x0 + ((x1 - x0) * k) / n,
        y0 + ((y1 - y0) * k) / n,
        x0 + ((x1 - x0) * (k + 1)) / n,
        y0 + ((y1 - y0) * (k + 1)) / n,
      );
  };
  seg(MB.x0, MB.y0, MB.x1, MB.y0);
  seg(MB.x0, MB.y0, MB.x0, MB.y1);
  seg(MB.x1, MB.y0, MB.x1, MB.y1);
  seg(MB.x0, MB.y1, MB.gx0, MB.y1);
  seg(MB.gx1, MB.y1, MB.x1, MB.y1);
  [
    [MB.x0, MB.y0, 0.785],
    [MB.x1, MB.y0, 2.356],
    [MB.x0, MB.y1, -0.785],
    [MB.x1, MB.y1, -2.356],
  ].forEach(([x, y, a]) => {
    area(x - 1.5, y - 1.5, x + 1.5, y + 1.5, T.BLDG);
    O("tower", x - 2, y - 2, x + 2, y + 2, { height: 70 }, 3.2);
    B.search.push([x, y, a]);
  });
  B.search.push([1245.5, 338, -2.2], [1254.5, 338, -0.9]);
  for (let x = MB.x0 + 20; x < MB.x1 - 10; x += 40) light(x, MB.y0 + 1.2, 8);
  for (let x = MB.x0 + 20; x < MB.x1 - 10; x += 40)
    if (x < 1230 || x > 1270) light(x, MB.y1 - 1.2, 8);
  for (let y = MB.y0 + 30; y < MB.y1 - 10; y += 40)
    (light(MB.x0 + 1.2, y, 8), light(MB.x1 - 1.2, y, 8));
  for (let x = 1100; x < 1430; x += 40) (light(x, 218.6, 8), light(x, 300.4, 8));
  // base junctions: plain priority (no signals)
  for (const J of world.junctions || [])
    if (J.x >= MB.x0 && J.x <= MB.x1 && J.y >= MB.y0 && J.y < MB.y1) J.lights = false;
}
// ---------------------------------------------------------------- vehicle sprites (16 px/m, nose up, like traffic art)
const MBS = {};
const MB_SPEC = {
  lr: { L: 4.6, W: 2.0, col: "#5b6a3c" },
  fox: { L: 5.4, W: 2.3, col: "#6a6f48" },
  man: { L: 8.0, W: 2.5, col: "#56633a" },
  mant: { L: 8.0, W: 2.5, col: "#56633a", tank: 1 },
  tank: { L: 9.8, W: 3.6, col: "#5f6a40" },
  car: { L: 4.6, W: 1.85, col: "#c8c8cd" },
  amb: { L: 5.6, W: 2.1, col: "#f2f2ee" },
  low: { L: 20.5, W: 3.0, col: "#5b6a3c", load: 1 },
  lowe: { L: 20.5, W: 3.0, col: "#5b6a3c" },
  cab6: { L: 6.6, W: 2.55, col: "#56633a" },
};
function mbSprite(k, col) {
  const key = k + (col || "");
  if (MBS[key]) return MBS[key];
  const S = MB_SPEC[k] || MB_SPEC.lr,
    L = S.L,
    W = S.W,
    c = vCanvas(L, W),
    g = c.getContext("2d"),
    cx = c.width / 2,
    X = (m) => cx + m * VS,
    Y = (m) => 0.15 * VS + m * VS,
    C = col || S.col;
  const box = (x0, y0, x1, y1, f, r) => {
    g.fillStyle = f;
    g.beginPath();
    mbRR(g, X(x0), Y(y0), (x1 - x0) * VS, (y1 - y0) * VS, (r || 0.2) * VS);
    g.fill();
  };
  const hw = W / 2;
  // wheels
  g.fillStyle = "#1b1b1b";
  const ax =
    k === "tank"
      ? []
      : k === "low" || k === "lowe"
        ? [1.2, 4.2, 15, 16.4, 17.8]
        : k === "man" || k === "mant"
          ? [1.4, 5.4, 6.8]
          : [0.9, L - 1.1];
  for (const a of ax) {
    g.fillRect(X(-hw - 0.05), Y(a - 0.45), 0.35 * VS, 0.9 * VS);
    g.fillRect(X(hw - 0.3), Y(a - 0.45), 0.35 * VS, 0.9 * VS);
  }
  if (k === "tank") {
    box(-hw, 0.6, -hw + 0.8, L - 0.2, "#2a2a24", 0.1);
    box(hw - 0.8, 0.6, hw, L - 0.2, "#2a2a24", 0.1);
    g.strokeStyle = "#4a4a40";
    g.lineWidth = 1;
    for (let y = 0.8; y < L - 0.3; y += 0.45) {
      g.beginPath();
      g.moveTo(X(-hw), Y(y));
      g.lineTo(X(-hw + 0.8), Y(y));
      g.moveTo(X(hw - 0.8), Y(y));
      g.lineTo(X(hw), Y(y));
      g.stroke();
    }
    box(-hw + 0.7, 0.4, hw - 0.7, L - 0.1, shade(C, 0.95), 0.3);
    box(-hw + 0.9, 1.0, hw - 0.9, L - 0.6, shade(C, 1.08), 0.2);
  } else if (k === "low" || k === "lowe") {
    box(-1.2, 0.1, 1.2, 2.6, C, 0.35); // tractor cab
    box(-1.05, 0.25, 1.05, 0.9, "#26323a", 0.1);
    box(-0.25, 2.6, 0.25, 4.6, "#333"); // drawbar / fifth wheel
    box(-hw, 4.0, hw, L - 0.1, "#4a4c44", 0.1); // deck
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 2;
    g.strokeRect(X(-hw + 0.1), Y(4.1), (W - 0.2) * VS, (L - 4.3) * VS);
    if (S.load) {
      box(-1.5, 6.4, -0.75, 16.2, "#2a2a24", 0.1);
      box(0.75, 6.4, 1.5, 16.2, "#2a2a24", 0.1);
      box(-1.0, 6.2, 1.0, 16.4, "#5f6a40", 0.3);
      g.fillStyle = "#4e5734";
      g.beginPath();
      g.arc(X(0), Y(11.6), 1.0 * VS, 0, 7);
      g.fill();
      box(-0.12, 5.0, 0.12, 11.6, "#3c4428");
    }
  } else {
    const cabL = k === "man" || k === "mant" ? 2.3 : 1.1;
    box(-hw + 0.1, 0.1, hw - 0.1, L - 0.1, C, 0.4);
    box(-hw + 0.25, 0.2, hw - 0.25, cabL - 0.1, shade(C, 1.12), 0.3);
    box(-hw + 0.3, cabL - 0.15, hw - 0.3, cabL + 0.45, "#26323a", 0.1); // windscreen
    if (k === "man") {
      box(-hw + 0.15, cabL + 0.6, hw - 0.15, L - 0.15, "#4f5a34", 0.15); // canvas tilt
      g.strokeStyle = "rgba(0,0,0,0.25)";
      for (let y = cabL + 1.2; y < L - 0.3; y += 1.1) {
        g.beginPath();
        g.moveTo(X(-hw + 0.2), Y(y));
        g.lineTo(X(hw - 0.2), Y(y));
        g.stroke();
      }
    } else if (k === "mant") {
      box(-hw + 0.2, cabL + 0.6, hw - 0.2, L - 0.2, "#7c8460", 1.0);
      box(-0.3, cabL + 0.9, 0.3, L - 0.5, "#9aa07c", 0.2);
    } else if (k === "amb") {
      box(-hw + 0.2, cabL + 0.6, hw - 0.2, L - 0.2, "#f7f7f2", 0.2);
      g.fillStyle = "#d22";
      g.fillRect(X(-0.18), Y(cabL + 1.4), 0.36 * VS, 1.6 * VS);
      g.fillRect(X(-0.8), Y(cabL + 2.0), 1.6 * VS, 0.36 * VS);
    } else if (k === "fox") {
      box(-0.5, 2.4, 0.5, 3.4, shade(C, 0.8), 0.5); // RWS turret
    } else if (k === "lr") {
      box(-hw + 0.2, 1.7, hw - 0.2, L - 0.2, shade(C, 0.88), 0.2);
    } else box(-hw + 0.25, cabL + 0.55, hw - 0.25, L - 0.9, shade(C, 0.9), 0.3); // car roof
    if (k !== "car") {
      g.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(X(((i * 37) % 10) / 10 - 0.5) * 1, Y(((i * 53) % 10) * 0.1 * L), 0.35 * VS, 0, 7);
        g.fill();
      }
    }
  }
  MBS[key] = { c, sh: shadowOf(c), L, W };
  return MBS[key];
}
// military trailers (13.6 m like other trailers): ARMY container, low-loader w/ tank, low-loader w/ vehicles, OIL tanker
const MB_TRL = { army: 1, lowtank: 1, lowveh: 1, oil: 1 };
function mbTrailerCanvas(kind) {
  const key = "trl:" + kind;
  if (MBS[key]) return MBS[key].c;
  const L = 13.6,
    W = 2.55,
    c = vCanvas(L, W),
    g = c.getContext("2d"),
    cx = c.width / 2,
    X = (m) => cx + m * VS,
    Y = (m) => 0.15 * VS + m * VS,
    hw = W / 2;
  const box = (x0, y0, x1, y1, f, r) => {
    g.fillStyle = f;
    g.beginPath();
    mbRR(g, X(x0), Y(y0), (x1 - x0) * VS, (y1 - y0) * VS, (r || 0.1) * VS);
    g.fill();
  };
  g.fillStyle = "#1b1b1b";
  for (const a of [10.2, 11.5, 12.8]) {
    g.fillRect(X(-hw - 0.05), Y(a - 0.45), 0.35 * VS, 0.9 * VS);
    g.fillRect(X(hw - 0.3), Y(a - 0.45), 0.35 * VS, 0.9 * VS);
  }
  if (kind === "army") {
    box(-hw, 0, hw, L, "#4f5d36");
    g.strokeStyle = "rgba(0,0,0,0.25)";
    for (let y = 0.5; y < L; y += 0.5) {
      g.beginPath();
      g.moveTo(X(-hw), Y(y));
      g.lineTo(X(hw), Y(y));
      g.stroke();
    }
    g.save();
    g.translate(X(0), Y(L / 2));
    g.rotate(-Math.PI / 2);
    g.fillStyle = "#e8e2c8";
    g.font = "bold " + 1.4 * VS + "px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("ARMY", 0, 0);
    g.restore();
  } else if (kind === "oil") {
    box(-hw + 0.1, 0.3, hw - 0.1, L - 0.2, "#d8d8d2", 1.1);
    box(-0.25, 0.8, 0.25, L - 0.8, "#a8a8a0", 0.2);
    g.save();
    g.translate(X(0.6), Y(L / 2));
    g.rotate(-Math.PI / 2);
    g.fillStyle = "#1f3c6e";
    g.font = "bold " + 1.0 * VS + "px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("OIL", 0, 0);
    g.restore();
  } else {
    box(-hw, 0, hw, L, "#4a4c44");
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 2;
    g.strokeRect(X(-hw + 0.1), Y(0.1), (W - 0.2) * VS, (L - 0.2) * VS);
    if (kind === "lowtank") {
      box(-1.25, 1.0, -0.6, 10.6, "#2a2a24");
      box(0.6, 1.0, 1.25, 10.6, "#2a2a24");
      box(-0.85, 0.8, 0.85, 10.8, "#5f6a40", 0.3);
      g.fillStyle = "#4e5734";
      g.beginPath();
      g.arc(X(0), Y(6), 0.85 * VS, 0, 7);
      g.fill();
      box(-0.1, 0.2, 0.1, 6, "#3c4428");
    } else {
      box(-hw + 0.25, 0.5, hw - 0.25, 5.4, "#5b6a3c", 0.4);
      box(-hw + 0.3, 6.6, hw - 0.3, 12.6, "#6a6f48", 0.4);
    }
  }
  MBS[key] = { c };
  return c;
}
// ---------------------------------------------------------------- helicopter art (the helicopters themselves live in heli.js)
function mbHeliBody(k) {
  const key = "heli:" + k;
  if (MBS[key]) return MBS[key];
  const ch = k === "chinook",
    L = ch ? 15.5 : 13.2,
    W = 3.2,
    c = vCanvas(L, W),
    g = c.getContext("2d"),
    cx = c.width / 2,
    X = (m) => cx + m * VS,
    Y = (m) => 0.15 * VS + m * VS;
  const col = ch ? "#6a7348" : "#7d8768";
  g.strokeStyle = "#1c2014";
  g.lineWidth = 2;
  g.fillStyle = col;
  if (ch) {
    g.beginPath();
    mbRR(g, X(-1.4), Y(0.6), 2.8 * VS, (L - 1.2) * VS, 1.2 * VS);
    g.fill();
    g.stroke();
    g.fillStyle = shade(col, 0.8);
    g.fillRect(X(-0.5), Y(L - 3), 1.0 * VS, 2.2 * VS);
  } else {
    g.beginPath();
    g.ellipse(X(0), Y(3.2), 1.3 * VS, 2.8 * VS, 0, 0, 7);
    g.fill();
    g.stroke();
    g.fillRect(X(-0.3), Y(5), 0.6 * VS, (L - 6) * VS); // tail boom
    g.fillRect(X(-1.4), Y(L - 1.6), 2.8 * VS, 0.5 * VS); // tailplane
  }
  g.fillStyle = "#1e2a34";
  g.beginPath();
  g.ellipse(X(0), Y(1.4), 0.9 * VS, 0.8 * VS, 0, 0, 7);
  g.fill();
  MBS[key] = {
    c,
    sh: shadowOf(c),
    L,
    W,
    rot: ch
      ? [
          [0, 2.2, 9.3],
          [0, L - 2.2, 9.3],
        ]
      : [[0, 3.3, 12.8]],
    tail: !ch,
  };
  return MBS[key];
}
function mbDrawHeli(g, s, k, t) {
  const B = mbHeliBody(k),
    sc = 1 + s.alt * 0.35,
    lift = s.alt * 70;
  const blit = (img, x, y, a, k) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.scale((PPM / VS) * k, (PPM / VS) * k);
    g.drawImage(img, -img.width / 2, -img.height / 2);
    g.restore();
  };
  blit(B.sh, s.x + 4 + lift * 0.6, s.y + 4 + lift, s.h, 1 - s.alt * 0.15);
  const bx = s.x,
    by = s.y;
  blit(B.c, bx, by, s.h, sc);
  // rotors: blurred disc + blades spinning
  const spin = t * 26 * s.rot;
  g.save();
  g.translate(bx, by);
  g.rotate(s.h);
  g.scale(sc, sc);
  for (const [rx, ry, D] of B.rot) {
    const ox = rx * PPM,
      oy = (ry - B.L / 2) * PPM,
      R = (D / 2) * PPM;
    g.fillStyle = "rgba(30,30,30," + 0.18 * s.rot + ")";
    g.beginPath();
    g.arc(ox, oy, R, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(25,25,25," + (0.85 - 0.45 * s.rot) + ")";
    g.lineWidth = 2.2;
    const nb = 4,
      a0 = spin * (ry > B.L / 2 ? -1 : 1);
    for (let i = 0; i < nb; i++) {
      const a = a0 + (i * Math.PI * 2) / nb;
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ox + Math.cos(a) * R, oy + Math.sin(a) * R);
      g.stroke();
    }
    g.fillStyle = "#222";
    g.beginPath();
    g.arc(ox, oy, 3, 0, 7);
    g.fill();
  }
  if (B.tail) {
    const oy = (B.L / 2 - 0.6) * PPM;
    g.strokeStyle = "rgba(20,20,20,0.7)";
    g.lineWidth = 1.5;
    g.beginPath();
    const a = spin * 1.7;
    g.moveTo(10 + Math.cos(a) * 9, oy + Math.sin(a) * 4);
    g.lineTo(10 - Math.cos(a) * 9, oy - Math.sin(a) * 4);
    g.stroke();
  }
  // strobes
  if ((t * 1.3) % 1 < 0.12) {
    g.fillStyle = "#ff3030";
    g.beginPath();
    g.arc(0, 0, 3.5, 0, 7);
    g.fill();
  }
  g.restore();
  return s;
}
// ---------------------------------------------------------------- AI military traffic
function mbKind(r) {
  const x = r();
  return x < 0.3 ? "suv" : x < 0.5 ? "van" : x < 0.75 ? "box" : "lorry";
}
function mbDress(v) {
  const r = v.r || Math.random;
  v.mil = 1;
  let k;
  if (
    v.kind === "suv" ||
    v.kind === "sedan" ||
    v.kind === "hatch" ||
    v.kind === "estate" ||
    v.kind === "sports" ||
    v.kind === "taxi"
  )
    k = r() < 0.55 ? "lr" : "fox";
  else if (v.kind === "van") k = r() < 0.7 ? "fox" : "lr";
  else if (v.kind === "box" || v.kind === "bus") k = r() < 0.5 ? "man" : "mant";
  else k = "cab6";
  const S = mbSprite(k);
  v.art = { body: { c: S.c, sh: S.sh } };
  v.mk = v.mk || [];
  v.mbk = k;
  if (v.kind === "lorry") {
    const tk = ["army", "army", "oil", "lowtank", "lowveh"][(r() * 5) | 0];
    const key = "mbtrl:" + tk;
    if (!traffic.arts[key]) {
      const c = mbTrailerCanvas(tk);
      traffic.arts[key] = { c, sh: shadowOf(c) };
    }
    v.art.trl = traffic.arts[key];
    v.mbt = tk;
  }
  return v;
}
const MB_CAP = 12;
// military vehicles alive (gate traffic included); background spawns on base roads and the gate generator both respect MB_CAP
function mbFull() {
  let n = 0;
  for (const v of traffic.vs) if (v.mil && ++n >= MB_CAP) return true;
  return false;
}
function mbUpdate(dt) {
  const B = world.milbase;
  if (!B) return;
  const R = MB.rt,
    by = MB.barY * M_T,
    xa = MB.av * M_T;
  // barriers: inbound lane (west half, northbound) = bar 0, outbound (east half) = bar 1
  const want = [0, 0];
  const chk = (x, y) => {
    if (x < xa - 2 || x > xa + 4 * M_T + 2) return;
    const dy = y - by;
    if (Math.abs(dy) > 26) return;
    want[x < xa + 2 * M_T ? 0 : 1] = 1;
  };
  let nm = 0;
  for (const v of traffic.vs) {
    if (v.mil) nm++;
    chk(v.x, v.y);
  }
  chk(truck.x, truck.y);
  for (let k = 0; k < 2; k++)
    R.bars[k] = Math.max(0, Math.min(1, R.bars[k] + (want[k] ? 1.4 : -0.8) * dt));
  R.mil = nm;
  // gate traffic generator (only while the player is near; capped)
  R.spT -= dt;
  const gx = (MB.av + 2) * M_T,
    gy = 345 * M_T;
  if (R.spT > 0) return;
  R.spT = 4 + Math.random() * 5;
  if (Math.hypot(truck.x - gx, truck.y - gy) > 900 || nm >= MB_CAP) return;
  try {
    const r = tRand;
    const inbound = r() < 0.55;
    let v = null;
    if (inbound) {
      const ext = ptSegAt((MB.av - 40) * M_T, 354.5 * M_T);
      if (!ext) return;
      const west = r() < 0.5,
        along = west ? MB.av - 60 - r() * 60 : MB.av + 60 + r() * 60;
      v = spawnVehicle(along * M_T, 354.5 * M_T, true, {
        kind: mbKind(r),
        seg: ext.id,
        along,
        dir: west ? 1 : -1,
      });
      if (v) {
        mbDress(v);
        const dst = [
          [1300, 222],
          [1200, 222],
          [1350, 298],
          [1100, 298],
          [1301, 226],
        ][(r() * 5) | 0];
        aiGoal(v, { entrance: { x: dst[0] * M_T, y: dst[1] * M_T } });
      }
    } else {
      const av = ptSegAt((MB.av + 1) * M_T, 300 * M_T);
      if (!av) return;
      const along = 304 + r() * 14;
      v = spawnVehicle((MB.av + 2) * M_T, along * M_T, true, {
        kind: mbKind(r),
        seg: av.id,
        along,
        dir: 1,
      });
      if (v) {
        mbDress(v);
        aiGoal(v, { entrance: { x: (r() < 0.5 ? 1060 : 1700) * M_T, y: 354.5 * M_T } });
      }
    }
  } catch (e) {
    if (!R.err) console.warn("milbase traffic", e);
    R.err = e;
  }
}
// tiny soldier (top-down): body + head, legs swing
function mbSoldier(g, x, y, a, ph, col) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.scale(1.5, 1.5);
  const sw = Math.sin(ph) * 2.2;
  g.fillStyle = "#2b2f22";
  g.fillRect(-2.2, -1 + sw, 1.6, 3);
  g.fillRect(0.6, -1 - sw, 1.6, 3);
  g.fillStyle = col || "#56603c";
  g.beginPath();
  g.ellipse(0, 0, 3.6, 2.3, 0, 0, 7);
  g.fill();
  g.fillStyle = "#3d4529";
  g.beginPath();
  g.arc(0, -0.3, 1.7, 0, 7);
  g.fill();
  g.restore();
}
function mbVis(vx0, vy0, vx1, vy1) {
  const B = world.milbase,
    T_ = TILE;
  return (
    B &&
    vx1 > (B.x0 - 30) * T_ &&
    vx0 < (B.x1 + 30) * T_ &&
    vy1 > (B.y0 - 160) * T_ &&
    vy0 < (B.y1 + 30) * T_
  );
}
function mbDrawLow(vx0, vy0, vx1, vy1) {
  if (!mbVis(vx0, vy0, vx1, vy1)) return;
  const g = ctx,
    T_ = TILE,
    t = timeS,
    B = world.milbase;
  // rifle range: 10 lanes, firers prone at x1192, pop-up targets at x1318 fall when hit
  for (let i = 0; i < 10; i++) {
    const y = (170.5 + i * 4.4) * T_,
      fx = 1192.5 * T_,
      tx = (1191 + 21.33 * (1 + (i % 3))) * T_, // pop-up targets at the 100/200/300 m markers
      ph = (t * 0.7 + i * 0.37) % 4,
      up = ph < 2.6;
    mbSoldier(g, fx, y, Math.PI / 2, 0, "#4d5636");
    g.fillStyle = "#222";
    g.fillRect(fx + 3, y - 0.7, 9, 1.4);
    if (ph > 0.6 && ph < 2.6 && (ph * 5) % 1 < 0.18) {
      const f = ((ph * 5) % 1) / 0.18;
      g.strokeStyle = "rgba(255,220,120,0.9)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(fx + 12 + (tx - fx - 12) * f, y);
      g.lineTo(fx + 12 + (tx - fx - 12) * Math.min(1, f + 0.12), y);
      g.stroke();
      g.fillStyle = "rgba(255,240,170,0.9)";
      g.beginPath();
      g.arc(fx + 13, y, 2.2, 0, 7);
      g.fill();
    }
    g.fillStyle = up ? "#e8e0c0" : "#6a6050";
    g.fillRect(tx - (up ? 1.5 : 6), y - 6, up ? 3 : 7, 12);
    if (up) {
      g.fillStyle = "#2a2a2a";
      g.beginPath();
      g.arc(tx, y, 2.5, 0, 7);
      g.fill();
    }
  }
  // range safety officer walking the line
  {
    const f = (Math.sin(t * 0.15) + 1) / 2;
    mbSoldier(
      g,
      1195.5 * T_,
      (171 + f * 40) * T_,
      Math.cos(t * 0.15) > 0 ? Math.PI : 0,
      t * 7,
      "#8a6a2a",
    );
  }
  // parade: 24 soldiers in a 4-wide column marching a loop round the square
  {
    const x0 = 1390 * T_,
      y0 = 178 * T_,
      w = 36 * T_,
      h = 30 * T_,
      per = 2 * (w + h),
      sp = 26;
    const at = (d) => {
      d = ((d % per) + per) % per;
      if (d < w) return [x0 + d, y0, Math.PI / 2];
      if ((d -= w) < h) return [x0 + w, y0 + d, Math.PI];
      if ((d -= h) < w) return [x0 + w - d, y0 + h, -Math.PI / 2];
      d -= w;
      return [x0, y0 + h - d, 0];
    };
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 4; c++) {
        const [x, y, a] = at(t * sp - r * 12),
          ox = Math.cos(a) * (c - 1.5) * 9,
          oy = Math.sin(a) * (c - 1.5) * 9;
        mbSoldier(g, x + ox, y + oy, a, t * 8 + (r % 2) * 3, "#4f5a36");
      }
    mbSoldier(g, ...at(t * sp + 18), t * 8, "#8a2a2a"); // drill sergeant (sash)
    for (let i = 0; i < 5; i++)
      mbSoldier(g, (1405 + i * 2) * T_, 172.3 * T_, Math.PI, 0, "#6b5a3a");
  }
  // mess queue + PT joggers + sentries
  for (let i = 0; i < 9; i++)
    mbSoldier(g, (1100 + i * 1.6) * T_, 326.6 * T_, -Math.PI / 2, 0, i % 3 ? "#56603c" : "#3c4a5a");
  {
    const cx = 1133 * T_,
      cy = 322.5 * T_;
    for (let i = 0; i < 8; i++) {
      const a = t * 0.5 + i * 0.78;
      mbSoldier(
        g,
        cx + Math.cos(a) * 10 * T_,
        cy + Math.sin(a) * 2.2 * T_,
        a + Math.PI,
        t * 11 + i,
        "#9aa0a8",
      );
    }
  }
  for (const [x, y] of [
    [1246.7, 340],
    [1253.3, 340],
  ])
    mbSoldier(g, x * T_, y * T_, Math.PI, 0, "#4d5636");
  {
    const f = (Math.sin(t * 0.08) + 1) / 2;
    mbSoldier(
      g,
      (MB.x0 + 3 + f * 160) * T_,
      (MB.y1 - 3) * T_,
      Math.cos(t * 0.08) > 0 ? Math.PI / 2 : -Math.PI / 2,
      t * 6,
    );
  }
  // night: floodlights (consumed by drawNight)
  if (DN.dark > 0.05)
    for (const s of mbSearch(t)) dnLight(s.x, s.y, 5.5 * T_, "rgba(240,248,255,0.95)", 0.9);
}
function mbSearch(t) {
  const out = [],
    T_ = TILE;
  (world.milbase.search || []).forEach(([x, y, a], i) => {
    const sw = a + Math.sin(t * 0.35 + i * 1.7) * 0.55,
      d = 26 + Math.sin(t * 0.21 + i) * 8;
    out.push({
      ox: x * T_,
      oy: y * T_,
      a: sw,
      x: x * T_ + Math.cos(sw) * d * T_,
      y: y * T_ + Math.sin(sw) * d * T_,
    });
  });
  return out;
}
function mbDrawHigh(vx0, vy0, vx1, vy1) {
  if (!mbVis(vx0, vy0, vx1, vy1)) return;
  const g = ctx,
    T_ = TILE;
  // gate barriers (arm pivots at the kerbs, lifts up to vertical)
  for (let k = 0; k < 2; k++) {
    const px = (k ? MB.av + 4 : MB.av) * T_,
      py = MB.barY * T_,
      L = 2 * T_ * Math.cos(MB.rt.bars[k] * 1.45),
      s = k ? -1 : 1;
    g.fillStyle = "#333";
    g.fillRect(px - 4, py - 4, 8, 8);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? "#f2f2f2" : "#d02020";
      g.fillRect(px + s * ((L * i) / 6), py - 1.8, s * (L / 6), 3.6);
    }
  }
}
function mbDrawNight(vx0, vy0, vx1, vy1) {
  if (!mbVis(vx0, vy0, vx1, vy1) || DN.dark < 0.05) return;
  const g = ctx,
    T_ = TILE,
    t = timeS,
    k = DN.dark;
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const s of mbSearch(t)) {
    const gr = g.createLinearGradient(s.ox, s.oy, s.x, s.y);
    gr.addColorStop(0, "rgba(200,220,255," + 0.28 * k + ")");
    gr.addColorStop(1, "rgba(200,220,255," + 0.08 * k + ")");
    g.fillStyle = gr;
    const n = [-Math.sin(s.a), Math.cos(s.a)],
      w = 4.6 * T_;
    g.beginPath();
    g.moveTo(s.ox, s.oy);
    g.lineTo(s.x + n[0] * w, s.y + n[1] * w);
    g.lineTo(s.x - n[0] * w, s.y - n[1] * w);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,240," + 0.9 * k + ")";
    g.beginPath();
    g.arc(s.ox, s.oy, 5, 0, 7);
    g.fill();
  }
  // helipad edge lights + heli landing lights
  MB_HP.forEach(([x, y], i) => {
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      g.fillStyle = i >= 3 ? "rgba(255,190,60," + k + ")" : "rgba(80,255,120," + k + ")";
      g.beginPath();
      g.arc((x + Math.cos(a) * 6.3) * T_, (y + Math.sin(a) * 6.3) * T_, 3, 0, 7);
      g.fill();
    }
  });
  for (const [x, y] of world.milbase.lights) {
    g.fillStyle = "rgba(255,240,200," + 0.8 * k + ")";
    g.beginPath();
    g.arc(x * T_, y * T_, 3.2, 0, 7);
    g.fill();
  }
  g.restore();
}
function mbRR(g, x, y, w, h, r) {
  if (g.roundRect) return g.roundRect(x, y, w, h, r);
  g.rect(x, y, w, h);
}
// ---------------------------------------------------------------- static chunk art (kind "mb", o.t = part)
function mbText(g, s, x, y, px, col, rot) {
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.fillStyle = col;
  g.font = "bold " + px + "px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(s, 0, 0);
  g.restore();
}
OBJX.mb = function (g, o) {
  const T_ = TILE,
    r = mulberry(o.seed || 1),
    X0 = o.x,
    Y0 = o.y,
    W = o.w,
    H = o.h;
  switch (o.t) {
    case "worn": {
      g.fillStyle = "rgba(120,110,70,0.10)";
      for (let i = 0; i < 260; i++) {
        g.beginPath();
        g.ellipse(X0 + r() * W, Y0 + r() * H, 20 + r() * 90, 10 + r() * 40, r() * 3, 0, 7);
        g.fill();
      }
      break;
    }
    case "conc": {
      g.fillStyle = o.col || "#999";
      g.fillRect(X0, Y0, W, H);
      g.strokeStyle = "rgba(0,0,0,0.10)";
      g.lineWidth = 1;
      const st = (o.slab || 4) * T_;
      for (let x = X0 + st; x < X0 + W; x += st)
        (g.beginPath(), g.moveTo(x, Y0), g.lineTo(x, Y0 + H), g.stroke());
      for (let y = Y0 + st; y < Y0 + H; y += st)
        (g.beginPath(), g.moveTo(X0, y), g.lineTo(X0 + W, y), g.stroke());
      if (o.hazard) {
        g.strokeStyle = "#ffd23f";
        g.lineWidth = 4;
        g.strokeRect(X0 + 3, Y0 + 3, W - 6, H - 6);
      }
      if (o.wash) {
        g.fillStyle = "rgba(90,140,190,0.25)";
        g.fillRect(X0 + 1 * T_, Y0 + 7 * T_, W - 2 * T_, H - 9 * T_);
      }
      if (o.parade) {
        g.strokeStyle = "rgba(255,255,255,0.75)";
        g.lineWidth = 3;
        g.strokeRect(X0 + 5 * T_, Y0 + 9 * T_, W - 10 * T_, H - 14 * T_);
        for (let i = 1; i < 6; i++) {
          const x = X0 + 5 * T_ + ((W - 10 * T_) * i) / 6;
          g.beginPath();
          g.moveTo(x, Y0 + 9 * T_);
          g.lineTo(x, Y0 + 10.5 * T_);
          g.stroke();
        }
      }
      if (o.bays) {
        const [bx, by, n, rows, bw, gap] = o.bays;
        g.strokeStyle = "rgba(255,255,255,0.8)";
        g.lineWidth = 2;
        for (let rr = 0; rr < rows; rr++)
          for (let i = 0; i <= n; i++) {
            const x = (bx + i * bw) * T_,
              y = (by + rr * gap - 1.2) * T_;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x, y + 2.4 * T_);
            g.stroke();
          }
      }
      break;
    }
    case "hpad": {
      const cx = o.cx,
        cy = o.cy,
        R = 6.2 * T_;
      g.fillStyle = "#6e706c";
      g.beginPath();
      g.arc(cx, cy, R, 0, 7);
      g.fill();
      g.strokeStyle = o.amber ? "#ffb43c" : "#f2f2f2";
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, cy, R - 10, 0, 7);
      g.stroke();
      mbText(g, "H", cx, cy, 5.5 * T_, "#f2f2f2");
      mbText(g, String(o.n), cx + R - 30, cy - R + 30, 24, "#ffd23f");
      break;
    }
    case "range": {
      g.fillStyle = "#c9b98a";
      g.fillRect(X0, Y0, W, H);
      g.fillStyle = "#86a05a";
      g.fillRect(X0 + 9 * T_, Y0, W - 18 * T_, H);
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 2;
      for (let i = 0; i <= 10; i++) {
        const y = Y0 + (2.3 + i * 4.4) * T_;
        g.beginPath();
        g.moveTo(X0 + 9 * T_, y);
        g.lineTo(X0 + W - 9 * T_, y);
        g.stroke();
      }
      for (let m = 1; m < 6; m++) {
        const x = X0 + 9 * T_ + ((W - 18 * T_) * m) / 6;
        g.fillStyle = "#f2f2f2";
        g.fillRect(x - 2, Y0 + 1.2 * T_, 4, H - 2.4 * T_);
        mbText(g, m * 100 + "m", x, Y0 + 0.6 * T_, 18, "#30361f");
      }
      g.fillStyle = "#7a6a48"; // earth butts
      g.fillRect(X0 + W - 8 * T_, Y0, 8 * T_, H);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(X0 + W - 8 * T_, Y0, 1.5 * T_, H);
      g.fillStyle = "#c83030"; // red danger flags
      for (const y of [Y0 + 4, Y0 + H - 18]) g.fillRect(X0 + W - 4 * T_, y, 18, 12);
      break;
    }
    case "shelter":
    case "dais": {
      drawShadowRect(g, X0, Y0, W, H, 10);
      g.fillStyle = o.t === "dais" ? "#8c7a5a" : "#54583e";
      g.fillRect(X0, Y0, W, H);
      g.fillStyle = "rgba(255,255,255,0.1)";
      g.fillRect(X0, Y0, W, H * 0.2);
      break;
    }
    case "flag": {
      const x = X0 + W / 2,
        y = Y0 + H / 2;
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(x, y, 40, 3);
      g.fillStyle = "#ddd";
      g.beginPath();
      g.arc(x, y, 4, 0, 7);
      g.fill();
      g.fillStyle = "#1e3c78";
      g.fillRect(x + 4, y - 34, 44, 24);
      g.strokeStyle = "#fff";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x + 4, y - 34);
      g.lineTo(x + 48, y - 10);
      g.moveTo(x + 48, y - 34);
      g.lineTo(x + 4, y - 10);
      g.moveTo(x + 26, y - 34);
      g.lineTo(x + 26, y - 10);
      g.moveTo(x + 4, y - 22);
      g.lineTo(x + 48, y - 22);
      g.stroke();
      g.strokeStyle = "#c8102e";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(x + 26, y - 34);
      g.lineTo(x + 26, y - 10);
      g.moveTo(x + 4, y - 22);
      g.lineTo(x + 48, y - 22);
      g.stroke();
      break;
    }
    case "tankf": {
      const cx = X0 + W / 2,
        cy = Y0 + H / 2,
        R = W / 2;
      g.fillStyle = "rgba(10,15,25,0.3)";
      g.beginPath();
      g.arc(cx + 12, cy + 12, R, 0, 7);
      g.fill();
      const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 2, cx, cy, R);
      gr.addColorStop(0, "#9aa080");
      gr.addColorStop(1, "#5c6244");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, cy, R, 0, 7);
      g.fill();
      mbText(g, "F" + o.n, cx, cy, 30, "#20240f");
      break;
    }
    case "sand": {
      g.fillStyle = "#b9a676";
      g.fillRect(X0, Y0, W, H);
      g.strokeStyle = "rgba(80,60,30,0.35)";
      g.lineWidth = 1;
      const step = 9;
      if (o.horiz) for (let x = X0; x < X0 + W; x += step) g.strokeRect(x, Y0, step, H);
      else for (let y = Y0; y < Y0 + H; y += step) g.strokeRect(X0, y, W, step);
      break;
    }
    case "net": {
      g.save();
      g.globalAlpha = 0.72;
      g.fillStyle = "#4a5a30";
      g.fillRect(X0, Y0, W, H);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = ["#3a4824", "#5c6a3a", "#6b6040", "#2e3a1e"][(r() * 4) | 0];
        g.beginPath();
        g.ellipse(X0 + r() * W, Y0 + r() * H, 8 + r() * 26, 5 + r() * 14, r() * 3, 0, 7);
        g.fill();
      }
      g.restore();
      g.strokeStyle = "rgba(20,25,10,0.5)";
      g.strokeRect(X0, Y0, W, H);
      break;
    }
    case "cstack": {
      drawShadowRect(g, X0, Y0, W, H, 16);
      g.fillStyle = "#4f5d36";
      g.fillRect(X0, Y0, W, H);
      g.strokeStyle = "rgba(0,0,0,0.25)";
      for (let x = X0 + 6; x < X0 + W; x += 6)
        (g.beginPath(), g.moveTo(x, Y0), g.lineTo(x, Y0 + H), g.stroke());
      mbText(g, "ARMY", X0 + W / 2, Y0 + H / 2, 34, "#e8e2c8");
      break;
    }
    case "hard": {
      g.strokeStyle = "rgba(255,210,63,0.6)";
      g.lineWidth = 3;
      g.setLineDash([14, 10]);
      g.strokeRect(X0 + 4, Y0 + 4, W - 8, H - 8);
      g.setLineDash([]);
      mbText(g, "AFV HARDSTAND", X0 + W / 2, Y0 + 20, 22, "#ffd23f");
      break;
    }
    case "pt": {
      g.fillStyle = "#a04838";
      g.fillRect(X0, Y0, W, H);
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 2;
      g.strokeRect(X0 + 6, Y0 + 6, W - 12, H - 12);
      break;
    }
    case "txt":
      mbText(g, o.s, X0 + W / 2, Y0 + H / 2, Math.min(H * 0.8, 30), o.c);
      break;
    case "gate": {
      // stop lines, GATE paint + centre line on the avenue
      g.fillStyle = "#f2f2f2";
      g.fillRect(MB.av * T_ + 4, (MB.barY + 1.4) * T_, 2 * T_ - 8, 5);
      g.fillRect((MB.av + 2) * T_ + 4, (MB.barY - 1.4) * T_, 2 * T_ - 8, 5);
      mbText(g, "STOP", (MB.av + 1) * T_, (MB.barY + 3) * T_, 22, "#f2f2f2", Math.PI);
      mbText(g, "STOP", (MB.av + 3) * T_, (MB.barY - 3) * T_, 22, "#f2f2f2");
      g.fillStyle = "#c83030";
      g.fillRect((MB.av + 2) * T_ - 5, (MB.barY - 4) * T_, 10, 8 * T_);
      break;
    }
    case "sign": {
      drawShadowRect(g, X0, Y0, W, H, 8);
      g.fillStyle = "#1e3c28";
      g.fillRect(X0, Y0, W, H);
      g.strokeStyle = "#f2f2f2";
      g.lineWidth = 3;
      g.strokeRect(X0 + 4, Y0 + 4, W - 8, H - 8);
      mbText(g, "SANDVALE", X0 + W / 2, Y0 + H * 0.36, 30, "#f2f2f2");
      mbText(g, "MILITARY BASE", X0 + W / 2, Y0 + H * 0.68, 24, "#ffd23f");
      break;
    }
    case "flood": {
      g.fillStyle = "#555";
      g.beginPath();
      g.arc(X0 + W / 2, Y0 + H / 2, 4, 0, 7);
      g.fill();
      g.fillStyle = "#ddd";
      g.fillRect(X0 + W / 2 - 5, Y0 + H / 2 - 2, 10, 4);
      break;
    }
    case "bld": {
      const ex = (o.big ? 1.2 : o.small ? 0.6 : 1) * 18;
      drawShadowRect(g, X0, Y0, W, H, ex);
      const gr = g.createLinearGradient(X0, Y0, X0, Y0 + H);
      gr.addColorStop(0, shade(o.col, 1.12));
      gr.addColorStop(1, shade(o.col, 0.86));
      g.fillStyle = gr;
      g.fillRect(X0, Y0, W, H);
      if (o.roof === "p") {
        g.fillStyle = "rgba(0,0,0,0.14)";
        g.fillRect(X0, Y0 + H / 2, W, H / 2);
        g.strokeStyle = "rgba(0,0,0,0.25)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(X0, Y0 + H / 2);
        g.lineTo(X0 + W, Y0 + H / 2);
        g.stroke();
      } else {
        g.strokeStyle = "rgba(0,0,0,0.22)";
        g.lineWidth = 2;
        g.strokeRect(X0 + 5, Y0 + 5, W - 10, H - 10);
        for (let i = 1; i < (o.units || 1); i++) {
          const x = X0 + (W * i) / (o.units || 1);
          g.beginPath();
          g.moveTo(x, Y0);
          g.lineTo(x, Y0 + H);
          g.stroke();
        }
        for (let i = 0; i < 4; i++) {
          g.fillStyle = "rgba(255,255,255,0.18)";
          g.fillRect(X0 + 12 + r() * (W - 40), Y0 + 12 + r() * (H - 30), 18, 12);
        }
      }
      if (o.doors) {
        g.fillStyle = "#3a3a36";
        for (let i = 0; i < o.doors; i++)
          g.fillRect(X0 + ((i + 0.5) * W) / o.doors - 0.9 * T_, Y0 + H - 6, 1.8 * T_, 6);
      }
      if (o.awn) {
        g.fillStyle = o.awn;
        g.fillRect(X0, Y0 + H - 10, W, 10);
      }
      if (o.icon === "redcross" || o.icon === "cross") {
        const c = o.icon === "redcross" ? "#d22" : "#f2f2ea",
          cx = X0 + W / 2,
          cy = Y0 + H / 2;
        g.fillStyle = o.icon === "redcross" ? "#fff" : "rgba(0,0,0,0)";
        g.fillRect(cx - 34, cy - 34, 68, 68);
        g.fillStyle = c;
        g.fillRect(cx - 9, cy - 28, 18, 56);
        g.fillRect(cx - 28, cy - 9, 56, 18);
      }
      if (o.icon === "tower") {
        g.fillStyle = "#26323a";
        g.fillRect(X0 + W / 2 - 40, Y0 + H / 2 - 40, 80, 80);
        g.strokeStyle = "#9ab";
        g.strokeRect(X0 + W / 2 - 40, Y0 + H / 2 - 40, 80, 80);
      }
      const fs = Math.min(26, (W / Math.max(4, o.name.length)) * 1.5, H * 0.32);
      mbText(
        g,
        o.name,
        X0 + W / 2,
        Y0 + (o.roof === "p" ? H * 0.27 : H / 2) + (o.icon ? H * 0.32 : 0),
        fs,
        "rgba(255,255,240,0.9)",
      );
      break;
    }
    case "veh": {
      const S = mbSprite(o.vk, o.col);
      g.save();
      g.translate(o.cx + 4, o.cy + 4);
      g.rotate(o.a);
      g.scale(PPM / VS, PPM / VS);
      g.drawImage(S.sh, -S.c.width / 2, -S.c.height / 2);
      g.restore();
      g.save();
      g.translate(o.cx, o.cy);
      g.rotate(o.a);
      g.scale(PPM / VS, PPM / VS);
      g.drawImage(S.c, -S.c.width / 2, -S.c.height / 2);
      g.restore();
      if (o.vk === "tank") {
        g.save();
        g.translate(o.cx, o.cy);
        g.rotate(o.a + ((o.ta || 0) * Math.PI) / 180);
        g.fillStyle = "#4e5734";
        g.beginPath();
        g.ellipse(0, 4, 13, 15, 0, 0, 7);
        g.fill();
        g.fillStyle = "#3c4428";
        g.fillRect(-1.6, -48, 3.2, 46);
        g.restore();
      }
      break;
    }
    case "fence": {
      g.strokeStyle = "rgba(0,0,0,0.3)";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(o.ax * T_ + 4, o.ay * T_ + 6);
      g.lineTo(o.bx * T_ + 4, o.by * T_ + 6);
      g.stroke();
      g.strokeStyle = "#6e7274";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(o.ax * T_, o.ay * T_);
      g.lineTo(o.bx * T_, o.by * T_);
      g.stroke();
      // barbed coil
      const L = Math.hypot(o.bx - o.ax, o.by - o.ay) * T_,
        ux = ((o.bx - o.ax) * T_) / L,
        uy = ((o.by - o.ay) * T_) / L;
      g.strokeStyle = "#c4c8ca";
      g.lineWidth = 1.6;
      g.beginPath();
      for (let d = 0; d < L; d += 6) {
        const x = o.ax * T_ + ux * d,
          y = o.ay * T_ + uy * d;
        g.moveTo(x - uy * 3.5 + ux * 3, y + ux * 3.5 + uy * 3);
        g.arc(x, y, 3.5, 0, 6.3);
      }
      g.stroke();
      g.fillStyle = "#4a4e50";
      for (let d = 0; d <= L; d += 3 * T_)
        g.fillRect(o.ax * T_ + ux * d - 2.5, o.ay * T_ + uy * d - 2.5, 5, 5);
      break;
    }
    case "tower": {
      const cx = X0 + W / 2,
        cy = Y0 + H / 2;
      g.fillStyle = "rgba(10,15,25,0.35)";
      g.fillRect(cx - 40 + 30, cy - 40 + 30, 80, 80);
      g.fillStyle = "#4a4e44";
      g.fillRect(cx - 44, cy - 44, 88, 88);
      g.fillStyle = "#6a6e5c";
      g.fillRect(cx - 36, cy - 36, 72, 72);
      g.fillStyle = "#26323a";
      g.fillRect(cx - 24, cy - 24, 48, 48);
      g.strokeStyle = "#999";
      g.lineWidth = 2;
      g.strokeRect(cx - 36, cy - 36, 72, 72);
      break;
    }
  }
};

// ---------------------------------------------------------------- night lighting (baked into the night light map, like the docks)
// floodlight pools on every mast, every building front/back, each depot bay row, helipads, motor pool, range lanes and the parade ground
function mbSiteLights(add) {
  const B = world.milbase;
  if (!B) return;
  const T_ = TILE;
  for (const [x, y, rr] of B.lights) add(x * T_, y * T_, rr * T_ * 1.5, "fl");
  for (const o of world.objects) {
    if (o.kind !== "mb") continue;
    if (o.t === "bld") {
      const r = Math.max(110, Math.min(260, o.w * 0.4));
      for (let x = o.x + r * 0.6; x < o.x + o.w; x += r * 1.3) {
        add(x, o.y + o.h + 24, r, "fl");
        add(x, o.y - 24, r * 0.8, "fl");
      }
    } else if (o.t === "hpad") add(o.cx, o.cy, 7 * T_, "fl");
    else if (o.t === "net" || o.t === "cstack" || o.t === "hard" || o.t === "conc")
      for (let y = o.y + 4 * T_; y < o.y + o.h; y += 10 * T_)
        for (let x = o.x + 4 * T_; x < o.x + o.w; x += 10 * T_) add(x, y, 7 * T_, "fl");
  }
  for (const rw of (B.depot && B.depot.rows) || [])
    for (let x = rw.x0; x < rw.x0 + rw.n * rw.bw; x += 6)
      add(x * T_, (rw.y0 - 1) * T_, 6 * T_, "fl");
  for (let x = 1186; x < 1326; x += 11)
    for (const y of [169, 180, 191, 202, 213]) add(x * T_, y * T_, 10 * T_, "fl");
  for (let x = 1388; x < 1432; x += 11)
    for (let y = 172; y < 214; y += 11) add(x * T_, y * T_, 8 * T_, "fl");
}
setTimeout(() => {
  if (typeof siteLights !== "function") return;
  const sl = siteLights;
  siteLights = function (add) {
    sl.apply(this, arguments);
    try {
      mbSiteLights(add);
    } catch (e) {
      console.warn("milbase lights", e);
    }
  };
}, 0);
