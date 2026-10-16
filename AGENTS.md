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
`ENGINE_WAV_B64`), optional `railbake.json` (`window.RAIL_BAKE`), then the files below. The result goes into
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
| 49 | `ambulance.js` | AMBULANCE: casualties stay down until paramedics treat them |
| 50 | `fire.js` | FIRES: buildings near the player catch fire; the nearest fire station's engine responds |
| 51 | `flycam.js` | admin-only fly camera (G / FLY button): truck holds its handbrake, free camera pans/zooms, click/tap or Tab/LB/RB to follow AI vehicles |
| 52 | `accounts.js` | Supabase accounts: name + 4-digit PIN via SECURITY DEFINER RPCs; cloud save sync; guest/offline fallback |
| 53 | `invite.js` | Invite landing: opened via ?join=TRUCK-1234 -> dedicated "You're invited" card (log in / create / guest / remembered), then straight into the host's game |
| 54 | `server.js` | Public servers over Supabase Realtime (no host needed). Presence = player list + cap, Broadcast = poses. |
| 55 | `homecard.js` | Home card: one clear "who am I" card. Account remembered -> Welcome back <name> + CONTINUE + Switch account |

Notes on ownership:
- **Police**: all police logic is in `police.js` (patrols, detection, chase, fines and arrest, hide boxes, the siren
  synth `emSiren`) and `wanted.js` (heat score, stars, 2-star response, roadblocks). Offence and fine records live in
  `roadlaw.js` (`OFF`).
- **Customiser**: `tune.js` (the `CZ_PARTS` catalogue and core logic), with `tune2.js`, `tune3.js` and `tune4.js` as
  later stages. `repair.js` holds the repair bays.
- **Ports**: the yard, cranes, ships, gate lane and rail siding are in `port.js`. AI hauliers on public roads are in
  `porttrucks.js`.
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

Available: `channel_diagonal_usage_check.py`, `dock2_test.py`, `dock3_traffic_test.py`, `dock4_probe.py`, `dock_shots.py`, `flyover_test.py`, `haptics_test.py`, `junction_audit_test.py`, `junction_live_screens.py`, `kingsbridge_test.py`, `kn_live_screens.py`, `landscape_aspect_test.py`, `live_overlap_check.py`, `port_test.py`, `rail_route_test.py`, `reverse_lock_test.py`, `roundabout_test.py`, `spawn_lane_test.py`, `train_curve_probe.py`, `train_ship_shots.py`.
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

## Map data file (src/map/) — stage 1: export only

`src/map/` is a **snapshot of the procedural world**, written by the exporter. The game does **not** read it yet;
the world is still generated at load by `genWorldSteps` (world.js and the build steps it yields into). Editing these
files changes nothing in-game until stage 2 (below) is done.

Regenerate after any change to world generation:

```bash
python3 build.py && python3 tools/export_map.py          # rewrites src/map/ (deterministic: same code -> same bytes)
python3 build.py && python3 tools/export_map.py --check  # only verifies the tile layers decode exactly, no write
```

`tools/map_export.js` runs inside the built page after generation (read-only). `tools/export_map.py` drives it
with Playwright, then decodes every layer again and compares an FNV-1a hash against the live world before writing.

Format:
- `src/map/map.json`
  - `meta`: `MW`, `MH` (tiles), `TILE_px` (32), `metres_per_tile` (4), and a count of every `world.objects` kind.
  - `layers`: one entry per full-grid typed array in `world` (`ground`, `under`, `water`, `roadH`, `roadV`, `fd`,
    `des`, `reserved`, `jMask`, `rbMask`, `cornerAt`, `cvOwn`, `foZ`, `foF`). Each entry has `type`, `len`
    (`MW*MH`, row-major `i = y*MW + x`), `fnv1a` (a hash of the raw bytes) and `file`.
  - `entities`: labelled lists. Every item has an `id`, a `type`, a `name` and a position or geometry, in **tiles**
    unless the field name says otherwise. The lists are `roads` (straight segments: `dir`, `a`, `w`, `b0`, `b1`,
    `rect_tiles`), `curvedRoads` (`pts_tiles`), `junctions`, `roundabouts`, `buildings`, `depots`, `fuelStations`,
    `garages`, `services` (hospital, police and fire), `malls`, `dealers`, `ports`, `airports`, `bridges`
    (suspension, flyover and curved bridges), `rail` (main line, sampled every 8 track samples), `stations` and
    `towns` (map labels).
- `src/map/tiles/<layer>.rle.gz`: the exact grid, gzip of a run-length stream of LEB128 varint pairs
  `(value, count)`. Values of `Int16Array`/`Int32Array` layers are zig-zag encoded (`v>=0 ? 2v : -2v-1`).
- Size: about 0.85 MB of gzipped tiles plus 1.5 MB of JSON. Inline only what the game needs, gzipped, when wiring
  stage 2, and measure phone load time against generation (~14 s on desktop today, mostly the railway route).

Not done yet (stages 2–3): loading the world from this data instead of generating it. Doing that exactly needs more
than these layers and lists:
- the full `world` object graph (about 313k nodes, with shared references, Maps and per-object fields such as the
  segment↔junction links, `chunkObjs` and the port, airport and rail internals);
- the module globals that generation fills (for example `RAIL`, services, homes, trailers);
- re-creating the canvases and functions it holds (trailer art, `regionAt`, `isDesert`, `roadClear`).

Verification must then compare every list as well as the tile grids.
