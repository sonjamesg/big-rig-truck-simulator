/**
 * @file crash.js — v66 CRASH: mass/momentum vehicle collisions, progressive damage, wrecks, tanker explosions, clearance crews,
 *   jackknife (no rollover since v67), spilled cargo, pile-up slow motion, police response.
 * Exposes (globals): CRASH, crMass, crPlayerHit, crashStepVeh, crImpulse, updateCrash, drawCrashLow, drawCrashHigh, crDrawBody,
 *   crRig, crTimeScale, crCargoPenalty
 * Depends on: traffic.js (traffic, boxesOf, obbMTV, pathAt, VTYPES), physics.js (fwd, rgt, kingpin, solidAtM), fx.js (fxEmit, FX),
 *   audio.js (thump, noiseBurst), police.js / wanted.js (optional), gfx.js (gfxHi, GFX_LOW_FPS optional)
 * All effects are local to this client (AI traffic is simulated per client); nothing here is sent over multiplayer.
 */
"use strict";
const CRASH = {
  booms: [], // tanker explosions {x,y,t}
  scorch: [], // ground decals {x,y,r,h,t}
  debris: [], // glass / cargo bits on the road {x,y,c,s,h,t}
  crews: [], // police + tow clearing a wreck
  slowT: 0,
  recent: [], // times of recent crash entries (pile-up detection)
  stats: { hits: 0, wrecks: 0, booms: 0, jk: 0, roll: 0 },
  reset() {
    this.booms.length = this.scorch.length = this.debris.length = this.crews.length = this.recent.length = 0;
    this.slowT = 0;
  },
};
const CR_E = 0.12, // restitution: metal crumples, very little bounce
  CR_DMG_K = 90, // J per kg of absorbed energy that wrecks a vehicle (car into a wall at ~30 mph)
  CR_MASS = { hatch: 1150, sedan: 1450, estate: 1550, sports: 1400, suv: 2050, taxi: 1500, van: 2400, box: 9000, bus: 13000, cab: 8000 };
