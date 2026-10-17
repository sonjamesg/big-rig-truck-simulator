# AGENTS.md — Big Rig Truck Simulator

Notes for anyone (human or agent) changing this repo. Keep it accurate. If you change the architecture or the build, update it.

## Architecture

A single-page browser game drawn on one 2D `<canvas id="game">` (no WebGL, no framework). `world.js` generates a tile
grid (`MW`×`MH` tiles, `TILE` = 32 px, `M_T` = 4 m per tile, `PPM` = 8 px per metre). Roads are stored as straight
**segments** (`world.segs`: `dir` `'h'`/`'v'`, cross position `a`, width `w`, span `b0..b1`), with per-tile lookups in
`world.roadH` / `world.roadV`, plus junctions, roundabouts, curves and flyovers. `render.js` bakes the ground into
cached 512 px chunks (`getChunk`, with a low-res LOD `getChunkLo`). These chunks are also reused by the map (`mapov.js`).
`traffic.js` runs AI vehicles on a lane graph with IDM car-following and GTA2-style ring spawning around the player.
Police, ambulance and fire vehicles are ordinary traffic cars with a `role`, or kinematic actors once they leave the
sim. `main.js` owns the loop (update → draw → HUD), the camera, the minimap and the full map (M). It also sets up the
**`window.__bigrig`** debug hook (`world`, `ready` flag, load stages), which every Playwright test waits on
(`__bigrig.world.ready`). There is no backend for gameplay. Accounts, cloud saves and public servers use Supabase
(`accounts.js`, `server.js`), and peer-to-peer multiplayer uses PeerJS (`mp.js`).

## Build order (build.py) and why it matters

`python3 build.py` concatenates, in this exact order, `peerjs.min.js`, the engine WAV (`engine_b64.txt` as
`ENGINE_WAV_B64`), optional `railbake.json` (`window.RAIL_BAKE`), `window.MAP_URL` (index.html) or the inlined `window.MAP_DATA`
(BigRig.html) from `src/map/`, then the files below. `mapload.js` comes just before `main.js`. The result goes into
`src/template.html` at `/*SCRIPT*/`, and writes `index.html`, `BigRig.html`, `dist/BigRigWeb/` and `BigRigWeb.zip`.

**Every file shares one global scope**: one `<script>`, with no modules or imports. Consequences:
- Top-level `const`/`let`/`class` are in the temporal dead zone until their file has run. Code that runs **at load time**
  may only use names from files *earlier* in the order. Code inside functions called later (per frame) can use anything.
- Later files extend earlier ones by wrapping globals (for example `drawPolice = function(){...}` inside a
  `setTimeout(..., 0)` so every file has loaded first). Order decides which wrapper runs outermost.
- `keyguard.js` must stay first (it wraps `addEventListener` for key events). `main.js` comes late because it calls
  into almost everything at boot.
- A duplicate top-level name breaks the whole bundle (SyntaxError) or silently replaces a function. Check `SYMBOLS.md`.

## Which file owns what

