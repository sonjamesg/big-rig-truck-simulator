/**
 * @file physics.js — LORRY PHYSICS
 * Exposes (globals): GEARS, MASS, ENG_BASE, torqueAt, truck, fwd, kingpin, solidAtM, bodyHits, hitTest,
 *   surfaceAt, stepTruck, HIT_PT, CRASH_E, CRASH_MU, crashNormal, crashResponse
 * Depends on: world.js, ltg.js (ltgGrip: wet skid pan), lorry.js, traffic.js, depots.js, fx.js, port.js, rail.js, weather.js,
 *   wanted.js, airport.js
 * Load order: #6 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== LORRY PHYSICS =====================
const GEARS = [4.2, 3.1, 2.3, 1.75, 1.35, 1.08, 0.88, 0.72],
  FINAL = 4.0,
  WHEEL_R = 0.5,
  REV_RATIO = 4.5;
// v49: base engine output +10% (James: a bit quicker with heavy trailers); customiser engine tunes multiply on top (truck.power)
const ENG_BASE = 1.1;
const MASS = 22000,
  IDLE = 650,
  REDLINE = 2300,
  VMAX = 25.0; // 56 mph governor (UK HGV)
function torqueAt(rpm) {
  if (rpm < 600) return 1300;
  if (rpm < 1100) return 1300 + (rpm - 600) * 2.2;
  if (rpm < 1500) return 2400;
  if (rpm < 2100) return 2400 - (rpm - 1500) * 1.3;
  return Math.max(0, 1620 - (rpm - 2100) * 8);
}
const truck = {
  x: 0,
  y: 0,
  h: 0, // rear axle position (metres), heading (rad, 0 = north, clockwise)
  v: 0,
  steer: 0,
  th: 0, // speed m/s (signed), steering angle rad, trailer heading
  gear: 1,
  mode: "D",
  rpm: IDLE,
  shiftT: 0,
  brakeHold: 0,
  throttle: 0,
  brake: 0,
  offroad: false,
  bump: 0,
  lastHit: 0,
  braking: 0,
  trl: null,
};
const fwd = (a) => [Math.sin(a), -Math.cos(a)],
  rgt = (a) => [Math.cos(a), Math.sin(a)];
function kingpin(s) {
  const f = fwd(s.h);
  return [s.x + f[0] * 0.3, s.y + f[1] * 0.3];
}
function solidAtM(mx, my) {
  return (
    isSolidTile(Math.floor((mx * PPM) / TILE), Math.floor((my * PPM) / TILE)) ||
    (typeof apSolidM === "function" && apSolidM(mx, my)) ||
    (typeof portFenceSolid === "function" && portFenceSolid(mx, my)) ||
    mbSolidM(mx, my) ||
    bmSolidM(mx, my)
  );
}
const HIT_PT = [0, 0];
function bodyHits(cx, cy, a, yf, yr, w) {
  // local y forward-negative range [yf,yr], width w; returns true on hit
  const f = fwd(a),
    r = rgt(a);
  const n = Math.ceil((yr - yf) / 1.2);
  for (let i = 0; i <= n; i++) {
    const ly = yf + ((yr - yf) * i) / n;
    for (const lx of [-w / 2, 0, w / 2]) {
      if (lx === 0 && i > 0 && i < n) continue;
      const px = cx - f[0] * ly + r[0] * lx,
        py = cy - f[1] * ly + r[1] * lx;
      if (solidAtM(px, py)) {
        HIT_PT[0] = px; // v51: contact point for the collision normal (stepTruck)
        HIT_PT[1] = py;
        return true;
      }
    }
  }
  return false;
}
function hitTest(s) {
  if (bodyHits(s.x, s.y, s.h, CAB.front + 0.1, CAB.rear - 0.2, CAB.w - 0.2)) return "cab";
  const k = kingpin(s);
  if (s.trl && bodyHits(k[0], k[1], s.th, TRL.front + 0.6, TRL.rear - 0.1, TRL.w - 0.2))
    return "trailer";
  return typeof trailerHitTest === "function" ? trailerHitTest(s) : null;
}
// v51: mostly inelastic impacts. Velocity along the contact normal is removed with very low restitution, the tangential
// part slides on with Coulomb friction (glancing hits scrape along the wall), a short crunch kills drive, and damage
// follows the normal impact speed. hit: "cab" | "trailer" (static solids, contact point in HIT_PT), "veh" (heavy
// vehicle, normal in s.hitN), "barrier".
const CRASH_E = { cab: 0.06, trailer: 0.06, barrier: 0.08, veh: 0.1 },
  CRASH_MU = 0.55;
function crashNormal(s, prev, hit) {
  if (hit === "veh" && s.hitN) return s.hitN;
  if (hit === "cab" || hit === "trailer") {
    // solidity gradient around the contact point: normal points out of the obstacle
    let nx = 0,
      ny = 0;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2,
        dx = Math.cos(a),
        dy = Math.sin(a);
      if (solidAtM(HIT_PT[0] + dx * 0.9, HIT_PT[1] + dy * 0.9)) {
        nx -= dx;
        ny -= dy;
      }
    }
    const L = Math.hypot(nx, ny);
    if (L > 0.3) return [nx / L, ny / L];
  }
  const f = fwd(prev.h),
    d = Math.sign(s.v) || 1;
  return [-f[0] * d, -f[1] * d]; // unknown: straight against the motion
}
function crashResponse(s, prev, hit, dt) {
  const f0 = fwd(prev.h),
    ux = f0[0] * s.v,
    uy = f0[1] * s.v,
    n = crashNormal(s, prev, hit),
    vn = ux * n[0] + uy * n[1]; // < 0: moving into the obstacle
  if (typeof wantProp === "function" && s === truck) wantProp(Math.abs(s.v));
  Object.assign(s, prev); // back to the last free pose (cab + trailer angle together: no jack-knife snap)
  s.throttle = 0;
  if (vn >= -0.05) {
    // pose-only contact (steering / articulation into a wall): just stop pushing
    s.v *= 0.5;
    if (Math.abs(s.v) < 0.3) s.v = 0;
    s.steer *= 0.5;
    return;
  }
  const e = CRASH_E[hit] || 0.06,
    tx = ux - vn * n[0],
    ty = uy - vn * n[1],
    tl = Math.hypot(tx, ty),
    keep = tl > 1e-6 ? Math.max(0, tl - CRASH_MU * -vn) / tl : 0, // Coulomb friction on the slide
    rb = Math.min(0.8, -e * vn), // rebound speed: a small settle back, never a bounce
    rx = tx * keep + rb * n[0],
    ry = ty * keep + rb * n[1];
  let v = rx * f0[0] + ry * f0[1];
  if (Math.abs(v) < 0.5) v = 0;
  s.v = v;
  // glancing hit: scrape along, the cab turns a little toward the wall's tangent and slides one step
  if (keep > 0 && tl * keep > 1) {
    const tg = Math.atan2(tx, -ty),
      dh = Math.atan2(Math.sin(tg - prev.h), Math.cos(tg - prev.h));
    if (Math.abs(dh) < 0.7 && s.v > 0) s.h += Math.max(-0.05, Math.min(0.05, dh * 0.3));
    const px = s.x,
      py = s.y,
      ph = s.h;
    s.x += tx * keep * dt;
    s.y += ty * keep * dt;
    if (hitTest(s)) Object.assign(s, { x: px, y: py, h: ph });
  }
  const imp = -vn;
  s.crunchT = Math.min(0.45, 0.06 + imp * 0.025);
  if (imp > 1.2) {
    s.bump = Math.min(1, imp / 10);
    s.hitV = imp; // main.js: damage scales with the normal impact speed
    s.lastHit = hit;
  }
  if (hitTest(s)) s.steer *= 0.5; // still touching after the revert (steering into the wall): straighten
}
function surfaceAt(s) {
  const f = fwd(s.h);
  const t = get(
    Math.floor(((s.x - f[0] * 2) * PPM) / TILE),
    Math.floor(((s.y - f[1] * 2) * PPM) / TILE),
  );
  return t;
}
function stepTruck(s, inp, dt) {
  if (typeof FX !== "undefined" && FX.boom) {
    s.v = 0;
    s.throttle = 0;
    s.brake = 1;
    s.skid = false;
    return;
  }
  // ----- driver input -> throttle / brake / reverse selection
  const solo = !s.trl,
    M = solo ? 7600 : 7600 + s.trl.weight;
  s.mass = M;
  // keyboard (digital) and gamepad triggers (analog) work together: take the stronger of the two
  const aUp = Math.max(inp.up ? 1 : 0, inp.padThr || 0),
    aDn = Math.max(inp.down ? 1 : 0, inp.padBrk || 0);
  const up = aUp > 0.05,
    down = aDn > 0.05;
  let thr = 0,
    brk = 0;
  s.kbBrk = inp.down ? Math.min(1, (s.kbBrk || 0) + dt * 1.3) : 0;
  if (s.mode === "D") {
    thr = aUp;
    brk = Math.max(inp.padBrk || 0, inp.down ? 0.3 + 0.7 * s.kbBrk : 0);
    if (down && Math.abs(s.v) < 0.3) {
      s.brakeHold += dt;
      if (s.brakeHold > 0.45) {
        s.mode = "R";
        s.brakeHold = 0;
      }
    } else if (!down) s.brakeHold = 0;
  } else {
    thr = aDn;
    brk = aUp;
    if (up && Math.abs(s.v) < 0.3) {
      s.mode = "D";
      s.gear = 1;
    }
  }
  if (s.fuel !== undefined && s.fuel <= 0) thr = 0;
  if (inp.hand) brk = Math.max(brk, 1.4);
  s.throttle += (thr - s.throttle) * Math.min(1, dt * 3);
  s.brake = brk;
  const panG = ltgGrip(s); // v54: wet skid pan at the LGV training ground (ltg.js)
  // v14 wheel lock: a hard stamp on the brakes at speed locks the wheels -> long skid, little steering, trailer sway
  if (
    s.mode === "D" &&
    brk >
      Math.min(
        0.99,
        ((typeof WX !== "undefined" && WX.wet > 0.5) || panG < 1 ? 0.8 : 0.92) +
          ((s.grip || 1) - 1) * 0.4,
      ) &&
    Math.abs(s.v) > 15
  )
    s.lockT = (s.lockT || 0) + dt;
  else s.lockT = 0;
  s.skid = (s.skid ? brk > 0.6 : s.lockT > 0.15) && Math.abs(s.v) > 3;
  // ----- surface
  const surf = surfaceAt(s);
  s.offroad = surf === T.GRASS || surf === T.PGRASS || surf === T.SAND;
  s.pave = surf === T.GRAVEL || surf === T.WALK || surf === T.PLAZA; // v38: footpaths/gravel paths are paved-ish, barely slower than road
  {
    const f = fwd(s.h),
      qx = ((s.x - f[0] * 2) * PPM) / TILE,
      qy = ((s.y - f[1] * 2) * PPM) / TILE,
      rb = rbAtTile(Math.floor(qx), Math.floor(qy));
    if (rb) {
      const rs = rbSurf(rb, qx, qy);
      s.offroad = rs !== 1 && !s.pave;
    }
  } // roundabout: exact flared outline
  // v51 crash 'crunch': a short moment of no drive after a solid impact (the rig stops dead instead of pushing on)
  if (s.rolled) s.throttle = 0;
  if (s.crunchT > 0) {
    s.crunchT -= dt;
    s.throttle *= 0.15;
  }
  // ----- gearbox & engine
  const dir = s.mode === "R" ? -1 : 1,
    av = Math.abs(s.v);
  const ratio = s.mode === "R" ? REV_RATIO : GEARS[s.gear - 1];
  const wheelRpm = (av / (2 * Math.PI * WHEEL_R)) * 60,
    coupled = wheelRpm * ratio * FINAL;
  let rpm = Math.max(IDLE + s.throttle * 700 * (coupled < IDLE + 200 ? 1 : 0), coupled); // clutch slip at pull-away
  if (s.shiftT > 0) {
    s.shiftT -= dt;
    rpm = s.rpm + (coupled - s.rpm) * Math.min(1, dt * 6);
  }
  if (s.mode === "D" && s.shiftT <= 0) {
    if (coupled > 1850 && s.gear < 8 && s.throttle > 0.3) {
      s.gear++;
      s.shiftT = 0.45 * (s.shiftM || 1);
    } else if (coupled < 1000 && s.gear > 1 && (s.throttle > 0.3 || coupled < 800)) {
      s.gear--;
      s.shiftT = 0.3 * (s.shiftM || 1);
    }
  }
  s.rpm += (Math.min(REDLINE, rpm) - s.rpm) * Math.min(1, dt * 8);
  let F = 0;
  if (s.shiftT <= 0) {
    let tq = torqueAt(s.rpm) * ENG_BASE * s.throttle * (s.power || 1) * (av < 14 ? s.accM || 1 : 1);
    if (s.govern && av > (s.vmax || VMAX) && dir > 0) tq = 0; // v40: no limiter unless s.govern (James: remove the 56 mph limiter) if(s.mode==='R' && av>3.5) tq=0;
    F += (dir * tq * ratio * FINAL * 0.9) / WHEEL_R;
    if (s.throttle < 0.05 && av > 1)
      F -= ((Math.sign(s.v) * (250 + 0.35 * s.rpm) * ratio * FINAL) / WHEEL_R) * 0.6 * (s.ebr || 1); // engine braking (cz: exhaust/jake brake)
  }
  const roll = (s.offroad ? 0.06 : s.pave ? 0.011 : 0.008) * M * 9.81,
    air = 0.5 * 1.2 * 6.5 * 0.7 * s.v * s.v;
  F -= Math.sign(s.v) * (roll + air);
  // brakes
  const bF =
    (s.skid ? (solo ? 0.42 : 0.36) * (s.grip || 1) : s.brake * (solo ? 0.6 : 0.5) * (s.brk || 1)) *
    M *
    9.81 *
    (typeof WX !== "undefined" ? WX.grip : 1) *
    panG;
  let a = F / M;
  let nv = s.v + a * dt;
  if (s.brake > 0) {
    const dv = (bF / M) * dt;
    if (Math.abs(nv) <= dv) nv = 0;
    else nv -= Math.sign(nv) * dv;
  }
  if (Math.abs(nv) < 0.05 && s.throttle < 0.05) nv = 0;
  if (
    Math.sign(nv) !== Math.sign(s.v) &&
    s.v !== 0 &&
    !(s.mode === "R" && nv < 0) &&
    !(s.mode === "D" && nv > 0)
  )
    nv = 0;
  if (s.offroad && Math.abs(nv) > 8) {
    const cap = 13.8;
    nv *= Math.abs(nv) > cap ? 0.995 : 0.9993;
  } // v38: off-road top speed ~31 mph (was ~25)
  if (s.jkLimit && Math.abs(nv) > 1.2) nv *= 1 - 0.6 * dt; // scrub at jackknife limit, never below walking pace
  s.v = nv;
  // ----- steering with inertia and self-centring
  const vabs = Math.abs(s.v),
    hg = (s.grip || 1) * (s.hand || 1) * panG,
    maxSteer = (solo ? 0.7 : 0.62) / (1 + (vabs * vabs) / ((solo ? 140 : 90) * hg));
  const SR = (solo ? 1.6 : 1) * (s.hand || 1);
  let target = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
  if (target === 0 && inp.padSteer) target = inp.padSteer;
  if (target !== 0) {
    const tgt = target * maxSteer;
    const rate =
      Math.sign(tgt - s.steer) !== Math.sign(s.steer) && s.steer !== 0 ? 2.2 * SR : 1.1 * SR;
    s.steer += Math.sign(tgt - s.steer) * Math.min(Math.abs(tgt - s.steer), rate * dt);
  } else {
    const rate = (1.0 + vabs * 0.12) * SR;
    s.steer -= Math.sign(s.steer) * Math.min(Math.abs(s.steer), rate * dt);
  }
  if (Math.abs(s.steer) > maxSteer) s.steer = Math.sign(s.steer) * maxSteer;
  // ----- kinematics (bicycle model) + trailer non-holonomic constraint
  const prev = { x: s.x, y: s.y, h: s.h, th: s.th };
  const om = ((s.v * Math.tan(s.steer)) / CAB.wheelbase) * (s.skid ? 0.22 * (s.grip || 1) : 1);
  const k0 = kingpin(s);
  s.h += om * dt;
  const f = fwd(s.h);
  s.x += f[0] * s.v * dt;
  s.y += f[1] * s.v * dt;
  const k1 = kingpin(s);
  if (solo) {
    s.th = s.h;
  } else {
    const ft = fwd(s.th);
    let ax = k0[0] - ft[0] * TRL.axle,
      ay = k0[1] - ft[1] * TRL.axle;
    const d = (k1[0] - k0[0]) * ft[0] + (k1[1] - k0[1]) * ft[1];
    ax += ft[0] * d;
    ay += ft[1] * d; // axle moves only along trailer heading
    s.th = Math.atan2(k1[0] - ax, -(k1[1] - ay));
    if (s.skid) {
      const sv = Math.min(1, Math.abs(s.v) / 20);
      s.th +=
        (Math.sin(timeS * 4.3) * 0.16 + Math.sin(timeS * 1.7) * 0.08) *
        sv *
        dt *
        Math.max(0.2, 1 - (s.jkM || 0));
    }
    if (s.jkM && s.v > 8) {
      const rl = Math.atan2(Math.sin(s.h - s.th), Math.cos(s.h - s.th));
      s.th += rl * Math.min(1, s.jkM * dt * 0.35);
    } // cz: air suspension keeps the trailer in line at speed
    // max articulation ~87 deg: at the limit the cab pushes the trailer round (angle held) instead of freezing.
    // (old code halved reverse speed every frame here, which stalled the rig on full-lock reversing)
    let rel = Math.atan2(Math.sin(s.h - s.th), Math.cos(s.h - s.th));
    const JK = 1.52;
    if (Math.abs(rel) > JK) {
      // Jackknife limit: cab and trailer lock together as one rigid body. Both the cab drive axle and the trailer axle
      // must roll along their own headings (no sideways slide), so the rig pivots about the point where the two axle
      // lines cross - the steer wheels just scrub. (Old code clamped th to the cab, which slid the trailer sideways and
      // made the whole rig crab backwards instead of turning.)
      const pr = Math.atan2(Math.sin(prev.h - prev.th), Math.cos(prev.h - prev.th)),
        lr = Math.sign(rel) * Math.min(JK, Math.abs(pr)); // keep the angle we had: no snap
      Object.assign(s, { x: prev.x, y: prev.y, h: prev.h });
      s.th = prev.h - lr;
      const cr = Math.cos(lr),
        sr = Math.sin(lr),
        AdotT = 0.3 * cr - TRL.axle,
        a = AdotT / -sr; // signed distance along cab right to pivot
      const w = s.v / a,
        ph = w * dt,
        rc = rgt(s.h),
        Px = s.x + rc[0] * a,
        Py = s.y + rc[1] * a,
        dx = s.x - Px,
        dy = s.y - Py,
        c = Math.cos(ph),
        sn = Math.sin(ph);
      s.x = Px + dx * c - dy * sn;
      s.y = Py + dx * sn + dy * c;
      s.h += ph;
      s.th += ph;
      s.jkLimit = true;
    } else s.jkLimit = false;
  }
  if (typeof crRig === "function") crRig(s, prev, dt); // v66: jackknife / rollover
  // ----- collisions
  const hit =
    hitTest(s) ||
    (typeof trafficHitTruck === "function" && trafficHitTruck(s) ? "veh" : null) ||
    (typeof railBarrierHit === "function" && railBarrierHit(s, prev) ? "barrier" : null);
  if (hit) crashResponse(s, prev, hit, dt);
  if (s.bump > 0) s.bump = Math.max(0, s.bump - dt * 2);
}
