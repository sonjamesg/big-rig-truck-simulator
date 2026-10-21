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
| 10a | `peds.js` | PEDESTRIANS: walk mask, crossing map, area density, route planner, looks, drawing |
| 11 | `depots.js` | DEPOTS, TRAILERS, COUPLING & EVENT HOOKS |
| 12 | `fuel.js` | FUEL, CASH, DAMAGE (stub) |
| 13 | `sites.js` | SITES: shopping malls / supermarkets (delivery docks), truck dealerships, forecourt art + visitor cars |
| 13a | `ltg.js` | LGV TRAINING GROUND (v54, ex Kingsbridge Field airfield): world gen + chunk-baked zone paint, physical cones, timed cone loop, e-stop light, wet skid pan grip, map icon/POI, floodlights |
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
| 52 | `army.js` | ARMY LOGISTICS (tier 3): military trailer art (helicopter w/ folded rotors, jeeps on a flatbed, wide tank low-loader, green fuel tanker, green ARMY containers, missile w/ huge warhead) + board card SVGs; Army Logistics board: ALD export runs to docks/harbour/airport |
| 53 | `ambulance.js` | AMBULANCE: casualties stay down until paramedics treat them |
| 54 | `fire.js` | FIRES: buildings near the player catch fire; the nearest fire station's engine responds |
| 55 | `bikes.js` | MOTORBIKES: sport/cruiser/scooter/delivery bikes join AI traffic by road type (never MIX/parked, so map data is unchanged); single lamp at night; lane filtering past slow queues; knock-offs (bike slides, rider tumbles); biker gangs (kinematic followers on the leader trail); biker revenge chase (HUD banner, shooting, escape by distance/LOS/knock-offs, never during jobs/BM/heists) |
| 56 | `liftbridge.js` | LIFT BRIDGE: double-leaf bascule in the M1 crossing over the bottom-docks channel (replaces the suspension cables there); opens on a timeline from the deterministic ship schedule; pseudo-3D leaves/towers (oblique projection), road signals + half barriers stopping AI and the player; jump off a rising leaf or fall in and get towed |
| 57 | `gfx.js` | GRAPHICS: quality setting (Auto/High/Low, `bigrig.gfx`) + FPS auto-fallback; time-of-day colour grade; coloured half-res light layer (headlight cones, streetlight pools, window halos), brake/indicator glow, vehicles lit by lamps/headlights |
| 58 | `gfxshade.js` | GRAPHICS stage 2: sun-driven soft shadows (high quality): baked building/tree casters recorded per chunk, cached half-res world-space shadow layer composited after vehicles; blurred, sun-offset vehicle/trailer shadows |
| 59 | `gfx3d.js` | GRAPHICS stage 3: fake-3D buildings (GTA2 parallax): roof lifted from the view centre by height, sun-shaded side walls with window pattern, lit walls at night (high quality, not when zoomed far out) |
| 60 | `gfxcity.js` | GRAPHICS overhaul (night city mood, straight top-down, no outlines): baked road wear + puddles, wet-road colour reflections at night; later stages add rooftops, grading/haze and vehicle art |
| 61 | `flycam.js` | admin-only fly camera (G / FLY button): truck holds its handbrake, free camera pans/zooms, click/tap or Tab/LB/RB to follow AI vehicles |
| 62 | `accounts.js` | Supabase accounts: name + 4-digit PIN via SECURITY DEFINER RPCs; cloud save sync; guest/offline fallback |
| 63 | `invite.js` | Invite landing: opened via ?join=TRUCK-1234 -> dedicated "You're invited" card (log in / create / guest / remembered), then straight into the host's game |
| 64 | `server.js` | Public servers over Supabase Realtime (no host needed, cap 15). Presence = player list + cap, Broadcast = poses. Home MULTIPLAYER card: SERVERS modal (list, count/cap, tap to join) + HOST GAME modal (PeerJS invite code, link copy/share, players x/6, start/close) |
| 65 | `homecard.js` | Home card: one clear "who am I" card. Account remembered -> Welcome back <name> + CONTINUE + Switch account |
| 66 | `ctrltheme.js` | phone controller theme: midnight-black deck, dark buttons with crisp 2 px neon-blue outline borders (brighter when pressed); colours only, layout stays in `mobile.js` |
| 67 | `milrig.js` | dealer truck Bastion M6 6x6 (£35k): green military heavy tractor, very high power, sturdy (`dur` crash-damage multiplier), slightly lower top speed; own art (wraps `modelArt` outermost) |