| # | file | owns |
|---|---|---|
| 1 | `keyguard.js` | key guard, loaded FIRST: wraps window key handlers so inputs never reach the game and hotkeys wait for game start |
| 2 | `world.js` | WORLD GENERATION: tile grid (MW x MH, TILE px / M_T m per tile), landmasses, road segments + junctions, roundabouts, curves, flyovers, towns |
| 3 | `render.js` | TEXTURES & CHUNK RENDERING |
| 4 | `bldg2.js` | buildings: seeded footprints, materials, facades, roof furniture (baked into chunk canvases) |
| 5 | `lorry.js` | LORRY ART (drawn once, rotated freely) |
| 6 | `physics.js` | LORRY PHYSICS |
| 7 | `audio.js` | AUDIO: WebAudio context + master volume, diesel engine (recorded idle pitch-shifted by RPM + synth rumble), horn, tyres, ambience |
| 8 | `traffic.js` | AI TRAFFIC (GTA2-style ring spawning, lane graph, IDM following) |
| 9 | `markings.js` | UK HIGHWAY CODE ROAD MARKINGS + approach lane rules |
| 10 | `signals.js` | SIGNAL PHASING (UK, drive on the left) |
| 11 | `depots.js` | DEPOTS, TRAILERS, COUPLING & EVENT HOOKS |
| 12 | `fuel.js` | FUEL, CASH, DAMAGE (stub) |
| 13 | `sites.js` | SITES: shopping malls / supermarkets (delivery docks), truck dealerships, forecourt art + visitor cars |
| 14 | `services.js` | emergency services: fire stations, police stations, hospitals |
| 15 | `career.js` | CAREER: missions to malls, XP / tiers, truck dealership, save game |
| 16 | `ui.js` | UI: job board, dealership, results, tier unlock (DOM overlay inside #frame so it works in fullscreen) |
| 17 | `ambient.js` | AMBIENT LIFE (cheap, culled to the view) |
| 18 | `satnav.js` | SAT NAV: A* over the road tiles, route guidance |
| 19 | `gamepad.js` | XBOX CONTROLLER (Gamepad API, standard mapping) — works alongside the keyboard |
| 20 | `mp.js` | MULTIPLAYER — PeerJS (WebRTC, free public broker, no backend). Star topology: host relays. |
| 21 | `mobile.js` | MOBILE: landscape thumb layout (controls in side gutters, never over the HUD) + portrait handheld deck |
| 22 | `haptics.js` | Haptics: phone vibration on touch controls. Feature-detected, touch-only, toggle in SETTINGS.vib (saved with game). |
| 23 | `breakdown.js` | BREAKDOWN at 100% damage |
| 24 | `indicators.js` | PLAYER INDICATORS (UK): Q/E, pad D-pad L/R, LB+RB or Z hazards, touch; self-cancelling; lamps, HUD, tick-tock, MP |
| 25 | `beams.js` | HEADLIGHTS: dipped (default, UK left-biased) / full beam toggle. L key, pad D-pad down, touch BEAM; saved; MP flag bit 64 |
| 26 | `fx.js` | FX: exhaust puffs, wheel-lock skid marks/smoke, crash explosions |
| 27 | `port.js` | living container ports (Albion + Kingsbridge) |
| 28 | `porttrucks.js` | port hauliers: persistent AI container trucks on the real road network |
| 29 | `owndepot.js` | player-owned haulage yards: purchase, tiers, yard trucks (ownership is local to this client save) |
| 30 | `homes.js` | purchasable homes + estate agents |
| 31 | `tune.js` | TRUCK CUSTOMISER core (cz): CZ_PARTS catalogue, tune shop bays at repair garages + owned yards, fitting/effects |
| 32 | `tune2.js` | truck customiser stage 2: gearbox, suspension, fuel tank, exhaust, armour |
| 33 | `tune3.js` | truck customiser stage 3: bumpers, lights, horns, cab extras, decals + company livery, MP sync |
| 34 | `tune4.js` | truck customiser stage 3b: truck model art overhaul (in-game + dealer) |
| 35 | `repair.js` | REPAIR BAYS: a drive-in REPAIR box beside the TUNE SHOP box at every truck repair garage |
| 36 | `park.js` | owned trucks you aren't driving, parked in marked bays at your home yard (local only, never sent in MP) |
| 37 | `rail.js` | RAILWAY: double-track main line, stations, passenger + freight trains as pure functions of game time |
| 38 | `daynight.js` | day / night cycle (game clock) |
| 39 | `nightmap.js` | night map style (world map + minimap) |
| 40 | `mapov.js` | map overview: the M map + minimap are drawn from the real game chunks (same renderer as the world / fly-mode LOD), |
| 41 | `weather.js` | weather: random clear / rain / fog cycles (host-synced in MP, saved) |
| 42 | `main.js` | MAIN: staged world generation + loading bar, game loop (update/draw), camera, HUD, minimap + full map (M), input, window.__bigrig debug hook |
| 43 | `home.js` | home / title screen: animated night-road backdrop, green loading bar, settings panel, version footer |
| 44 | `roadlaw.js` | ROAD LAW: offences & fines (one module), UK speed limits, speed cameras |
| 45 | `police.js` | POLICE AI: patrols from police stations, line-of-sight detection, chase, fines + arrest |
| 46 | `wanted.js` | wanted stars (capped at 2 for now): heat score, 2-star police response, roadblocks |
| 47 | `rbx.js` | ROUNDABOUTS: 3-lane spiral markings, signalised entries, landscaped lit island |
| 48 | `airport.js` | ALBION AIRPORT: runway, taxiways, HAS dispersals, hangars, civil terminal, landside car parks; aircraft as pure functions of timeS |
| 49 | `milbase.js` | SANDVALE MILITARY BASE (replaced Sandvale Intl): base roads (sg.mil, civilians filtered out), fence/towers/buildings, Army Logistics Depot (ALD) + military trailers, AI military gate traffic + barriers, base junctions unsignalised except the two depot T-junctions on the spine (MB_SIG: gate avenue x1248 + depot yard road x1292, UK signals), helicopter art, rifle range + parade soldiers, night lighting (base street lamps + baked floodlights), searchlights |
| 50 | `heli.js` | HELICOPTERS: 4 real entities flying missions base <-> remote helipads (hospital/police roofs, airport, docks); take-off/cruise/landing state machine, shadow, rotors, nav lights + strobes, rotor sound, minimap + map icons; airborne (no traffic collisions) |
| 51 | `bm.js` | BLACK MARKET: 4 seedy yards (fenced, shed, drop bay, sign; map/minimap/fast travel/sat nav), separate Black Market Jobs board (same design as the normal board; opened from the JOBS button/J/Menu or the JOB BOARD ground box; BM_MISSIONS registry + rotating Depot Theft offers), Tank Heist + Depot Theft shared heist flow: riflemen/MG soldiers (run to cover, kneel, tracers, flashes, casings, dust misses, bullet holes), 2-star escape (bmWanted2/bmLoseUpdate: search circle, off-screen police top-ups, lose timer), numbered reverse-in yard bays (bmBays; completes ONLY on uncouple in a valid bay, bmOnDrop), payout breakdown (bmPayout: damage deduction, time + no-kill bonus); v47 extras: stealth window + searchlight/guard detection, gate lockdown (ram the barrier, milbase.js), army jeep pursuit (bmJeep*), stingers at roadblocks, smoke at low health, live cargo value, chase music, busted ending (fine + cargo seized, keep truck), random tank/bay per replay, touch damage x0.8, save safety (heists never saved; bigrig.bmAbandon notice) |
| 52 | `ambulance.js` | AMBULANCE: casualties stay down until paramedics treat them |
| 53 | `fire.js` | FIRES: buildings near the player catch fire; the nearest fire station's engine responds |
| 54 | `flycam.js` | admin-only fly camera (G / FLY button): truck holds its handbrake, free camera pans/zooms, click/tap or Tab/LB/RB to follow AI vehicles |
| 55 | `accounts.js` | Supabase accounts: name + 4-digit PIN via SECURITY DEFINER RPCs; cloud save sync; guest/offline fallback |
| 56 | `invite.js` | Invite landing: opened via ?join=TRUCK-1234 -> dedicated "You're invited" card (log in / create / guest / remembered), then straight into the host's game |
| 57 | `server.js` | Public servers over Supabase Realtime (no host needed, cap 15). Presence = player list + cap, Broadcast = poses. Home MULTIPLAYER card: SERVERS modal (list, count/cap, tap to join) + HOST GAME modal (PeerJS invite code, link copy/share, players x/6, start/close) |
| 58 | `homecard.js` | Home card: one clear "who am I" card. Account remembered -> Welcome back <name> + CONTINUE + Switch account |

Notes on ownership:
- **Police**: all police logic is in `police.js` (patrols, detection, chase, fines and arrest, hide boxes, the siren
  synth `emSiren`) and `wanted.js` (heat score, stars, 2-star response, roadblocks). Offence and fine records live in
  `roadlaw.js` (`OFF`).
- **Emergency response**: blue-light vehicles (`emOnBlue`) weave via a lateral-offset probe in `traffic.js`
  (`v.emWant`) and creep through red lights; other cars yield to the kerb (`emYield`). Fire engines park at a kerb point
  beside the burning building (`fireRoadPt`; the last stretch is kinematic, `fireApproach`). Fire and ambulance crews
  leave from where they parked (`emRejoin`: drive to the kerb lane ahead, then spawn into traffic exactly there).
- **Customiser**: `tune.js` (the `CZ_PARTS` catalogue and core logic), with `tune2.js`, `tune3.js` and `tune4.js` as
  later stages. `repair.js` holds the repair bays.
- **Ports**: the yard, cranes, ships, gate lane and rail siding are in `port.js`. AI hauliers on public roads are in
  `porttrucks.js`.
- **Desktop window size**: `fit()` in `main.js` scales the title bar + frame to fill the viewport (legend beside the
  frame on wide screens, compact rows below otherwise) and sets `RSF` (canvas backing px per logical px = CSS scale ×
  devicePixelRatio, max 2). Game code still draws in logical VW×VH coordinates; **every main-canvas `ctx.setTransform`
  must multiply by `RSF`** (phones keep RSF 1 and their own layout in `mobile.js`).
- **Fast travel**: big-map icons and their targets come from one list, `mapPOIList` in `satnav.js` (the live data the
  icons are drawn from). `ftTarget(o, icon)` picks the depot/yard rect, then the place's own drivable ground
  (`ftPlaceSpot`: fuel HGV lane or forecourt, garage bay), then the nearest kerbside lane (`ftRoadSpot`, straight
  segments) or bend (`ftCurveSpot`). `ftJobBlock` refuses fast travel during any job, heist or wanted level. Check:
  `tests/fasttravel_poi_test.py`.
- **Trigger popups** (yard sale, homes, dealers, depot and Black Market boards) are edge-triggered with `trigFresh` /
  `trigUsed` (`ui.js`): they open only after the truck drives into the zone, never on load, respawn or fast travel
  (`rigPlace` calls `trigReset`). Check: `tests/trigger_popup_test.py`.
- **Map**: drawing is in `main.js` (`drawMinimap`, `drawBigMap`). The real-chunk overview and the airport overlay are
  in `mapov.js`, the night style is in `nightmap.js`, and route and POI hit-testing are in `satnav.js`.
- `src/template.html` is the page shell (DOM, CSS and the mobile deck). `src/peerjs.min.js`, `src/engine_b64.txt` and
  `src/railbake.json` are vendored or generated data. Don't edit or format them.

Every src file starts with a `@file` header (purpose, exposed globals, dependencies, load position). Keep it current
when you change a file.

## Build and test

```bash
python3 build.py                  # -> index.html, BigRig.html, dist/, BigRigWeb.zip
python3 tools/gen_index.py        # regenerate SYMBOLS.md after any src edit (also reports duplicate names)
npx prettier@3 --write src/*.js src/template.html   # .prettierrc: printWidth 100; .prettierignore skips vendored files
```

Tests are Python Playwright scripts in `tests/` that drive the built page in headless Chrome
(`/usr/bin/google-chrome`, swiftshader GL). Most default to `../BigRig.html`, so **build first**. Run them one at a
time, for example:

```bash
python3 tests/port_test.py BigRig.html 1        # port logistics soak (days)
python3 tests/roundabout_test.py
python3 tests/spawn_lane_test.py
```

Available: `channel_diagonal_usage_check.py`, `dock2_test.py`, `dock3_traffic_test.py`, `dock4_probe.py`, `dock_shots.py`, `flyover_test.py`, `haptics_test.py`, `junction_audit_test.py`, `junction_live_screens.py`, `kingsbridge_test.py`, `kn_live_screens.py`, `landscape_aspect_test.py`, `live_overlap_check.py`, `port_test.py`, `rail_route_test.py`, `reverse_lock_test.py`, `road_audit_test.py` (static road-network audit: dead ends, curve kinks, reachability, rail crossings, unmarked roads, fuel gaps), `roundabout_test.py`, `spawn_lane_test.py`, `train_curve_probe.py`, `train_ship_shots.py`.
Each script waits on `window.__bigrig.world.ready`, calls `startGame()` and then evaluates game globals directly.
Check for `pageerror` / console errors when you add a test.

## Rules

- **Never add an empty `catch`.** Handle the error, or record it somewhere visible (for example `OVL.err = String(e)`,
  `WANT.err`, `APX.err`) so tests can see it.
- **Before adding a top-level name, check it is unique** across all files (`SYMBOLS.md` / `python3 tools/gen_index.py`).
  Prefer a module prefix (`pol*`, `want*`, `ov*`, `cz*`, `port*`).
- **Customiser: extend it by adding entries to `CZ_PARTS`** (tune.js). Don't monkey-patch customiser functions.
- **Fix at the source.** Don't stack another `tune*.js`-style patch file or wrapper on top of a bug; change the owning
  file.
- **Keep Prettier formatting** (`.prettierrc`, print width 100). Format before committing.
- **Never commit secrets** (API keys, tokens, passwords, service-role keys). The Supabase anon/publishable key is the
  only key that belongs in client code.
- **Don't touch the git stash** (`stash@{0}`: "port-v16 curvy port WIP (paused)"). Don't pop, drop or apply it.

## James's standing preferences

- **UK roads**: drive on the left, clockwise roundabouts, UK signals and markings (Highway Code).
- **Units: mph** for every speed shown to the player.
- **2D top-down canvas style.** No pixel art and no 3D.
- **Every feature must work on keyboard, Xbox-style controller (`gamepad.js`) and phone (`mobile.js`, touch).**
- **Elevation changes (new bridges, flyovers, height levels) need James's approval first.**

## Map data file (src/map/) — the game loads the world from it

`src/map/` **is the world**. At boot `mapload.js` restores every serialisable piece of state that `genWorldSteps`
used to build (tiles, roads, junctions, objects, depots, services, homes, rail route, timetable…) from it; the
generator does not run. **Edit these files and rebuild, and the game changes.**

- `src/map/manifest.json`: list of parts, one per `<root>.<key>` (roots: `world`, `traffic`, `BigRig`, `SVC`,
  `HOMES`, `RAIL`, plus the scalar `trlSeq`). `derived` parts (`world.chunkObjs`) are rebuilt in code
  (`worldChunkIndex`), not stored.
- `src/map/state/<root>.<key>.json`: the value. Plain JSON plus markers (full list at the top of mapload.js):
  `$i`/`$r` shared object + back-reference (keep ids consistent if you hand-edit), `$tab`/`$tabs` tables (one row
  per object, column names in the header), `$t` typed arrays (`tile` = a file in tiles/), `$m` Map, `$s` Set,
  `$n` NaN/±Inf/−0, `$u` undefined, `$h` hole, `$f` function rebuilt in code (`regionAt`, `isDesert`,
  `taperHs`, `rlTrackFn` with args, `global:<name>`), `$c` trailer art canvas.
- `src/map/tiles/<layer>.rle.gz`: full-grid typed arrays, gzip of LEB128 `(value,count)` runs, zig-zag for signed.
- Canvases and functions are never stored: they're recreated in code. Objects that existed before generation
  (`world.ground` aliased as `G`, etc.) are refilled in place so aliases survive.
- Generator-only debug handles (`RAIL.hard`, `_CL`, `_CO`, `_dist`, `_tgt`, `_clearLine`) aren't stored.

Build: `build.py` packs the data into `mapdata.bin` (next to index.html, in dist/ and the zip), fetched at boot
(started as soon as the script loads). `index.html` stays ~2.5 MB. `BigRig.html` (gitignored single file) inlines
the same data as base64 so it works from `file://`. `index.html` opened from `file://` can't fetch, so it falls back
to the generator (slow but identical). A decode failure after the world is touched reloads with `?mapgen=1`.

Old generator / verification:
- `?mapgen=1` (or `window.__BIGRIG_MAPGEN`) runs `genWorldSteps` as before.
- **After any change to world generation code**: `python3 build.py && python3 tools/export_map.py && python3
  build.py && python3 tools/verify_map.py`. The export rewrites src/map/ (deterministic). verify_map compares a
  deep fingerprint of every global, a full re-serialisation, `G === world.ground` and sampled rebuilt functions
  between the generator and the data path (served over http); it must print `OK`. Timings and the random
  fire/police countdowns are masked (they differ between any two runs).
- If you hand-edit src/map/ instead, verify_map will (correctly) report a mismatch with the generator; that's
  expected — the data file is then the source of truth, and re-exporting would overwrite your edits.

## Reference map grid (tools/mapgrid.py, tools/mapviewer.py)
James marks up these maps and sends screenshots; map each mark back to tiles with:
- Column letters: A=0, B=1 … Z=25, AA=26, AB=27 …; rows are numbers from 1.
- Whole-map square `<C><R>` (64 tiles): tiles x = 64·col … 64·col+63, y = 64·(R−1) … 64·(R−1)+63.
- City square `<CITY>-<C><R>` (16 tiles): x = X0 + 16·col … +15, y = Y0 + 16·(R−1) … +15, where X0/Y0
  (multiples of 16, = city street grid bounds minus 12 tiles, snapped down) are printed on the page / viewer.
- Tile (tx, ty) = world pixels tx·32 … tx·32+31 (TILE = 32 px = 4 m); map is 2048×2048 tiles.
Regenerate: `python3 build.py && python3 tools/mapviewer.py` → /workspace/mapgrid/BigRig_Map_Viewer.html
(one offline HTML, WebP pyramid, grid toggle, live tile/grid readout, city jump + search incl. "ASHBY-C4",
"K7" or "x,y"; Sandvale Military Base is a city box with prefix BASE-<C><R>; depots, fuel stations, Black Market
yards and helipads are searchable POI markers — search "fuel", "helipad", "black market" etc.). `python3 tools/mapgrid.py [--pdf]` writes the gridded PNGs. The viewer's in-browser readout
uses the same formulas.
