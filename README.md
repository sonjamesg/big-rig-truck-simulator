# Big Rig Truck Simulator

A single-file browser truck game: articulated lorry physics, trailer coupling, depots, fuel forecourts, sat nav, AI traffic, missions to mall loading bays, XP tiers, truck dealerships and Xbox controller support.

**Play:** https://sonjamesg.github.io/big-rig-truck-simulator/

## Controls
| Keyboard | Xbox | Action |
|---|---|---|
| W / ↑ | RT | Accelerate |
| S / ↓ | LT | Brake, reverse when stopped |
| A D / ← → | Left stick | Steer |
| Space | B | Handbrake |
| T / C | A | Couple / uncouple |
| F | X | Refuel (in a pump bay) |
| U | Y | Unload in bay |
| H | LB | Horn |
| X | RB | Cancel route |
| M | View | World map |
| J | Menu | Job board (Enter / A = Start mission) |
| Esc | B | Close panel |
| Tab | D-pad ↑ | Player list (multiplayer) |
| Enter | – | Chat (multiplayer) |
| Enter / click | A | Choose an option on the BROKEN DOWN panel |

## Touch (phones & tablets)
- **Landscape:** steering slider bottom-left, GAS and BRAKE/REV pedals bottom-right, Handbrake / Horn / Jobs / Map top-left, and Couple / Refuel / Unload pop up top-right only when they apply.
- **Portrait:** "Big Rig Boy" handheld: D-pad steers (and moves around menus), **A** = gas / select, **B** = brake / back, plus Couple, Refuel, Unload, Handbrake, Horn, MAP and JOBS buttons.

## Features
- **Road network:** organic city grids, motorways with roundabout interchanges, winding country roads, the Sound Coast Road, Greyfell Pass hairpins, the Moor Dam and reservoir, a curved bridge on Airport Way, dirt tracks to the quarry and Fen Forest. The world map is drawn from the same road geometry.
- **Suspension bridges:** the long motorway sea crossings are red-orange suspension bridges with towers and long shadows, main cables and hangers, railings and lamp posts, and ships passing underneath. They are marked on the world map. Other bridges keep the girder and curved-viaduct styles.
- **Traffic lights (UK, drive on the left):** conflict-free stages built from the real vehicle paths, so no two crossing movements are ever green together. Right turns get their own green-arrow stage where they would cut across oncoming traffic. Each stage runs green, amber, all-red, then red+amber. Overhead heads show each lane's own signal, with arrows. AI traffic stops on red and on amber when it can, keeps yellow boxes clear, and gives way to anything still crossing the junction.
- **Damage and breakdown:** at 100% damage the truck breaks down. The engine cuts out, it smokes and the hazard lights flash. **RESPAWN** tows you to the nearest garage or depot for a fee of up to £250 and resets the damage. An active job fails and its trailer goes back to its depot.

## Multiplayer (up to 8, no account, no server)
Peer-to-peer over WebRTC using PeerJS's free public broker. The host's browser relays everyone's position (star topology).
1. Open the play link, type a **username** (remembered next time).
2. **Host:** press **HOST GAME**. You get a room code like `TRUCK-4821` and an invite link (`...?join=TRUCK-4821`). Press **Copy invite link**, send it to friends, then **START DRIVING**.
3. **Join:** open the invite link (the code fills in automatically), or type the code, then press **JOIN**.
4. In game: **Tab** (or D-pad up on a pad) opens the player list, **Enter** opens chat, and other drivers show with name tags on the road, minimap and world map. Each player has their own traffic and jobs in the same world.
5. If the host leaves, everyone gets a message and goes back to the lobby. **PLAY SOLO** works offline.

Note: some strict corporate/VPN networks block WebRTC; there's no TURN relay, so on those networks players may not be able to connect.

## For developers
Breakdown options are data-driven: `BigRig.breakdown.addOption({id,label,sub,enabled,run,order})` adds a button to the panel. A future roadside-repair option can be added this way.

## Build
`python3 build.py` concatenates `src/*.js` into `BigRig.html` (copy it to `index.html`).

## Credits
PeerJS (MIT) is bundled inline. Engine sound: 'Truck engine' by Joseph Sardin (bigsoundbank.com), CC0. All graphics are procedurally generated.
