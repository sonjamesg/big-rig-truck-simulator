# python3 tests/bld_stability_test.py BigRig.html [tag] -> pans the camera across Kingsbridge (day + night, slow and fast)
# and checks, frame by frame: every 3D building whose footprint is on screen is drawn (no pop-in at the edges), and the
# lit-window pixel count does not jump between consecutive frames (no flicker). Prints PASS / FAIL.
import asyncio, json, sys, os
from playwright.async_api import async_playwright
HTML = sys.argv[1] if len(sys.argv) > 1 else "BigRig.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "run"
PAN = r"""
async ([hr, step, n, x0, y0]) => {
  gameT = hr; WX.st = 'clear'; WX.rain = 0; FIRE.t = 1e9; BK.nextGang = 1e9;
  updateTraffic = () => {}; traffic.vs.length = 0; // moving headlights would mask window flicker
  const c = document.getElementById('game'), g = c.getContext('2d', { willReadFrequently: true });
  let X = x0 * TILE;
  window._cl = () => { cam.x = X; cam.y = y0 * TILE; cam.z = cam.zLock = 0.6; };
  if (!window._clr) { window._clr = 1; const f = () => { _cl(); requestAnimationFrame(f); }; f(); }
  if (!window._g3w) { window._g3w = 1; const g0 = gfx3dDraw; gfx3dDraw = function (a, b, c, d) { window._vb = [a, b, c, d]; return g0.apply(this, arguments); }; }
  const fr = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let i = 0; i < 20; i++) await fr(); // settle (initial bake)
  const lit = [], miss = [], t = [], ok = []; let pv = null;
  for (let i = 0; i < n; i++) {
    X += step; const t0 = performance.now(); await fr(); t.push(performance.now() - t0);
    const [vx0, vy0, vx1, vy1] = window._vb; // the bounds the frame was really drawn with
    // the game's follow camera sometimes wins over the lock; only compare frames that moved by the pan step
    ok.push(pv && Math.abs(vx0 - pv[0] - step) < 1 && Math.abs(vy0 - pv[1]) < 1); pv = [vx0, vy0];
    // buildings with their footprint on screen that the 3D pass did not draw
    let m = 0; const sn = new Set();
    if (gfx3dOn()) {
      const vis = new Set(G3.vis);
      for (let y = Math.floor(vy0 / CHUNK); y <= Math.floor(vy1 / CHUNK); y++)
        for (let x = Math.floor(vx0 / CHUNK); x <= Math.floor(vx1 / CHUNK); x++)
          for (const o of world.chunkObjs.get(x + ',' + y) || [])
            if (o.kind === 'bldg' && o.height > 0 && o.style !== 'stadium' && o.x < vx1 && o.x + o.w > vx0 && o.y < vy1 && o.y + o.h > vy0 && !vis.has(o) && !sn.has(o)) { sn.add(o); m++; }
    }
    miss.push(m);
    if (hr > 20) {
      // only pixels inside drawn buildings' footprints (street lamps, the truck and traffic are not windows)
      const W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data, sx = W / (vx1 - vx0), sy = H / (vy1 - vy0);
      const mk = new Uint8Array(W * H); let k = 0;
      for (const o of G3.vis) {
        const x0 = Math.max(0, Math.ceil((o.x - vx0) * sx) + 2), x1 = Math.min(W, Math.floor((o.x + o.w - vx0) * sx) - 2);
        const y0 = Math.max(0, Math.ceil((o.y - vy0) * sy) + 2), y1 = Math.min(H, Math.floor((o.y + o.h - vy0) * sy) - 2);
        for (let y = y0; y < y1; y++) mk.fill(1, y * W + x0, y * W + Math.max(x0, x1));
      }
      for (let q = 0, p = 0; q < mk.length; q++, p += 4) if (mk[q] && d[p] > 200 && d[p + 1] > 150 && d[p + 2] < 170 && d[p] - d[p + 2] > 60) k++;
      lit.push(k);
    }
  }
  let jump = 0, mean = lit.reduce((a, b) => a + b, 0) / (lit.length || 1);
  for (let i = 1; i < lit.length; i++) if (ok[i]) jump = Math.max(jump, Math.abs(lit[i] - lit[i - 1]));
  t.sort((a, b) => a - b);
  return { maxMissing: Math.max(...miss), framesWithMissing: miss.filter(v => v).length, litMean: Math.round(mean),
           pairs: ok.filter(v => v).length, litMaxJumpPct: mean ? +(100 * jump / mean).toFixed(1) : 0, frameMsMedian: +t[t.length >> 1].toFixed(1) };
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 1100, "height": 760}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.add_init_script("localStorage.setItem('bigrig.gfx','high')")
        await pg.goto("file://" + os.path.abspath(HTML)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{rigPlace({x:1500*M_T,y:420*M_T,h:Math.PI/2});truck.v=0}")
        out = {}
        for nm, hr, step, n, x0 in (("night_slow", 22.5, 3, 60, 1580), ("night_fast", 22.5, 40, 50, 1500), ("day_fast", 12.5, 40, 50, 1500)):
            out[nm] = await pg.evaluate(PAN, [hr, step, n, x0, 408])
            await pg.screenshot(path=f"/workspace/bldfix/{nm}_{TAG}.png")
        print(json.dumps(out)); print("ERRS", errs)
        ok = all(v["maxMissing"] == 0 for v in out.values()) and out["night_slow"]["pairs"] >= 10 and out["night_slow"]["litMaxJumpPct"] < 8 and not errs
        print("PASS" if ok else "FAIL"); await b.close()
asyncio.run(main())