function crMass(v) {
  if (v.crM) return v.crM;
  let m = CR_MASS[v.kind] || (v.heavy ? 9000 : 1500);
  if (v.kind === "lorry") {
    const tank = v.tanker || (v.art && v.art.tank);
    m = 8000 + (tank ? 30000 : 7000 + ((v.id * 7919) % 17) * 1000); // deterministic load per vehicle
  }
  return (v.crM = m);
}
function crQ() {
  // effect density: 1 on High, 0.4 on Low or when the frame rate drops
  const hi = typeof gfxHi === "function" ? gfxHi() : true;
  const low = typeof fps !== "undefined" && fps > 0 && fps < 30;
  return hi && !low ? 1 : 0.4;
}
function crSound(E, glass) {
  try {
    const k = Math.min(1, E / 4e5);
    if (k < 0.02) return;
    thump(Math.min(1, 0.3 + k));
    noiseBurst(0.18 + k * 0.4, 700 + 500 * (1 - k), 1.2, 0.25 + 0.6 * k); // metal crunch
    if (glass) noiseBurst(0.35, 5200, 4, 0.18 + 0.2 * k, "highpass"); // glass
  } catch (e) {}
}
function crVel(v) {
  if (v.cr) return [v.cr.vx, v.cr.vy];
  const f = fwd(v.h || 0);
  return [f[0] * v.v, f[1] * v.v];
}
function crEnter(v) {
  if (v.cr) return v.cr;
  const f = fwd(v.h || 0);
  v.cr = { vx: f[0] * v.v, vy: f[1] * v.v, w: 0, t: 0 };
  v.v = 0;
  CRASH.recent.push(timeS);
  return v.cr;
}
function crEmitGlass(x, y, n, col) {
  n = Math.round(n * crQ());
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283,
      d = Math.random() * 3.2;
    CRASH.debris.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, c: col || (i % 4 ? "190,225,240" : "240,250,255"), s: 0.12 + Math.random() * 0.18, h: Math.random() * 3, t: timeS });
  }
  if (CRASH.debris.length > 900) CRASH.debris.splice(0, CRASH.debris.length - 900);
}
// damage a vehicle by absorbed energy E (J); returns the damage added
function crDamage(v, E, cx, cy) {
  const m = crMass(v),
    add = E / (m * CR_DMG_K);
  const d0 = v.dmg || 0;
  v.dmg = d0 + add;
  if (cx !== undefined) {
    const f = fwd(v.h || 0);
    const end = (cx - v.x) * f[0] + (cy - v.y) * f[1] >= 0 ? 1 : -1;
    v.crEnd = v.crEnd || end;
  }
  if (d0 < 0.25 && v.dmg >= 0.25) crEmitGlass(cx ?? v.x, cy ?? v.y, 14);
  if (v.dmg >= 1 && !v.wreck) {
    v.wreck = true;
    v.wreckT = timeS;
    v.burnT = v.dmg >= 1.5 ? timeS + 25 : 0;
    CRASH.stats.wrecks++;
    crEmitGlass(v.x, v.y, 24);
  }
  if ((v.tanker || (v.art && v.art.tank)) && v.dmg >= 0.45 && !v.boomed) {
    v.boomed = true;
    v.wreck = true;
    v.wreckT = timeS;
    v.burnT = timeS + 40;
    const t = v.trl || v;
    crBoom(t.x, t.y, v);
  }
  return add;
}
// impulse between two bodies along unit normal n (pointing from A to B); va/vb velocity vectors, ma/mb masses.
// returns {J, E, dva:[..], dvb:[..]} or null when they are separating
function crImpulse(va, vb, ma, mb, n) {
  const vrel = (va[0] - vb[0]) * n[0] + (va[1] - vb[1]) * n[1];
  if (vrel <= 0.3) return null;
  const J = ((1 + CR_E) * vrel) / (1 / ma + 1 / mb),
    mu = (ma * mb) / (ma + mb),
    E = 0.5 * mu * vrel * vrel * (1 - CR_E * CR_E);
  return { J, E, vrel, dva: [(-J / ma) * n[0], (-J / ma) * n[1]], dvb: [(J / mb) * n[0], (J / mb) * n[1]] };
}
function crSpin(v, cx, cy, J, n) {
  const m = crMass(v),
    L = v.trl ? 18 : v.L || 4.5,
    I = (m * L * L) / 12,
    rx = cx - v.x,
    ry = cy - v.y;
  v.cr.w = Math.max(-2.5, Math.min(2.5, v.cr.w + ((rx * n[1] - ry * n[0]) * J) / I));
}
// player rig vs AI vehicle box. p: player box, b: AI box, m: [nx,ny,depth] from obbMTV(p,b) (pushes b away from p)
function crPlayerHit(s, v, p, b, m) {
  const M = s.mass || 20000,
    mv = crMass(v),
    n = [m[0], m[1]],
    f = fwd(s.h),
    vp = [f[0] * s.v, f[1] * s.v],
    vb = crVel(v);
  // positional split by mass (the lighter body moves more)
  const dep = m[2] + 0.04,
    sa = mv / (M + mv),
    sb = M / (M + mv);
  s.x -= n[0] * dep * sa;
  s.y -= n[1] * dep * sa;
  const mvB = (dx, dy) => {
    v.x += dx;
    v.y += dy;
    if (!v.cr) {
      v.offX += dx;
      v.offY += dy;
    }
    if (v.trl) {
      v.trl.x += dx;
      v.trl.y += dy;
    }
  };
  mvB(n[0] * dep * sb, n[1] * dep * sb);
  const r = crImpulse(vp, vb, M, mv, n);
  if (!r) return 0;
  const cx = (p.x + b.x) / 2,
    cy = (p.y + b.y) / 2;
  s.v += r.dva[0] * f[0] + r.dva[1] * f[1];
  const c = crEnter(v);
  c.vx = vb[0] + r.dvb[0];
  c.vy = vb[1] + r.dvb[1];
  crSpin(v, cx, cy, r.J, n);
  CRASH.stats.hits++;
  const was = !!v.wreck;
  crDamage(v, r.E * 0.5, cx, cy);
  const pd = Math.min(85, ((r.E * 0.5) / (M * CR_DMG_K)) * 100 * 0.6);
  s.damage = Math.min(100, (s.damage || 0) + pd * (s.dmgM || 1));
  s.bump = Math.min(1, Math.max(s.bump || 0, r.E / 3e5));
  s.hitV = 1e-6; // main.js damage path: already applied here
  s.crunchT = Math.min(0.3, r.E / 4e6);
  cam.shake = Math.max(cam.shake || 0, Math.min(22, 2 + r.E / 1.5e5));
  crSound(r.E, (v.dmg || 0) >= 0.25);
  if (typeof wantHit === "function")
    try {
      wantHit(v, r.vrel);
    } catch (e) {}
  if (!was && v.wreck && v.role !== "police") crPolice(r.E);
  crCargo(s, r.E / M);
  return r.vrel;
}
// cargo damage + spill on the player's load (E per tonne of rig)
function crCargo(s, ek) {
  if (!s.trl || ek < 2) return;
  const a = typeof career !== "undefined" && career.active;
  const add = Math.min(60, ek * 0.9);
  if (a) a.cdmg = Math.min(100, (a.cdmg || 0) + add);
  if (ek > 25) crSpill(s, Math.min(40, ek * 0.6));
}
function crSpill(s, n) {
  const k = kingpin(s),
    ft = fwd(s.th),
    rt = rgt(s.th),
    cols = ["160,120,70", "200,170,110", "120,90,60", "90,110,140", "210,210,200"];
  n = Math.round(n * crQ());
  for (let i = 0; i < n; i++) {
    const t = 4 + Math.random() * 10,
      side = (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 4);
    CRASH.debris.push({ x: k[0] - ft[0] * t + rt[0] * side, y: k[1] - ft[1] * t + rt[1] * side, c: cols[i % 5], s: 0.5 + Math.random() * 0.6, h: Math.random() * 3, t: timeS, box: 1 });
  }
  if (typeof toast === "function" && !s._spillMsg) {
    s._spillMsg = 1;
    toast("\u{1F4E6} Cargo spilled \u2014 the load is damaged");
    setTimeout(() => (s._spillMsg = 0), 8000);
  }
}
function crCargoPenalty() {
  const a = typeof career !== "undefined" && career.active;
  return a && a.cdmg ? Math.min(80, a.cdmg) : 0;
}
// police: a serious crash the player caused -> a patrol is sent (pursuit with a fine, never an arrest)
function crPolice(E) {
  if (E < 1.5e5 || typeof polSpawn !== "function" || typeof polOffence !== "function") return;
  if (CRASH.polT && timeS - CRASH.polT < 60) return;
  CRASH.polT = timeS;
  try {
    if (typeof POL_FINES !== "undefined") POL_FINES.crash = POL_FINES.crash || 250;
    const v = (typeof POL !== "undefined" && POL.chase && POL.chase.v) || polSpawn();
    if (v) polOffence("crash", v, "caused a serious crash");
  } catch (e) {}
}
// free-body step for an AI vehicle knocked out of its lane (traffic.js stepVeh calls this while v.cr is set)
function crashStepVeh(v, dt) {
  const c = v.cr;
  c.t += dt;
  const sp = Math.hypot(c.vx, c.vy);
  if (sp > 0.01) {
    const dec = (v.wreck ? 7.5 : 5.5) * dt,
      k = Math.max(0, sp - dec) / sp;
    c.vx *= k;
    c.vy *= k;
  }
  c.w *= Math.exp(-2.5 * dt);
  const dx = c.vx * dt,
    dy = c.vy * dt,
    dh = c.w * dt;
  // static solids (buildings, walls): stop dead with damage
  const nx = v.x + dx,
    ny = v.y + dy;
  if (typeof solidAtM === "function" && solidAtM(nx + Math.sign(dx) * (v.W || 2) * 0.5, ny + Math.sign(dy) * (v.W || 2) * 0.5)) {
    crDamage(v, 0.5 * crMass(v) * sp * sp * 0.9, nx, ny);
    if (sp > 3) crSound(0.5 * crMass(v) * sp * sp, false);
    c.vx *= -0.1;
    c.vy *= -0.1;
    c.w *= 0.3;
  } else {
    v.x = nx;
    v.y = ny;
    v.h = (v.h || 0) + dh;
    if (v.trl) {
      // the trailer is dragged: translate with the cab, swing half as much about the coupling
      const ox = v.trl.x - v.x,
        oy = v.trl.y - v.y,
        a = dh * 0.5,
        ca = Math.cos(a),
        sa = Math.sin(a);
      v.trl.x = v.x + ox * ca - oy * sa + dx;
      v.trl.y = v.y + ox * sa + oy * ca + dy;
      v.trl.h += a;
    }
  }
  // pile-up propagation: a moving crashed body hits other traffic
  if (sp > 0.8) {
    for (const o of traffic.vs) {
      if (o === v || Math.abs(o.x - v.x) > 22 || Math.abs(o.y - v.y) > 22) continue;
      if ((o.layer | 0) !== (v.layer | 0)) continue;
      let done = false;
      for (const A of boxesOf(v)) {
        for (const B of boxesOf(o)) {
          const m = obbMTV(A, B);
          if (!m) continue;
          const ma = crMass(v),
            mb = crMass(o),
            n = [m[0], m[1]],
            dep = m[2] + 0.03;
          const sa = mb / (ma + mb),
            sb = ma / (ma + mb);
          v.x -= n[0] * dep * sa;
          v.y -= n[1] * dep * sa;
          if (v.trl) {
            v.trl.x -= n[0] * dep * sa;
            v.trl.y -= n[1] * dep * sa;
          }
          o.x += n[0] * dep * sb;
          o.y += n[1] * dep * sb;
          if (!o.cr) {
            o.offX += n[0] * dep * sb;
            o.offY += n[1] * dep * sb;
          }
          if (o.trl) {
            o.trl.x += n[0] * dep * sb;
            o.trl.y += n[1] * dep * sb;
          }
          const r = crImpulse([c.vx, c.vy], crVel(o), ma, mb, n);
          if (r) {
            const ov = crVel(o),
              oc = crEnter(o);
            c.vx += r.dva[0];
            c.vy += r.dva[1];
            oc.vx = ov[0] + r.dvb[0];
            oc.vy = ov[1] + r.dvb[1];
            const cx = (A.x + B.x) / 2,
              cy = (A.y + B.y) / 2;
            crSpin(o, cx, cy, r.J, n);
            crDamage(v, r.E * 0.5, cx, cy);
            crDamage(o, r.E * 0.5, cx, cy);
            if (Math.hypot(cx - truck.x, cy - truck.y) < 150) crSound(r.E, (o.dmg || 0) >= 0.25);
          }
          done = true;
          break;
        }
        if (done) break;
      }
    }
  }
  if (Math.hypot(c.vx, c.vy) < 0.25 && Math.abs(c.w) < 0.05) {
    c.vx = c.vy = c.w = 0;
    if (v.parked) {
      if (!v.wreck) v.cr = null;
      return;
    }
    if (!v.wreck && c.t > 1.2) {
      // shaken but driveable: rejoin the lane (traffic.js steers the offset back in)
      const p = pathAt(v, v.s);
      v.offX = v.x - p[0];
      v.offY = v.y - p[1];
      v.cr = null;
      v.v = 0;
      v.shakeT = 1.6;
      v.hitEnd = timeS;
      v.ghostT = Math.max(v.ghostT || 0, 1.5);
      return;
    }
  }
  v.v = 0;
  v.brake = true;
  v.stopT += dt;
  if (v.wreck) v.stopT = Math.min(v.stopT, 30); // wrecks stay until the tow truck takes them
}
// ---------------- tanker explosion ----------------
function crBoom(x, y, src) {
  CRASH.booms.push({ x, y, t: 0 });
  CRASH.stats.booms++;
  CRASH.scorch.push({ x, y, r: 9 + Math.random() * 3, h: Math.random() * 3, t: timeS });
  if (CRASH.scorch.length > 30) CRASH.scorch.shift();
  CRASH.slowT = Math.max(CRASH.slowT, 1.4);
  const q = crQ();
  for (let i = 0; i < 90 * q; i++) {
    const a = Math.random() * 6.283,
      sp = 5 + Math.random() * 18;
    fxEmit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + Math.random(), 0.7 + Math.random() * 0.8, i % 3 ? "255," + (110 + ((Math.random() * 110) | 0)) + ",20" : "255,240,180", 3, 1);
  }
  for (let i = 0; i < 14 * q; i++) {
    const a = Math.random() * 6.283,
      sp = 2 + Math.random() * 6;
    fxEmit(x + Math.cos(a) * 3, y + Math.sin(a) * 3, Math.cos(a) * sp, Math.sin(a) * sp, 1.2, 2.6, "74,70,66", 2.2);
  }
  // shockwave: push and damage everything nearby
  const R = 28;
  for (const o of traffic.vs) {
    if (o === src) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d > R) continue;
    const k = 1 - d / R,
      c = crEnter(o),
      dv = (14 * k * 9000) / Math.max(1500, crMass(o));
    c.vx += ((o.x - x) / (d || 1)) * dv;
    c.vy += ((o.y - y) / (d || 1)) * dv;
    c.w += (Math.random() - 0.5) * 2 * k;
    crDamage(o, k * 1.3 * crMass(o) * CR_DMG_K);
  }
  const d = Math.hypot(truck.x - x, truck.y - y);
  if (d < R) {
    const k = 1 - d / R;
    truck.damage = Math.min(100, (truck.damage || 0) + 55 * k);
    truck.v *= 1 - 0.6 * k;
    truck.bump = 1;
    truck.hitV = 1e-6;
    crCargo(truck, 40 * k);
  }
  cam.shake = Math.max(cam.shake || 0, d < 120 ? 26 : 10);
  try {
    thump(1);
    noiseBurst(1.6, 110, 0.7, 1.4, "lowpass");
    noiseBurst(0.6, 2400, 1, 0.4);
  } catch (e) {}
  if (typeof BigRig !== "undefined" && BigRig.emit) BigRig.emit("tankerExplode", { x, y });
  if (typeof toast === "function" && d < 200) toast("\u{1F525} Tanker explosion!");
}
// ---------------- player rig: jackknife (called from stepTruck after the kinematics, 120 Hz) ----------------
function crRig(s, prev, dt) {
  if (s.rolled) s.rolled = null; // no rollover any more (old state cleared)
  if (!s.trl) return;
  const w = s.trl.weight || 0,
    av = Math.abs(s.v);
  // v67: trailer rollover removed (James) - jackknife only
  // jackknife: locking the drive wheels hard at speed with a heavy trailer (or a swerve under braking) lets the trailer swing round
  if (av > 15 && w > 12000 && (s.brake > 0.85 || s.skid) && (Math.abs(s.steer) > 0.05 || s.skid)) {
    s.jkT = (s.jkT || 0) + dt;
    if (s.jkT > 0.35 && !s.jkW) {
      const rel = Math.atan2(Math.sin(s.h - s.th), Math.cos(s.h - s.th));
      s.jkW = (Math.sign(rel || s.steer) || 1) * 0.9;
      CRASH.stats.jk++;
      if (typeof toast === "function") toast("\u26A0\uFE0F Jackknife!");
    }
  } else s.jkT = 0;
  if (s.jkW) {
    s.th -= s.jkW * dt * Math.min(1, av / 10);
    s.v *= 1 - 0.25 * dt;
    s.jkW *= Math.exp(-0.9 * dt);
    if (Math.abs(s.jkW) < 0.05 || av < 2) s.jkW = 0;
  }
}
// slow motion for a big pile-up / explosion (single player only: multiplayer keeps real time)
function crTimeScale() {
  if (typeof MP !== "undefined" && MP.on) return 1;
  return CRASH.slowT > 0 ? 0.35 : 1;
}
// ---------------- clearance crews: police car + tow truck for each wreck ----------------
function crCrewArt(kind) {
  const k = "crew_" + kind;
  if (!traffic.arts[k]) {
    const c = kind === "pol" ? makeCarArt("estate", "#f2f2f2") : makeBoxArt("#f1c40f", "#2c2c2c", "RECOVERY");
    traffic.arts[k] = { c, sh: shadowOf(c) };
  }
  return traffic.arts[k];
}
function crCrews(dt) {
  for (const v of traffic.vs)
    if (v.wreck && !v.crew && timeS - v.wreckT > 10 && CRASH.crews.length < 4) {
      const h = v.h || 0,
        f = fwd(h),
        r = rgt(h);
      v.crew = { v, h, ph: 0, t: 0, pol: { x: v.x - f[0] * 12 + r[0] * 0.5, y: v.y - f[1] * 12 + r[1] * 0.5, h }, tow: { x: v.x - f[0] * 90, y: v.y - f[1] * 90, h } };
      CRASH.crews.push(v.crew);
    }
  for (let i = CRASH.crews.length - 1; i >= 0; i--) {
    const C = CRASH.crews[i],
      v = C.v;
    C.t += dt;
    const f = fwd(C.h);
    if (traffic.vs.indexOf(v) < 0) {
      CRASH.crews.splice(i, 1);
      continue;
    }
    if (v.burnT && timeS < v.burnT) continue; // wait for the fire to burn out
    if (C.ph === 0 && C.t > 6) C.ph = 1; // tow truck sets off
    if (C.ph === 1) {
      const tx = v.x - f[0] * ((v.trl ? 18 : v.L) / 2 + 4),
        ty = v.y - f[1] * ((v.trl ? 18 : v.L) / 2 + 4),
        d = Math.hypot(tx - C.tow.x, ty - C.tow.y);
      // the tow truck reverses in from behind the police car
      const st = Math.min(d, 9 * dt);
      if (d > 0.2) {
        C.tow.x += ((tx - C.tow.x) / d) * st;
        C.tow.y += ((ty - C.tow.y) / d) * st;
      } else {
        C.ph = 2;
        C.t = 0;
      }
    } else if (C.ph === 2 && C.t > 4) C.ph = 3; // hooked up
    else if (C.ph === 3) {
      // drive off ahead with the wreck in tow
      const sp = Math.min(10, C.t * 2) * dt;
      C.tow.x += f[0] * sp;
      C.tow.y += f[1] * sp;
      C.pol.x += f[0] * sp * (C.t > 3 ? 1 : 0);
      C.pol.y += f[1] * sp * (C.t > 3 ? 1 : 0);
      if (C.t > 1) {
        // pull the wreck straight behind the tow truck
        const L = (v.trl ? 18 : v.L) / 2 + 4;
        const ox = C.tow.x - f[0] * L - v.x,
          oy = C.tow.y - f[1] * L - v.y;
        v.x += ox;
        v.y += oy;
        v.h = C.h;
        if (v.trl) {
          v.trl.x += ox;
          v.trl.y += oy;
        }
      }
      if (C.t > 12 || (C.t > 4 && !onScreen(C.tow.x, C.tow.y, 20))) {
        const k = traffic.vs.indexOf(v);
        if (k >= 0) {
          if (typeof releaseJ === "function") releaseJ(v);
          traffic.vs.splice(k, 1);
        }
        CRASH.crews.splice(i, 1);
      }
    }
  }
}
// ---------------- per-frame ----------------
function updateCrash(dt) {
  CRASH.recent = CRASH.recent.filter((t) => timeS - t < 0.8);
  if (CRASH.recent.length >= 3 && CRASH.slowT <= 0 && !CRASH.slowCool) {
    CRASH.slowT = 1.1; // pile-up moment
    CRASH.slowCool = 1;
    setTimeout(() => (CRASH.slowCool = 0), 6000);
  }
  if (CRASH.slowT > 0) CRASH.slowT -= dt / 0.35;
  for (const b of CRASH.booms) b.t += dt;
  CRASH.booms = CRASH.booms.filter((b) => b.t < 2.5);
  // smoke + fire from damaged vehicles (near the player only)
  const q = crQ();
  for (const v of traffic.vs) {
    const d = v.dmg || 0;
    if (d < 0.55 || Math.abs(v.x - truck.x) > 160 || Math.abs(v.y - truck.y) > 160) continue;
    const burning = v.burnT && timeS < v.burnT,
      f = fwd(v.h || 0),
      e = v.crEnd || 1,
      ex = v.x + f[0] * e * (v.L || 4) * 0.35,
      ey = v.y + f[1] * e * (v.L || 4) * 0.35;
    if (Math.random() < dt * (burning ? 10 : 5) * q)
      fxEmit(ex, ey, (Math.random() - 0.5) * 0.8 + 0.4, (Math.random() - 0.5) * 0.8 - 0.3, 0.5, 2.6, burning ? "58,55,52" : d >= 1 ? "60,60,62" : "150,150,150", 1.6);
    if (burning && Math.random() < dt * 22 * q) {
      const t = v.trl && v.boomed ? v.trl : v;
      fxEmit(t.x + (Math.random() - 0.5) * 3, t.y + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.4, 0.55, "255," + (120 + ((Math.random() * 90) | 0)) + ",25", 1.2, 1);
    }
  }
  const now = timeS;
  if (CRASH.debris.length && now - CRASH.debris[0].t > 90) CRASH.debris = CRASH.debris.filter((p) => now - p.t < 90);
  for (const v of traffic.parked) if (v.cr && (v.cr.vx || v.cr.vy || v.cr.w)) crashStepVeh(v, dt);
  crCrews(dt);
}
function drawCrashLow(vx0, vy0, vx1, vy1) {
  // ground layer: scorch marks, glass and spilled cargo
  const inV = (x, y, m) => x * PPM > vx0 - m && x * PPM < vx1 + m && y * PPM > vy0 - m && y * PPM < vy1 + m;
  for (const s of CRASH.scorch) {
    if (!inV(s.x, s.y, s.r * PPM)) continue;
    const g = ctx.createRadialGradient(s.x * PPM, s.y * PPM, 0, s.x * PPM, s.y * PPM, s.r * PPM);
    g.addColorStop(0, "rgba(12,10,8,0.75)");
    g.addColorStop(0.6, "rgba(20,16,12,0.45)");
    g.addColorStop(1, "rgba(20,16,12,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(s.x * PPM, s.y * PPM, s.r * PPM, s.r * PPM * 0.8, s.h, 0, 7);
    ctx.fill();
  }
  const now = timeS;
  for (const p of CRASH.debris) {
    if (!inV(p.x, p.y, 10)) continue;
    const a = Math.min(1, (90 - (now - p.t)) / 20);
    ctx.globalAlpha = Math.max(0, a) * (p.box ? 0.95 : 0.8);
    ctx.fillStyle = "rgb(" + p.c + ")";
    const z = p.s * PPM;
    ctx.save();
    ctx.translate(p.x * PPM, p.y * PPM);
    ctx.rotate(p.h);
    ctx.fillRect(-z / 2, -z / 2, z, z * (p.box ? 0.8 : 0.6));
    if (p.box) {
      ctx.strokeStyle = "rgba(40,30,20,0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-z / 2, -z / 2, z, z * 0.8);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// damaged body: squashed at the crushed end and darkened (called by drawTraffic instead of blitV)
function crDrawBody(a, x, y, h, L, W, v) {
  const d = Math.min(1.6, v.dmg || 0),
    k = Math.min(1, d),
    sq = 1 - 0.2 * k,
    e = v.crEnd || 1,
    aw = (a.width * PPM) / VS,
    ah = (a.height * PPM) / VS;
  ctx.save();
  ctx.translate(x * PPM, y * PPM);
  ctx.rotate(h);
  ctx.translate(0, ((e * (1 - sq) * ah) / 2) * 1); // crushed end pulls in towards the middle (local -y = forward)
  ctx.scale(1 - 0.04 * k, sq);
  ctx.drawImage(a, -aw / 2, -ah / 2, aw, ah);
  // dents / soot over the body
  const lw = L * PPM,
    ww = W * PPM;
  ctx.fillStyle = "rgba(15,12,10," + (v.wreck ? (v.burnT && timeS > v.wreckT + 3 ? 0.62 : 0.45) : 0.12 + 0.25 * k) + ")";
  ctx.fillRect(-ww / 2, -lw / 2, ww, lw);
  // crumple zone at the impact end: jagged dark folds + broken glass glint
  const yE = -e * (lw / 2); // forward = -y
  ctx.strokeStyle = "rgba(30,28,26,0.85)";
  ctx.lineWidth = Math.max(1, PPM * 0.12);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const yy = yE + e * (i + 1) * lw * 0.07;
    ctx.moveTo(-ww / 2, yy);
    for (let j = 1; j <= 4; j++) ctx.lineTo(-ww / 2 + (ww * j) / 4, yy + ((j % 2 ? 1 : -1) * lw * 0.025 * (1 + ((v.id + i) % 3))) );
  }
  ctx.stroke();
  if (k > 0.25) {
    ctx.fillStyle = "rgba(210,235,245,0.55)";
    for (let i = 0; i < 6; i++) {
      const rx = (((v.id * 37 + i * 53) % 100) / 100 - 0.5) * ww * 0.8,
        ry = yE + e * (((v.id * 11 + i * 29) % 100) / 100) * lw * 0.3;
      ctx.fillRect(rx, ry, PPM * 0.18, PPM * 0.12);
    }
  }
  ctx.restore();
}
function drawCrashHigh(vx0, vy0, vx1, vy1) {
  // explosions: fireball flash + expanding shockwave ring
  for (const b of CRASH.booms) {
    const x = b.x * PPM,
      y = b.y * PPM;
    const fl = Math.max(0, 1 - b.t / 0.6),
      R = (6 + b.t * 40) * PPM;
    if (fl > 0) {
      const g = ctx.createRadialGradient(x, y, 2, x, y, 14 * PPM * (0.6 + b.t));
      g.addColorStop(0, "rgba(255,250,215," + fl + ")");
      g.addColorStop(0.35, "rgba(255,160,40," + fl * 0.85 + ")");
      g.addColorStop(1, "rgba(255,70,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 14 * PPM * (0.6 + b.t), 0, 7);
      ctx.fill();
    }
    const ra = Math.max(0, 0.55 - b.t * 0.5);
    if (ra > 0) {
      ctx.strokeStyle = "rgba(255,235,200," + ra + ")";
      ctx.lineWidth = Math.max(2, PPM * 0.6 * (1 - b.t / 1.2));
      ctx.beginPath();
      ctx.arc(x, y, R, 0, 7);
      ctx.stroke();
    }
  }
  // clearance crews
  const blink = timeS % 0.5 < 0.25;
  for (const C of CRASH.crews) {
    const P = crCrewArt("pol");
    blitV(P.sh, C.pol.x, C.pol.y, C.pol.h, 4.8, 1.85, 4, 4);
    blitV(P.c, C.pol.x, C.pol.y, C.pol.h, 4.8, 1.85, 0, 0);
    const f = fwd(C.pol.h),
      r = rgt(C.pol.h);
    for (const sd of [-1, 1]) {
      ctx.fillStyle = (sd < 0) === blink ? "rgba(40,110,255,0.95)" : "rgba(40,110,255,0.25)";
      ctx.beginPath();
      ctx.arc((C.pol.x + r[0] * sd * 0.5) * PPM, (C.pol.y + r[1] * sd * 0.5) * PPM, PPM * 0.35, 0, 7);
      ctx.fill();
    }
    // battenburg stripe
    ctx.save();
    ctx.translate(C.pol.x * PPM, C.pol.y * PPM);
    ctx.rotate(C.pol.h);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "rgba(30,90,220,0.9)" : "rgba(250,220,0,0.9)";
      ctx.fillRect(-0.95 * PPM, (-1.6 + i * 0.55) * PPM, 0.2 * PPM, 0.55 * PPM);
      ctx.fillRect(0.75 * PPM, (-1.6 + i * 0.55) * PPM, 0.2 * PPM, 0.55 * PPM);
    }
    ctx.restore();
    if (C.ph >= 1) {
      const T = crCrewArt("tow");
      blitV(T.sh, C.tow.x, C.tow.y, C.h, 8, 2.45, 4, 4);
      blitV(T.c, C.tow.x, C.tow.y, C.h, 8, 2.45, 0, 0);
      ctx.fillStyle = blink ? "rgba(255,170,0,0.95)" : "rgba(255,170,0,0.3)";
      const g = fwd(C.h);
      ctx.beginPath();
      ctx.arc((C.tow.x + g[0] * 2.5) * PPM, (C.tow.y + g[1] * 2.5) * PPM, PPM * 0.4, 0, 7);
      ctx.fill();
    }
  }
  // the player's rolled trailer: lying on its side (underside + axles showing)
  const s = truck;
  if (s.rolled && s.trl) {
    const k = kingpin(s),
      ft = fwd(s.th),
      rt = rgt(s.th),
      sd = s.rolled.side,
      cx = k[0] - ft[0] * 6.8 + rt[0] * sd * 1.6,
      cy = k[1] - ft[1] * 6.8 + rt[1] * sd * 1.6;
    ctx.save();
    ctx.translate(cx * PPM, cy * PPM);
    ctx.rotate(s.th);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-1.9 * PPM + 6, -6.8 * PPM + 6, 3.8 * PPM, 13.6 * PPM);
    ctx.fillStyle = "#3a3d42";
    ctx.fillRect(-1.3 * PPM, -6.8 * PPM, 2.6 * PPM, 13.6 * PPM);
    ctx.fillStyle = "#16171a";
    for (const ay of [3.2, 4.5, 5.8]) ctx.fillRect(-1.3 * PPM, ay * PPM, 2.6 * PPM, 0.55 * PPM);
    ctx.fillStyle = "#555a60";
    ctx.fillRect(-0.2 * PPM, -6.6 * PPM, 0.4 * PPM, 13.2 * PPM);
    ctx.restore();
  }
}
