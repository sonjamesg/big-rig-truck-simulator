"""Mod fit: every truck model x every visual customiser part, rendered with the real game art (czArt top view + czSide
profile, the 360 turntable is textured from these). The pixels each part adds are boxed (diff vs stock) and must lie inside
that model's mount points (czMount): body width, behind the cab / between the axles / on the roof / at the front, left-right
mirrored, and a fitted exhaust must hide the stock stacks. Usage: python3 tests/mod_fit_test.py [BigRig.html]"""
import asyncio, sys, os
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "..", "BigRig.html")
E = 0.04  # metres slack (anti-aliasing)
ONE_SIDE = {"bcn1", "tnk1", "tnk2", "plt1", "plt2"}
def check(mid, M, pid, r):
    bad = []; sl = pid.rstrip("0123456789")
    t, s = r.get("top"), r.get("side")
    if r.get("err"): return [r["err"]]
    if t == "size": return ["art size changed"]
    if t is None and s is None: return ["part not drawn in any view"]
    if t:
        x0, x1, y0, y1 = t
        wide = M["half"] + (0.2 if sl in ("bmp", "vis", "arm", "bpl") else 0.05 if sl == "mud" else 0) + E  # mud: twin-tyre fender edge
        if sl != "led" and (x0 < -wide or x1 > wide): bad.append(f"top: wider than body ({x0},{x1}) > {wide:.2f}")
        if pid not in ONE_SIDE and sl != "led" and abs(x0 + x1) > 0.08: bad.append(f"top: not mirrored ({x0},{x1})")
        rng = {"exs": (M["cabRear"] - 0.1, M["rail"][1]), "exh": (M["cabRear"] - 0.1, M["rail"][1]),  # -0.1: stock stack removed
               "tnk": (M["rail"][0], M["rail"][1]), "skt": (M["cabRear"], M["rail"][1]),
               "mud": (0.3, 1.25), "bmp": (M["front"] - 0.65, M["front"] + 0.15), "bem": (M["front"] - 0.1, M["front"] + 0.15),
               "rbar": (M["cab0"], M["cabRear"]), "vis": (M["cab0"] - 0.2, M["cab0"] + 0.3), "plt": (M["cab0"], M["cab0"] + 0.4),
               "spl": (M["cab0"], M["cabRear"] + 0.65), "bcn": (M["cab0"], M["cabRear"] + 0.1)}.get(sl)
        if rng and (y0 < rng[0] - E or y1 > rng[1] + E): bad.append(f"top: along ({y0},{y1}) outside mount {tuple(round(v,2) for v in rng)}")
    if s:
        x0, x1, h0, h1 = s
        if sl in ("exs", "exh") and x0 < M["sideRear"] - E - 0.03: bad.append(f"side: stack inside the cab (x0 {x0} < {M['sideRear']})")
        if sl in ("rbar", "bcn") and not (M["roof"] - 0.25 <= h0 <= M["roofTop"] + 0.35): bad.append(f"side: not on the roof (h {h0}, roof {M['roof']}-{M['roofTop']})")
        if sl == "spl" and h0 < M["roof"] - 0.4: bad.append(f"side: spoiler below roof (h {h0})")
        if sl in ("skt", "tnk") and (x0 < M["sideRear"] - E or x1 > M["rail"][1] + 0.1): bad.append(f"side: off the chassis rail ({x0},{x1})")
        if h0 < -0.05: bad.append(f"side: below the road ({h0})")
    return bad
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("typeof czArt==='function'&&typeof czMount==='function'", timeout=300000)
        await pg.wait_for_timeout(1000)
        R = await pg.evaluate(open(os.path.join(D, "modfit_probe.js")).read())
        MT = await pg.evaluate("(()=>{const o={};for(const m of TRUCK_MODELS)o[m.id]=czMount(m);return o})()")
        # stock exhaust hidden when a mod exhaust is fitted (bastion has no stock stack in its art)
        hid = await pg.evaluate("""(()=>{const r={};for(const m of TRUCK_MODELS){const c=m.cols[0];
          const a=modelArt(m,c,rigHide({},{})).c.toDataURL(), e=modelArt(m,c,rigHide({exs:'exs1'},czLook(m.id,{exs:'exs1'}))).c.toDataURL();
          r[m.id]=m.id==="bastion"||(a!==e && rigHide({exh:"exh1"},{}).exh);}return r})()""")
        nbad = n = 0
        for mid, parts in R.items():
            M = MT[mid]; parts.pop("_body", None)
            for pid, r in parts.items():
                n += 1
                for x in check(mid, M, pid, r): nbad += 1; print("FAIL", mid, pid, x)
            if not hid[mid]: nbad += 1; print("FAIL", mid, "stock exhaust still drawn with a mod exhaust fitted")
        print(f"models {len(R)} | part renders checked {n} | failures {nbad} | page errors {errs[:3]}")
        print("PASS" if not nbad and not errs and n > 200 else "FAIL")
        await b.close()
asyncio.run(main())