Notes on ownership:
- **Roundabouts (v51)**: splitters are narrow raised kerb medians (`rbSplitter(rb, arm)` = `g.spN`, half-width `RB_MED`);
  the old triangular outline (`rbSplitter(rb, arm, true)` = `g.spF`) is only painted hatching and is what `rbPaint` uses,
  so map tiles never change. Signal heads sit on the left verge (primary + repeater). Give-way dashes at every entry.
  Approach lanes (`rbLanes`): 2 lanes LS|R, 3 lanes L|S|R; `rbApprFix()` re-applies them after the map loads.
- **Army Logistics** (`army.js`, v51, tier 3): new trailer kinds `heli`, `jeeps`, `oilmil`, `missile` (added to
  `TRAILER_TYPES` + `MB_TRL`); `alTrailerCanvas` also redraws `lowtank` (tank wider than the 2.55 m deck, canvas 3.9 m)
  and `army` (two green 20 ft ARMY containers), so parked/AI military trailers change too. `trlSVG` is wrapped for the
  board card side views. Jobs: `AL_CARGOS` are pushed into `CARGOS` with `army: 1` (save/load and results work;
  `makeJob`/`makeRepeat` skip them). `alJobs()` = one order per cargo from ALD to APT/KHT/AAC (refresh 10 min).
  `alOpenBoard(force)` (modal kind `armyboard`) opens instead of the normal board at ALD; elsewhere the normal board gets
  an "Army Logistics" chip. Starting uses the normal `startMission`/`acceptJob` (tier 3 gate). Map data unchanged.
- **City overhaul** (`gfxcity.js`, v51): stage A roads. `renderChunk` (outermost wrapper) bakes `gcRoadWear` on every
  `T.ROAD` tile (tyre tracks from `roadH` / `roadV`, cracks, patches, oil, `gcPuddle` patches; all from `gcHash`, so
  stable). `gcWetNight` (after `drawNight`, high only) adds puddle + lamp-pool reflections in `GC.pal`
  (magenta / cyan / amber in city + suburb zones, amber rural). Switches: `GFX.off.wear`, `GFX.off.wet`.
  Stage B rooftops: `gcRoofBits(o)` (cached on `o.gcRB`) gives skylights + vents in the upper roof (clear of the
  facade strip); `drawObject` wrapper bakes them (`gcRoofBake`), `gcRoofLive` (after `drawNight`, high) lights
  skylights in `GC.pal` as flat panels + glow (no outlines) and draws drifting steam; `gcRoofPt` follows the 3D lift.
  Stage C light: `gfxGradeAt` wrapper (high, night) blends a teal multiply `GC_TEAL` and a faint haze wash `GC_HAZE` into
  the cached grade sprites (no extra passes by day); headlight cone alpha raised in `gfx.js`. `GFX.off.grade` switch.
  Stage D vehicles: `makeCarArt` / `makeVanArt` / `makeBusArt` / `makeBoxArt` / `makeTractorArt` / `makeTrailerArtAI`
  are wrapped by `gcVehGloss` (source-atop flank shading, clear-coat sheen, faint sky streak; baked once, both
  qualities, `GFX.off.vgloss`). Not built yet: skid-mark decals per crash, rooftop sign text, haze noise texture.
- **Crash response** (`physics.js` `crashResponse`, v51): impacts are mostly inelastic. The pose reverts to the last free
  one (cab + trailer angle together), velocity along the contact normal is removed with restitution `CRASH_E` (0.06
  solids, 0.1 heavy vehicles; rebound capped at 0.8 m/s), the tangential part slides on with Coulomb friction
  `CRASH_MU` (glancing hits scrape along and turn the cab slightly toward the wall), `s.crunchT` cuts drive for a moment.
  Normal: solidity gradient around `HIT_PT` (set by `bodyHits`) or `s.hitN` from `trafficHitTruck` (heavy AI). Damage
  (`main.js`) = `0.06 * hitV^1.6` (normal impact speed, m/s), capped 25 per hit, times `dmgM`. Light AI vehicles are
  shoved by the OBB push-out and the rig loses `mv/(M+mv)` of its head-on speed. Later ideas (not built): proper
  rigid-body yaw impulse from off-centre hits, trailer swing from side impacts, crumple / part damage, AI-vs-AI
  momentum, debris and skid on impact.
- **Company dashboard trip progress** (`owndepot.js` `ownTrkInfo`, v51): the bar and the "57% complete" line cover the
  whole fleet-truck job (to pickup, loading, delivering, unloading). legs weighted by planned time, each measured by its own remaining distance / dwell; `T.prMax` only rises (keyed by the trip clock
  `T.mT0`, reset when `ownMission` starts the next job); `ownDelivered` sets `T.prDone` so it reads 100 %.
