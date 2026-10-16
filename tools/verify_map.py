#!/usr/bin/env python3
"""Check the map data file (src/map/) rebuilds exactly the world the generator makes.

Usage: python3 build.py && python3 tools/verify_map.py
Page A runs the old generator (?mapgen=1), page B loads MAP_DATA (mapload.js). Compares a deep fingerprint of every
global (lists, fields, typed arrays/tile grids, Maps/Sets, shared references), a full re-serialisation, G===world.ground,
the rebuilt functions sampled numerically, and trailer art pixels. Exit 0 only if everything matches.
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from export_map import GEN_SCRATCH, ROOTS  # noqa: E402

GLOBALS_JS = """() => {
  // every global lexical/var name declared by the bundle's top level
  const src = [...document.scripts].map((s) => s.textContent).join("\\n");
  const names = new Set();
  for (const m of src.matchAll(/^(?:const|let|var|function\\*?|class)\\s+([A-Za-z_$][\\w$]*)/gm)) names.add(m[1]);
  return [...names];
}"""

CHECK_JS = """(scratch) => {
  for (const p of scratch) { const [r, k] = p.split("."); delete mapRootGet(r)[k]; }
  // timings and per-session random timers differ between any two runs (even two generator runs): mask them
  world.genMs = world.tmMall = world.tmSvc = 0;
  if (world.tm) for (const e of world.tm) e[1] = 0;
  if (RAIL.route) RAIL.route.ms = 0;
  FIRE.t = 0;
  POL.spawnT = 0;
  const out = { aliasG: G === world.ground };
  // rebuilt functions, sampled
  const smp = [];
  for (const tr of RAIL.tracks || []) for (let s = 0; s < RAIL.L; s += 7.3) smp.push(tr.w(s));
  if (RAIL.hubB) for (let s = 0; s < RAIL.L; s += 3.1) smp.push(RAIL.hubB(s));
  const taps = [];
  for (const sg of world.segs || []) if (sg && sg.tap) for (const tp of Object.values(sg.tap)) if (tp && tp.hs) taps.push(tp);
  for (const o of world.objects || []) if (o.cv && o.cv.tap) for (const tp of Object.values(o.cv.tap)) if (tp && tp.hs) taps.push(tp);
  for (const tp of taps) for (let t = -2; t <= tp.L + 2; t += tp.L / 9 + 0.01) smp.push(tp.hs(t, 1), tp.hs(t, -1));
  out.fnSamples = smp.length;
  out.fnHash = mapFingerprint.hashValue ? mapFingerprint.hashValue(smp) : JSON.stringify(smp);
  out.regionAt = world.regionAt === regionAt;
  out.isDesert = world.isDesert === isDesert;
  // BigRig API functions: same function objects as the code defines
  out.bigrigFns = Object.keys(BigRig).filter((k) => typeof BigRig[k] === "function").map((k) => k + ":" + (BigRig[k].name || "?")).join(",");
  // trailer art pixels
  let ah = 0, an = 0;
  for (const k of Object.keys(traffic.arts || {}).sort()) {
    const c = traffic.arts[k];
    if (!c || !c.getContext) continue;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 3) ah = (Math.imul(ah ^ d[i], 16777619) >>> 0);
    an++;
  }
  out.art = an + ":" + ah;
  out.ser = JSON.stringify(mapSerialize(PARTS, true));
  return out;
}"""


# globals that describe how the world was obtained, not the world itself
IGNORE = {"MAPLOAD"}


async def page(p, gen):
    b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = await b.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    await pg.add_init_script("window.__BIGRIG_NOBOOT=1;" + ("window.__BIGRIG_MAPGEN=1;" if gen else ""))
    # generator: file:// (no map data reachable); map data: index.html over http, fetching mapdata.bin like the live site
    await pg.goto("file://" + os.path.join(ROOT, "index.html") + "?mapgen=1" if gen else BASE + "index.html")
    await pg.wait_for_function("typeof genWorldSteps==='function'")
    for f in ("mapfp.js", "mapstate.js"):
        await pg.add_script_tag(content=open(os.path.join(ROOT, "tools", f)).read())
    await pg.evaluate("makeTextures()")
    if gen:
        ms = await pg.evaluate("(()=>{const t=performance.now(); for (const st of genWorldSteps()); return performance.now()-t;})()")
    else:
        assert await pg.evaluate("mapAvailable() && !window.MAP_DATA"), "map data path not active"
        ms = await pg.evaluate("(async()=>{const t=performance.now(); await mapLoadWorld(async()=>{}); return performance.now()-t;})()")
    return b, pg, errs, ms


BASE = None


async def main():
    global BASE
    import functools, http.server, socketserver, threading
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    h.log_message = lambda *a: None
    srv = socketserver.TCPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    BASE = "http://127.0.0.1:%d/" % srv.server_address[1]
    man = json.load(open(os.path.join(ROOT, "src", "map", "manifest.json")))
    parts = [{"root": q["root"], "key": q["key"], **({"derived": q["derived"]} if q.get("derived") else {})} for q in man["parts"]]
    res = {}
    async with async_playwright() as p:
        for gen in (True, False):
            b, pg, errs, ms = await page(p, gen)
            names = await pg.evaluate(GLOBALS_JS)
            await pg.evaluate("(p)=>{window.PARTS=p}", parts)
            chk = await pg.evaluate(CHECK_JS, sorted(GEN_SCRATCH))
            fp = await pg.evaluate("(n)=>mapFingerprint(n)", names)
            res[gen] = dict(chk=chk, fp=fp, errs=errs, ms=ms, pg=pg)
            if gen is False:
                bad0 = [k for k in fp if res[True]["fp"].get(k) != fp[k] and k not in IGNORE]
                for P in (res[True]["pg"], pg):
                    sub = await P.evaluate("""(ns)=>{const out={};for(const n of ns){let v;try{v=(0,eval)(n)}catch(e){continue}
                      if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){const ks=Object.keys(v);Object.assign(out,mapFingerprint(ks.map(k=>n+'['+JSON.stringify(k)+']')));}}return out}""", bad0)
                    P._sub = sub
                sa, sb = res[True]["pg"]._sub, pg._sub
                res["subdiff"] = [k for k in sorted(set(sa) | set(sb)) if sa.get(k) != sb.get(k)]
                await res[True]["b"].close()
            else:
                res[gen]["b"] = b
                continue
            await b.close()
    A, B = res[True], res[False]
    bad = []
    keys = sorted(set(A["fp"]) | set(B["fp"]))
    for k in keys:
        if k not in IGNORE and A["fp"].get(k) != B["fp"].get(k):
            bad.append("global " + k)
    for k in A["chk"]:
        if A["chk"][k] != B["chk"][k]:
            bad.append("check " + k)
    if not B["chk"]["aliasG"]:
        bad.append("G !== world.ground")
    print("globals compared:", len(keys), " fn samples:", A["chk"]["fnSamples"], " trailer art:", A["chk"]["art"])
    print("serialised state: %d chars, %s" % (len(A["chk"]["ser"]), "identical" if A["chk"]["ser"] == B["chk"]["ser"] else "DIFFERENT"))
    print("generator %.0f ms, map data %.0f ms" % (A["ms"], B["ms"]))
    print("page errors:", A["errs"] + B["errs"])
    if bad or A["errs"] or B["errs"]:
        print("MISMATCH:", bad[:40])
        print("differing keys:", res.get("subdiff", [])[:60])
        return 1
    print("OK: map data == generator")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
