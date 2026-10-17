#!/usr/bin/env python3
"""Gridded reference maps of the game world (daytime game render, same chunks as fly mode / the M map).

Usage: python3 build.py && python3 tools/mapgrid.py [outdir]   (default /workspace/mapgrid)
Writes overview.png (whole map, 64-tile squares) and <city>.png (16-tile squares); with --pdf also
BigRig_Map_Grid.pdf. The zoomable offline viewer is tools/mapviewer.py.

Grid -> tile formula (also in AGENTS.md "Reference map grid"):
  column letters: A=0, B=1 .. Z=25, AA=26, AB=27 ..; rows are numbers starting at 1.
  overview square <C><R>:      tiles x = 64*col .. 64*col+63,       y = 64*(R-1) .. 64*(R-1)+63
  city square <CITY>-<C><R>:   tiles x = X0 + 16*col .. +15,         y = Y0 + 16*(R-1) .. +15
  where X0, Y0 (the page's top-left tile, a multiple of 16) are printed on that page.
  tile (tx,ty) covers world pixels tx*32 .. tx*32+31 (TILE = 32 px = 4 m).
"""
import asyncio, base64, io, json, os, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = ARGS[0] if ARGS else "/workspace/mapgrid"
MW = 2048
OV_SQ, OV_PPT = 64, 4  # overview: tiles per square, px per tile (8192 px map)
CT_SQ, CT_PPT = 16, 16  # city pages
PAD = 12  # tiles of margin around a city
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

RENDER_JS = """async ([tx0, ty0, tw, th, ppt]) => {
  // daytime game render of tiles [tx0,tx0+tw) x [ty0,ty0+th) at ppt px per tile, as a PNG data URL
  const N = CHUNK / TILE, c = document.createElement("canvas");
  c.width = tw * ppt; c.height = th * ppt;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  for (let cy = Math.floor(ty0 / N); cy * N < ty0 + th; cy++)
    for (let cx = Math.floor(tx0 / N); cx * N < tx0 + tw; cx++) {
      const dx = (cx * N - tx0) * ppt, dy = (cy * N - ty0) * ppt;
      g.drawImage(renderChunk(cx, cy), dx, dy, N * ppt, N * ppt);
      if (typeof ovlNow === "function" && ovlHits(cx * N, cy * N, cx * N + N, cy * N + N)) ovlNow(g, dx, dy, cx * N, cy * N, N, N, ppt);
    }
  return c.toDataURL("image/png");
}"""

PLACES_JS = """() => {
  const out = [], L = world.labels.filter((l) => l.length === 3);
  for (const [k, c] of Object.entries(world.cities)) {
    const x0 = c.xs[0], y0 = c.ys[0], x1 = c.X1, y1 = c.Y1;
    const lab = L.find((l) => l[1] >= x0 && l[1] <= x1 && l[2] >= y0 && l[2] <= y1);
    out.push({ name: lab ? lab[0] : k, x0, y0, x1, y1 });
  }
  // towns without a street grid (rail station towns etc.): a 100-tile box around the label / station
  const inCity = (x, y) => out.some((o) => x >= o.x0 - 20 && x <= o.x1 + 20 && y >= o.y0 - 20 && y <= o.y1 + 20);
  const extra = (typeof RAIL_ST !== "undefined" ? RAIL_ST : []).filter((s) => s[3] !== "hub" && s[3] !== "city").map((s) => [s[0], s[1], s[2]]);
  for (const [n, x, y] of extra) {
    if (inCity(x, y) || out.some((o) => o.name.toLowerCase() === n.toLowerCase())) continue;
    out.push({ name: n, x0: x - 50, y0: y - 50, x1: x + 50, y1: y + 50 });
  }
  for (const l of L) {
    if (!/^[A-Z][a-z]/.test(l[0]) || /Airport|Intl|Field|Port|Harbour|Mount|River|Pass|Road|Quarry|Reservoir/.test(l[0])) continue;
    if (inCity(l[1], l[2]) || out.some((o) => o.name.toLowerCase() === l[0].toLowerCase())) continue;
    out.push({ name: l[0], x0: l[1] - 50, y0: l[2] - 50, x1: l[1] + 50, y1: l[2] + 50 });
  }
  // Sandvale Military Base (milbase.js): its own page / city box, short grid prefix BASE-<C><R>
  const B = world.milbase;
  if (B) {
    const i = out.findIndex((o) => o.name.toLowerCase() === B.name.toLowerCase());
    if (i >= 0) out.splice(i, 1); // drop the 100-tile label box, use the real fence bounds
    out.push({ name: B.name, prefix: "BASE", x0: B.x0, y0: B.y0, x1: B.x1, y1: B.y1 });
  }
  return out;
}"""


