/**
 * @file porttrucks.js — port hauliers: persistent AI container trucks on the real road network
 * Exposes (globals): PTRUCK, ptArt, ptSetArt, ptVisible, ptGateGoal, ptDest, ptDepotGeo, ptPoly,
 *   ptBay, ptDepotPath, ptPose, ptToRoad, ptSegAt, updatePortTrucks (+9 more)
 * Depends on: world.js, physics.js, traffic.js, satnav.js, port.js, owndepot.js, tune.js,
 *   daynight.js, main.js
 * Load order: #28 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
// ===================== v30 port hauliers: persistent AI container trucks on the real road network =====================
// Cycle: road (normal traffic routing/rules) -> port gate approach (handed to the gate lane script: yard crane loads/unloads)
//  -> back onto the road loaded -> depot/shop -> under the depot gantry (lift-off, sometimes an export box goes on) -> back to the port.
// While on public roads a truck IS a traffic.js vehicle (lights, roundabouts, give-way, IDM spacing); only the yard/depot loops are scripted.
const PTRUCK = { list: [], per: 3, t: 0 };
// v50: same solid art as the player's skeletal trailers: loaded = trailerArt("cont") (chassis + container), empty = a full
// steel skeletal chassis (main beams, side rails, crossmembers, gooseneck, mudguards, rear light bar), not a faint outline
function ptArt(col) {
  if (col) return trailerArt("cont", col, "");
  const key = "ptc-empty2";
  if (traffic.arts[key]) return traffic.arts[key];
  const L = TRL_LEN,
    W = TRL_W,
    c = vCanvas(L, W),
    g = c.getContext("2d"),
    cx = c.width / 2,
    X = (m) => cx + m * VS,
    Y = (m) => 0.15 * VS + m * VS,
    R = (x0, y0, w, h) => g.fillRect(X(x0), Y(y0), w * VS, h * VS);
  g.fillStyle = "#121212"; // tyres
  for (const fy of [9.6, 10.7, 11.8])
    for (const s2 of [-1, 1]) R((s2 * W) / 2 - (s2 > 0 ? 0.32 : -0.02), fy, 0.3, 0.85);
  g.fillStyle = "#24272b"; // mudguards over the axle group
  for (const s2 of [-1, 1]) R(s2 > 0 ? W / 2 - 0.42 : -W / 2 + 0.02, 9.45, 0.4, 3.2);
  g.fillStyle = "#5d636b"; // gooseneck plate at the kingpin
  R(-W / 2 + 0.15, 0, W - 0.3, 1.25);
  g.fillStyle = "#4a4f56"; // twin main beams
  R(-0.62, 0, 0.32, L - 0.2);
  R(0.3, 0, 0.32, L - 0.2);
  g.fillStyle = "#6b7179"; // side rails + crossmembers with twist-locks
  R(-W / 2 + 0.05, 1.2, 0.14, L - 1.5);
  R(W / 2 - 0.19, 1.2, 0.14, L - 1.5);
  for (const fy of [1.2, 3.4, 5.6, 7.8, 9.2, L - 0.75]) R(-W / 2 + 0.05, fy, W - 0.1, 0.26);
  g.fillStyle = "#c9a227";
  for (const fy of [1.25, L - 0.7])
    for (const s2 of [-1, 1]) R(s2 * (W / 2 - 0.35) - 0.09, fy, 0.18, 0.16);
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = Math.max(1, VS * 0.05);
  g.strokeRect(X(-W / 2 + 0.05), Y(1.2), (W - 0.1) * VS, (L - 1.95) * VS);
  g.fillStyle = "#2b2e33"; // rear under-run bar
  R(-W / 2 + 0.1, L - 0.42, W - 0.2, 0.22);
  g.fillStyle = "#b31515"; // tail lights (dnLight adds the glow at night)
  R(-W / 2 + 0.1, L - 0.28, 0.42, 0.14);
  R(W / 2 - 0.52, L - 0.28, 0.42, 0.14);
  return (traffic.arts[key] = { c, sh: shadowOf(c) });
}
function ptSetArt(T) {
  if (T.v) {
    T.v.art = { body: T.body || T.v.art.body, trl: ptArt(T.box) };
  }
}
function ptVisible(x, y, m) {
  return (
    Math.abs(x * PPM - cam.x) < VW / 2 / cam.z + (m || 150) &&
    Math.abs(y * PPM - cam.y) < VH / 2 / cam.z + (m || 150)
  );
}
function ptGateGoal(P) {
  const w = PL(P, ...P.lpath.pts[0]);
  return (
    P.gateDp ||
    (P.gateDp = {
      name: (P.depot ? P.depot.name : "Port") + " gate",
      entrance: { x: w[0] * M_T, y: w[1] * M_T },
    })
  );
}
function ptDest(T) {
  if (T.home) return T.home;
  const P = T.P,
    busy = new Set(PTRUCK.list.filter((o) => o !== T && o.dest).map((o) => o.dest));
  const e = P.depot ? P.depot.entrance : ptGateGoal(P).entrance;
  const L = world.depots
    .filter(
      (d) =>
        d.bays &&
        d.bays.length &&
        d !== P.depot &&
        d.code !== "APT" &&
        !portList().some((Q) => Q.depot === d),
    )
    .concat((world.malls || []).filter((m) => m.bays && m.bays.length))
    .filter((d) => !busy.has(d) && ptDepotGeo(d) && d.bays.every((b) => !b.th))
    .map((d) => [d, Math.hypot(d.entrance.x - e.x, d.entrance.y - e.y)])
    .filter((q) => q[1] > 500 && q[1] < 6000)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8);
  if (!L.length) {
    const A = world.depots.filter(
      (d) => d.bays && d.bays.length && !portList().some((Q) => Q.depot === d) && ptDepotGeo(d),
    );
    return A.length ? A[(Math.random() * A.length) | 0] : null;
  }
  return L.length ? L[(Math.random() * L.length) | 0][0] : null;
}
// ---- depot gantry geometry: road snap point S, entrance E, stub direction d; loop path in metres
function ptDepotGeo(d) {
  if (d._ptg !== undefined) return d._ptg;
  d._ptg = null;
  const e = d.entrance,
    s = navSnap(e.x / M_T, e.y / M_T, 10);
  if (!s) return null;
  const i = idx(s[0], s[1]);
  const sid = world.roadH[i] >= 0 ? world.roadH[i] : world.roadV[i];
  if (sid < 0) return null;
  const sg = world.segs[sid];
  const along0 = (sg.dir === "h" ? s[0] : s[1]) + 0.5,
    pa = lanePt(sg, 1, 0, along0),
    pb = lanePt(sg, -1, 0, along0),
    S = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  let dx = e.x - S[0],
    dy = e.y - S[1];
  const dl = Math.hypot(dx, dy);
  if (dl < 2) return null;
  dx /= dl;
  dy /= dl;
  const along = (sg.dir === "h" ? s[0] : s[1]) + 0.5,
    G = [e.x + dx * 8, e.y + dy * 8];
  return (d._ptg = { sg, S, E: [e.x, e.y], d: [dx, dy], along, G });
}
function ptPoly(pts) {
  for (let it = 0; it < 4; it++) {
    const q = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1];
      q.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    q.push(pts[pts.length - 1]);
    pts = q;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function ptBay(d) {
  const busy = new Set(PTRUCK.list.map((o) => o.bay).filter(Boolean));
  return (
    d.bays
      .filter((b) => !b.trailer && !b.assigned && !b.target && !busy.has(b))
      .sort(
        (a, b) =>
          Math.hypot(a.kx - d.entrance.x, a.ky - d.entrance.y) -
          Math.hypot(b.kx - d.entrance.x, b.ky - d.entrance.y),
      )[0] || null
  );
}
// depot/shop: pull forward across the yard past the bay, reverse the trailer into the bay, drop the box (it goes "inside"), drive out empty
function ptDepotPath(T, v, g, bay) {
  const f = fwd(v.h),
    k = [v.x - f[0] * 1.6, v.y - f[1] * 1.6],
    E = g.E,
    d = g.d,
    u = fwd(bay.th || 0),
    r = rgt(bay.th || 0),
    K = [bay.kx, bay.ky];
  const row = [K[0] + u[0] * 13, K[1] + u[1] * 13];
  let s0 = Math.sign((K[0] - E[0]) * r[0] + (K[1] - E[1]) * r[1]) || 1;
  const B = [row[0] + r[0] * s0 * 16, row[1] + r[1] * s0 * 16];
  const inP = ptPoly([
    k,
    [k[0] + f[0] * 5, k[1] + f[1] * 5],
    [g.S[0] + d[0] * 4, g.S[1] + d[1] * 4],
    E,
    [row[0] - r[0] * s0 * 7, row[1] - r[1] * s0 * 7],
    [row[0] + r[0] * s0 * 4, row[1] + r[1] * s0 * 4],
    B,
  ]);
  let best = null;
  for (const dir of [1, -1]) {
    const dv = dirVec(g.sg, dir),
      cr = -d[0] * dv[1] - -d[1] * dv[0];
    if (cr < 0 || !best) best = { dir };
    if (cr < 0) break;
  }
  const dir = best.dir,
    dv = dirVec(g.sg, dir),
    exitA = g.along + dir * 5,
    X = lanePt(g.sg, dir, 0, exitA);
  const outP = ptPoly([
    K,
    [K[0] + u[0] * 8, K[1] + u[1] * 8],
    [row[0] + u[0] * 2 - r[0] * s0 * 4, row[1] + u[1] * 2 - r[1] * s0 * 4],
    [E[0] + d[0] * 2, E[1] + d[1] * 2],
    [g.S[0] + d[0] * 3, g.S[1] + d[1] * 3],
    [X[0] - dv[0] * 5, X[1] - dv[1] * 5],
    X,
  ]);
  return { inP, outP, K, u, r, row, s0, exit: { dir, along: exitA } };
}
function ptPose(path, s) {
  const a = polyAt(path, s + 3.6),
    b = polyAt(path, s - 1.6),
    h = polyAt(path, s);
  return [h[0], h[1], Math.atan2(a[1] - b[1], a[0] - b[0])];
}
// ---- back to traffic at a lane point
function ptToRoad(T, sg, dir, along, goal) {
  for (const off of [0, 1.5, 3, 4.5, 6]) {
    const a = along + dir * off;
    if (a < sg.b0 + 2.5 || a > sg.b1 - 2) continue;
    const v = spawnVehicle(0, 0, true, { kind: "lorry", dir, along: a, seg: sg.id });
    if (v) {
      if (T.body) v.art.body = T.body;
      else T.body = v.art.body;
      T.v = v;
      v.port = T.P;
      v.ptruck = T;
      v.pinT = 1e12;
      ptSetArt(T);
      if (goal) (aiGoal(v, goal), (v.pinT = 1e12));
      T.st = "road";
      T.t = 0;
      T.gT = 0;
      return true;
    }
  }
  return false;
}
function ptSegAt(x, y) {
  const tx = Math.floor(x / M_T),
    ty = Math.floor(y / M_T);
  if (!inb(tx, ty)) return null;
  const i = idx(tx, ty),
    a = world.roadH[i],
    b = world.roadV[i];
  const k = a >= 0 ? a : b;
  return k >= 0 ? world.segs[k] : null;
}
// ---- per-frame
function updatePortTrucks(dt) {
  if (!world.ready || typeof traffic === "undefined") return;
  PTRUCK.t += dt;
  if (typeof updateOwnDepots === "function") updateOwnDepots(dt);
  for (let k = PTRUCK.list.length - 1; k >= 0; k--) {
    const T = PTRUCK.list[k];
    if (T.home && typeof ownedYard === "function" && !ownedYard(T.home) && T.st !== "depot") {
      if (T.v) {
        const i = traffic.vs.indexOf(T.v);
        if (i >= 0) {
          releaseJ(T.v);
          traffic.vs.splice(i, 1);
        }
      }
      if (T.l) {
        const i = T.P.lors.indexOf(T.l);
        if (i >= 0) T.P.lors.splice(i, 1);
      }
      PTRUCK.list.splice(k, 1);
    }
  }
  for (const P of portList()) {
    if (!P.ready || !P.lpath) continue;
    const mine = PTRUCK.list.filter((T) => T.P === P && !T.home);
    if (mine.length < PTRUCK.per && PTRUCK.t > (P.ptNext || 0)) {
      P.ptNext = PTRUCK.t + 8; // seed: start out of sight at a depot or on the port approach, alternating loaded/empty
      const exp = ptWantExp(P),
        T = {
          P,
          st: "new",
          box: exp ? YARD_COLS[(Math.random() * 8) | 0] : null,
          t: 0,
          id: PTRUCK.list.length,
        };
      const dp = ptDest(T),
        g = dp && ptDepotGeo(dp);
      if (
        g &&
        ptLaneOK(P) &&
        !ptVisible(g.S[0], g.S[1], 200) &&
        ptToRoad(T, g.sg, 1, g.along + 6, ptGateGoal(P))
      ) {
        T.tgt = "port";
        PTRUCK.list.push(T);
      }
    }
  }
  for (let k = PTRUCK.list.length - 1; k >= 0; k--) {
    const T = PTRUCK.list[k],
      P = T.P;
    T.t += dt;
    if (T.st === "road") {
      const v = T.v;
      if (!traffic.vs.includes(v)) {
        T.st = "lost";
        T.v = null;
        continue;
      }
      v.pinT = 1e12;
      if (T.tgt === "port") {
        const G = ptGateGoal(P).entrance;
        // hand-over: the truck is on the approach road heading the right way -> it becomes the gate-lane lorry at the matching arc
        if (Math.hypot(v.x - G.x, v.y - G.y) < P.lpre * M_T * 0.8) {
          let bs = -1,
            bd = 1e9;
          for (let s = 0; s < P.lpre * 0.6; s += 0.25) {
            const q = polyAt(P.lpath, s),
              w = PL(P, q[0], q[1]),
              dd = Math.hypot(w[0] * M_T - v.x, w[1] * M_T - v.y);
            if (dd < bd) {
              bd = dd;
              bs = s;
            }
          }
          const q0 = polyAt(P.lpath, bs),
            q1 = polyAt(P.lpath, bs + 1),
            w0 = PL(P, q0[0], q0[1]),
            w1 = PL(P, q1[0], q1[1]),
            hd = [w1[0] - w0[0], w1[1] - w0[1]],
            hl = Math.hypot(hd[0], hd[1]) || 1,
            f = fwd(v.h);
          if (
            bd < 4.5 &&
            (f[0] * hd[0] + f[1] * hd[1]) / hl > 0.8 &&
            !P.lors.some((l) => Math.abs(l.p - (bs - P.lpre)) < 7)
          ) {
            const imp = !T.box && P.stock - P.impClaim > 0;
            if (imp) P.impClaim++;
            const l = {
              p: bs - P.lpre,
              box: T.box,
              kind: T.box ? "exp" : "imp",
              claim: imp ? 1 : 0,
              w: 0,
              still: 0,
              col: "#d63b2f",
              truck: T,
            };
            const lc = portLocal(P, v.x / M_T, v.y / M_T);
            l.ox = lc[0] - q0[0];
            l.oy = lc[1] - q0[1];
            if (v.trl) {
              const tl = portLocal(P, (v.trl.x - Math.cos(v.trl.h) * 0) / M_T, v.trl.y / M_T);
            }
            const i = traffic.vs.indexOf(v);
            if (i >= 0) {
              releaseJ(v);
              traffic.vs.splice(i, 1);
            }
            T.v = null;
            T.l = l;
            T.st = "gate";
            P.lors.push(l);
            continue;
          }
        }
        T.gT += dt;
        if (T.gT > 25) {
          T.gT = 0;
          aiGoal(v, ptGateGoal(P));
          v.pinT = 1e12;
        }
      } else if (T.dest) {
        const g = ptDepotGeo(T.dest);
        const bay =
          g &&
          Math.hypot(v.x - g.S[0], v.y - g.S[1]) < 11 &&
          !PTRUCK.list.some((o) => o !== T && o.st === "depot" && o.dest === T.dest) &&
          ptBay(T.dest);
        if (bay) {
          const dp = ptDepotPath(T, v, g, bay);
          T.bay = bay;
          const f = fwd(v.h);
          T.dp = dp;
          T.s = 0;
          T.ph = "in";
          T.w = 0;
          T.x = v.x;
          T.y = v.y;
          T.h = Math.atan2(f[1], f[0]);
          T.ax = null;
          const i = traffic.vs.indexOf(v);
          if (i >= 0) {
            releaseJ(v);
            traffic.vs.splice(i, 1);
          }
          T.v = null;
          T.st = "depot";
          continue;
        }
        T.gT += dt;
        if (T.gT > 25) {
          T.gT = 0;
          aiGoal(v, T.dest);
          v.pinT = 1e12;
        }
      }
      if (T.t > 900) {
        T.st = "lost";
        const i = traffic.vs.indexOf(v);
        if (i >= 0) {
          releaseJ(v);
          traffic.vs.splice(i, 1);
        }
        T.v = null;
      }
      continue;
    }
    if (T.st === "gate") {
      const l = T.l;
      T.box = l.box;
      if (l.ox) {
        l.ox *= Math.max(0, 1 - dt * 1.5);
        l.oy *= Math.max(0, 1 - dt * 1.5);
      }
      if (l.p >= P.laneLen + P.lpost - 0.6) {
        l.hold = 1;
        const q = polyAt(P.lpath, P.lpath.len - 0.01),
          w = PL(P, q[0], q[1]),
          sg = ptSegAt(w[0] * M_T, w[1] * M_T);
        if (sg) {
          const q2 = polyAt(P.lpath, P.lpath.len - 1),
            w2 = PL(P, q2[0], q2[1]),
            hv = [w[0] - w2[0], w[1] - w2[1]],
            dv = dirVec(sg, 1),
            dir = hv[0] * dv[0] + hv[1] * dv[1] >= 0 ? 1 : -1,
            along = sg.dir === "h" ? w[0] : w[1];
          T.box = l.box;
          T.dest = ptDest(T);
          if (ptToRoad(T, sg, dir, along, T.dest)) {
            T.tgt = T.dest ? "depot" : "port";
            if (!T.dest) aiGoal(T.v, ptGateGoal(P));
            const i = P.lors.indexOf(l);
            if (i >= 0) P.lors.splice(i, 1);
            if (l.box) P.sent++;
            T.l = null;
          }
        }
      }
      continue;
    }
    if (T.st === "depot") {
      const D = T.dp;
      if (T.ph === "in") {
        const left = D.inP.len - T.s,
          pa = ptAhead(T, 6),
          mv = Math.max(
            0,
            Math.min(
              dt * Math.min(6, 0.8 + left * 0.5),
              left,
              pa < 6 ? Math.max(0, (pa - 3) * dt) : 1e9,
            ),
          );
        T.s += mv;
        const q = ptPose(D.inP, T.s);
        T.x = q[0];
        T.y = q[1];
        T.h = q[2];
        artic(T, q[0], q[1], q[2], 10.5);
        if (left < 0.05) {
          T.ph = "rev";
          T.s = 0;
          T.revP = ptPoly([
            [T.ax, T.ay],
            [D.row[0] + D.r[0] * D.s0 * 1, D.row[1] + D.r[1] * D.s0 * 1],
            [D.K[0] + D.u[0] * 9, D.K[1] + D.u[1] * 9],
            [D.K[0] + D.u[0] * 5, D.K[1] + D.u[1] * 5],
            [D.K[0] - D.u[0] * 2, D.K[1] - D.u[1] * 2],
            [D.K[0] - D.u[0] * 6, D.K[1] - D.u[1] * 6],
            [D.K[0] - D.u[0] * 10.5, D.K[1] - D.u[1] * 10.5],
          ]);
          T.q = [T.x + Math.cos(T.h) * 3.6, T.y + Math.sin(T.h) * 3.6];
          T.w = 0;
        }
      } else if (T.ph === "rev") {
        T.w += dt;
        if (T.w < 1.2) {
        } else {
          const left = T.revP.len - T.s,
            mv = Math.max(0, Math.min(dt * Math.min(1.6, 0.3 + left * 0.4), left));
          T.s += mv; // reversing: the trailer axle leads, kingpin and cab trail behind it
          const a = polyAt(T.revP, T.s);
          T.ax = a[0];
          T.ay = a[1];
          let dx = T.x - a[0],
            dy = T.y - a[1],
            l = Math.hypot(dx, dy) || 1;
          T.x = a[0] + (dx / l) * 10.5;
          T.y = a[1] + (dy / l) * 10.5;
          T.th = Math.atan2(dy, dx);
          dx = T.q[0] - T.x;
          dy = T.q[1] - T.y;
          l = Math.hypot(dx, dy) || 1;
          T.q = [T.x + (dx / l) * 3.6, T.y + (dy / l) * 3.6];
          T.h = Math.atan2(dy, dx);
          T.rev = 1;
          if (left < 0.05) {
            T.ph = "drop";
            T.w = 0;
            T.rev = 0;
          }
        }
      } else if (T.ph === "drop") {
        T.w += dt;
        {
          const bh = Math.atan2(D.u[1], D.u[0]),
            e = (x, t) => {
              let d = t - x;
              d = Math.atan2(Math.sin(d), Math.cos(d));
              return x + d * Math.min(1, dt * 3);
            };
          T.th = e(T.th, bh);
          T.h = e(T.h, bh);
          T.x = D.K[0];
          T.y = D.K[1];
          T.ax = D.K[0] - D.u[0] * 10.5;
          T.ay = D.K[1] - D.u[1] * 10.5;
          T.straight = Math.abs(Math.atan2(Math.sin(T.th - bh), Math.cos(T.th - bh))) < 0.03;
        }
        /* final square-up in the bay */ if (T.pick) {
          if (T.w > 2.5 && !T.box && T.straight) T.box = YARD_COLS[(Math.random() * 8) | 0];
          if (T.w > 4.5 && T.box) {
            T.ph = "out";
            T.s = 0;
            T.bay = null;
            ptSetArt(T);
          }
        } else {
          if (T.w > 2.5 && T.box && T.straight && !T.expLoad) {
            T.box = null;
            if (T.home && typeof ownDelivered === "function") ownDelivered(T);
            T.P.delivered = (T.P.delivered || 0) + 1;
            if (!T.home && ptWantExp(T.P)) T.expLoad = 1;
          }
          if (T.expLoad && !T.box && T.w > 4) {
            T.box = YARD_COLS[(Math.random() * 8) | 0];
            ptSetArt(T);
            T.P.expOut = (T.P.expOut || 0) + 1;
          }
          if (T.w > (T.expLoad ? 6 : 4.5) && (!T.box || T.expLoad)) {
            T.ph = "out";
            T.s = 0;
            T.bay = null;
            T.expLoad = 0;
          }
        }
      } // box goes into the building, never seen again
      else {
        const pa = ptAhead(T, 6),
          mv = Math.max(
            0,
            Math.min(dt * Math.min(6, 1 + T.s * 0.4), pa < 6 ? Math.max(0, (pa - 3) * dt) : 1e9),
          ),
          end = D.outP.len;
        if (T.s + mv >= end - 0.05) {
          T.s = end - 0.05;
          const g = ptDepotGeo(T.dest);
          if (T.wl) {
            if (!ptLaneOK(T.P)) continue;
            T.wl = 0;
          } else {
            if (T.home && typeof ownMission === "function") {
              if (T.pick && T.box) {
                T.pick = 0;
                T.dest = T.home;
                T.tgt = "depot";
              } else ownMission(T);
            } else {
              T.tgt = "port";
              T.dest = null;
            }
            if (T.tgt === "port" && !ptLaneOK(T.P)) {
              T.wl = 1;
              continue;
            }
          }
          if (
            ptToRoad(T, g.sg, D.exit.dir, D.exit.along, T.tgt === "port" ? ptGateGoal(T.P) : T.dest)
          ) {
            if (T.tgt === "port") T.dest = null;
            continue;
          }
        } else T.s += mv;
        const q = ptPose(D.outP, T.s);
        T.x = q[0];
        T.y = q[1];
        T.h = q[2];
        artic(T, q[0], q[1], q[2], 10.5);
      }
      continue;
    }
    if (T.st === "lost") {
      T.lt = (T.lt || 0) + dt;
      if (T.lt > 6) {
        T.lt = 0;
        const dp = ptDest(T) || T.dest,
          g = dp && ptDepotGeo(dp);
        if (
          g &&
          !ptVisible(g.S[0], g.S[1], 200) &&
          ptToRoad(T, g.sg, 1, g.along + 6, ptGateGoal(P))
        ) {
          T.tgt = "port";
          T.dest = null;
        }
      }
    }
  }
}
// balance import collections vs export deliveries by the yard (import) stock and the export stack level
function ptWantExp(P) {
  const cap = P.ecap || 16,
    inbound =
      PTRUCK.list.filter((o) => o.P === P && o.box && (o.tgt === "port" || o.expLoad)).length +
      P.lors.filter((l) => l.kind === "exp" && l.box && !l.dropped).length;
  const need = cap - 2 - (P.ex + (P.exRes || 0) + inbound);
  if (need <= 0) return false;
  const imp = (P.stock || 0) - (P.impClaim || 0);
  if (imp <= 0) return true;
  return need / cap >= imp / (P.cap || 16);
}
function ptAhead(T, look) {
  const h = T.h,
    d = [Math.cos(h), Math.sin(h)];
  let best = 1e9;
  const pts = [[truck.x, truck.y]];
  if (truck.trl) pts.push([truck.trl.x, truck.trl.y]);
  for (const o of traffic.vs)
    if (Math.abs(o.x - T.x) < 40 && Math.abs(o.y - T.y) < 40) {
      pts.push([o.x, o.y]);
      if (o.trl) pts.push([o.trl.x, o.trl.y]);
    }
  for (const q of pts) {
    const rx = q[0] - T.x,
      ry = q[1] - T.y,
      a = (rx * d[0] + ry * d[1]) / M_T,
      lat = Math.abs(rx * d[1] - ry * d[0]);
    if (a > -0.3 && a < look && lat < 2.6 && a < best) best = a;
  }
  return best;
}
// bodies the AI traffic must brake for (scripted depot trucks + gate lorries are added in port.js)
function ptBodies() {
  const out = [];
  for (const T of PTRUCK.list)
    if (T.st === "depot" && T.x != null) {
      const f = [Math.cos(T.h), Math.sin(T.h)],
        tt = [Math.cos(T.th ?? T.h), Math.sin(T.th ?? T.h)];
      for (const k of [5, 2]) out.push([T.x + f[0] * k, T.y + f[1] * k]);
      for (const k of [0, -4.5, -9, -13.6]) out.push([T.x + tt[0] * k, T.y + tt[1] * k]);
    }
  return out;
}
// ---- drawing: depot trucks (scripted), depot gantry cranes
function ptYardCounter(vx0, vy0, vx1, vy1) {
  for (const P of portList()) {
    if (!P.ready || P.impC == null) continue;
    const w = PL(P, (P.blkU ? P.blkU[1] : 0) + 1.5, P.impC + P.hs * 8),
      x = w[0] * TILE,
      y = w[1] * TILE;
    if (x < vx0 - 300 || x > vx1 + 300 || y < vy0 - 300 || y > vy1 + 300) continue; // yard stock debug counter
    const t1 =
        "YARD " +
        P.stock +
        "/" +
        P.cap +
        (P.stock >= P.cap ? " FULL" : P.stock <= 0 ? " EMPTY" : ""),
      t2 =
        "in " +
        (P.yIn || 0) +
        " − out " +
        (P.collected || 0) +
        " • waiting " +
        P.lors.filter((l) => l.truck && !l.box && l.at).length;
    ctx.save();
    ctx.font = "bold 15px ui-monospace,monospace";
    ctx.textAlign = "center";
    const wd = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + 14;
    ctx.fillStyle = "rgba(10,14,20,0.82)";
    ctx.fillRect(x - wd / 2, y - 22, wd, 42);
    ctx.fillStyle = P.stock >= P.cap ? "#ff7b72" : P.stock <= 0 ? "#ffd866" : "#7dff9a";
    ctx.fillText(t1, x, y - 4);
    ctx.font = "12px ui-monospace,monospace";
    ctx.fillStyle = "#cfd8e3";
    ctx.fillText(t2, x, y + 13);
    {
      const sh = (P.cur && P.cur.ships) || [],
        nm = (o) =>
          ["ALBION STAR", "NORDIC TIDE", "MAERSK KENT", "CMA SEINE", "EVER GRACE", "HAPAG ELBE"][
            ((o.k % 6) + 6) % 6
          ],
        cnt = (o) => (o.s ? o.s.has.filter(Boolean).length : 0); // v43 extra 3: ship schedule board
      const st = (k) =>
        ({
          in: "INBOUND",
          sideIn: "BERTHING",
          dockA: "DISCHARGING",
          shift: "SHIFTING",
          dockB: "LOADING",
          sideOut: "SAILING",
          out: "OUTBOUND",
          anchor: "AT ANCHOR",
        })[k] || k;
      const A = sh.find((o) => o.pose.k === "dockA" || o.pose.k === "sideIn"),
        B = sh.find((o) => o.pose.k === "dockB" || o.pose.k === "shift"),
        an = sh.filter((o) => o.pose.k === "anchor"),
        inb = sh.filter((o) => o.pose.k === "in");
      const L = [
        P.windStop ? "SHIP SCHEDULE  \u26A0 CRANES STOPPED - HIGH WIND" : "SHIP SCHEDULE",
        "A import  " +
          (A ? nm(A).padEnd(12) + st(A.pose.k).padEnd(12) + cnt(A) + "/6" : "-- free --"),
        "B export  " +
          (B ? nm(B).padEnd(12) + st(B.pose.k).padEnd(12) + cnt(B) + "/6" : "-- free --"),
        "anchor    " +
          (an.length ? an.map(nm).join(", ") + " (next)" : "none") +
          (inb.length ? "  inbound " + inb.length : ""),
      ];
      ctx.font = "bold 13px ui-monospace,monospace";
      ctx.textAlign = "left";
      const W2 = Math.max(...L.map((t) => ctx.measureText(t).width)) + 16,
        y2 = y + 28;
      ctx.fillStyle = "rgba(10,14,20,0.85)";
      ctx.fillRect(x - W2 / 2, y2, W2, L.length * 17 + 8);
      L.forEach((t, i) => {
        ctx.fillStyle = i ? "#e6edf3" : "#ffd866";
        ctx.fillText(t, x - W2 / 2 + 8, y2 + 16 + i * 17);
      });
    }
    ctx.restore();
  }
}
function drawPortTrucksLow(vx0, vy0, vx1, vy1) {
  if (typeof drawOwnDepots === "function") drawOwnDepots(vx0, vy0, vx1, vy1);
  if (typeof czDrawBays === "function") czDrawBays(vx0, vy0, vx1, vy1);
  for (const T of PTRUCK.list) {
    if (T.st !== "depot" || T.x == null) continue;
    const x = T.x * PPM,
      y = T.y * PPM;
    if (x < vx0 - 200 || x > vx1 + 200 || y < vy0 - 200 || y > vy1 + 200) continue;
    drawPortLorry(null, T.x / M_T, T.y / M_T, T.h, { col: "#d63b2f", box: T.box, th: T.th });
    if (T.rev && DN.dark > 0.05) {
      dnLight(
        (T.x - Math.cos(T.th) * 13.8) * PPM,
        (T.y - Math.sin(T.th) * 13.8) * PPM,
        50,
        "rgba(255,255,255,0.9)",
        0.6,
      );
    }
    if (DN.dark > 0.05) {
      dnLight(
        (T.x + Math.cos(T.h) * 7) * PPM,
        (T.y + Math.sin(T.h) * 7) * PPM,
        70,
        "rgba(255,245,215,0.9)",
        0.7,
      );
    }
  }
}
function drawDepotCranes() {} // (no depot cranes: James's spec - trucks reverse into a bay and the box goes into the building)
// ---- world map / minimap: loaded = container colour, empty = hollow skeletal
function ptPoses() {
  const out = [];
  for (const T of PTRUCK.list) {
    let x, y, h;
    if (T.st === "road" && T.v) {
      const f = fwd(T.v.h || 0);
      x = T.v.x;
      y = T.v.y;
      h = Math.atan2(f[1], f[0]);
    } else if (T.st === "gate" && T.l && T.l.x != null) {
      const w = PL(T.P, T.l.x, T.l.y);
      x = w[0] * M_T;
      y = w[1] * M_T;
      const P = T.P;
      h = Math.atan2(
        P.U[1] * Math.cos(T.l.h) + P.V[1] * Math.sin(T.l.h),
        P.U[0] * Math.cos(T.l.h) + P.V[0] * Math.sin(T.l.h),
      );
    } else if (T.st === "depot" && T.x != null) {
      x = T.x;
      y = T.y;
      h = T.h;
    } else continue;
    out.push({ x, y, h, box: T.box, T });
  }
  return out;
}
function portMapTrucks(BX, BY, z) {
  if (typeof ownMap === "function" && z > 0) ownMap(BX, BY, z);
  ctx.save();
  for (const q of ptPoses()) {
    const x = BX(q.x / M_T),
      y = BY(q.y / M_T),
      l = Math.max(9, 4.2 * z),
      w = Math.max(4.5, 0.7 * z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(q.h);
    ctx.fillStyle = "#d63b2f";
    ctx.fillRect(l * 0.18, -w / 2, l * 0.3, w);
    if (q.box) {
      ctx.fillStyle = q.box;
      ctx.fillRect(-l * 0.62, -w / 2, l * 0.78, w);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-l * 0.62, -w / 2, l * 0.78, w);
    } else {
      ctx.strokeStyle = "#e8e8e8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(-l * 0.62, -w / 2, l * 0.78, w);
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (z >= 2.2 && !q.mini) {
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      const t = q.box ? "Container (loaded)" : "Empty trailer";
      ctx.strokeText(t, x + l * 0.6 + 4, y - 6);
      ctx.fillStyle = q.box ? "#ffe08a" : "#cfd8e3";
      ctx.fillText(t, x + l * 0.6 + 4, y - 6);
    }
  }
  ctx.restore();
}

// road port trucks only head for the gate when the holding lane has space for them (counts trucks already on the way)
function ptLaneOK(P) {
  const onWay = PTRUCK.list.filter((o) => o.P === P && o.tgt === "port" && o.v && !o.wl).length;
  return dgHoldN(P) + P.lors.filter((l) => l.p < -0.5).length + onWay < 4;
}
