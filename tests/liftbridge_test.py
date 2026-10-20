# python3 tests/liftbridge_test.py BigRig.html -> both bascules: ship-timed cycle (north crossing simulated through a full
# ship passage: open before the hull arrives, fully open while it is over the span, closed again after), AI stop line,
# barrier block, fast jump lands / slow drop sinks. Prints PASS / FAIL.
import asyncio, json, sys
from playwright.async_api import async_playwright
HTML = sys.argv[1] if len(sys.argv) > 1 else "BigRig.html"
JS = r"""
async () => {
  const out = {}, B = lbBridges(), N = B.find(b => b.id === "north"), K = B.find(b => b.id === "kb");
  out.bridges = B.map(b => [b.id, b.XA, b.XB, b.Y0, (b.boats || []).length]);
  // 1) simulate the north crossing until two ships have passed: step boats + clock, audit the state each 0.25 s
  lbUse(N);
  const t0 = timeS, s0 = N.boats.map(o => o.s), rt0 = portT(), rtF = window.railTime;
  window.railTime = () => rt0 + (timeS - t0); // port clock follows the simulated clock
  let occ = 0, minTh = 1, opens = 0, wasOpen = false, preOpen = [], closedAfter = 0, steps = 0, firstOcc = -1, lastT = -1, st = [];
  let portOcc = 0, boatOcc = 0;
  for (let k = 0; k < 4 * 4200 && opens < 8; k++) {
    timeS += 0.25; for (const o of N.boats) o.s += o.v * 0.25; steps++;
    const S = lbState(), o = lbOcc(timeS, -2);
    if (lbOccPort(world.port, portT(), -2, N.L - 1)) portOcc++;
    if (lbOccBoats(N, timeS, -2)) boatOcc++;
    if (o) { occ++; minTh = Math.min(minTh, S.th); if (firstOcc < 0) firstOcc = timeS; }
    if (S.th > 0.01 && !wasOpen) { opens++; wasOpen = true; st.push({openAt: +(timeS - t0).toFixed(1)}); }
    if (S.th < 0.001 && wasOpen) { wasOpen = false; st[st.length - 1].closedAt = +(timeS - t0).toFixed(1); }
    if (o && !st.length) preOpen.push(timeS);
  }
  out.north = { steps, occSteps: occ, portOcc, boatOcc, minThWhileShipOver: +minTh.toFixed(3), cycles: st, shipBeforeOpen: preOpen.length };
  window.railTime = rtF; timeS = t0; N.boats.forEach((o, i) => o.s = s0[i]); N.st.t = -1;
  // 2) AI stop line + 3) barrier (forced lit / barriers down, leaves up)
  const res = {};
  for (const b of [N, K]) {
    lbUse(b); b.force = LB.force = { th: 1, bar: 1, lit: 1 };
    const v = Object.assign({}, traffic.vs[0], { x: (b.XA - 14) * M_T, y: (b.Y0 + 1.5) * M_T, h: Math.PI / 2, v: 12 });
    const acc = lbStopAcc(v, v.v);
    // drive the rig at the lowered barrier for 5 s: it must never get past the arm
    rigPlace({ x: (b.bar[0].x - 14) * M_T, y: (b.Y0 + 1.5) * M_T, h: Math.PI / 2 });
    let maxX = -1e9;
    for (let i = 0; i < 300; i++) { input.up = true; stepTruck(truck, input, 1 / 60); maxX = Math.max(maxX, truck.x / M_T); }
    input.up = false;
    res[b.id] = { aiAcc: +acc.toFixed(2), barrier: maxX < b.bar[0].x, maxX: +maxX.toFixed(1), barX: b.bar[0].x };
    b.force = LB.force = null;
  }
  out.stop = res;
  // 4) jump (fast) and drop (slow) on the north leaves, leaves forced part-open
  const ride = async (sp, th, x0) => {
    lbUse(N); N.force = LB.force = { th, bar: 0, lit: 1 }; LB.pl.mode = null; LB.pl.b = null;
    rigPlace({ x: (N.XA + x0) * M_T, y: (N.Y0 + 1.5) * M_T, h: Math.PI / 2 });
    truck.v = sp; let seen = {};
    for (let i = 0; i < 400; i++) {
      input.up = sp > 10; stepTruck(truck, input, 1 / 60);
      seen[LB.pl.mode || "none"] = 1;
      if (LB.pl.mode === "sink" && LB.pl.t > 0.5) break;
      if (seen.air && !LB.pl.mode) break;
    }
    input.up = false; const r = { seen: Object.keys(seen), x: +(truck.x / M_T).toFixed(1), mode: LB.pl.mode };
    N.force = LB.force = null; LB.pl.mode = null; LB.pl.z = 0; return r;
  };
  const ld = N.stats.landed, fl = N.stats.falls;
  out.fast = await ride(30, 0.35, 1);
  // creeping over the tip of a raised leaf: too slow to clear the gap
  out.slow = await ride(2, 0.3, N.L * Math.cos(0.3 * LB.AMAX) - 0.05);
  out.landed = N.stats.landed - ld; out.falls = N.stats.falls - fl;
  return out;
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + __import__("os").path.abspath(HTML)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1500)
        r = await pg.evaluate(JS); print(json.dumps(r)); print("ERRS", errs)
        n = r["north"]
        ok = (len(r["bridges"]) == 2 and n["occSteps"] > 0 and n["portOcc"] > 0 and n["boatOcc"] > 0 and n["minThWhileShipOver"] >= 0.999 and n["shipBeforeOpen"] == 0
              and all("closedAt" in c for c in n["cycles"][:-1]) and n["cycles"]
              and all(v["aiAcc"] < 0 and v["barrier"] for v in r["stop"].values())
              and r["landed"] >= 1 and r["falls"] >= 1 and not errs)
        print("PASS" if ok else "FAIL"); await b.close()
asyncio.run(main())