- **Fleet / port lorry routing** (`porttrucks.js`, v52): goal-directed turns via `ptPickExit` (called from `planPiece`
  junction choice and roundabout arm choice in `traffic.js`, `v.ptruck` vehicles only): probe points ~24 m down each exit
  (`tProbeA`) are matched against the A* corridor `v.gk`; off the corridor the exit with the lowest `ptRouteCost`
  (cached A*) wins, and a goal truck may still swap lanes for its turn. `ptToRoad` sets the goal through
  `spawnVehicle(opt.pre)` before the first 90 m are planned (they used to be random). Depot exits: `ptExitDir` /
  `ptExitOK` pull a loaded company truck out towards home; the depot out-phase decides the next leg once (`T.nxt`,
  `T.outG`) and falls back to the other direction after 8 s. Company trucks wait at a busy gate up to 15 s and may
  enter while another truck stands in a different bay. Pinned `v.ptruck` lorries are only culled after 150 s stopped.
- **City grid thinning** (`world.js`, v51, James 19 Oct): `thinGrid(g, keepX, keepY)` runs right after `grid()` (jitter
  draws unchanged) and keeps the edge streets + arterials/outside links: Albion 6x5, Sandvale 5x5, Kingsbridge core 4x4,
  districts ~3-4 each way (thinned after snapping / edge drops), towns lose columns only (their rows are the frontage the
  services/garages/agents need), Ashby untouched (an unthinned grid has no `oxs`; its fills and R() draws are unchanged). `g.oxs/g.oys` keep the original lines: outside roads use
  `thinAt/thinSet` (original line if kept, else nearest kept interior street), crescents use `thinCol`, the port aisles
  use `C1.oys`. Block fills walk the ORIGINAL cells via `gridCells(g, fixed)` (memoised per grid, so landmarks keep their
  cells): a dropped street's strip is split 2+2 between the neighbours with a 2-tile footpath, and ~35% of pairs across
  it merge into one plot (`m`) that gets `splitBuildings(..., big)` (larger lots, 0.6-1.7x heights, no giant shops) or
  a `square()`. `bFurniture` keeps panels/roof gardens to part of a big roof. Homes have `HOME_DEFS[].at` anchors (tried
  first, 48-tile search) so map edits never reshuffle them; a city with a 4-fuel quota finishes it 40 tiles apart.
  Test harness: /workspace/fleet/sim.py (fast-forward, logs legs and deliveries).
- **UK signalised junctions** (`J.uk`, v53, James 19 Oct): signalised city/town x city/town crossroads inside a city or
  Kingsbridge district grid rectangle (+1 tile) get 12 m kerbs (`kr = 3`); everything outside the grids or touching
  rural/dual/hwy keeps its radius (lorry routes). Geometry in px from the box edge: `UKJ_*` in `markings.js` (crossing
  `UKJ_U1..UKJ_U2`, stop line `UKJ_US` = 4.5 tiles, so `lineA` and the AI stop marker move with it). `world.js` (after
  the traffic-lights stage) builds the arms (null = no arm) and pushes overhead `ukjx`; an arm under 7 tiles to the
  previous junction clears `J.uk` (that junction keeps masts, but its 12 m kerbs are already carved). Painted by
  `drawUkApproach` (approach `m.uk` = repaint length) + `drawBoxJunction` (`o.uk`), signals by `drawUkjx` (main.js:
  puffin units; see v53c), night via `DN.sig` `ped` entries in `drawSigNight`. Approach marks for non-UK junctions are still not
  baked: their push had been swallowed by a comment since v40 and is only restored for `J.uk` pending James's review.
  Lorry check (`/workspace/thin/lt_ai.py`): AI trailers (chord model) clear the kerbs on 595/596 left turns; a towed
  trailer from the kerb lane needs the outer exit lane.
  v53b (James feedback): UK junctions keep their mast arms too (`off` = just past the set-back stop line) next to the
  verge poles; a head whose only greens are arrows keeps its red disc lit (red + green filter arrow); puffin units stayed
  red until v53c; filtering right-turners wait inside the box (`dBox`); the AI also takes a car
  straight ahead of its nose as leader while easing into another lane; wet-road night colours come only from real
  lights (`gcWetNight`: warm lamps, signal heads in their current colour, no random palette). Signal soak harness:
  `/workspace/thin/sigsim.py` (red entries, box near misses, opposing right-turn conflicts, stuck, collisions).
  v53c (James 13:24): the verge vehicle poles are gone again (masts only; `ukjx` arms have no `P`), puffins stay. Each
  `J.uk` plan ends with an all-red `ped` stage (`SIG_PED` s, `sigPedLeft(J)` = green-man seconds left); `drawUkjx`
  draws the puffin units only (green while `sigPedLeft > 0`), AI vehicles also hold at the line while `pedOnX(J)`.
