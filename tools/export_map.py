#!/usr/bin/env python3
"""Export the generated world to src/map/: map.json (labelled entities) + tiles/<layer>.rle.gz (exact tile grids).
Usage: python3 build.py && python3 tools/export_map.py [--check]
--check: re-decode every tile layer and compare its FNV-1a hash with the live world (exactness), no write if it fails."""
import asyncio, base64, gzip, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "map")


def unrle(data, n, signed):
    out, i, vals = bytearray(), 0, []
    import array
    a = array.array("h" if signed == 2 else ("i" if signed == 4 else "B"))
    def rd():
        nonlocal i
        r = s = 0
        while True:
            b = data[i]; i += 1; r |= (b & 127) << s; s += 7
            if b < 128: return r
    while i < len(data):
        v = rd(); c = rd()
        if signed: v = v // 2 if v % 2 == 0 else -(v + 1) // 2
        a.extend([v] * c)
    assert len(a) == n, (len(a), n)
    return a.tobytes()


def fnv(b):
    h = 0x811C9DC5
    for x in b:
        h ^= x; h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "x")


async def main():
    js = open(os.path.join(ROOT, "tools", "map_export.js")).read()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page()
        await pg.goto("file://" + os.path.join(ROOT, "index.html"))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=240000)
        data = json.loads(await pg.evaluate(js))
        await b.close()
    os.makedirs(os.path.join(OUT, "tiles"), exist_ok=True)
    ok = True
    layers = {}
    for k, L in data["layers"].items():
        raw = base64.b64decode(L["rle_b64"])
        sz = {"Int16Array": 2, "Int32Array": 4}.get(L["type"], 0)
        exact = unrle(raw, L["len"], sz)
        good = fnv(exact) == L["fnv1a"]
        ok &= good
        print(f"layer {k:10s} {L['type']:11s} rle {len(raw):9d} B  exact={'yes' if good else 'NO'}")
        layers[k] = {"type": L["type"], "len": L["len"], "fnv1a": L["fnv1a"], "file": f"tiles/{k}.rle.gz"}
        if "--check" not in sys.argv:
            with gzip.GzipFile(os.path.join(OUT, "tiles", k + ".rle.gz"), "wb", mtime=0) as f:
                f.write(raw)
    if not ok:
        print("EXACTNESS CHECK FAILED"); return 1
    if "--check" in sys.argv:
        return 0
    doc = {"meta": data["meta"], "layers": layers, "entities": data["entities"]}
    with open(os.path.join(OUT, "map.json"), "w") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("wrote", os.path.relpath(OUT, ROOT), {k: len(v) if isinstance(v, list) else 1 for k, v in data["entities"].items()})
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
