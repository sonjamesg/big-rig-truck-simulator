import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    js = open(sys.argv[1]).read()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader"])
        pg = await b.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html"))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        r = await pg.evaluate(js); print(json.dumps(r, indent=None)[:60000]); print("ERRS", errs[:3]); await b.close()
asyncio.run(main())
