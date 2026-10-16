#!/usr/bin/env python3
"""Export the generated world state to src/map/ (the data the game loads instead of generating).
Usage: python3 build.py && python3 tools/export_map.py
Runs the old generator (world.js genWorldSteps) in headless Chrome with the automatic boot disabled, finds which
global state generation fills (per root key, by deep fingerprint before/after), serialises it (tools/mapstate.js)
and writes src/map/manifest.json, src/map/state/<root>.<key>.json and src/map/tiles/<layer>.rle.gz."""
import asyncio, base64, gzip, json, os, shutil, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "map")
ROOTS = ["world", "traffic", "BigRig", "SVC", "HOMES", "RAIL"]
KEYFP = r"""(roots)=>{ const out={}; for(const r of roots){ const R=mapRootGet(r); for(const k of Object.keys(R)) out[r+'.'+k]=mapFingerprint(['mapRootGet("'+r+'")['+JSON.stringify(k)+']'])[ 'mapRootGet("'+r+'")['+JSON.stringify(k)+']' ]; } out['trlSeq']=String(trlSeq); return out; }"""


def fmt(v, d=0):
    """JSON with one table row / list element per line near the top, compact below (keeps files diffable + editable)."""
    c = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
    pad = " " * (d + 1)
    if isinstance(v, dict) and ("$tab" in v or "$tabs" in v):
        head = {k: x for k, x in v.items() if k != "rows"}
        rows = ",\n".join(pad + " " + c(r) for r in v["rows"])
        return "{" + c(head)[1:-1] + ',"rows":[\n' + rows + "\n" + pad + "]}"
    if d < 2 and isinstance(v, dict) and len(c(v)) > 200:
        return "{\n" + ",\n".join(pad + json.dumps(k) + ": " + fmt(x, d + 1) for k, x in v.items()) + "\n" + " " * d + "}"
    if d < 2 and isinstance(v, list) and len(c(v)) > 200:
        return "[\n" + ",\n".join(pad + fmt(x, d + 1) for x in v) + "\n" + " " * d + "]"
    return c(v)


# Generator-only debug handles: never read after generation (grep src/ tests/), large, so not in the data file.
# tools/verify_map.py skips them too.
GEN_SCRATCH = {"RAIL.hard", "RAIL._CL", "RAIL._CO", "RAIL._dist", "RAIL._tgt", "RAIL._clearLine"}
# Indexes rebuilt in code on load from the stored lists (keeps key order: the loader reserves the slot).
DERIVED = {"world.chunkObjs": "worldChunkIndex"}

async def gen_page(p):
    b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = await b.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.add_init_script("window.__BIGRIG_NOBOOT=1; window.__BIGRIG_MAPGEN=1;")
    await pg.goto("file://" + os.path.join(ROOT, "index.html"))
    await pg.wait_for_function("typeof genWorldSteps==='function'")
    for f in ("mapfp.js", "mapstate.js"):
        await pg.add_script_tag(content=open(os.path.join(ROOT, "tools", f)).read())
    return b, pg, errs


async def main():
    async with async_playwright() as p:
        b, pg, errs = await gen_page(p)
        await pg.evaluate("makeTextures()")
        pre = await pg.evaluate(KEYFP, ROOTS)
        await pg.evaluate("(()=>{ for (const st of genWorldSteps()); })()")
        post = await pg.evaluate(KEYFP, ROOTS)
        parts = []
        for r in ROOTS:
            for k in await pg.evaluate("(r)=>Object.keys(mapRootGet(r))", r):
                if r + "." + k in GEN_SCRATCH:
                    continue
                if pre.get(r + "." + k) != post[r + "." + k]:
                    if r + "." + k in DERIVED:
                        parts.append({"root": r, "key": k, "derived": DERIVED[r + "." + k]})
                    else:
                        parts.append({"root": r, "key": k})
        if pre["trlSeq"] != post["trlSeq"]:
            parts.append({"root": "trlSeq", "key": None})
        data = await pg.evaluate("(parts)=>JSON.stringify(mapSerialize(parts,true))", parts)
        await b.close()
        if errs:
            print("page errors:", errs); return 1
    data = json.loads(data)
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(os.path.join(OUT, "state")); os.makedirs(os.path.join(OUT, "tiles"))
    man = {"format": "bigrig-map-state", "version": 1, "MW": None, "parts": [], "tiles": []}
    for part in data["parts"]:
        if part.get("derived"):
            man["parts"].append({"root": part["root"], "key": part["key"], "derived": part["derived"]})
            continue
        name = part["root"] + ("." + part["key"] if part["key"] is not None else "") + ".json"
        with open(os.path.join(OUT, "state", name), "w") as f:
            f.write(fmt(part["value"]) + "\n")
        man["parts"].append({"root": part["root"], "key": part["key"], "file": "state/" + name})
    for k, s in data["tiles"].items():
        with gzip.GzipFile(os.path.join(OUT, "tiles", k + ".rle.gz"), "wb", mtime=0) as f:
            f.write(base64.b64decode(s))
        man["tiles"].append(k)
    man["MW"] = 2048
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(man, f, indent=1); f.write("\n")
    print("parts", len(man["parts"]), "tiles", len(man["tiles"]), "stats", data["stats"])
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