def col(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


async def grab(pg, tx0, ty0, tw, th, ppt, band=None):
    """render in horizontal bands (keeps each data URL small) and stitch"""
    band = band or max(16, (4096 // ppt) // 16 * 16)
    img = Image.new("RGB", (tw * ppt, th * ppt))
    for y in range(0, th, band):
        h = min(band, th - y)
        url = await pg.evaluate(RENDER_JS, [tx0, ty0 + y, tw, h, ppt])
        img.paste(Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB"), (0, y * ppt))
    return img


def page_spec(name, tx0, ty0, tw, th, ppt, sq, prefix):
    return dict(name=name, tx0=tx0, ty0=ty0, tw=tw, th=th, ppt=ppt, sq=sq, prefix=prefix)


def margins(sp):
    m = max(90, sp["sq"] * sp["ppt"] // 2)
    return m, m + 70  # side margin, top margin (title)


def draw_png(img, sp, path):
    """bake the grid into a PNG: map + white-on-dark labels in the margins, thin dual-tone lines over the map"""
    ppt, sq = sp["ppt"], sp["sq"]
    m, top = margins(sp)
    W, H = img.width + 2 * m, img.height + top + m
    out = Image.new("RGB", (W, H), (24, 26, 32))
    out.paste(img, (m, top))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    f = ImageFont.truetype(FONT, max(14, min(40, sq * ppt // 6)))
    fs = ImageFont.truetype(FONT, max(11, min(22, sq * ppt // 12)))
    ft = ImageFont.truetype(FONT, 26)
    nx, ny = -(-sp["tw"] // sq), -(-sp["th"] // sq)
    for i in range(nx + 1):
        x = m + min(i * sq, sp["tw"]) * ppt
        d.line([(x, top), (x, top + img.height)], fill=(0, 0, 0, 150), width=3)
        d.line([(x, top), (x, top + img.height)], fill=(255, 235, 60, 255), width=2)
    for j in range(ny + 1):
        y = top + min(j * sq, sp["th"]) * ppt
        d.line([(m, y), (m + img.width, y)], fill=(0, 0, 0, 150), width=3)
        d.line([(m, y), (m + img.width, y)], fill=(255, 235, 60, 255), width=2)
    for i in range(nx):
        cx = m + (i * sq + sq / 2) * ppt
        for yy in (top - 8, top + img.height + 8):
            d.text((cx, yy), col(i), font=f, fill="white", anchor="md" if yy < top else "ma")
        tx = sp["tx0"] + i * sq
        d.text((m + i * sq * ppt + 3, top + img.height + 8 + f.size + 4), str(tx), font=fs, fill=(180, 200, 255), anchor="la")
    for j in range(ny):
        cy = top + (j * sq + sq / 2) * ppt
        d.text((m - 10, cy), str(j + 1), font=f, fill="white", anchor="rm")
        d.text((m + img.width + 10, cy), str(j + 1), font=f, fill="white", anchor="lm")
        d.text((m - 10, top + j * sq * ppt + 3), str(sp["ty0"] + j * sq), font=fs, fill=(180, 200, 255), anchor="ra")
    # in-square labels for city pages (small, top-left of each square, dark halo)
    if sp["prefix"]:
        for i in range(nx):
            for j in range(ny):
                d.text((m + i * sq * ppt + 4, top + j * sq * ppt + 3), sp["prefix"] + "-" + col(i) + str(j + 1), font=fs,
                       fill=(255, 255, 255, 235), stroke_width=2, stroke_fill=(0, 0, 0, 200))
    else:
        for i in range(nx):
            for j in range(ny):
                d.text((m + i * sq * ppt + 4, top + j * sq * ppt + 3), col(i) + str(j + 1), font=fs,
                       fill=(255, 255, 255, 220), stroke_width=2, stroke_fill=(0, 0, 0, 190))
    title = "%s\ntiles x %d-%d, y %d-%d | %d tiles/square | X0=%d Y0=%d" % (
        sp["name"], sp["tx0"], sp["tx0"] + sp["tw"] - 1, sp["ty0"], sp["ty0"] + sp["th"] - 1, sq, sp["tx0"], sp["ty0"])
    d.multiline_text((m, 6), title, font=ft, fill="white", spacing=4)
    out = Image.alpha_composite(out.convert("RGBA"), ov).convert("RGB")
    out.save(path, optimize=False, compress_level=6)
    return out


def pdf(pages, path):
    from reportlab.pdfgen import canvas as rc
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.colors import Color

    c = rc.Canvas(path, pageCompression=1)
    c.setTitle("Big Rig map grid")
    for sp, img in pages:
        ppt, sq = sp["ppt"], sp["sq"]
        # 1 pt per image px / 2 => page sizes stay sane; the image keeps its full resolution
        k = 0.5 if img.width > 3000 else 1.0
        m = 60
        Wm, Hm = img.width * k, img.height * k
        tf = max(20, (Wm + 2 * m) / 45)
        top = max(90, tf * 2.6)
        W, H = Wm + 2 * m, Hm + top + m
        c.setPageSize((W, H))
        c.setFillColorRGB(0.09, 0.1, 0.13)
        c.rect(0, 0, W, H, fill=1, stroke=0)
        y0 = m  # map bottom in PDF coords
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=90, subsampling=0)  # keeps the PDF a sensible size; PNGs stay lossless
        buf.seek(0)
        c.drawImage(ImageReader(buf), m, y0, Wm, Hm)
        s = sq * ppt * k
        nx, ny = -(-sp["tw"] // sq), -(-sp["th"] // sq)
        X = lambda i: m + min(i * sq, sp["tw"]) * ppt * k
        Y = lambda j: y0 + Hm - min(j * sq, sp["th"]) * ppt * k
        for w, colr in ((1.6, Color(0, 0, 0, alpha=0.55)), (0.6, Color(1, 0.92, 0.24, alpha=0.95))):
            c.setStrokeColor(colr)
            c.setLineWidth(w)
            for i in range(nx + 1):
                c.line(X(i), y0, X(i), y0 + Hm)
            for j in range(ny + 1):
                c.line(m, Y(j), m + Wm, Y(j))
        fz = max(7, min(22, s / 5))
        c.setFont("Helvetica-Bold", fz)
        c.setFillColorRGB(1, 1, 1)
        for i in range(nx):
            c.drawCentredString((X(i) + X(i + 1)) / 2, y0 + Hm + 6, col(i))
            c.drawCentredString((X(i) + X(i + 1)) / 2, y0 - fz - 4, col(i))
        for j in range(ny):
            yc = (Y(j) + Y(j + 1)) / 2 - fz / 3
            c.drawRightString(m - 6, yc, str(j + 1))
            c.drawString(m + Wm + 6, yc, str(j + 1))
        fe = max(5, fz * 0.55)
        c.setFont("Helvetica", fe)
        c.setFillColorRGB(0.7, 0.8, 1)
        for i in range(nx):
            c.drawString(X(i) + 1.5, y0 - fz - fe - 8, str(sp["tx0"] + i * sq))
        for j in range(ny):
            c.drawRightString(m - 6, Y(j) - fe - 1, str(sp["ty0"] + j * sq))
        # square labels (small, white with dark outline via text render mode 2)
        fl = max(3, min(9, s / 9))
        c.setFont("Helvetica-Bold", fl)
        for i in range(nx):
            for j in range(ny):
                lab = (sp["prefix"] + "-" if sp["prefix"] else "") + col(i) + str(j + 1)
                tw_ = c.stringWidth(lab, "Helvetica-Bold", fl)
                c.setFillColor(Color(0, 0, 0, alpha=0.6))
                c.rect(X(i) + 1, Y(j) - fl - 2, tw_ + 2, fl + 1.5, fill=1, stroke=0)
                c.setFillColorRGB(1, 1, 1)
                c.drawString(X(i) + 2, Y(j) - fl - 0.5, lab)
        c.setFont("Helvetica-Bold", tf)
        c.setFillColorRGB(1, 1, 1)
        c.drawString(m, H - tf * 1.2, sp["name"])
        c.setFont("Helvetica", tf * 0.45)
        c.drawString(m, H - tf * 1.95, "tiles x %d-%d, y %d-%d  |  %d tiles per square  |  X0=%d, Y0=%d  |  tile x = X0 + 16*col (A=0), y = Y0 + 16*(row-1)"
                     .replace("16", str(sq)) % (sp["tx0"], sp["tx0"] + sp["tw"] - 1, sp["ty0"], sp["ty0"] + sp["th"] - 1, sq, sp["tx0"], sp["ty0"]))
        c.showPage()
    c.save()


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 1280, "height": 720})
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html"))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world&&__bigrig.world.ready", timeout=600000, polling=500)
        places = await pg.evaluate(PLACES_JS)
        pages = []
        print("overview...", flush=True)
        ov = await grab(pg, 0, 0, MW, MW, OV_PPT)
        sp = page_spec("BIG RIG - WHOLE MAP", 0, 0, MW, MW, OV_PPT, OV_SQ, "")
        pages.append((sp, ov))
        draw_png(ov, sp, os.path.join(OUT, "overview.png"))
        for pl in places:
            x0 = max(0, (pl["x0"] - PAD) // CT_SQ * CT_SQ)
            y0 = max(0, (pl["y0"] - PAD) // CT_SQ * CT_SQ)
            x1 = min(MW, -(-(pl["x1"] + PAD) // CT_SQ) * CT_SQ)
            y1 = min(MW, -(-(pl["y1"] + PAD) // CT_SQ) * CT_SQ)
            name = pl["name"].upper()
            pref = pl.get("prefix") or name.replace(" ", "")
            print(name, x0, y0, x1, y1, flush=True)
            img = await grab(pg, int(x0), int(y0), int(x1 - x0), int(y1 - y0), CT_PPT)
            sp = page_spec(name, int(x0), int(y0), int(x1 - x0), int(y1 - y0), CT_PPT, CT_SQ, pref)
            pages.append((sp, img))
            draw_png(img, sp, os.path.join(OUT, pref.lower() + ".png"))
        await b.close()
    json.dump([s for s, _ in pages], open(os.path.join(OUT, "pages.json"), "w"), indent=1)
    if "--pdf" in sys.argv:  # optional: large (~60 MB); the HTML viewer (tools/mapviewer.py) replaces it
        pdf(pages, os.path.join(OUT, "BigRig_Map_Grid.pdf"))
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