- **Pedestrians** (`peds.js`, v53c): `WALKABLE`/`pedOk` mask, crossing map `pedXings()` (row 3 tiles out from each UK
  box edge, needs pavement at both ends; peds cross nowhere else), area density `pedDensity` (zone weights; target
  `traffic.pedW` = 90 high / 30 low x density), off-screen spawning 30-130 m out, BFS route planner `pedPlan` (radius
  `PED_R`, 35% heads for parks/plazas, string-pulled pavement runs, lateral pavement offset `lat`), waits at the kerb
  until the green man has enough time left, lingers in parks, steps away from a fast lorry. Looks from `pedLook`
  (tops, bottoms, skin, hair style, bags), drawn at `PED_SCALE`. Casualty hooks (`ambPedHit`/`polPedHit`) unchanged.
  Check: `/workspace/thin/pedshots.py` (onRoad must be 0, XMON offPath 0).
  v53d danger: sources queue `pedAlarm(x, y, r, kind)` (bm.js / bikes.js gunshots; `pedLorryAlarms`: horn via
  `input.horn`, any lorry box over a walkable tile while moving), `pedScare` turns them into `p.scare` (run away with
  `pedFlee`, walkable tiles only) or, in front of a lorry on the kerb, `p.dive` + `p.prone` (get up after). Check:
  `/workspace/thin/pedA1.py`.
  v53d time/weather: target = cap x `pedDensity` (fixed sunflower samples) x `pedTimeK(hour)` (rush peaks, quiet
  nights) x rain 0.8 + gathering points; `pedHotspots()` (shop fronts, `PUB`, stadium sides) weighted by `pedHotW`
  feed `traffic.pedHot` / `pedHotP`, `pedSpawnHot` puts walkers there and `pedPlan` keeps them nearby (`p.hot`).
  Umbrellas (`p.umb`, 75%) open while `WX.rain > 0.25`. Check: `/workspace/thin/pedA2.py`.
- **Street life** (`pedlife.js`, v53d): runtime bus stops `pedStops()` (kerb lane of city/town roads, 50 tiles apart,
  clear of junctions; shelter + flag + BUS STOP box) are `bus` gathering points; queued walkers (`p.stop`) board AI buses
  that call via `busStopAcc` (hooked in `stepVeh`; dwell 4-14 s, skip empty stops, 0-2 get off). Roles from `pedRole`:
  joggers (`p.jog`), dog walkers (`p.dog`, `pedDogTick`), cyclists (`p.bike`); mall shoppers (`p.mall`, two bags) wander
  the forecourt (`pedMallWalk`); benches `pedBenches` in parks/squares are sat on (`p.sit`). `pedRelease` frees queue
  places and benches. Check: `/workspace/thin/pedA3.py` (BUSONLY=1 for the bus test).
  Groups: `pedGroup` adds followers at spawn (`p.lead`, `p.slot`; couples, three abreast, families with `p.pram` +
  `p.kid`, chat rings `p.chat` at shop/pub points); `pedFollow` keeps the slot, hands over `onX` on crossings, and lets
  go when the leader leaves, is scared or hurt. A slot over a verge/tree falls back to the leader's track (never off
  the walkable mask; boxed in >1 s snaps to the leader so nobody parks on a crossing). Check: `/workspace/thin/pedA4.py`.
  Workers: `pedWorkSites` (depots and mall goods yards with bays, `pedWorks()` pavement pits - fenced 1-tile works
  on pavements 2+ tiles wide, blocked in `pedMask`) get crews from `pedWorkers` (added on top of the crowd target,
  `traffic.pedWk`); `p.work` walkers stroll between bay mouths in hi-vis (`p.hat`), builders dig (`p.dig`), all step
  clear of a moving lorry inside their site (`pedWorkWalk`). Check: `/workspace/thin/pedA5.py`.
