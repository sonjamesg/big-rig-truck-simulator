#!/usr/bin/env python3
"""Offline zoomable map viewer: one self-contained HTML file (no server), daytime game render as a WebP tile pyramid.

Usage: python3 build.py && python3 tools/mapviewer.py [out.html]   (default /workspace/mapgrid/BigRig_Map_Viewer.html)
Grid labels match tools/mapgrid.py and AGENTS.md "Reference map grid":
  overview square <C><R> (64 tiles):  x = 64*col .. +63, y = 64*(R-1) .. +63   (A=0, B=1 .. Z=25, AA=26)
  city square <CITY>-<C><R> (16 tiles): x = X0 + 16*col .. +15, y = Y0 + 16*(R-1) .. +15  (X0,Y0 shown in the viewer)
"""
import asyncio, base64, io, json, os, sys
from playwright.async_api import async_playwright
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapgrid import RENDER_JS, PLACES_JS, MW, CT_SQ, PAD, ROOT  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
OUT = sys.argv[1] if len(sys.argv) > 1 else "/workspace/mapgrid/BigRig_Map_Viewer.html"
TOP_PPT = int(os.environ.get("MAPVIEW_PPT", "8"))  # px per tile at the most detailed level
Q = int(os.environ.get("MAPVIEW_Q", "70"))
TS = 512  # tile image size


def webp(im):
    b = io.BytesIO()
    im.save(b, "WEBP", quality=Q, method=6)
    return base64.b64encode(b.getvalue()).decode()


async def main():
    tiles = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await br.new_page(viewport={"width": 1280, "height": 720})
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html"))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world&&__bigrig.world.ready", timeout=600000, polling=500)
        places = await pg.evaluate(PLACES_JS)
        labels = await pg.evaluate("world.labels.map((l)=>[l[0],Math.round(l[1]),Math.round(l[2]),l[3]||0])")
        half = TOP_PPT // 2
        base = Image.new("RGB", (MW * half, MW * half))  # next level down, filled band by band
        band = TS // TOP_PPT  # tiles per band = one row of tile images
        lv = 0
        n = MW * TOP_PPT // TS
        for by in range(n):
            url = await pg.evaluate(RENDER_JS, [0, by * band, MW, band, TOP_PPT])
            im = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
            for bx in range(n):
                tiles["%d/%d/%d" % (TOP_PPT, bx, by)] = webp(im.crop((bx * TS, 0, bx * TS + TS, TS)))
            base.paste(im.resize((im.width // 2, im.height // 2), Image.LANCZOS), (0, by * TS // 2))
            if by % 8 == 0:
                print("band", by, "/", n, flush=True)
        await br.close()
    levels = [TOP_PPT]
    ppt, im = half, base
    while True:
        levels.append(ppt)
        k = -(-im.width // TS)
        for x in range(k):
            for y in range(k):
                tiles["%g/%d/%d" % (ppt, x, y)] = webp(im.crop((x * TS, y * TS, min(im.width, x * TS + TS), min(im.height, y * TS + TS))))
        if im.width <= TS:
            break
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        ppt = ppt / 2
    cities = []
    for pl in places:
        x0 = max(0, (pl["x0"] - PAD) // CT_SQ * CT_SQ)
        y0 = max(0, (pl["y0"] - PAD) // CT_SQ * CT_SQ)
        x1 = min(MW, -(-(pl["x1"] + PAD) // CT_SQ) * CT_SQ)
        y1 = min(MW, -(-(pl["y1"] + PAD) // CT_SQ) * CT_SQ)
        nm = pl["name"].upper()
        cities.append({"name": nm, "prefix": nm.replace(" ", ""), "x0": int(x0), "y0": int(y0), "x1": int(x1), "y1": int(y1)})
    data = {"MW": MW, "TS": TS, "levels": levels, "cities": cities, "labels": labels, "sq": 64, "csq": CT_SQ}
    html = open(os.path.join(ROOT, "tools", "mapviewer.html")).read()
    html = html.replace("/*DATA*/", "const D=" + json.dumps(data) + ";\nconst T=" + json.dumps(tiles, separators=(",", ":")) + ";")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w").write(html)
    print("tiles", len(tiles), "levels", levels, "size", os.path.getsize(OUT))


if __name__ == "__main__":
    asyncio.run(main())
