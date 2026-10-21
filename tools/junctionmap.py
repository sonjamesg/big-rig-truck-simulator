#!/usr/bin/env python3
"""Junction review map: python3 build.py && python3 tools/junctionmap.py  ->  map/index.html + map/world.png (trucksim.co.uk/map/).

Loads BigRig.html headless, reads the generated world (tile grid, world.junctions, world.rbs, world.curves, world.labels) and
writes a 1 px-per-tile colour raster plus a JSON node list that map/index.html (static, noindex) draws with pan / pinch zoom.
Node ids: J<id> = world.junctions[i].id, R<i> = world.rbs[i], C<id> = world.curves[i].id (bends).
Types: sig = signalised junction (lights, 3+ arms), rb = roundabout, gw = unsignalised / give-way junction (3+ arms),
corner = junction box with 2 arms (lights flag kept), bend = curve. Arms = sides of the box with road tiles just outside.
"""
import asyncio, base64, json, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = r"""() => {
  const W = MW, H = MH, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  const P = {}; // tile type -> colour (midnight palette)
  const C = (t, r, gg, b) => (P[t] = [r, gg, b]);
  C(T.GRASS,14,22,24); C(T.PGRASS,14,24,26); C(T.FIELD,18,26,22); C(T.TREE,10,20,20); C(T.HEDGE,12,22,20); C(T.PARK,14,28,28);
  C(T.WATER,6,16,40); C(T.SAND,40,40,36); C(T.ROCK,30,32,36); C(T.ROAD,150,176,205); C(T.BRIDGE,170,196,225); C(T.ISLAND,90,110,130);
  C(T.WALK,38,46,60); C(T.PLAZA,40,48,62); C(T.CONC,34,40,52); C(T.LOT,36,42,56); C(T.QUAY,44,50,62); C(T.GRAVEL,34,36,40);
  C(T.BLDG,24,30,44); C(T.CONT,30,36,50); C(T.TANK,30,36,50); C(T.PUMP,60,70,90);
  for (let i = 0; i < W * H; i++) { const p = P[G[i]] || [20, 24, 30]; d[i*4] = p[0]; d[i*4+1] = p[1]; d[i*4+2] = p[2]; d[i*4+3] = 255; }
  g.putImageData(im, 0, 0);
  const isR = (x, y) => { const t = get(x, y); return t === T.ROAD || t === T.BRIDGE; };
  const arms = (j) => { let n = 0, s = [];
    const side = (pts) => pts.filter(([x, y]) => isR(x, y)).length >= Math.max(1, Math.floor(pts.length / 2));
    const top = [], bot = [], lef = [], rig = [];
    for (let x = j.x; x < j.x + j.w; x++) { top.push([x, j.y - 2]); bot.push([x, j.y + j.h + 1]); }
    for (let y = j.y; y < j.y + j.h; y++) { lef.push([j.x - 2, y]); rig.push([j.x + j.w + 1, y]); }
    for (const [k, pts] of [['N', top], ['S', bot], ['W', lef], ['E', rig]]) if (side(pts)) { n++; s.push(k); }
    return [n, s.join('')]; };
  const N = [];
  for (const j of world.junctions) { const [a, s] = arms(j);
    const t = a <= 2 ? 'corner' : j.lights ? 'sig' : 'gw';
    N.push({ id: 'J' + j.id, x: +(j.x + j.w / 2).toFixed(1), y: +(j.y + j.h / 2).toFixed(1), t, a, s, L: j.lights ? 1 : 0, w: j.w, h: j.h }); }
  world.rbs.forEach((r, i) => N.push({ id: 'R' + i, x: r.cx, y: r.cy, t: 'rb', a: (r.arms || []).length, L: 0, r: r.rout }));
  for (const cv of world.curves) { const p = cv.pts[cv.pts.length >> 1];
    N.push({ id: 'C' + cv.id, x: +p[0].toFixed(1), y: +p[1].toFixed(1), t: 'bend', a: 2, L: 0, k: cv.type }); }
  const labels = world.labels.map(l => [l[0], l[1], l[2], l[3] || 1]);
  return { W, H, png: c.toDataURL('image/png'), nodes: N, labels };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg = await b.new_page()
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html"))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        r = await pg.evaluate(JS); await b.close()
    os.makedirs(os.path.join(ROOT, "map"), exist_ok=True)
    open(os.path.join(ROOT, "map", "world.png"), "wb").write(base64.b64decode(r.pop("png").split(",")[1]))
    tpl = open(os.path.join(ROOT, "tools", "junctionmap.html")).read()
    open(os.path.join(ROOT, "map", "index.html"), "w").write(tpl.replace("/*DATA*/null", json.dumps(r, separators=(",", ":"))))
    cnt = {}
    for n in r["nodes"]: cnt[n["t"]] = cnt.get(n["t"], 0) + 1
    print("nodes", len(r["nodes"]), cnt, "signalised corners", sum(1 for n in r["nodes"] if n["t"] == "corner" and n["L"]))
asyncio.run(main())