- **LGV training ground** (`ltg.js`, v54): replaces the Kingsbridge Field airfield (tiles 1195-1384 x 1792-1904; the
  - Cone layout rules (ltgConeInit; audited by tests/ltg_test.py): loop cones sit exactly on the painted edge lines, about 8.8 m apart, never in the lane. No cones on roads, pavements, buildings, the spine, the gate apron, the town streets, the bays, the blind bays or the coupling stands; only tidy edge rows elsewhere. Cones are runtime only and rebuilt at home on every load (the test checks this after a reload).
  airfield's 4 building `R()` draws are still made in world.js so later generation is unchanged). `ltgGen` lays LOT
  tarmac (Airport Way kept), the training dock / blind-side dock / mini-town buildings and kind `ltg` paint objects
  (`LTG_PAINT[o.part]`, baked into chunks, o.z -1); `ltgGate` (after the forest pass, so tree seeds don't drift) opens
  the apron to Field Road on the spine rows. Street trees skip the gate mouth (`ltgIn`). Runtime only: ~740 cones
  (`ltgConeInit`, metres, 16 m grid) knocked by `playerBoxes()` (slide, spin, reset 12 s after the last touch once the
  rig is 25 m clear; loop cones reset on a new run). Timed loop: START (u 62) starts the clock driving east along the
  bottom straight, checkpoints top straight (u 68) + left bend, chequered FINISH (u 57) stops it; leaving the site
  surface (`ltgOnTarmac`), Esc/Backspace, hold pad B 1 s or the `#ltgX` button cancel; any cone touched fails; best in
  `localStorage["bigrig.ltgBest"]`. E-stop light (`LTG.es`), skid pan grip `ltgGrip` (physics.js `panG`), map zones
  only when zoomed out (`ltgMapDraw`), learner-plate icon `ltgMapIcon` + legend `~L`, POI "Training ground" (fast
  travel lands on the spine via `zones`). Hooks: main.js (`ltgUpdate`, `ltgDraw`, `ltgHUD`), fuel.js drawPOIs,
  satnav.js mapPOIList, daynight.js `ltgLights`. Check: `tests/ltg_test.py`. No Kingsbridge planes any more (it was the
  only non-Albion runway).
- **Graphics** (`gfx.js`, v51): `GFX.lvl` is `"high"`/`"low"`; `GFX.q` is the saved choice (`auto` drops to low once
  if the EMA fps stays under `GFX_LOW_FPS` for 6 s). `drawNight` is wrapped: `gfxGrade()` (cached quarter-res multiply +
  sun-side additive sprites from `GFX_GRADE` keyframes; replaces the old dusk multiply, so `DN.dusk` is zeroed during the
  original call), then the original darkness layer (`DN.lc`, resolution 0.5 high / 0.34 low), then `gfxLights()`
  (high: coloured layer `GL.lc` with tinted cones, pools, halos, one additive composite; both: brake/indicator glow;
  high: `gfxVehLit`). `GFX.off.{cones,pools,halos}` switch effects off for profiling. Low quality = baseline night look.
- **Shadows** (`gfxshade.js`, v51): on high, `renderChunk` is wrapped so `bShadow` / `drawShadowRect` / `treeShadow`
  record casters into `GS.ch` (per chunk key; world-space footprint via `g.getTransform()`) instead of painting; on low
  they paint as before. `gfxQualityChanged()` clears `chunkCache` / `chunkLo` / `GS.ch` so chunks re-bake. `gfxSun()`
  (called from the `drawRail` wrapper each frame) sets `SUN` (direction from `gfxSunDir`, length `L`, alpha `a`);
  `gfxShadeLayer` rebuilds `GS.lc` (sun-swept hulls minus footprints/crowns) only when the view leaves `GS.R`, zoom
  changes 8 %, `SUN.k` steps or chunks were baked. `blitV` / `blit` calls with a nonzero shadow offset use
  `gfxShadowArt` (blurred padded silhouette, WeakMap cache) at the sun offset. New shadow casters should just call one
  of the three shadow helpers inside the chunk bake.
- **No building neon** (v51, James): shop strips/awning light, neon bars, cyber outlines (night) and the baked cyber
  neon trim (`bldg2.js` / `render.js`) are removed in every quality mode; `l.neon` stays null. Don't re-add them.
- **3D buildings** (`gfx3d.js`, v51): drawn by a `gfxShadeLayer` wrapper, i.e. after ground vehicles + the shadow layer
  and before rail / overhead / night, sorted by `o.height` (tallest last). Roof points = view centre + (p - centre) *
  (1 + k), `k = min(0.6, height / G3_HCAM)`. Roof image = baked chunk pixels under the footprint (`g3Roof`, LRU 220,
  skipped until every overlapped chunk is in `chunkCache`). Walls whose outward normal faces the view centre are filled
  with the average roof colour (sun shaded) and `G3.pat`; `G3.walls` are re-lit with `G3.patN` after `drawNight`. The
  `drawNight` wrapper sets `l.hideWin` on each lifted building during the call (no roof dots; walls carry the lights); `gfxBOff(o)` gives
  the centre shift for gfx.js halos. Map data unchanged.
- **Lift bridge** (`liftbridge.js`, v51): constants in `LB` (span `XA..XB` x `Y0..Y1` tiles, leaf `L`, `AMAX`).
  `lbState()` derives lights/barriers/leaf angle from `lbOcc(t)` (ship hull over the span) looked ahead/back with
  `portT()`, so it is deterministic and needs no saved state; `LB.force` overrides it for tests/shots. Only ships already
  released by the port sim are seen ahead, which is fine since ships reach the bridge long after release. Drawing:
  `lbProj` (oblique: height rises up-screen, `LB_OB`, plus a small swell `LB_K`), `lbSolid` culls faces by projected
  winding. The generated suspension span over this crossing (`lbSusp()`) is skipped in `drawOverhead`; `lbRails` draws
  plain parapets/lamps on the fixed decks. `lbGapClip(sh)` removes port deck shadow / street lamps over the open span.
  Hooks: `railStopAcc` (AI stop line 0.8 tiles before each barrier), `railBarrierHit` (player; rigs already straddling
  the line pass), `stepTruck` (`lbTruckStep`: leaf slope gravity, launch off the tip, landing damage, sink -> BREAKDOWN
  "respawn" tow). Road layout and map data unchanged.
- **Motorbikes** (`bikes.js`, v51): bike kinds live in `BK_T` (merged into `VTYPES`, flag `bike`). `spawnVehicle` is wrapped:
  random spawns without `opt.kind` become a bike with `BK_MIX[type][0]` probability. Gang followers and revenge hunters are
  kinematic (`v.bkK`, `stepVeh` wrapper skips the lane model; a 2-point stub path keeps `pathAt` working). They ride the
  leader trail (`G.T`) or the player trail (`BK.ptr`). `wantHit` wrapper knocks riders off (kinematic ones only when the
  truck closes on them, `bkK.cl` > 0.8 m/s). `BK.heat` (+1 per knock-off, ~5 min decay) triggers `bkRevenge()` at 4-5,
  never while `career.active` / `BM.act`; `bkEnd(why)` = far / lost / wiped / job. Damage per hit `BK_DMG` x `truck.bulM`.
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
- **Generator random stream is pinned per stage** (`GEN_R_PIN` + `pinR` in `world.js`): each later stage (and the towns /
  industry parts of "Raising buildings") restarts the mulberry stream at the v49 draw count, so editing a few city blocks
  only re-rolls those blocks. If you add or remove `R()` draws on purpose in a pinned stage, the pins downstream still
  hold; to adopt a new baseline, recount (instrument `R`) and update the table.
- **City-grid junctions**: never lay a street within ~5 tiles of a parallel road (twin junctions, offset yellow boxes,
  doubled signals). Kingsbridge districts snap streets up to 12 tiles onto a neighbouring district straight across, and an
  edge row/column that would sit alongside an existing road is dropped (its cross streets still run up to that road).
  Check with the near-junction probe in `tests/junction_audit_test.py` (STATIC + duplicate-junction) after map changes.
- **PC home screen and modals fit with no scrolling** down to 1024x576: the desktop home is a two-column grid
  (`home.js`, `body:not(.touch) #overlay`, inset 0); dealer and estate lists are compacted on desktop. Job board lists
  still scroll internally when there are more jobs than fit.
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

- Trees (v54, render.js): drawTree and drawBush use pre-rendered aerial-photo sprites (treeSprite: oak, beech, birch, autumn, pine, conifer, hedge, shrub; 6 variants each, lit from the upper-left). One drawImage per tree; the ground shadow still goes through treeShadow, so gfxshade's sun-following shadows keep working. The drawn size is TREE_VIS (1.75) times the generator radius; collision tiles are unchanged. Sprites are built lazily on the first bake, about 0.2 s once.
- Phone D-pad (v55, mobile.js mobDpad): left and right are wide pads. An invisible #mDZone over the whole D-pad, with a margin of about 14 units, owns every D-pad touch. Left half = left and right half = right; only the arm column above or below the centre counts as up or down. It reacts on pointerdown and pointermove (with capture), so the thumb can slide between left and right without lifting. The visible pads only show .on. Test it with /workspace/dpad/t.py (CDP touch at a 412x915 viewport).
- Lift bridges (v56, liftbridge.js): there are now two bascules in LB.all, built lazily by lbBridges once the ports have their ship timelines. 'kb' is the docks M1 crossing. 'north' is the long north-coast crossing (the world.port brgW deck): the opening is LB_N_XC 784 with 10-tile leaves (XA 774, XB 794). lbUse(b) copies a bridge's geometry and state into LB; every hook loops the bridges. The north bridge opens for the cargo liners in world.boats (constant speed, so their future position is known) and for world.port container ships. The port's outbound lane (portCfg outT) now runs north at world x 780, 8 tiles west of the inbound lane at 788, through the opening. No tiles or elevation changed. Test: tests/liftbridge_test.py (simulated ship passages: fully open whenever a hull is over the span; AI stop, barrier block, jump lands, slow drop sinks).

- Corners to bends, more signals, horn, AI honking (v57, 21 Oct): world.js BEND_CORNERS lists [vs.a, hs.a] of plain 2-arm street corners (no entrance). Before junction detection each one is cut back by the bend radius Rc (centre line 6 tiles on city/town, giving a 16 m inner kerb; 5 on estate roads, 12 m) and joined by a quarter-circle curve() named "bend" (world.bends = [x, y, curveId, Rc]). Corners with an entrance stay signalised junctions. SIG_ADD signalises the former give-way junctions: estate and base streets get the full UK design (J.uk), motorway and country T-junctions get masts only. Military-base junctions take their signals from milbase.js MB_SIG, which now lists all of them. The horn (audio.js) is a dual-trumpet reed synth, F3+A3 (CZ_HORNS[0]), 28-harmonic PeriodicWave, formant peaks, air hiss, pitch rise on attack and sag on release. AI honks (traffic.js aiHonkWanted): never at red or amber; at a signal only when it has been green for 5 s + patience and the vehicle ahead (or the player) has not moved for that long; elsewhere only after 12 s+ stationary behind a stopped lead. 60 % of drivers honk, there is a global 1.5 s gap, and each driver has an 8-18 s cooldown.

- Phone portrait deck (v58, mobile.js mobLayout + ctrltheme.js): IND / HAZ / BEAM / IND form a row of square-ish icon + label tiles (.tile), with MAP and JOBS as matching tiles under HAZ / BEAM. On short decks (deck height < 392 layout units, `tight`) the D-pad, A/B and the function row move up (dcy 80, fy 152) and the tiles shrink so everything fits. The decorative #deck grille, which looked like a hamburger menu but had no handler, was removed; nothing moved. The theme is near-black (#07080b deck, #0b0d12 / #0d0f14 fills) with the 2 px neon outline. Hit areas and #mDZone are unchanged.

- Horns (v59, src/horns.js): every horn sound lives in one table. HORNS[look.hrn] holds the player's horns: six pitches, levels, lowpass, bell, air, attack, an optional seq pattern and preview length. Index 0 is the stock deep air horn and stays the default, and the choice is still saved as the fitted hrn part. AI_HORNS / aiHornClass / aiHornShot give AI traffic horns: beep for small cars, a two-tone for SUVs, estates and vans, and an air horn for buses and lorries. Each vehicle gets its own pitch (v.hornPr, 0.92-1.08) plus pan and distance falloff; emergency vehicles never honk. audio.js updateHorn drives the player's horn and runs even while a menu pauses the game (main.js), which is what makes tune-shop previews audible. Every horn card has a PREVIEW button (touch / mouse); X on a pad and P on the keyboard preview the focused horn (tune3.js czHornFocus). Test: /workspace/horns/t.py.

- Estate agents (v60, homes.js):
  - **No auto-open.** In eaZone(a) (forecourt, drive and the kerbside lane in front), HOMES.atAgent is set and a bottom-centre #eaGo ENTER SHOP button appears, styled like #czGo. Tap or click it, press E or Enter, or press A on a pad (the gamepad.js A chain, after the couple / repair / customise prompts). eaEnter opens estatePanel only below EA_STOP (1.34 m/s, 3 mph); otherwise it flashes "Stop to enter …". Driveway home cards still open as before.
  - **Art.** hAgentArt redraws the shop: block paving, an asphalt customer forecourt with bays and a brand roundel, planters, a totem sign, and a glass frontage with listing cards, a striped awning and a green/gold fascia on a slate roof. Night glow is drawn in drawHomes.
  - **Menu.** EA_CSS styles a midnight + neon listing grid (.eam .pc cards: photo, OWNED / FOR SALE badge, HOME / COMMERCIAL YARD chip, price, facts, FAST TRAVEL). Tabs ALL / HOMES / COMMERCIAL step with eaTabStep (LB RB, Q E, PageUp/Down).
  - **Fast travel.** homePOIs lists every home ("Home for sale" or "Your home") as a fast-travel point.
  - **Test.** tests/property_ft_test.py runs the real fastTravel to every home and every world.forSale yard: lands on its own drive or yard with nothing solid under the rig, facing out.

## Buildings: culling, chunk ring, stable windows (bldfix)
- `gfx3dDraw` culls on the UNION of footprint and leaned roof quad (min/max), so edge buildings are never dropped; `g3Roof` bakes a missing chunk (`getChunk(cx,cy,true)`) instead of skipping; roof cache cap 900.
- `main.js chunkRing` pre-bakes a 1-chunk ring round the view (+2 ahead in travel direction) within the per-frame budget; skipped above 84 chunks.
- Window lit state/brightness come only from `g3H` (hash of building world position) and `g3LitShare(l)` (slow, per 5 game minutes). Walls use cached Path2D (`g3WinPaths`, `G3.wc`), no pattern resampling; roof dots in daynight.js are pixel-snapped and only for on-screen buildings.
- Test: `tests/bld_stability_test.py` (0 missing edge buildings, slow-pan lit-window jump < 8% on >=10 frame pairs, traffic frozen, footprint pixels only).

## Site / SEO (trucksim.co.uk, GitHub Pages from main /)
- Root files served as-is and NOT generated by build.py (it only rewrites index.html, BigRig.html, mapdata.bin, dist/, BigRigWeb.zip): `CNAME`, `robots.txt`, `sitemap.xml`, `og-image.jpg` (1200x630), `manifest.webmanifest`, icons, `about/index.html` + `about/img/*.webp`.
- Game page SEO lives in `src/template.html` head (title, description, canonical, OG/Twitter, JSON-LD VideoGame, noscript summary, lang en-GB). `home.js` adds the "About the game" link on the version line (http(s) only).
- /about/ is a short trailer-style landing page (logo hero, showcase sections, WIP badge + "Latest updates" strip: refresh those 4 items when big features land). Copy must only describe features that exist in src/; update it (and sitemap lastmod) when gameplay changes. Gallery shots: hide the canvas HUD by stubbing the draw*HUD functions and drawMinimap.

## Junction review map (trucksim.co.uk/map/, noindex)
- `python3 build.py && python3 tools/junctionmap.py` regenerates `map/index.html` (from template `tools/junctionmap.html`) and `map/world.png` (1 px per tile, from the live world). Re-run after map changes. build.py does not touch `map/`.
- Ids: J<junction id>, R<roundabout index>, C<curve id>. Types: sig (lights, 3+ arms), gw (no lights, 3+ arms), corner (2 arms; ring = has lights), rb, bend. Arms = box sides with road tiles 2 tiles out, plus entrance arms (lower-case letter: forecourt / yard / quay / depot frontage on a box side; `d` = driveway touching an arm within 6 tiles of the box), so a corner with an entrance counts as a T.
- URL hash `#x,y,zoom,ID` deep-links a spot; the coordinate stamp is drawn into the canvas so screenshots carry it.

## Release workflow: staging, then live, with rollback (tools/deploy.sh)
- **Live:** repo `sonjamesg/big-rig-truck-simulator`, branch `main`, served by GitHub Pages at https://trucksim.co.uk (CNAME file `trucksim.co.uk`). Day-to-day work happens on `sb`, which is pushed to `main` and `wip-grid-thin` as usual.
- **Staging:** repo `sonjamesg/big-rig-truck-simulator-staging`, branch `main`, served by Pages. It is reached at https://staging.trucksim.co.uk once DNS has `CNAME staging -> sonjamesg.github.io`, and at https://sonjamesg.github.io/big-rig-truck-simulator-staging/ until then.
  - **What makes it different from live:** every page gets `noindex,nofollow`, has no canonical link and carries a "[STAGING]" title prefix. A red STAGING badge sits bottom-left. robots.txt is `Disallow: /`.
  - **Paths:** root-absolute links are made relative, so the site works under the /repo/ path too.
  - **Contents:** only the public site files are published (no src, tools, tests, supabase, dist, BigRig.html or zips). `STAGING_SOURCE` records the source commit and branch.
  - **CNAME:** the live CNAME is never copied. deploy.sh writes `staging.trucksim.co.uk` into the staging CNAME only once that DNS record exists; writing it earlier would break the github.io URL.
  - **Shared backend:** staging talks to the same Supabase backend as live (accounts, multiplayer).
- **Flow when James sends a module:**
  1. Review it: secrets, empty catches, duplicate globals.
  2. Copy it into src/ and run build plus the relevant tests (world-gen changes: build, export_map, build, verify_map).
  3. Run prettier and gen_index, then commit on `sb` (not yet pushed to main).
  4. Run `tools/deploy.sh staging` and test on the staging URL (phone and desktop).
  5. When it's good, run `tools/deploy.sh live`. This tags the current live main `live-YYYYMMDD-HHMM`, then fast-forwards main to exactly the staged commit; it refuses if that isn't a fast-forward. Push `wip-grid-thin` as usual.
  6. **Undo:** `tools/deploy.sh rollback <tag>` (a live-* tag or `backup-2026-10-21`). This makes a new commit on main whose tree equals the tag, so history is kept and nothing is force-pushed.
- **Backups:**
  - Annotated tag `backup-2026-10-21` at 94df611 (v59).
  - GitHub release "Backup 2026-10-21" with BigRig_full_source.zip attached.
  - A local copy in /workspace/backups/.

## v61: Ravensholt Cabin design by James
- `hArt` uses `hDrawCabin(h)` (src/homes.js) for every home with `kind: "cabin"` (currently only H2 Ravensholt), `hDrawPlot` otherwise.
- The hardstanding, lorry bays and door path come from the shared `hDrawHard(g, h)` (also used by hDrawPlot). Keep the fast-travel landing visible.
- `h.lights` entries are `[x, y, r, colour, alpha]` in WORLD px (drawHomes feeds dnLight). Plot-canvas px must be offset by `h.x0*TILE, h.y0*TILE`.
- The cabin house is drawn on its collision box (`homeLayout` case "cabin", house feat). Its trees are art only, so they have no collision.
