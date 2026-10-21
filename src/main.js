/**
 * @file main.js — MAIN: staged world generation + loading bar, game loop (update/draw), camera, HUD, minimap + full map (M), input, window.__bigrig debug hook
 * Exposes (globals): PORTRAIT_SQ, VW, VW0, cv, input, cam, started, CABART, LOADMS, bootYield,
 *   boot, KEYMAP, welcomeCard, startGame, ukjxPed, drawUkjx (+44 more)
 * Depends on: world.js, ltg.js (ltgUpdate, ltgDraw, ltgHUD, ltgPlate), render.js, lorry.js, physics.js, traffic.js, depots.js, fuel.js,
 *   sites.js, career.js, ui.js, satnav.js, gamepad.js, mp.js, mobile.js, breakdown.js, rail.js,
 *   police.js, server.js
 * Load order: #42 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== MAIN =====================
const PORTRAIT_SQ =
  ("ontouchstart" in window || navigator.maxTouchPoints > 0) && innerHeight > innerWidth; // portrait phones: square view, HUD relatively larger
let VW = PORTRAIT_SQ ? 640 : 960,
  VH = PORTRAIT_SQ ? 640 : 600;
const VW0 = VW,
  VH0 = VH;
{
  const c = document.getElementById("game");
  if (c && PORTRAIT_SQ) {
    c.width = VW;
    c.height = VH;
  }
}
const cv = document.getElementById("game"),
  ctx = cv.getContext("2d");
const input = { up: false, down: false, left: false, right: false, hand: false, horn: false };
const cam = { x: 0, y: 0, z: 1, shake: 0 };
let started = false,
  last = 0,
  acc = 0,
  timeS = 0,
  fps = 60,
  fpsAcc = 0,
  fpsN = 0,
  wasBraking = 0;
let CABART, TRLART, CABSH, TRLSH;
// v27: world generation runs in stages (genWorldSteps yields a stage name), handing back to the browser between them so the
// green loading bar really paints. LOADMS = measured time per stage on a desktop; progress = finished stages + time spent in
// the current one (capped below its share), so the % tracks real work on slower phones too.
const LOADMS = {
  "Painting textures": 22,
  "Shaping coastline & terrain": 1187,
  "Painting beaches": 1075,
  "Laying roads": 7,
  "Placing cities & towns": 23,
  "Connecting towns": 11,
  "Building country roads": 291,
  "Building junctions": 96,
  "Raising buildings": 36,
  "Building the docks": 8,
  "Building airports": 9,
  "Planting farmland": 22,
  "Growing forests": 604,
  "Launching boats": 4,
  "Carving kerbs": 24,
  "Installing traffic lights": 7,
  "Painting road markings": 26,
  "Building depots & shops": 181,
  "Building fuel stations": 76,
  "Building garages": 445,
  "Building city fuel & garages": 1646,
  "Parking trailers": 190,
  "Finishing towns": 164,
  "Routing the railway": 6345,
  "Laying the railway": 20,
  "Placing stations": 56,
  "Surveying the track": 29,
  "Clearing the rail corridor": 53,
  "Building level crossings": 26,
  "Building rail bridges": 6,
  "Writing the timetable": 42,
  "Clearing roadsides": 1100,
  "Drawing the map": 93,
  "Spawning traffic": 48,
  "Fuelling your truck": 19,
  // map data path (mapload.js) instead of the generator stages
  "Loading the map": 300,
  "Building the map": 600,
};
// stages run when the world comes from src/map/ (MAP_DATA) instead of genWorldSteps()
const LOADMS_MAP = [
  "Painting textures",
  "Loading the map",
  "Building the map",
  "Drawing the map",
  "Spawning traffic",
  "Fuelling your truck",
];
function bootYield() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}
async function boot() {
  const tb = performance.now(),
    tim = {},
    order = [];
  const useMap = typeof mapAvailable === "function" && mapAvailable();
  const tot =
    Object.keys(LOADMS)
      .filter((k) =>
        useMap ? LOADMS_MAP.includes(k) : k !== "Loading the map" && k !== "Building the map",
      )
      .reduce((a, k) => a + LOADMS[k], 0) || 1;
  let doneMs = 0,
    cur = null,
    curT = tb,
    shown = 0,
    lastY = 0;
  const show = (txt) => {
    const exp = LOADMS[cur] || 0,
      el = performance.now() - curT;
    const p = Math.min(99, ((doneMs + Math.min(exp * 0.95, el * (exp ? 1 : 0))) / tot) * 100);
    shown = Math.max(shown, p);
    if (typeof homeProgress === "function") homeProgress(shown, txt);
  };
  const stage = async (name) => {
    const n = performance.now();
    if (name !== cur) {
      if (cur !== null) {
        tim[cur] = (tim[cur] || 0) + (n - curT);
        doneMs += LOADMS[cur] || 0;
      }
      cur = name;
      curT = n;
      order.push(name);
    }
    if (performance.now() - lastY < 13) return;
    show(name + "\u2026");
    await bootYield();
    lastY = performance.now();
  };
  await stage("Painting textures");
  makeTextures();
  let gen = !useMap;
  if (useMap) {
    // world state from the map data file (src/map/); ?mapgen=1 runs the old generator instead
    try {
      await mapLoadWorld(stage);
    } catch (e) {
      MAPLOAD.err = String((e && e.stack) || e);
      if (MAPLOAD.touched) {
        // world half-overwritten: start again on the generator
        console.error("map data failed to decode, reloading with the generator:", e);
        const q = location.search ? location.search + "&mapgen=1" : "?mapgen=1";
        location.replace(location.pathname + q + location.hash);
        return;
      }
      console.warn("map data unavailable, generating the world instead:", e);
      gen = true;
    }
  }
  if (gen) {
    await stage("Shaping coastline & terrain");
    for (const st of genWorldSteps()) await stage(st);
  }
  await stage("Drawing the map");
  makeMinimap();
  if (typeof railMinimap === "function") railMinimap();
  await stage("Spawning traffic");
  initParked();
  await stage("Fuelling your truck");
  CABART = makeCabArt("#d63b2f");
  TRLART = makeTrailerArt();
  CABSH = silhouette(CABART);
  TRLSH = silhouette(TRLART);
  truck.trl = makeTrailer("box", mulberry(9), {
    type: "player",
    id: "TR-0000",
    typeName: "Box van (Big Rig)",
    cargo: "General freight",
    cargoKg: 7000,
    tareKg: 7500,
    weight: 14500,
    reqLevel: 1,
    coupled: true,
  });
  world.trailers.push(truck.trl);
  const st = world.start;
  truck.x = st.x / PPM;
  truck.y = st.y / PPM;
  truck.h = st.h;
  truck.th = st.h;
  cam.x = st.x;
  cam.y = st.y;
  window.__bigrig = {
    RAIL,
    railSelfTest,
    railHead,
    railTime,
    railCrossState,
    NAV,
    setRoute,
    clearRoute,
    mBX,
    mBY,
    truck,
    input,
    world,
    cam,
    bigmap,
    openMap,
    closeMap,
    onRoadM,
    kingpin,
    traffic,
    toggleRefuel,
    fuelStationAt,
    refuel,
    get loadMs() {
      return world.loadMs;
    },
    spawnVehicle,
    toggleCouple,
    coupleCandidate,
    trailerInBay,
    BigRig,
    get fps() {
      return fps;
    },
    chunks: chunkCache,
  };
  truck.fuel = 260;
  truck.tank = 400;
  truck.money = 5000; // v45: new players start with £5,000 (existing saves keep their own balance via loadGame)
  truck.damage = 0;
  const hadSave = loadGame();
  if (!hadSave) applyModel("rigger");
  uiInit();
  padInstall();
  mpInit();
  mobInit();
  Object.assign(window.__bigrig, {
    BREAKDOWN,
    MP,
    mpHost,
    mpJoin,
    mpChatSend,
    startGame,
    getChunk,
    renderChunk,
    MAPC,
    drawMapDetail,
    pad,
    padUpdate,
    career,
    acceptJob,
    abandonJob,
    tryUnload,
    bayAlign,
    buyTruck,
    openBoard,
    openDealer,
    closeUI,
    fcv,
    addXP,
    saveGame,
    loadGame,
    applyModel,
    TRUCK_MODELS,
    TIERS,
    CARGOS,
    levelOf,
    uncouple,
    couple,
    fillBoard,
    jobRoute,
  });
  tim[cur] = performance.now() - curT;
  world.loadMs = performance.now() - tb;
  if (typeof rbApprFix === "function") rbApprFix(); // v51 roundabout approach lanes: left / ahead / right on 3 lanes
  world.ready = true;
  window.__bigrig.loadStages = tim;
  if (typeof homeProgress === "function")
    homeProgress(100, "World ready (" + (world.loadMs / 1000).toFixed(1) + " s)");
  else {
    const ld = document.getElementById("loading");
    if (ld) ld.textContent = "World ready";
  }
  if (hadSave) welcomeCard();
  requestAnimationFrame(frame);
}
// ---------- input
const KEYMAP = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "hand",
  KeyH: "horn",
};
function welcomeCard() {
  const ov = document.getElementById("overlay");
  if (!ov || document.getElementById("wbCard")) return;
  const nm = (localStorage.getItem("bigrig.name") || "driver").replace(/[<>"&]/g, "");
  const c = document.createElement("div");
  c.id = "wbCard";
  c.style.cssText =
    "margin:14px auto;padding:14px 18px;max-width:340px;border-radius:12px;background:rgba(15,21,34,.92);border:1px solid rgba(245,184,46,.5);text-align:center;font-family:inherit";
  c.innerHTML = `<div style="font-size:20px;font-weight:900;color:#f5b82e">Welcome back, ${nm}</div><div style="font-size:12px;opacity:.8;margin:4px 0 10px">${money(truck.money)} \u2022 Level ${levelOf ? levelOf(career.xp) : ""} \u2022 ${modelById(career.cur).name}${career.active ? " \u2022 job in progress" : ""}</div><button id="wbGo" style="font:inherit;font-weight:900;padding:9px 26px;border-radius:9px;border:2px solid #fff;background:#f5b82e;color:#111;cursor:pointer">CONTINUE \u24B6</button> <button id="wbNew" style="font:inherit;padding:9px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#ddd;cursor:pointer">Reset progress</button>`;
  const go = ov.querySelector(".go");
  (go || ov).after ? go.after(c) : ov.appendChild(c);
  const b = c.querySelector("#wbGo");
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });
  b.focus();
  const n = c.querySelector("#wbNew");
  n.addEventListener("click", (e) => {
    e.stopPropagation();
    if (n.dataset.arm) {
      resetGame();
      return;
    }
    n.dataset.arm = 1;
    n.textContent = "Click again to wipe save";
    n.style.color = "#ff8a7a";
  });
  n.addEventListener("keydown", (e) => e.stopPropagation());
}
function startGame() {
  if (started || !world.ready) return;
  started = true;
  document.getElementById("overlay").classList.add("hidden");
  initAudio();
}
addEventListener("keydown", (e) => {
  const k = KEYMAP[e.code];
  if (k) {
    input[k] = true;
    e.preventDefault();
  }
  if (
    !started &&
    (k || e.code === "Enter") &&
    !(
      e.target &&
      e.target.closest &&
      e.target.closest("input,textarea,select,button,#invite,#acct,#srvCard")
    )
  )
    startGame();
  else if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
});
addEventListener("keydown", (e) => {
  if ((e.code === "KeyT" || e.code === "KeyC") && started && !e.repeat) {
    toggleCouple();
    e.preventDefault();
  }
  if (e.code === "KeyF" && started && !e.repeat) {
    toggleRefuel();
    e.preventDefault();
  }
});
addEventListener("keyup", (e) => {
  const k = KEYMAP[e.code];
  if (k) {
    input[k] = false;
    e.preventDefault();
  }
});
addEventListener("blur", () => {
  for (const k in input) input[k] = false;
});
// home: only a mouse click on empty space starts (touch must scroll freely; PLAY SOLO / CONTINUE / TAP TO DRIVE start on phones)
document.getElementById("overlay").addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") return;
  if (
    e.target.closest &&
    e.target.closest(
      "button,input,select,textarea,a,label,#wbCard,#acct,#lobby,#invite,#setPanel,#srvCard",
    )
  )
    return;
  e.preventDefault();
  startGame();
});
document.querySelectorAll("[data-k]").forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => {
      e.preventDefault();
      input[k] = true;
      b.classList.add("on");
    },
    off = (e) => {
      e.preventDefault();
      input[k] = false;
      b.classList.remove("on");
    };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
  b.addEventListener("pointerleave", off);
});
document.getElementById("fbtn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (started) toggleRefuel();
});
document.getElementById("tbtn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (started) toggleCouple();
});
if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.body.classList.add("touch");
document.getElementById("fs").addEventListener("click", () => {
  const f = document.getElementById("frame");
  if (!document.fullscreenElement) (f.requestFullscreen || f.webkitRequestFullscreen).call(f);
  else document.exitFullscreen();
});
// desktop: scale the 960x600 window (title bar + frame) up or down to fill the viewport, legend below at its own size.
// RSF = canvas backing pixels per logical pixel (CSS scale x devicePixelRatio, capped) so the bigger frame stays sharp;
// every main-canvas setTransform multiplies by it. Phones (body.touch) keep RSF 1 and their own layout (mobile.js).
let RSF = 1;
function setRSF(r) {
  r = Math.round(r * 100) / 100;
  const w = Math.round(VW * r),
    h = Math.round(VH * r);
  RSF = r;
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
}
function fit() {
  if (document.body.classList.contains("touch")) return;
  const wrap = document.getElementById("wrap"),
    st = document.getElementById("stage"),
    sc = document.getElementById("scaler"),
    lg = document.getElementById("legend"),
    fr = document.getElementById("frame");
  const core = sc.offsetHeight || 680, // title bar + frame, unscaled
    B = document.body;
  // legend below the frame (compact rows) ...
  B.classList.remove("lgs");
  let s = 1;
  for (let i = 0; i < 2; i++) {
    wrap.style.setProperty("--s", s); // legend wraps to the scaled width: measure, then refit
    const lh = lg ? lg.offsetHeight + 4 : 0;
    s = Math.max(0.3, Math.min((innerWidth - 16) / 984, (innerHeight - 16 - lh) / core));
  }
  // ... or beside it (wide viewports: the frame then uses the full height); keep whichever gives the bigger frame
  B.classList.add("lgs");
  const ss = Math.min((innerWidth - 16 - 262) / 984, (innerHeight - 16) / core);
  if (!lg || ss <= s || lg.offsetHeight + 60 > innerHeight) B.classList.remove("lgs");
  else s = ss;
  wrap.style.setProperty("--s", s);
  st.style.height = Math.round(core * s) + "px";
  const fs = document.fullscreenElement === fr,
    css = fs ? Math.min(innerWidth, innerHeight * 1.6) : VW * s;
  setRSF(Math.max(1, Math.min(2, (css * (devicePixelRatio || 1)) / VW)));
}
addEventListener("resize", fit);
document.addEventListener("fullscreenchange", fit);
fit();
// refit when the legend changes size (ui.js pad/keyboard legend switch, late styles / fonts)
{
  const lg = document.getElementById("legend");
  let q = 0;
  if (lg && typeof ResizeObserver === "function")
    new ResizeObserver(() => {
      if (!q) q = requestAnimationFrame(() => ((q = 0), fit()));
    }).observe(lg);
}
// ---------- loop
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000 || 0.016);
  last = ts;
  timeS += dt;
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 0.5) {
    fps = fpsN / fpsAcc;
    fpsAcc = 0;
    fpsN = 0;
  }
  padUpdate(dt);
  updateMP(dt);
  const paused = uiBlocking();
  if (started && paused && typeof updateHorn === "function") updateHorn(truck, BD_IN); // horn previews in menus
  if (started && !paused) {
    acc += dt;
    const H = 1 / 120;
    const inp = input;
    while (acc >= H) {
      stepTruck(truck, BREAKDOWN.active || (typeof FLY !== "undefined" && FLY.on) ? BD_IN : inp, H);
      acc -= H;
    }
    // air brake hiss on release after a firm stop / handbrake
    const braking = truck.brake > 0;
    if (braking) wasBraking += dt;
    else {
      if (wasBraking > 0.6 && Math.abs(truck.v) < 6) airHiss();
      wasBraking = 0;
    }
    if (truck.bump > 0.01 && !truck._bumped) {
      thump(truck.bump);
      if (truck.bump > 0.25 && typeof noiseBurst === "function")
        noiseBurst(0.22, 900, 1.5, 0.5 * truck.bump); // crunch
      cam.shake = truck.bump * 10;
      truck._bumped = true;
    }
    if (truck.bump <= 0.01) truck._bumped = false;
    updateAudio(truck, inp, timeS);
    updateAudioExtra(truck, dt);
  }
  if (!paused) {
    updateTraffic(dt);
    updateFuel(dt);
    updateForecourts(dt);
    if (started) updateCareer(dt);
    if (started) updateIndicators(dt);
    updateFX(dt);
  }
  updatePort(dt);
  mbUpdate(dt);
  hlUpdate(dt);
  bmUpdate(dt);
  {
    const z = cam.z;
    updateAmbient(dt, [
      cam.x - VW / 2 / z,
      cam.y - VH / 2 / z,
      cam.x + VW / 2 / z,
      cam.y + VH / 2 / z,
    ]);
  }
  if (started && !paused) updateNav(dt);
  if (truck.bump > 0.05 && !truck._dmg) {
    // v51: damage from the normal impact speed (m/s): ~2 at 22 mph, ~7 at 45 mph, ~14 at 67 mph; glancing hits less
    const hv = truck.hitV || truck.bump * 10;
    truck.hitV = 0;
    truck.damage = Math.min(
      100,
      truck.damage + Math.min(25, 0.06 * Math.pow(hv, 1.6)) * (truck.dmgM || 1),
    );
    truck._dmg = true;
  }
  if (truck.bump <= 0.01) truck._dmg = false;
  updateBreakdown(dt);
  ltgUpdate(dt);
  if (typeof czTick === "function") czTick();
  updateDayNight(dt, started && !paused);
  updateWeather(dt, started && !paused);
  // camera: look-ahead + zoom-out with speed
  const f = fwd(truck.h),
    sp = Math.abs(truck.v);
  const kp = kingpin(truck);
  const mid = [(truck.x - f[0] * 1.9) * PPM, (truck.y - f[1] * 1.9) * PPM];
  const tx = mid[0] + f[0] * truck.v * PPM * 1.3,
    ty = mid[1] + f[1] * truck.v * PPM * 1.3;
  const k = 1 - Math.exp(-dt * 3);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  if (window.__camHold) {
    cam.x = __camHold[0];
    cam.y = __camHold[1];
  } // test/debug: hold the camera on a spot
  const zt = cam.zLock || 1.05 - 0.33 * Math.min(1, sp / 24);
  cam.z += (zt - cam.z) * (1 - Math.exp(-dt * 1.2));
  cam.shake *= Math.exp(-dt * 8);
  if (typeof flyCamTick === "function") flyCamTick(dt);
  if (typeof ovlFlush === "function") ovlFlush(bigmap.open ? 12 : 3);
  draw();
  requestAnimationFrame(frame);
}
function draw() {
  const z = cam.z;
  const sx = (Math.random() - 0.5) * cam.shake,
    sy = (Math.random() - 0.5) * cam.shake;
  const vx0 = cam.x - VW / 2 / z,
    vy0 = cam.y - VH / 2 / z,
    vx1 = cam.x + VW / 2 / z,
    vy1 = cam.y + VH / 2 / z;
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  ctx.fillStyle = "#5d9b3a";
  ctx.fillRect(0, 0, VW, VH);
  const zr = z * RSF;
  ctx.setTransform(zr, 0, 0, zr, (VW / 2 - cam.x * z + sx) * RSF, (VH / 2 - cam.y * z + sy) * RSF);
  ctx.imageSmoothingEnabled = true;
  let budget = started ? 2 : 99;
  const c0x = Math.floor(vx0 / CHUNK),
    c1x = Math.floor(vx1 / CHUNK),
    c0y = Math.floor(vy0 / CHUNK),
    c1y = Math.floor(vy1 / CHUNK);
  for (let cy = c0y; cy <= c1y; cy++)
    for (let cx = c0x; cx <= c1x; cx++) {
      let c;
      if (z < 0.34) {
        c = getChunkLo(cx, cy, false);
        if (!c && budget > 0) {
          c = getChunkLo(cx, cy, true);
          budget--;
        }
      } else {
        c = getChunk(cx, cy, false);
        if (!c && budget > 0) {
          c = getChunk(cx, cy, true);
          budget--;
        }
        if (!c) c = chunkLo.get(cx + "," + cy);
      }
      if (c) ctx.drawImage(c, cx * CHUNK, cy * CHUNK, CHUNK + 0.5, CHUNK + 0.5);
    }
  // pre-bake a ring of chunks round the view (leftover budget, travel side first) so buildings, whose 3D roofs and
  // walls need every chunk under their footprint, are ready before they reach the screen edge (they used to pop in)
  if (budget > 0 && z >= 0.34) chunkRing(c0x, c1x, c0y, c1y, budget);
  try {
    drawPuddles(vx0, vy0, vx1, vy1, z);
  } catch (e) {}
  drawFXLow(vx0, vy0, vx1, vy1); // v50: skid marks are a ground decal: over the road paint, under every vehicle/ped/prop
  const VR = [vx0, vy0, vx1, vy1];
  drawAmbientLow(VR);
  drawNavWorld();
  drawCareerWorld(vx0, vy0, vx1, vy1);
  ltgDraw(vx0, vy0, vx1, vy1);
  drawParkedTrailers(vx0, vy0, vx1, vy1);
  hlDrawPads(vx0, vy0, vx1, vy1);
  drawTraffic(vx0, vy0, vx1, vy1);
  mbDrawLow(vx0, vy0, vx1, vy1);
  bmDrawLow(vx0, vy0, vx1, vy1);
  drawPortLow(vx0, vy0, vx1, vy1);
  drawRemotePlayers(vx0, vy0, vx1, vy1);
  if (typeof drawParkedTrucks === "function") drawParkedTrucks(vx0, vy0, vx1, vy1);
  drawBreakdown();
  drawLorry();
  if (
    !truck.foLay &&
    world.foZ &&
    world.foZ[idx(Math.floor(truck.x / M_T), Math.floor(truck.y / M_T))]
  )
    drawFlyovers(vx0, vy0, vx1, vy1, 0.72);
  drawRail(vx0, vy0, vx1, vy1);
  drawFXHigh();
  drawPortHigh(vx0, vy0, vx1, vy1);
  for (const o of world.overhead)
    if (o.x > vx0 - 400 && o.x < vx1 + 400 && o.y > vy0 - 400 && o.y < vy1 + 400) drawOverhead(o);
  drawAmbientHigh(VR);
  mbDrawHigh(vx0, vy0, vx1, vy1);
  hlDrawHigh(vx0, vy0, vx1, vy1);
  bmDrawHigh();
  drawWeather(vx0, vy0, vx1, vy1, z);
  drawNight(vx0, vy0, vx1, vy1, z);
  mbDrawNight(vx0, vy0, vx1, vy1);
  hlDrawNight(vx0, vy0, vx1, vy1);
  drawStreetLamps(vx0, vy0, vx1, vy1);
  drawSigNight();
  drawPortNight(vx0, vy0, vx1, vy1);
  if (typeof ptYardCounter === "function") ptYardCounter(vx0, vy0, vx1, vy1);
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  drawHUD();
  bmHUD();
  ltgHUD();
  if (bigmap.open) {
    drawBigMap();
    drawPadMapCursor();
  }
}
function blit(art, mx, my, ang, dx = 0, dy = 0) {
  ctx.save();
  ctx.translate(mx * PPM + dx, my * PPM + dy);
  ctx.rotate(ang);
  ctx.drawImage(
    art.c,
    -art.ox / ART_SCALE,
    -art.oy / ART_SCALE,
    art.W / ART_SCALE,
    art.H / ART_SCALE,
  );
  ctx.restore();
}
// coupled artic layering: tractor chassis + fifth wheel (behind the cab body) draw UNDER the trailer, cab body over the trailer nose
function cabLayers(a) {
  if (a.rear) return a;
  const Ys = Math.round(a.oy - 1.0 * PPM * ART_SCALE);
  const mk = (top) => {
    const c = mkCanvas(a.W, a.H),
      g = c.getContext("2d");
    g.save();
    g.beginPath();
    top ? g.rect(0, 0, a.W, Ys) : g.rect(0, Ys, a.W, a.H - Ys);
    g.clip();
    g.drawImage(a.c, 0, 0);
    g.restore();
    return { c, W: a.W, H: a.H, ox: a.ox, oy: a.oy };
  };
  a.front = mk(true);
  a.rear = mk(false);
  return a;
}
function drawRig(art, sh, x, y, h, trl, kx, ky, th, shOff) {
  if (!trl) {
    blit(sh, x, y, h, shOff, shOff);
    blit(art, x, y, h);
    return;
  }
  const L = cabLayers(art);
  drawTrailerAt(trl, kx, ky, th, true);
  blit(sh, x, y, h, shOff, shOff);
  blit(L.rear, x, y, h);
  drawTrailerAt(trl, kx, ky, th, false);
  blit(L.front, x, y, h);
}
function drawLorry() {
  const s = truck,
    k = kingpin(s);
  if (s.trl) {
    drawTrailerAt(s.trl, k[0], k[1], s.th, true);
    blit(CABSH, s.x, s.y, s.h, 5, 5);
    blit(cabLayers(CABART).rear, s.x, s.y, s.h);
    drawTrailerAt(s.trl, k[0], k[1], s.th, false);
  } else blit(CABSH, s.x, s.y, s.h, 5, 5);
  // brake / reverse lights
  const ft = fwd(s.th),
    rt = rgt(s.th);
  if (s.trl && (s.brake > 0 || s.mode === "R")) {
    const rx = (k[0] - ft[0] * 12.45) * PPM,
      ry = (k[1] - ft[1] * 12.45) * PPM;
    ctx.fillStyle =
      s.mode === "R" && s.brake === 0 ? "rgba(255,255,230,0.55)" : "rgba(255,40,30,0.6)";
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(rx + rt[0] * sd * 8, ry + rt[1] * sd * 8, 6, 0, 7);
      ctx.fill();
    }
  }
  // front wheels (steered)
  const f = fwd(s.h),
    r = rgt(s.h);
  const fx = s.x + f[0] * CAB.wheelbase,
    fy = s.y + f[1] * CAB.wheelbase;
  for (const sd of [-1, 1]) {
    ctx.save();
    ctx.translate((fx + r[0] * sd * 1.12) * PPM, (fy + r[1] * sd * 1.12) * PPM);
    ctx.rotate(s.h + s.steer);
    ctx.fillStyle = "#141414";
    ctx.fillRect(-2.2, -4.5, 4.4, 9);
    ctx.restore();
  }
  blit(s.trl ? cabLayers(CABART).front : CABART, s.x, s.y, s.h);
  indLampsAt(s.x, s.y, s.h, !!s.trl, k[0], k[1], s.th, IND.side, IND.haz);
  // headlight beams at night? (daytime build) - small DRL dots
  ctx.fillStyle = "rgba(255,250,220,0.9)";
  for (const sd of [-1, 1]) {
    const hx = (s.x + f[0] * 5.0 + r[0] * sd * 1.0) * PPM,
      hy = (s.y + f[1] * 5.0 + r[1] * sd * 1.0) * PPM;
    ctx.fillRect(hx - 1.5, hy - 1.5, 3, 3);
  }
}
// v12 suspension bridge: cable height profile (0 deck .. 1 tower top), sun from the NW so shadows fall to the SE
function suspH(S, u) {
  if (u <= S.t0) return Math.max(0, (u - S.r0) / (S.t0 - S.r0));
  if (u >= S.t1) return Math.max(0, (S.r1 - u) / (S.r1 - S.t1));
  const m = (S.t0 + S.t1) / 2,
    k = (u - m) / ((S.t1 - S.t0) / 2);
  return 0.12 + 0.88 * k * k;
}
const SUSP_K = 150,
  SUSP_COL = "#c4402b";
function suspP(S, u, v) {
  return S.dir === "h" ? [u * TILE, v * TILE] : [v * TILE, u * TILE];
}
function drawSusp(o) {
  const S = o.S,
    e0 = S.a - 0.35,
    e1 = S.a + S.w + 0.35;
  ctx.save();
  ctx.lineCap = "round";
  // shadows of cables + hangers on the water/deck
  for (const e of [e0, e1]) {
    ctx.strokeStyle = "rgba(0,10,20,0.28)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let u = o.p0; u <= o.p1; u += 0.5) {
      const h = suspH(S, u) * SUSP_K,
        p = suspP(S, u, e);
      u === o.p0 ? ctx.moveTo(p[0] + h, p[1] + h) : ctx.lineTo(p[0] + h, p[1] + h);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,10,20,0.16)";
    ctx.beginPath();
    for (let u = Math.ceil(o.p0); u < o.p1; u++) {
      const h = suspH(S, u) * SUSP_K,
        p = suspP(S, u, e);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + h, p[1] + h);
    }
    ctx.stroke();
  }
  // railings
  for (const e of [S.a - 0.1, S.a + S.w + 0.1]) {
    const a = suspP(S, o.p0, e),
      b = suspP(S, o.p1, e);
    ctx.strokeStyle = "#e9e4da";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  // hangers (seen almost end-on: short ticks), main cables, lamp posts
  for (const e of [e0, e1]) {
    ctx.strokeStyle = SUSP_COL;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let u = Math.ceil(o.p0); u < o.p1; u++) {
      const h = suspH(S, u),
        p = suspP(S, u, e),
        dl = (S.dir === "h" ? [0, 1] : [1, 0]).map((x) => x * h * 3 * (e === e0 ? -1 : 1));
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + dl[0], p[1] + dl[1]);
    }
    ctx.stroke();
    const a = suspP(S, o.p0, e),
      b = suspP(S, o.p1, e);
    ctx.strokeStyle = "#7d2416";
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = "#e0603f";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    for (let u = Math.ceil(o.p0 / 6) * 6; u < o.p1; u += 6) {
      const p = suspP(S, u, e === e0 ? S.a + 0.25 : S.a + S.w - 0.25);
      ctx.fillStyle = "rgba(255,240,180,0.25)";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 7, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#2b2f35";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#fff6c8";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.3, 0, 7);
      ctx.fill();
    }
  }
  ctx.restore();
}
function drawSTower(o) {
  const S = o.S,
    H = SUSP_K * 1.08,
    legs = [S.a - 0.9, S.a + S.w + 0.9],
    hw = 0.75;
  ctx.save();
  // long tower shadow
  ctx.fillStyle = "rgba(0,10,20,0.32)";
  for (const v of legs) {
    const c = suspP(S, o.u, v),
      r = hw * TILE;
    ctx.beginPath();
    ctx.moveTo(c[0] - r, c[1] - r);
    ctx.lineTo(c[0] + r, c[1] - r);
    ctx.lineTo(c[0] + r + H, c[1] - r + H);
    ctx.lineTo(c[0] + r + H, c[1] + r + H);
    ctx.lineTo(c[0] - r + H, c[1] + r + H);
    ctx.lineTo(c[0] - r, c[1] + r);
    ctx.closePath();
    ctx.fill();
  }
  {
    const a = suspP(S, o.u, legs[0]),
      b = suspP(S, o.u, legs[1]);
    ctx.strokeStyle = "rgba(0,10,20,0.25)";
    ctx.lineWidth = 9;
    for (const f of [0.55, 0.8, 1]) {
      ctx.beginPath();
      ctx.moveTo(a[0] + H * f, a[1] + H * f);
      ctx.lineTo(b[0] + H * f, b[1] + H * f);
      ctx.stroke();
    }
  }
  // portal: two legs and cross beams above the deck
  const a = suspP(S, o.u, legs[0]),
    b = suspP(S, o.u, legs[1]);
  ctx.lineCap = "butt";
  for (const [w, col] of [
    [13, "#7d2416"],
    [9, SUSP_COL],
  ]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    for (const d of [-0.35, 0.35]) {
      const a2 = suspP(S, o.u + d, legs[0]),
        b2 = suspP(S, o.u + d, legs[1]);
      if (d < 0) {
        ctx.beginPath();
        ctx.moveTo(a2[0], a2[1]);
        ctx.lineTo(b2[0], b2[1]);
        ctx.stroke();
      }
    }
  }
  for (const c of [a, b]) {
    const r = hw * TILE;
    const g = ctx.createLinearGradient(c[0] - r, c[1] - r, c[0] + r, c[1] + r);
    g.addColorStop(0, "#ef6a48");
    g.addColorStop(1, "#8e2a1a");
    ctx.fillStyle = g;
    ctx.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r);
    ctx.fillStyle = "#5a1a10";
    ctx.fillRect(c[0] - r * 0.35, c[1] - r * 0.35, r * 0.7, r * 0.7);
    ctx.fillStyle = "#ff2b1e";
    ctx.beginPath();
    ctx.arc(c[0], c[1], 2.2 + Math.sin(timeS * 3) * 0.8, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}
// v53: UK junction pedestrian signals (J.uk, overhead "ukjx"); the vehicle heads are the mast arms (v53c, James 19 Oct:
// one set of vehicle signals). Puffin near-side unit: small pole, red / green man facing across the crossing, yellow
// push-button box; green during the junction's all-red pedestrian stage (sigPedLeft)
function ukjxPed(p, ang, pedG) {
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.rotate(ang);
  ctx.fillStyle = "#3a3f46";
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#17191c";
  ctx.fillRect(2, -5, 7, 10);
  ctx.fillStyle = pedG ? "#36e05a" : "#ff3b30";
  ctx.beginPath();
  ctx.arc(5.5, -2, 1.2, 0, 7);
  ctx.fill();
  ctx.fillRect(4.8, -0.8, 1.5, 4);
  ctx.fillStyle = "#f2c230";
  ctx.fillRect(-4, 3.2, 5, 4);
  ctx.restore();
}
function drawUkjx(o) {
  const pedG = sigPedLeft(o.J) > 0,
    night = DN.dark > 0.01 ? DN.sig || (DN.sig = []) : null;
  for (const A of o.arms)
    if (A)
      for (let k = 0; k < 2; k++) {
        const p = A.ped[k],
          s = k ? -1 : 1,
          ang = Math.atan2(-A.l[1] * s, -A.l[0] * s);
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.arc(p[0] + 4, p[1] + 4, 3.5, 0, 7);
        ctx.fill();
        ukjxPed(p, ang, pedG);
        if (night) night.push({ ped: 1, x: p[0], y: p[1], a: ang, g: pedG });
      }
}
function drawOverhead(o) {
  if (o.kind === "yrtg") {
    const T_ = TILE,
      x = o.x,
      y = o.y,
      h = o.h,
      hw = 0.95 * T_,
      r = mulberry(o.seed),
      ty = y + T_ * 0.6 + r() * (h - T_ * 3.2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x - hw + 12, y + 12, hw * 2, h);
    ctx.fillStyle = "#1b1b1b";
    for (const yy of [y - 4, y + h - 8])
      for (const xx of [x - hw - 3, x + hw - 7]) ctx.fillRect(xx, yy, 10, 12);
    ctx.fillStyle = "#d9d6cc";
    ctx.fillRect(x - hw, y, 7, h);
    ctx.fillRect(x + hw - 7, y, 7, h);
    ctx.fillStyle = "#b9b5a8";
    ctx.fillRect(x - hw, y, hw * 2, 6);
    ctx.fillRect(x - hw, y + h - 6, hw * 2, 6);
    ctx.fillStyle = "#24407a";
    ctx.fillRect(x - hw, y + h * 0.5 - 1, 2, 2);
    ctx.fillStyle = "#e7c33a";
    ctx.fillRect(x - hw + 7, ty + 4, hw * 2 - 14, 10);
    ctx.fillStyle = "#c9c4b5";
    ctx.fillRect(x - hw + 2, ty, hw * 2 - 4, 18);
    ctx.fillStyle = "#2f4f6a";
    ctx.fillRect(x + hw - 14, y + h - 30, 9, 12);
    ctx.fillStyle = "#f2c230";
    ctx.fillRect(x - hw, y, hw * 2, 2);
    return;
  }
  if (o.kind === "pgate") {
    const T_ = TILE;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(o.x + 18, o.y + 18, o.w, o.h);
    ctx.fillStyle = "#e9ecee";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "#24407a";
    ctx.fillRect(o.x, o.y, o.w, 7);
    ctx.fillRect(o.x, o.y + o.h - 7, o.w, 7);
    ctx.globalAlpha = 1;
    const cy = o.y + o.h / 2;
    ctx.fillStyle = "#5d6f80";
    ctx.fillRect(o.x + o.w * 0.35, cy - 5, o.w * 0.3, 10);
    ctx.fillStyle = "#9fb8c4";
    ctx.fillRect(o.x + o.w * 0.38, cy - 3, o.w * 0.24, 6);
    for (const yy of [o.y + 8, cy + 5]) {
      const L = cy - 5 - (o.y + 8);
      for (let k = 0; k < L; k += 8) {
        ctx.fillStyle = (k / 8) % 2 ? "#fff" : "#d33";
        ctx.fillRect(o.x + o.w - 8, yy + k, 4, Math.min(8, L - k));
      }
    }
    ctx.fillStyle = "#24407a";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GATE", o.x + o.w / 2, o.y + 16);
    ctx.fillStyle = "#2b2b2b";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("LANE 1 →", o.x + o.w / 2, o.y + o.h * 0.25);
    ctx.fillText("← LANE 2", o.x + o.w / 2, o.y + o.h * 0.75);
    ctx.restore();
    return;
  }
  if (o.kind === "susp") return drawSusp(o);
  if (o.kind === "stower") return drawSTower(o);
  if (o.kind === "ukjx") return drawUkjx(o);
  if (o.kind === "mast") {
    const l = o.l,
      f = o.f,
      Ax = o.A[0] * TILE,
      Ay = o.A[1] * TILE,
      E0 = [Ax + f[0] * 0.55 * TILE, Ay + f[1] * 0.55 * TILE],
      onArm = (lat) => {
        const u = lat / o.pLat,
          lon = 0.55 + (o.pLon - 0.55) * u;
        return [E0[0] + (l[0] * lat - f[0] * lon) * TILE, E0[1] + (l[1] * lat - f[1] * lon) * TILE];
      },
      P = onArm(o.pLat),
      tip = onArm(-0.15);
    const sh = 10;
    ctx.lineCap = "round";
    // shadow (sun from the north-west)
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(P[0] + 4, P[1] + 4);
    ctx.lineTo(tip[0] + sh, tip[1] + sh);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    for (let i = 0; i < o.n; i++) {
      const d = ((i + 0.5) * o.hw) / o.n,
        q = onArm(d),
        hx = q[0] + sh,
        hy = q[1] + sh;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.atan2(f[1], f[0]));
      ctx.fillRect(-14, -6, 28, 12);
      ctx.restore();
    }
    // arm + pole
    ctx.strokeStyle = "#5d636c";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(P[0], P[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.strokeStyle = "#8a9099";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(P[0], P[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.fillStyle = "#3a3f46";
    ctx.beginPath();
    ctx.arc(P[0], P[1], 6.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#6b717a";
    ctx.beginPath();
    ctx.arc(P[0] - 1.5, P[1] - 1.5, 3, 0, 7);
    ctx.fill();
    ctx.lineCap = "butt";
    // heads: one per inbound lane, lenses face oncoming traffic (red farthest from driver)
    // v12: one head per lane; each shows its own movements (green disc for ahead, green arrows for turn stages, red+amber before green)
    const key = (f[0] ? o.J.hs : o.J.vs) + ":" + (f[0] || f[1]),
      ap = o.J.appr && o.J.appr[key],
      nl = ap && ap.lanes ? ap.lanes.length : o.n;
    for (let i = 0; i < o.n; i++) {
      const d = ((i + 0.5) * o.hw) / o.n,
        q = onArm(d),
        hx = q[0],
        hy = q[1];
      const lane = Math.max(0, Math.min(nl - 1, o.n - 1 - i)),
        mvs = (ap && ap.lanes && ap.lanes[lane]) || "S";
      const ss = {};
      let anyG = false,
        anyA = false,
        anyRA = false;
      for (const m of mvs) {
        const s = sigState(o.J, key, m);
        ss[m] = s;
        if (s === "g") anyG = true;
        else if (s === "a") anyA = true;
        else if (s === "ra") anyRA = true;
      }
      // full green disc for ahead/left and filtering rights; green arrows only for protected (arrow / early cut-off / left
      // filter) movements. v53b: a head whose only greens are arrows keeps its red disc lit (UK red + green filter arrow)
      let disc = false;
      const arrows = [];
      for (const mv of mvs) {
        if (ss[mv] !== "g") continue;
        if (sigArrow(o.J, key, mv)) arrows.push(mv);
        else disc = true;
      }
      const red = !disc && !anyA,
        amb = anyA || (!anyG && anyRA);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.atan2(f[1], f[0])); // +x = travel direction, -y = left
      ctx.fillStyle = "#e8b923";
      ctx.fillRect(-15, -7, 30, 14);
      ctx.fillStyle = "#17191c";
      ctx.fillRect(-13, -5, 26, 10);
      const lamp = (xx, on, col, dimc) => {
        ctx.fillStyle = on ? col : dimc;
        ctx.beginPath();
        ctx.arc(xx, 0, 3.3, 0, 7);
        ctx.fill();
        if (on) {
          ctx.fillStyle = col + "50";
          ctx.beginPath();
          ctx.arc(xx, 0, 7.5, 0, 7);
          ctx.fill();
        }
      };
      lamp(8, red, "#ff3b30", "#3a1210");
      lamp(0, amb, "#ffb020", "#3a2a10");
      if (disc) lamp(-8, true, "#36e05a", "#10240f");
      else {
        ctx.fillStyle = "#10240f";
        ctx.beginPath();
        ctx.arc(-8, 0, 3.3, 0, 7);
        ctx.fill();
      }
      if (DN.dark > 0.01)
        (DN.sig || (DN.sig = [])).push({
          x: hx,
          y: hy,
          a: Math.atan2(f[1], f[0]),
          f,
          red,
          amb,
          disc,
          arrows: arrows.slice(),
          P,
        });
      if (arrows.length) {
        const ax = disc ? -15 : -8;
        if (disc) {
          ctx.fillStyle = "#e8b923";
          ctx.fillRect(-23, -5, 9, 10);
          ctx.fillStyle = "#17191c";
          ctx.fillRect(-22, -4, 7, 8);
        }
        ctx.fillStyle = "#36e05a50";
        ctx.beginPath();
        ctx.arc(ax - (disc ? 3.5 : 0), 0, 6, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "#5dff7a";
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        for (const mv of arrows) {
          ctx.save();
          ctx.translate(ax - (disc ? 3.5 : 0), 0);
          ctx.rotate(mv === "S" ? 0 : mv === "L" ? -Math.PI / 2 : Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(-3, 0);
          ctx.lineTo(3, 0);
          ctx.moveTo(0.6, -2.2);
          ctx.lineTo(3, 0);
          ctx.lineTo(0.6, 2.2);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }
    return;
  }
  if (o.kind === "light") {
    const c = o.c,
      ns = c.dx === c.dy;
    const st = lightState(o.J, ns);
    // pole + arm reaching over the road
    const ax = o.x - c.dx * (ns ? 0 : 26),
      ay = o.y - c.dy * (ns ? 26 : 0);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(o.x + 8, o.y + 8);
    ctx.lineTo(ax + 8, ay + 8);
    ctx.stroke();
    ctx.strokeStyle = "#4a4f57";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = "#2b2e33";
    ctx.beginPath();
    ctx.arc(o.x, o.y, 4, 0, 7);
    ctx.fill();
    ctx.save();
    ctx.translate(ax, ay);
    if (!ns) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#16181b";
    ctx.fillRect(-5, -13, 10, 26);
    const cols = {
      r: ["#ff3b30", "#3a1210", "#10240f"],
      a: ["#3a1210", "#ffb020", "#10240f"],
      g: ["#3a1210", "#3a2a10", "#36e05a"],
    }[st];
    const lit = [st === "r", st === "a", st === "g"];
    [-8, 0, 8].forEach((yy, i) => {
      ctx.fillStyle = lit[i] ? cols[i] : ["#3a1210", "#3a2a10", "#10240f"][i];
      ctx.beginPath();
      ctx.arc(0, yy, 3.2, 0, 7);
      ctx.fill();
      if (lit[i]) {
        ctx.fillStyle = cols[i] + "55";
        ctx.beginPath();
        ctx.arc(0, yy, 7, 0, 7);
        ctx.fill();
      }
    });
    ctx.restore();
    return;
  }
  if (o.kind === "canopy") {
    if (o.brand) ctx.globalAlpha = 0.62;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(o.x + 22, o.y + 22, o.w, o.h);
    ctx.fillStyle = "#ecf0f1";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = o.col || "#c0392b";
    ctx.fillRect(o.x, o.y, o.w, 8);
    ctx.fillRect(o.x, o.y + o.h - 8, o.w, 8);
    if (o.brand) {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      for (let k = o.x + 24; k < o.x + o.w; k += 48) ctx.fillRect(k, o.y + 8, 2, o.h - 16);
      ctx.fillStyle = o.col;
      ctx.font = "900 26px Arial Black,Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.brand, o.x + o.w / 2, o.y + o.h / 2 - 14);
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(
        o.hgv ? "HGV \u2022 HIGH CLEARANCE" : "CARS \u2022 VANS",
        o.x + o.w / 2,
        o.y + o.h / 2 + 16,
      );
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = "#c0392b";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FUEL", o.x + o.w / 2, o.y + o.h / 2);
    return;
  }
  if (o.kind === "crane") {
    const x = o.x,
      y = o.y;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + 40, y - 300 + 40, 36, 420);
    ctx.fillRect(x - 60 + 40, y - 60 + 40, 156, 60);
    ctx.fillStyle = "#e8a317";
    ctx.fillRect(x, y - 300, 36, 420);
    ctx.fillStyle = "#b77d0e";
    for (let k = 0; k < 420; k += 18) {
      ctx.fillRect(x, y - 300 + k, 36, 3);
    }
    ctx.strokeStyle = "#8a5d08";
    ctx.lineWidth = 2;
    for (let k = 0; k < 420; k += 18) {
      ctx.beginPath();
      ctx.moveTo(x, y - 300 + k);
      ctx.lineTo(x + 36, y - 300 + k + 18);
      ctx.stroke();
    }
    ctx.fillStyle = "#d0d3d6";
    ctx.fillRect(x - 60, y - 60, 156, 60);
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(x - 50, y - 50, 40, 40);
    ctx.lineWidth = 1;
  }
}
// ---------- HUD
function drawHUD() {
  const s = truck,
    kmh = Math.abs(s.v) * 2.23694;
  drawMinimap();
  drawClockHUD();
  drawWeatherHUD();
  drawCoupleHUD();
  drawFuelHUD();
  drawIndHUD();
  if (typeof drawBeamHUD === "function") drawBeamHUD();
  drawCareerHUD();
  drawNavHUD();
  // gauge panel
  const gx = 14,
    gy = VH - 150,
    gw = 186,
    gh = 136;
  ctx.fillStyle = "rgba(10,14,22,0.72)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(gx, gy, gw, gh, 16) : ctx.rect(gx, gy, gw, gh);
  ctx.fill();
  const ccx = gx + 70,
    ccy = gy + 76,
    R = 54,
    a0 = Math.PI * 0.75,
    a1 = Math.PI * 2.25;
  ctx.lineWidth = 8;
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(ccx, ccy, R, a0, a1);
  ctx.stroke();
  const rf = Math.min(1, s.rpm / 2500);
  const grd = ctx.createLinearGradient(ccx - R, 0, ccx + R, 0);
  grd.addColorStop(0, "#2ecc71");
  grd.addColorStop(0.7, "#f1c40f");
  grd.addColorStop(1, "#e74c3c");
  ctx.strokeStyle = grd;
  ctx.beginPath();
  ctx.arc(ccx, ccy, R, a0, a0 + (a1 - a0) * rf);
  ctx.stroke();
  ctx.strokeStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(ccx, ccy, R, a0 + (a1 - a0) * 0.84, a1);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px system-ui,sans-serif";
  ctx.textAlign = "center";
  for (let r = 0; r <= 25; r += 5) {
    const a = a0 + ((a1 - a0) * r) / 25;
    ctx.fillText(String(r), ccx + Math.cos(a) * (R - 17), ccy + Math.sin(a) * (R - 17) + 3);
  }
  const na = a0 + (a1 - a0) * rf;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ccx, ccy);
  ctx.lineTo(ccx + Math.cos(na) * (R - 6), ccy + Math.sin(na) * (R - 6));
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ccx, ccy, 4, 0, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "9px system-ui,sans-serif";
  ctx.fillText("RPM x100", ccx, ccy + 24);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px system-ui,sans-serif";
  ctx.fillText(String(Math.round(s.rpm)), ccx, ccy + 42);
  // speed + gear
  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px system-ui,sans-serif";
  ctx.fillText(String(Math.round(kmh)), gx + gw - 12, gy + 44);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "11px system-ui,sans-serif";
  ctx.fillText("mph", gx + gw - 12, gy + 58);
  const gear =
    s.mode === "R" ? "R" : Math.abs(s.v) < 0.2 && s.throttle < 0.05 ? "N" : String(s.gear);
  ctx.fillStyle = s.mode === "R" ? "#ff8c42" : "#7fdcff";
  ctx.font = "bold 34px system-ui,sans-serif";
  ctx.fillText(gear, gx + gw - 12, gy + 104);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "11px system-ui,sans-serif";
  ctx.fillText("GEAR", gx + gw - 12, gy + 118);
  if (s.offroad) {
    ctx.fillStyle = "#d8c98f";
    ctx.font = "bold 11px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("OFF-ROAD", gx + 12, gy + 18);
  }
  if (input.hand) {
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 11px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("(P) HANDBRAKE", gx + 12, gy + gh - 8);
  }
}
// ---------- minimap & big map
const MM = { x: VW - 14 - 220, y: VH - 14 - 140, w: 220, h: 140 };
function mmColorsReady() {
  return MINIMAP;
}
function drawMinimap() {
  MM.x = VW - 14 - MM.w;
  MM.y = VH - 14 - MM.h;
  const s = truck,
    { x, y, w, h } = MM;
  const span = 90; // tiles across
  ctx.save();
  ctx.fillStyle = "rgba(10,14,22,0.8)";
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 10)
    : ctx.rect(x - 4, y - 4, w + 8, h + 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const cxT = (s.x * PPM) / TILE,
    cyT = (s.y * PPM) / TILE,
    sc = w / span,
    sh = h / sc;
  ovDraw(x - (cxT - span / 2) * sc, y - (cyT - sh / 2) * sc, sc, x, y, x + w, y + h);
  ovTick(bigmap.open ? 0 : 2.5);
  ctx.imageSmoothingEnabled = true;
  drawMapDetail(x - (cxT - span / 2) * sc, y - (cyT - sh / 2) * sc, sc, x, y, x + w, y + h);
  nightMapLayer(x - (cxT - span / 2) * sc, y - (cyT - sh / 2) * sc, sc, x, y, x + w, y + h, true);
  navLine(
    (m) => x + (m / 4 - (cxT - span / 2)) * sc,
    (m) => y + (m / 4 - (cyT - sh / 2)) * sc,
    3,
    "#ff3df0",
  );
  drawPOIs(
    (m) => x + (m / 4 - (cxT - span / 2)) * sc,
    (m) => y + (m / 4 - (cyT - sh / 2)) * sc,
    false,
  );
  mpDrawMap(
    (m) => x + (m / 4 - (cxT - span / 2)) * sc,
    (m) => y + (m / 4 - (cyT - sh / 2)) * sc,
    false,
  );
  hlDrawMap(
    (m) => x + (m / 4 - (cxT - span / 2)) * sc,
    (m) => y + (m / 4 - (cyT - sh / 2)) * sc,
    false,
  );
  bmMapIcons(
    (m) => x + (m / 4 - (cxT - span / 2)) * sc,
    (m) => y + (m / 4 - (cyT - sh / 2)) * sc,
    5.5,
    false,
  );
  for (const t of world.trailers) {
    if (t.coupled) continue;
    const mx = x + (t.x / 4 - (cxT - span / 2)) * sc,
      my = y + (t.y / 4 - (cyT - sh / 2)) * sc;
    if (mx < x || my < y || mx > x + w || my > y + h) continue;
    ctx.fillStyle = t.target ? "#ffd600" : "#4fd1ff";
    ctx.fillRect(mx - 2, my - 3, 4, 6);
  }
  if (typeof missionFlag === "function") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    missionFlag(
      (m) => x + (m / 4 - (cxT - span / 2)) * sc,
      (m) => y + (m / 4 - (cyT - sh / 2)) * sc,
      false,
    );
    ctx.restore();
  }
  if (typeof railMapTrains === "function")
    railMapTrains(
      (m) => x + (m - (cxT - span / 2)) * sc,
      (m) => y + (m - (cyT - sh / 2)) * sc,
      sc,
      true,
    );
  if (typeof portMapTrucks === "function")
    portMapTrucks(
      (m) => x + (m - (cxT - span / 2)) * sc,
      (m) => y + (m - (cyT - sh / 2)) * sc,
      sc * 0.6,
    );
  for (const v of traffic.vs) {
    const mx = x + (v.x / 4 - (cxT - span / 2)) * sc,
      my = y + (v.y / 4 - (cyT - sh / 2)) * sc;
    if (mx < x || my < y || mx > x + w || my > y + h) continue;
    ctx.fillStyle = v.heavy ? "#ff9f1a" : "#ffffff";
    ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }
  if (typeof fogDraw === "function")
    fogDraw(x - (cxT - span / 2) * sc, y - (cyT - sh / 2) * sc, sc, [x, y, w, h]);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(s.h);
  if (nmK() > 0.05) {
    ctx.shadowColor = "rgba(255,221,51,0.95)";
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = "#ffdd33";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 10px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("MAP (M)", x + 4, y + 12);
  ctx.textAlign = "right";
  ctx.fillText("N\u2191", x + w - 4, y + 12);
}
const bigmap = { open: false, z: 2.4, cx: 0, cy: 0, drag: null };
// v9: the map is drawn from the SAME renderer as the world. Zoomed in, it uses downscaled game chunks (exact roads, kerb radii,
// roundabouts, curves, bridges, buildings); zoomed out, the per-tile ground image (1 px = 1 tile, same coordinates).
const MAPC = { cache: new Map(), order: [], px: 128, max: 700, budget: 7, built: 0 };
function mapChunk(cx, cy, allow) {
  const k = cx + "," + cy;
  let c = MAPC.cache.get(k);
  if (c) return c;
  const gc = getChunk(cx, cy, false);
  if (!gc && !allow) return null;
  const src = gc || renderChunk(cx, cy);
  c = mkCanvas(MAPC.px, MAPC.px);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, MAPC.px, MAPC.px);
  if (typeof ovlPaint === "function") {
    const N = CHUNK / TILE;
    ovlPaint(g, 0, 0, cx * N, cy * N, N, N, MAPC.px / N);
  }
  MAPC.cache.set(k, c);
  MAPC.order.push(k);
  MAPC.built++;
  if (MAPC.order.length > MAPC.max) MAPC.cache.delete(MAPC.order.shift());
  return c;
}
function drawMapDetail(X0, Y0, z, x0, y0, x1, y1) {
  // X0/Y0: screen pos of tile 0,0; z px per tile; clip rect in screen px
  const N = CHUNK / TILE,
    s = N * z;
  const cx0 = Math.max(0, Math.floor((x0 - X0) / s)),
    cy0 = Math.max(0, Math.floor((y0 - Y0) / s)),
    cx1 = Math.min(MW / N - 1, Math.floor((x1 - X0) / s)),
    cy1 = Math.min(MH / N - 1, Math.floor((y1 - Y0) / s));
  const t0 = performance.now();
  let miss = 0;
  const ccx = (cx0 + cx1) / 2,
    ccy = (cy0 + cy1) / 2;
  const L = [];
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) L.push([cx, cy]);
  L.sort((a, b) => Math.hypot(a[0] - ccx, a[1] - ccy) - Math.hypot(b[0] - ccx, b[1] - ccy));
  for (const [cx, cy] of L) {
    const c = mapChunk(cx, cy, performance.now() - t0 < MAPC.budget);
    if (!c) {
      miss++;
      continue;
    }
    ctx.drawImage(
      c,
      Math.floor(X0 + cx * s),
      Math.floor(Y0 + cy * s),
      Math.ceil(s) + 1,
      Math.ceil(s) + 1,
    );
  }
  return miss;
}
function mapFitZ() {
  return Math.min((VW - 40) / MW, (VH - 60) / MH);
}
const LOCAL_Z = (VW - 40) / 250; // ~1 km (250 tiles) across
function mapClamp() {
  bigmap.cx = Math.max(0, Math.min(MW, bigmap.cx));
  bigmap.cy = Math.max(0, Math.min(MH, bigmap.cy));
} // v26: free pan; any point of the world can reach the screen centre (ocean beyond the edge)
function mapCentreTruck() {
  bigmap.cx = (truck.x * PPM) / TILE;
  bigmap.cy = (truck.y * PPM) / TILE;
  bigmap.anchor = null;
  mapClamp();
}
function mapZoomTo(zt, mx, my) {
  bigmap.zt = Math.max(mapFitZ(), Math.min(14, zt));
  bigmap.anchor = mx === undefined ? [VW / 2, VH / 2 + 10] : [mx, my];
}
function mapFull(on) {
  if (!document.body.classList.contains("touch")) return;
  const c = document.getElementById("game");
  document.body.classList.toggle("mapo", on);
  if (on) {
    VW = Math.round(innerWidth * 1.6);
    VH = Math.round(innerHeight * 1.6);
  } else {
    VW = VW0;
    VH = VH0;
  }
  c.width = VW;
  c.height = VH;
  if (!on && typeof mobLayout === "function") mobLayout();
}
addEventListener("resize", () => {
  if (bigmap.open) setTimeout(() => mapFull(true), 60);
});
function openMap() {
  setTimeout(() => typeof flyBtnSync === "function" && flyBtnSync(), 0);
  if (!started) return;
  // v44: a stale uiOpen (no modal on screen) used to block the map silently; clear it instead
  if (career.uiOpen && !(uiRoot && uiRoot.querySelector(".mback,.celebrate"))) career.uiOpen = null;
  if (career.uiOpen) return;
  if (career.active && career.active.phase === "unloading") {
    flash("Unloading \u2014 the map opens when the unload finishes");
    return;
  }
  bigmap.open = true;
  bigmap.openedAt = performance.now();
  mapFull(true);
  bigmap.z = bigmap.zt = bigmap.saved || LOCAL_Z;
  mapCentreTruck();
}
function closeMap() {
  setTimeout(() => typeof flyBtnSync === "function" && flyBtnSync(), 0);
  NAV.sel = null;
  if (bigmap.open) bigmap.saved = bigmap.zt || bigmap.z;
  bigmap.open = false;
  mapFull(false);
}
const MAPBTN = [
  ["+", () => mapZoomTo(bigmap.zt * 1.6)],
  ["−", () => mapZoomTo(bigmap.zt / 1.6)],
  ["◎", mapCentreTruck],
  ["✕", () => closeMap()],
];
function CR_BTN() {
  return [VW / 2 - 90, VH - 74, 180, 46];
}
function drawCancelRouteBtn() {
  if (!NAV.route) return;
  const [bx, by, bw, bh] = CR_BTN(),
    mi = navIsMission();
  ctx.save();
  ctx.fillStyle = mi ? "rgba(70,80,95,0.92)" : "rgba(200,40,40,0.92)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 10) : ctx.rect(bx, by, bw, bh);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    mi ? "\u2715 HIDE MISSION ROUTE" : "\u2715 CANCEL ROUTE",
    bx + bw / 2,
    by + bh / 2 + 1,
  );
  ctx.restore();
}
function mapBtnRect(i) {
  if (document.body.classList.contains("mapo")) {
    const i2 = i === 3 ? 0 : i + 1;
    return [VW - 96, i === 3 ? 56 : 84 + i2 * 76, 76, 68];
  }
  return [VW - 62, 58 + i * 48, 40, 40];
}
const mBX = (t) => VW / 2 + (t - bigmap.cx) * bigmap.z,
  mBY = (t) => VH / 2 + 10 + (t - bigmap.cy) * bigmap.z;
function routeToMapPoint(x, y) {
  const tx = bigmap.cx + (x - VW / 2) / bigmap.z,
    ty = bigmap.cy + (y - VH / 2 - 10) / bigmap.z;
  const r = setRoute({ x: tx * M_T, y: ty * M_T, name: "Map point" });
  if (r) flash("Route set: " + fmtD(r.len));
}
function drawBigMap() {
  {
    const zt = bigmap.zt || bigmap.z,
      z0 = bigmap.z;
    if (Math.abs(zt - z0) > 1e-4) {
      let z1 = z0 + (zt - z0) * 0.22;
      if (Math.abs(zt - z1) < zt * 0.004) z1 = zt;
      const a = bigmap.anchor || [VW / 2, VH / 2 + 10];
      const wx = bigmap.cx + (a[0] - VW / 2) / z0,
        wy = bigmap.cy + (a[1] - VH / 2 - 10) / z0;
      bigmap.z = z1;
      bigmap.cx = wx - (a[0] - VW / 2) / z1;
      bigmap.cy = wy - (a[1] - VH / 2 - 10) / z1;
    }
    mapClamp();
  }
  ctx.fillStyle = "rgba(6,9,15,0.92)";
  ctx.fillRect(0, 0, VW, VH);
  const z = bigmap.z;
  ctx.save();
  ctx.beginPath();
  ctx.rect(20, 40, VW - 40, VH - 60);
  ctx.clip();
  ctx.fillStyle = "#6e8aac";
  ctx.fillRect(20, 40, VW - 40, VH - 60);
  {
    const K = nmK();
    if (K > 0.01) {
      ctx.globalAlpha = K;
      ctx.fillStyle = "#08102a";
      ctx.fillRect(20, 40, VW - 40, VH - 60);
      ctx.globalAlpha = 1;
    }
  }
  ovTick(9);
  ovDraw(VW / 2 - bigmap.cx * z, VH / 2 + 10 - bigmap.cy * z, z, 20, 40, VW - 20, VH - 20);
  bigmap.miss =
    z >= 2.2
      ? drawMapDetail(
          VW / 2 - bigmap.cx * z,
          VH / 2 + 10 - bigmap.cy * z,
          z,
          20,
          40,
          VW - 20,
          VH - 20,
        )
      : 0;
  nightMapLayer(
    VW / 2 - bigmap.cx * z,
    VH / 2 + 10 - bigmap.cy * z,
    z,
    20,
    40,
    VW - 20,
    VH - 20,
    z >= 2.2,
  );
  const BX = (t) => VW / 2 + (t - bigmap.cx) * z,
    BY = (t) => VH / 2 + 10 + (t - bigmap.cy) * z;
  if (z > 0.8)
    for (const v of traffic.vs) {
      ctx.fillStyle = v.heavy ? "#ff9f1a" : "#fff";
      ctx.fillRect(BX(v.x / 4) - 1.5, BY(v.y / 4) - 1.5, 3, 3);
    }
  for (const t of world.trailers) {
    if (t.coupled) continue;
    if (z < 0.8 && !t.target) continue;
    ctx.fillStyle = t.target ? "#ffd600" : "#4fd1ff";
    ctx.fillRect(BX(t.x / 4) - 2, BY(t.y / 4) - 2, 4, 4);
  }
  const IR = mapIconR(z);
  MAPLBL.length = 0;
  railBigMap(BX, BY, z, IR);
  portBigMap(BX, BY, z);
  navLine(
    (m) => BX(m / 4),
    (m) => BY(m / 4),
    4,
    "#ff3df0",
  );
  drawPOIs(
    (m) => BX(m / 4),
    (m) => BY(m / 4),
    z > 0.6,
    IR,
  );
  if (typeof missionFlag === "function")
    missionFlag(
      (m) => BX(m / 4),
      (m) => BY(m / 4),
      true,
    );
  mpDrawMap(
    (m) => BX(m / 4),
    (m) => BY(m / 4),
    true,
  );
  hlDrawMap(
    (m) => BX(m / 4),
    (m) => BY(m / 4),
    true,
  );
  bmMapIcons(
    (m) => BX(m / 4),
    (m) => BY(m / 4),
    IR,
    z > 1.2,
  );
  if (typeof ownMapLabels === "function") ownMapLabels(BX, BY, z, IR);
  if (typeof czMapMarks === "function") czMapMarks(BX, BY, z, IR);
  if (z > 1.2)
    for (const dp of world.depots)
      mapLabel(dp.name, BX(dp.entrance.x / 4) + IR + 4, BY(dp.entrance.y / 4), "#8fc8ff", true);
  if (z >= 4) {
    for (const f of world.fuel) mapLabel(f.name, BX(f.x / 4) + IR + 4, BY(f.y / 4), "#9be7a8");
    for (const g of world.garages) mapLabel(g.name, BX(g.x / 4) + IR + 4, BY(g.y / 4), "#ffc58a");
    for (const m of world.malls || [])
      mapLabel(m.name, BX(m.entrance.x / 4) + IR + 4, BY(m.entrance.y / 4), "#ff9cc0");
    for (const d of world.dealers || [])
      mapLabel(d.name, BX(d.entrance.x / 4) + IR + 4, BY(d.entrance.y / 4), "#d6a8f0");
  }
  for (const S of world.susp || []) {
    const p = (u, v) => (S.dir === "h" ? [BX(u), BY(v)] : [BX(v), BY(u)]),
      c = S.a + S.w / 2,
      a = p(S.r0, c),
      b = p(S.r1, c);
    ctx.save();
    ctx.strokeStyle = "#e0603f";
    ctx.lineWidth = Math.max(2, z * 2.5);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    for (const t of [S.t0, S.t1]) {
      const q = p(t, c);
      ctx.fillStyle = "#c4402b";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.fillRect(q[0] - 4, q[1] - 4, 8, 8);
      ctx.strokeRect(q[0] - 4, q[1] - 4, 8, 8);
    }
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [n, lx2, ly2, kind] of world.labels) {
    const X = BX(lx2),
      Y = BY(ly2);
    const big = kind === 1,
      wat = kind === 2,
      city = !kind && n === n.toUpperCase(),
      town = !kind && !city;
    if (
      town &&
      z < 0.45 &&
      !/Ashby|Millford|Redhill|Dustwater|Coppermine|Fenwick|Wendwood|Greyfell/.test(n)
    )
      continue;
    const LK = Math.min(big ? 1.4 : 1.7, mapLblK(z));
    ctx.font = big
      ? "900 " + Math.round(22 * LK) + "px system-ui,sans-serif"
      : wat
        ? "italic 600 " + Math.round(13 * LK) + "px Georgia,serif"
        : city
          ? "bold " + Math.round(15 * LK) + "px system-ui,sans-serif"
          : "600 " + Math.round(11 * LK) + "px system-ui,sans-serif";
    ctx.lineWidth = (big ? 5 : 3) * LK * (1 + nmK() * 0.5);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0," + (0.75 + 0.2 * nmK()) + ")";
    ctx.strokeText(n, X, Y);
    ctx.fillStyle = big ? "rgba(255,214,120,0.95)" : wat ? "#bfe3ff" : city ? "#ffffff" : "#ffe9a8";
    ctx.fillText(n, X, Y);
  }
  ctx.textBaseline = "alphabetic";
  if (typeof fogDraw === "function" && fogActive()) {
    // v66: fog over terrain/icons; the sat-nav route + mission flag still show through
    fogDraw(BX(0), BY(0), z, [20, 40, VW - 40, VH - 60]);
    navLine(
      (m) => BX(m / 4),
      (m) => BY(m / 4),
      4,
      "#ff3df0",
    );
    if (typeof missionFlag === "function")
      missionFlag(
        (m) => BX(m / 4),
        (m) => BY(m / 4),
        true,
      );
  }
  const lx = VW / 2 + ((truck.x * PPM) / TILE - bigmap.cx) * z,
    ly = VH / 2 + 10 + ((truck.y * PPM) / TILE - bigmap.cy) * z;
  {
    const pu = (timeS * 1.6) % 1;
    ctx.strokeStyle = "rgba(255,221,51," + (1 - pu).toFixed(2) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(lx, ly, 12 + pu * 26, 0, 7);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,221,51,0.25)";
    ctx.beginPath();
    ctx.arc(lx, ly, 14, 0, 7);
    ctx.fill();
  }
  ctx.translate(lx, ly);
  ctx.rotate(truck.h);
  if (nmK() > 0.05) {
    ctx.shadowColor = "rgba(255,221,51,1)";
    ctx.shadowBlur = 16;
  }
  const k = 1.5 + 0.12 * Math.sin(timeS * 6);
  ctx.fillStyle = "#ffdd33";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -11 * k);
  ctx.lineTo(7.5 * k, 8 * k);
  ctx.lineTo(0, 4 * k);
  ctx.lineTo(-7.5 * k, 8 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  FT_BTN = NAV_BTN = null;
  if (NAV.sel) {
    const hv = NAV.sel,
      e = hv.o.entrance || hv.o,
      X = mBX(e.x / M_T),
      Y = mBY(e.y / M_T),
      tch = document.body.classList.contains("touch"),
      cr = ctx.canvas.getBoundingClientRect(),
      PK = Math.max(1, Math.min(2.5, cr.height > 0 ? VH / cr.height : 1)),
      bh = (tch ? 54 : 40) * PK,
      H = bh + 80 * PK;
    ctx.font = "bold " + Math.round(18 * PK) + "px system-ui,sans-serif";
    const t1 = hv.kind + ": " + hv.name,
      why = ftBlock(hv.o, true),
      t2 = why ? why.replace(/^Fast travel:? ?/, "") : "Fast travel fee \u00a3" + ftFee(hv.o);
    const tw = Math.min(VW - 32, Math.max(300 * PK, ctx.measureText(t1).width + 28 * PK)),
      tx = Math.max(16, Math.min(VW - tw - 16, X + 16)),
      ty = Math.max(44, Math.min(VH - H - 16, Y - H / 2));
    ctx.fillStyle = "rgba(10,14,22,0.95)";
    ctx.fillRect(tx, ty, tw, H);
    ctx.strokeStyle = "#f5b82e";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx, ty, tw, H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t1, tx + 14 * PK, ty + 26 * PK, tw - 28 * PK);
    ctx.font = Math.round(14 * PK) + "px system-ui,sans-serif";
    ctx.fillStyle = why ? "#ffb020" : "#9be7a8";
    ctx.fillText(t2, tx + 14 * PK, ty + 48 * PK, tw - 28 * PK);
    const pad2 = typeof pad !== "undefined" && pad.active;
    const G = 12 * PK;
    NAV_BTN = [tx + G, ty + 64 * PK, (tw - 3 * G) / 2, bh];
    FT_BTN = [tx + 2 * G + (tw - 3 * G) / 2, ty + 64 * PK, (tw - 3 * G) / 2, bh];
    for (const [b, l, c] of [
      [NAV_BTN, (pad2 ? "X " : "") + "Sat nav", "#2e86de"],
      [FT_BTN, (pad2 ? "A " : "") + "Fast travel", ftJobBlock() ? "#4b5563" : "#27ae60"], // v50: greyed during a job
    ]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(b[0], b[1], b[2], b[3], 10 * PK)
        : ctx.rect(b[0], b[1], b[2], b[3]);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold " + Math.round((tch ? 18 : 16) * PK) + "px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(l, b[0] + b[2] / 2, b[1] + b[3] / 2, b[2] - 8);
      ctx.textBaseline = "alphabetic";
    }
    ctx.textAlign = "left";
  }
  if (NAV.hover && !(NAV.sel && NAV.sel.o === NAV.hover.o)) {
    const hv = NAV.hover,
      t = hv.kind + ": " + hv.name + "  (click: sat nav / fast travel)";
    ctx.font = "bold 12px system-ui,sans-serif";
    const tw = ctx.measureText(t).width;
    const tx = Math.min(VW - tw - 30, NAV.hx + 14),
      ty = NAV.hy - 12;
    ctx.fillStyle = "rgba(10,14,22,0.92)";
    ctx.fillRect(tx - 6, ty - 14, tw + 12, 22);
    ctx.strokeStyle = "#f5b82e";
    ctx.strokeRect(tx - 6, ty - 14, tw + 12, 22);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(t, tx, ty + 1);
  }
  ctx.fillStyle = "#f5b82e";
  ctx.font = "bold 18px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WORLD MAP", 24, 28);
  ctx.font = "11px system-ui,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("1 km ≈ " + Math.round(250 * bigmap.z) + " px", 150, 28);
  // buttons
  drawCancelRouteBtn();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  MAPBTN.forEach(([t], i) => {
    const [bx, by, bw, bh] = mapBtnRect(i);
    ctx.fillStyle = "rgba(12,18,28,0.85)";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 8) : ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui,sans-serif";
    ctx.fillText(t, bx + bw / 2, by + bh / 2 + 1);
  });
  // legend
  {
    if (bigmap.leg === undefined) bigmap.leg = !PORTRAIT_SQ;
    const items = [
      ["#2e86de", "D", "Depot"],
      ["#27ae60", "F", "Fuel"],
      ["#e67e22", "G", "Garage"],
      ["#d6336c", "S", "Mall / shop"],
      ["#8e44ad", "$", "Dealer"],
      ["#d62828", "\u{1F692}", "Fire station"],
      ["#1d4fbf", "\u{1F693}", "Police station"],
      ["#0a8f6a", "+", "Hospital"],
      ["#ffffff", "R", "Station"],
      ["#ffdd33", "\u25B2", "Your lorry"],
      ["#4fd1ff", "~P", "Passenger train"],
      ["#ff9f1a", "~F", "Freight train"],
      ["#f39c12", "Y", "Haulage yard"],
      ["#d63b2f", "H", "Haulage truck"],
      ["#1b1022", "\u2620", "Black Market"],
      ["#ffffff", "~L", "Training ground"],
    ];
    const lx0 = 28,
      w = bigmap.leg ? 232 : 92,
      h = bigmap.leg ? 24 + Math.ceil(items.length / 2) * 17 + 4 : 24,
      ly0 = VH - 28 - h;
    LEG_BTN = [lx0, ly0, w, h];
    ctx.fillStyle = "rgba(12,18,28,0.88)";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(lx0, ly0, w, h, 8) : ctx.rect(lx0, ly0, w, h);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px system-ui,sans-serif";
    ctx.fillStyle = "#f5b82e";
    ctx.fillText("LEGEND " + (bigmap.leg ? "\u25BE" : "\u25B8"), lx0 + 10, ly0 + 12);
    if (bigmap.leg)
      items.forEach(([c, l, n], i) => {
        const dark = c === "#ffdd33" || c === "#ffffff";
        const x = lx0 + 10 + (i % 2) * 110,
          y = ly0 + 32 + ((i / 2) | 0) * 17;
        if (l === "~L") {
          ltgPlate(ctx, x + 6, y, 12);
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.font = "11px system-ui,sans-serif";
          ctx.fillStyle = "#e8eef5";
          ctx.fillText(n, x + 16, y);
          return;
        }
        if (l[0] === "~") {
          ctx.fillStyle = c;
          ctx.strokeStyle = l === "~P" ? "#0a3358" : "#2a1a08";
          ctx.lineWidth = 1;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            if (l === "~P" && ctx.roundRect) ctx.roundRect(x - 1 + k * 5.5, y - 2.5, 5, 5, 2);
            else ctx.rect(x - 1 + k * 5.5, y - 2.5, 5, 5);
            if (l === "~F" && k) ctx.fillStyle = "#8a5a3c";
            ctx.fill();
            ctx.stroke();
          }
          ctx.font = "11px system-ui,sans-serif";
          ctx.fillStyle = "#e8eef5";
          ctx.fillText(n, x + 16, y);
          return;
        }
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + 6, y, 6, 0, 7);
        ctx.fill();
        ctx.fillStyle = dark ? "#000" : "#fff";
        ctx.font = "bold 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(l, x + 6, y + 0.5);
        ctx.textAlign = "left";
        ctx.font = "11px system-ui,sans-serif";
        ctx.fillStyle = "#e8eef5";
        ctx.fillText(n, x + 16, y);
      });
  }
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "12px system-ui,sans-serif";
  ctx.textAlign = "right";
  {
    const R = VW - (document.body.classList.contains("touch") ? 24 : 150),
      L = 270;
    let t =
      "drag to pan \u00b7 wheel or +/\u2212 to zoom \u00b7 click icon = sat nav \u00b7 right-click/hold = route to point \u00b7 Home = centre";
    for (const alt of [
      "drag to pan \u00b7 +/\u2212 zoom \u00b7 tap icon = sat nav / travel \u00b7 hold = route",
      "drag \u00b7 +/\u2212 zoom \u00b7 tap icon = sat nav / travel",
    ])
      if (ctx.measureText(t).width > R - L) t = alt;
    if (ctx.measureText(t).width <= R - L) ctx.fillText(t, R, 28);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.strokeRect(20.5, 40.5, VW - 41, VH - 61);
}
let LEG_BTN = null;
// big-map labels with simple collision avoidance (skips any label that would overlap one already drawn this frame)
function mapLblK(z) {
  return Math.max(1, Math.min(1.9, 0.85 + 0.1 * z));
}
const MAPLBL = [];
function mapLabel(t, x, y, col, bold) {
  if (!t) return false;
  const k = mapLblK(bigmap.z),
    fs = Math.round(11 * k);
  ctx.font = (bold ? "bold " : "600 ") + fs + "px system-ui,sans-serif";
  const w = ctx.measureText(t).width,
    r = [x - 2, y - fs * 0.72, w + 4, fs * 1.45];
  for (const q of MAPLBL)
    if (r[0] < q[0] + q[2] && q[0] < r[0] + r[2] && r[1] < q[1] + q[3] && q[1] < r[1] + r[3])
      return false;
  MAPLBL.push(r);
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3 * mapLblK(bigmap.z) * (1 + nmK() * 0.5);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0," + (0.8 + 0.15 * nmK()) + ")";
  ctx.strokeText(t, x, y);
  ctx.fillStyle = col;
  ctx.fillText(t, x, y);
  ctx.restore();
  return true;
}
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return [((e.clientX - r.left) * VW) / r.width, ((e.clientY - r.top) * VH) / r.height];
}
let downAt = null;
const popBtnAt = (x, y, pd) => {
  if (!bigmap.open || !NAV.sel) return null;
  const inB = (b) =>
    b && x >= b[0] - pd && x <= b[0] + b[2] + pd && y >= b[1] - pd && y <= b[1] + b[3] + pd;
  return inB(FT_BTN) ? "ft" : inB(NAV_BTN) ? "nav" : null;
};
function popAct(k) {
  const sel = NAV.sel;
  if (!sel) return;
  if (k === "ft") {
    const why = ftBlock(sel.o);
    if (why) {
      flash(why);
      return;
    }
    NAV.sel = null;
    fastTravel(sel.o, sel);
  } else {
    NAV.sel = null;
    const r = setRoute(sel.o);
    if (r) flash("Sat nav to " + sel.name + ": " + fmtD(r.len));
    else NAV.sel = sel;
  }
}
cv.addEventListener("pointerdown", (e) => {
  const [x, y] = canvasPos(e);
  downAt = [x, y, performance.now()];
  bigmap.btnDown = popBtnAt(x, y, 4);
  if (bigmap.btnDown) {
    downAt = null;
    e.preventDefault();
    return;
  } // popup buttons own the press: no drag / long-press / deselect
  if (bigmap.open) {
    if (
      LEG_BTN &&
      x >= LEG_BTN[0] &&
      x <= LEG_BTN[0] + LEG_BTN[2] &&
      y >= LEG_BTN[1] &&
      y <= LEG_BTN[1] + LEG_BTN[3]
    ) {
      bigmap.leg = !bigmap.leg;
      downAt = null;
      return;
    }
    if (
      MAPBTN.some((b, i) => {
        const [bx, by, bw, bh] = mapBtnRect(i);
        return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
      })
    )
      return;
    bigmap.drag = [x, y, bigmap.cx, bigmap.cy];
    if (bigmap.lp) clearTimeout(bigmap.lp);
    bigmap.lp = setTimeout(() => {
      bigmap.lp = null;
      if (
        bigmap.open &&
        bigmap.drag &&
        downAt &&
        Math.abs(bigmap.cx - bigmap.drag[2]) < 0.5 &&
        Math.abs(bigmap.cy - bigmap.drag[3]) < 0.5
      ) {
        bigmap.drag = null;
        downAt = null;
        routeToMapPoint(x, y);
      }
    }, 600);
    cv.setPointerCapture(e.pointerId);
  }
});
cv.addEventListener("pointermove", (e) => {
  if (bigmap.open && !bigmap.drag) {
    const [x, y] = canvasPos(e);
    NAV.hover = navPOIAt(x, y, mBX, mBY);
    NAV.hx = x;
    NAV.hy = y;
    cv.style.cursor = NAV.hover ? "pointer" : "";
  }
  if (bigmap.open && bigmap.drag) {
    const [x, y] = canvasPos(e);
    bigmap.cx = bigmap.drag[2] - (x - bigmap.drag[0]) / bigmap.z;
    bigmap.cy = bigmap.drag[3] - (y - bigmap.drag[1]) / bigmap.z;
    mapClamp();
  }
});
cv.addEventListener("pointerup", (e) => {
  const [x, y] = canvasPos(e);
  if (bigmap.btnDown) {
    const k = bigmap.btnDown;
    bigmap.btnDown = null;
    if (popBtnAt(x, y, 14) === k) popAct(k);
    return;
  }
  const click =
    downAt && Math.hypot(x - downAt[0], y - downAt[1]) < 6 && performance.now() - downAt[2] < 400;
  bigmap.drag = null;
  if (bigmap.lp) {
    clearTimeout(bigmap.lp);
    bigmap.lp = null;
  }
  if (click) {
    if (!bigmap.open && navPanelClick(x, y)) return;
    if (
      bigmap.open &&
      NAV.route &&
      x >= CR_BTN()[0] &&
      x <= CR_BTN()[0] + CR_BTN()[2] &&
      y >= CR_BTN()[1] &&
      y <= CR_BTN()[1] + CR_BTN()[3]
    ) {
      userCancelRoute();
      return;
    }
    if (bigmap.open) {
      let hitB = false;
      MAPBTN.forEach((b, i) => {
        const [bx, by, bw, bh] = mapBtnRect(i);
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) hitB = true;
      });
      const inB = (b) => b && x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
      if (NAV.sel && inB(FT_BTN)) {
        const sel = NAV.sel;
        NAV.sel = null;
        fastTravel(sel.o, sel);
        return;
      }
      if (NAV.sel && inB(NAV_BTN)) {
        const sel = NAV.sel;
        NAV.sel = null;
        const r = setRoute(sel.o);
        if (r) flash("Sat nav to " + sel.name + ": " + fmtD(r.len));
        return;
      }
      const poi = hitB ? null : navPOIAt(x, y, mBX, mBY);
      const was = NAV.sel;
      NAV.sel = null;
      const trn = hitB || poi || typeof railMapTrainAt !== "function" ? null : railMapTrainAt(x, y);
      if (typeof RAIL !== "undefined") RAIL.mapSel = trn || null;
      if (poi) NAV.sel = poi;
      else if (was || trn) hitB = true;
      MAPBTN.forEach(([t, f], i) => {
        const [bx, by, bw, bh] = mapBtnRect(i);
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) f();
      });
    } else if (x >= MM.x && x <= MM.x + MM.w && y >= MM.y && y <= MM.y + MM.h) openMap();
  }
});
cv.addEventListener(
  "wheel",
  (e) => {
    if (!bigmap.open) return;
    e.preventDefault();
    const [mx, my] = canvasPos(e);
    mapZoomTo((bigmap.zt || bigmap.z) * Math.exp(-e.deltaY * 0.0018), mx, my);
  },
  { passive: false },
);
addEventListener("keydown", (e) => {
  if (bigmap.open && NAV.sel && (e.code === "Enter" || e.code === "Space")) {
    const sel = NAV.sel;
    NAV.sel = null;
    fastTravel(sel.o, sel);
    e.preventDefault();
    return;
  }
  if (e.code === "KeyM") {
    bigmap.open ? closeMap() : openMap();
  }
  if (e.code === "Escape") closeMap();
  if (bigmap.open) {
    if (e.code === "Equal" || e.code === "NumpadAdd") {
      mapZoomTo(bigmap.zt * 1.6);
      e.preventDefault();
    }
    if (e.code === "Minus" || e.code === "NumpadSubtract") {
      mapZoomTo(bigmap.zt / 1.6);
      e.preventDefault();
    }
    if (e.code === "Home") {
      mapCentreTruck();
      e.preventDefault();
    }
  }
});
// window.__BIGRIG_NOBOOT (set by a test before the page scripts run) stops the automatic boot
requestAnimationFrame(() => setTimeout(() => window.__BIGRIG_NOBOOT || boot(), 30));

cv.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (!bigmap.open) return;
  const [x, y] = canvasPos(e);
  routeToMapPoint(x, y);
});
addEventListener("keydown", (e) => {
  if (e.code === "KeyX" && NAV.route && !e.repeat) userCancelRoute();
});

// v7 keys: J job board, U unload, Esc closes panels; while a panel is open, game keys are swallowed
addEventListener(
  "keydown",
  (e) => {
    if (!world.ready) return;
    if (career.uiOpen) {
      if (
        e.code === "Escape" ||
        (e.code === "KeyJ" && (career.uiOpen === "board" || career.uiOpen === "armyboard"))
      ) {
        if (career.uiOpen !== "result") closeUI();
      }
      e.stopImmediatePropagation();
      if (e.code !== "F11") e.preventDefault();
      return;
    }
    if (e.code === "KeyJ" && !e.repeat) {
      if (!started) startGame();
      openBoard();
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    if (e.code === "KeyU" && !e.repeat && started) {
      tryUnload();
      e.preventDefault();
    }
  },
  true,
);
cv.addEventListener(
  "pointerdown",
  (e) => {
    const b = career.unloadBtn;
    if (!b || bigmap.open) return;
    const [x, y] = canvasPos(e);
    if (
      x >= b[0] &&
      x <= b[0] + b[2] &&
      y >= b[1] &&
      y <= b[1] + b[3] &&
      career.active &&
      career.active.phase === "deliver"
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      downAt = null;
      career.unlTap = performance.now();
      tryUnload();
    }
  },
  true,
);
cv.addEventListener(
  "pointerup",
  (e) => {
    if (career.unlTap && performance.now() - career.unlTap < 800) {
      career.unlTap = 0;
      e.stopImmediatePropagation();
    }
  },
  true,
);

// v27: two-finger pinch zoom (centred on midpoint) + pan on the world map
{
  const P = new Map();
  let pin = null;
  cv.addEventListener("pointerdown", (e) => {
    if (!bigmap.open || e.pointerType !== "touch") return;
    P.set(e.pointerId, canvasPos(e));
    if (P.size === 2) {
      bigmap.drag = null;
      downAt = null;
      if (bigmap.lp) {
        clearTimeout(bigmap.lp);
        bigmap.lp = null;
      }
      const [a, b] = [...P.values()];
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      pin = {
        d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
        z: bigmap.z,
        wx: bigmap.cx + (mx - VW / 2) / bigmap.z,
        wy: bigmap.cy + (my - VH / 2 - 10) / bigmap.z,
      };
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!P.has(e.pointerId)) return;
    P.set(e.pointerId, canvasPos(e));
    if (pin && P.size >= 2) {
      const [a, b] = [...P.values()];
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2,
        d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const z = Math.max(mapFitZ(), Math.min(14, (pin.z * d) / pin.d));
      bigmap.z = bigmap.zt = z;
      bigmap.anchor = null;
      bigmap.cx = pin.wx - (mx - VW / 2) / z;
      bigmap.cy = pin.wy - (my - VH / 2 - 10) / z;
      mapClamp();
      bigmap.drag = null;
    }
  });
  const up = (e) => {
    P.delete(e.pointerId);
    if (P.size < 2 && pin) {
      pin = null;
      bigmap.drag = null;
      downAt = null;
    }
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
}

// bake missing chunks in a 1-chunk ring round the visible ones (2 ahead in the travel direction), nearest first;
// never more than `budget` per frame and never more than the LRU can keep alongside the visible set
function chunkRing(c0x, c1x, c0y, c1y, budget) {
  const f = fwd(truck.h),
    sg = Math.sign(truck.v || 1),
    dx = f[0] * sg,
    dy = f[1] * sg,
    X0 = c0x - 1 - (dx < -0.3 ? 1 : 0),
    X1 = c1x + 1 + (dx > 0.3 ? 1 : 0),
    Y0 = c0y - 1 - (dy < -0.3 ? 1 : 0),
    Y1 = c1y + 1 + (dy > 0.3 ? 1 : 0);
  if ((X1 - X0 + 1) * (Y1 - Y0 + 1) > 84) return;
  const mx = (c0x + c1x) / 2,
    my = (c0y + c1y) / 2,
    miss = [];
  for (let cy = Y0; cy <= Y1; cy++)
    for (let cx = X0; cx <= X1; cx++)
      if (!chunkCache.has(cx + "," + cy))
        miss.push([cx, cy, Math.hypot(cx - mx, cy - my) - ((cx - mx) * dx + (cy - my) * dy) * 0.8]);
  miss.sort((a, b) => a[2] - b[2]);
  for (let i = 0; i < miss.length && i < budget; i++) getChunk(miss[i][0], miss[i][1], true);
}
