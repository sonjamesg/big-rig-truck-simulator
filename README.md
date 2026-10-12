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

## Multiplayer (up to 8, no account, no server)
Peer-to-peer over WebRTC using PeerJS's free public broker. The host's browser relays everyone's position (star topology).
1. Open the play link, type a **username** (remembered next time).
2. **Host:** press **HOST GAME**. You get a room code like `TRUCK-4821` and an invite link (`...?join=TRUCK-4821`). Press **Copy invite link**, send it to friends, then **START DRIVING**.
3. **Join:** open the invite link (the code fills in automatically), or type the code, then press **JOIN**.
4. In game: **Tab** (or D-pad up on a pad) opens the player list, **Enter** opens chat, and other drivers show with name tags on the road, minimap and world map. Each player has their own traffic and jobs in the same world.
5. If the host leaves, everyone gets a message and goes back to the lobby. **PLAY SOLO** works offline.

Note: some strict corporate/VPN networks block WebRTC; there's no TURN relay, so on those networks players may not be able to connect.

## Build
`python3 build.py` concatenates `src/*.js` into `BigRig.html` (copy it to `index.html`).

## Credits
PeerJS (MIT) is bundled inline. Engine sound: 'Truck engine' by Joseph Sardin (bigsoundbank.com), CC0. All graphics are procedurally generated.
