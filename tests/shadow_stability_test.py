# python3 tests/shadow_stability_test.py [BigRig.html|URL] [tag] -> daytime shadow flicker meter.
# Pans the camera over a city block (traffic frozen, clear weather, the game clock left running as in play) by a step
# that is a whole number of backing pixels, so a stable frame equals the previous frame shifted. For each frame it
# re-composites the building / tree shadow layer alone (the game's own composite, gsComposite, into a white scratch
# canvas with the frame's transform) and measures the mean absolute luma change against the previous frame shifted by
# the pan (overlap only). "pops" = frames changing by > 0.5. PASS when the mean < 0.1 and pops == 0 on both pans.
import asyncio, json, sys, os
from playwright.async_api import async_playwright
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BigRig.html")
TAG = sys.argv[2] if len(sys.argv) > 2 else "run"
URL = HTML if HTML.startswith("http") else "file://" + os.path.abspath(HTML)
RUN = r"""
async ([x0, y0, z, px, n, off, dir]) => {
  WX.st = 'clear'; WX.rain = 0; WX.timer = 1e9; FIRE.t = 1e9; BK.nextGang = 1e9;
  updateTraffic = () => {}; traffic.vs.length = 0;
  GFX.off.shade = off === true;
  const c = document.getElementById('game'), g = c.getContext('2d', { willReadFrequently: true });
  const step = px / (z * RSF); // world px per frame = px backing px on screen
  let X = x0 * TILE, Y = y0 * TILE;
  window.__camHold = [X, Y]; cam.z = cam.zLock = z;
  const fr = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let i = 0; i < 25; i++) await fr();
  const W = c.width, H = c.height, out = [];
  let pv = null;
  for (let i = 0; i < n; i++) {
    if (dir === 'x') X += step; else { X += step * 0.6; Y += step * 0.8; }
    window.__camHold = [X, Y]; cam.z = z;
    await fr();
    let d;
    if (off === 'layer') {
      // shadow layer alone, composited exactly as the game does it, into a scratch canvas with the frame's transform
      // (drawn over the finished frame on the game canvas itself; the next frame repaints everything)
      const zr = cam.z * RSF;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(zr, 0, 0, zr, (VW / 2 - cam.x * cam.z) * RSF, (VH / 2 - cam.y * cam.z) * RSF);
      const vx0 = cam.x - VW / 2 / cam.z, vy0 = cam.y - VH / 2 / cam.z, vx1 = cam.x + VW / 2 / cam.z, vy1 = cam.y + VH / 2 / cam.z;
      try {
        if (typeof gsComposite === 'function') gsComposite(vx0, vy0, vx1, vy1, cam.z);
        else { const Q = GS.R; ctx.globalAlpha = 0.4 * SUN.a; ctx.drawImage(GS.lc, Q[0], Q[1], Q[2] - Q[0], Q[3] - Q[1]); }
      } finally { ctx.restore(); }
      d = g.getImageData(0, 0, W, H).data;
    } else d = g.getImageData(0, 0, W, H).data;
    if (pv) {
      const sx = dir === 'x' ? px : Math.round(px * 0.6), sy = dir === 'x' ? 0 : Math.round(px * 0.8);
      let s = 0, k = 0;
      for (let y = 40; y < H - 40 - sy; y += 2)
        for (let x = 40; x < W - 40 - sx; x += 2) {
          const a = (y * W + x) * 4, b = ((y + sy) * W + x + sx) * 4;
          s += Math.abs(d[a] * 0.3 + d[a + 1] * 0.59 + d[a + 2] * 0.11 - (pv[b] * 0.3 + pv[b + 1] * 0.59 + pv[b + 2] * 0.11));
          k++;
        }
      out.push(s / k);
    }
    pv = d;
  }
  GFX.off.shade = false;
  return out;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1000, 'height': 700}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('bigrig.gfx','high')")
        await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>{gameT=15.0}")
        res = {}; ok = True
        for name, args in [("pan_x", [300, 230, 0.6, 5, 40, None, 'x']), ("pan_diag", [205, 250, 0.75, 5, 40, None, 'd'])]:
            a = list(args); a[5] = 'layer'
            ex = await pg.evaluate(RUN, a)
            m = {"shadow_change_mean": round(sum(ex) / len(ex), 3), "max": round(max(ex), 3), "pops": sum(1 for e in ex if e > 0.5)}
            res[name] = m
            ok = ok and m["shadow_change_mean"] < 0.1 and m["pops"] == 0
        fps = await pg.evaluate("""async()=>{window.__camHold=null;cam.zLock=0;let n=0;const t0=performance.now();await new Promise(r=>{const f=()=>{n++;performance.now()-t0<5000?requestAnimationFrame(f):r()};requestAnimationFrame(f)});return Math.round(n/5*10)/10}""")
        print(TAG, json.dumps(res), "fps", fps, "errs", errs[:3])
        print("SUMMARY", "PASS" if ok and not errs else "FAIL")
        await b.close()
asyncio.run(main())
