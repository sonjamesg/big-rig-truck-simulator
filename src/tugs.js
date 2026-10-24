// v60 harbour tugs: two tugs live at each port's tug berth. When a ship is ready to sail from berth B they sail out to it,
// make fast at the bow (and stern), pull it off the quay, turn it slowly in the basin, escort it to the harbour mouth,
// let go and return to their berth. Local port frame (u = off the quay into the water, v = along the quay), tiles.
const TUG = { L: 3.3, W: 1.35, V: 2.6 };
function tugWater(P, u, v) {
  const w = PL(P, u, v),
    x = Math.floor(w[0]),
    y = Math.floor(w[1]);
  if (!inb(x, y)) return true;
  const t = get(x, y);
  return t === T.WATER || t === T.BRIDGE;
}
function tugFits(P, u, v, r) {
  for (let a = -r; a <= r; a += 0.5) for (let b = -r; b <= r; b += 0.5) if (!tugWater(P, u + a, v + b)) return false;
  return true;
}
function tugInit(P) {
  const hs = P.hs,
    vB = P.ph[5].a[1];
  P.tugs = [];
  const H = Math.atan2(-hs, 0); // moored bow away from the berths
  outer: for (let d = 22; d < 60; d += 1)
    for (let u = 4.5; u < 9; u += 0.5) {
      const v = vB - hs * d,
        v2 = v - hs * 4.6;
      if (tugFits(P, u, v, 2.4) && tugFits(P, u, v2, 2.4) && tugFits(P, 11, v, 1.2) && tugFits(P, 11, v2, 1.2)) {
        P.tugBerth = [
          [u, v, H],
          [u, v2, H],
        ];
        break outer;
      }
    }
  if (!P.tugBerth)
    P.tugBerth = [
      [6, vB - hs * 24, H],
      [6, vB - hs * 28.6, H],
    ];
  P.tugLane = 11; // tugs run along the basin clear of the berthed ships
  P.tugBerth.forEach((b, i) =>
    P.tugs.push({ i, u: b[0], v: b[1], h: b[2], st: "idle", ship: null, wp: [], spd: 0, line: 0 }),
  );
}
// where a tug should be on the ship it is towing (ship frame: x forward, y beside), blended from "pull off the quay" to "lead out"
function tugSlot(P, o, i) {
  const p = o.pose,
    ws = -P.hs, // ship-frame side that faces open water while berthed
    tl = o.tl,
    b = Math.max(0, Math.min(1, (tl - P.tOut - 4) / 46)),
    e = b * b * (3 - 2 * b),
    L2 = SHIP.L / 2,
    W2 = SHIP.W / 2;
  let x, y, ax, ay;
  if (i === 0) {
    x = (L2 - 2.5) * (1 - e) + (L2 + 6.5) * e;
    y = ws * (W2 + 5.2) * (1 - e);
    ax = L2 - 2.5 + 2.5 * e;
    ay = ws * W2 * (1 - e);
  } else {
    x = (-L2 + 3) * (1 - e) + (-L2 - 5.5) * e;
    y = ws * (W2 + 5.2) * (1 - e);
    ax = -L2 + 3 - 3 * e;
    ay = ws * W2 * (1 - e);
  }
  const c = Math.cos(p.h),
    s = Math.sin(p.h);
  return {
    u: p.u + c * x - s * y,
    v: p.v + s * x + c * y,
    au: p.u + c * ax - s * ay, // towline attach point on the ship
    av: p.v + s * ax + c * ay,
  };
}
function tugReady(P, o) {
  if (!P.tugs) return true;
  const mine = P.tugs.filter((t) => t.ship === o.k);
  return mine.length > 0 && mine.every((t) => t.st === "tow");
}
function tugSteer(t, tu, tv, dt, vmax) {
  const du = tu - t.u,
    dv = tv - t.v,
    d = Math.hypot(du, dv);
  if (d < 0.05) return d;
  const want = Math.atan2(dv, du);
  let dh = want - t.h;
  while (dh > Math.PI) dh -= 2 * Math.PI;
  while (dh < -Math.PI) dh += 2 * Math.PI;
  t.h += Math.max(-1.1 * dt, Math.min(1.1 * dt, dh));
  const tgt = Math.min(vmax, d * 0.9) * Math.max(0.15, Math.cos(dh));
  t.spd += Math.max(-1.5 * dt, Math.min(0.9 * dt, tgt - t.spd));
  const m = Math.min(d, t.spd * dt);
  t.u += Math.cos(t.h) * m;
  t.v += Math.sin(t.h) * m;
  return d;
}
function tugBlocked(P, t, ships) {
  // yield: don't sail into a ship's path (look 3 tiles ahead)
  const nu = t.u + Math.cos(t.h) * 3,
    nv = t.v + Math.sin(t.h) * 3;
  for (const o of ships) {
    if (o.k === t.ship && t.st === "tow") continue;
    const A = shipOBB(o.pose, 1.5, 1.5);
    if (obbHit(A, { u: nu, v: nv, c: Math.cos(t.h), s: Math.sin(t.h), a: TUG.L / 2, b: TUG.W / 2 })) return true;
  }
  return false;
}
function updateTugs(P, dt, ships) {
  if (!P.ph || !P.shG) return;
  if (!P.tugs) tugInit(P);
  const lane = P.tugLane,
    byK = new Map(ships.map((o) => [o.k, o]));
  P.tugJobs = P.tugJobs || 0;
  // call the tugs for the ship about to sail from berth B
  for (const o of ships) {
    if (o.anch || !o.s || o.s.tugs) continue;
    const near = (o.pose.k === "dockB" && P.gOut - o.tl < 75) || o.gate === P.gOut;
    if (!near) continue;
    const free = P.tugs.filter((t) => t.st === "idle");
    if (free.length < P.tugs.length) continue; // both tugs work each departure
    o.s.tugs = 1;
    P.tugJobs++;
    for (const t of free) {
      const sl = tugSlot(P, o, t.i);
      t.ship = o.k;
      t.st = "out";
      t.wp = [
        [lane, t.v],
        [lane, sl.v],
      ];
    }
  }
  for (const t of P.tugs) {
    const o = t.ship != null ? byK.get(t.ship) : null;
    if ((t.st === "out" || t.st === "tow" || t.st === "clear") && !o) {
      t.st = "home";
      t.ship = null;
      t.wp = tugHomeWp(P, t);
    }
    if (t.st === "idle") {
      const b = P.tugBerth[t.i];
      tugSteer(t, b[0], b[1], dt, 0.6);
      t.spd = 0;
      let dh = b[2] - t.h;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      t.h += dh * Math.min(1, dt * 0.8);
      t.line = Math.max(0, t.line - dt);
    } else if (t.st === "out") {
      const sl = tugSlot(P, o, t.i);
      if (t.wp.length) {
        const w = t.wp[0];
        if (!tugBlocked(P, t, ships) && tugSteer(t, w[0], w[1], dt, TUG.V) < 0.8) t.wp.shift();
        else if (tugBlocked(P, t, ships)) t.spd = 0;
      } else if (tugSteer(t, sl.u, sl.v, dt, 1.4) < 0.5) {
        t.st = "tow";
        t.att = (t.att || 0) + 1;
      }
    } else if (t.st === "tow") {
      const sl = tugSlot(P, o, t.i),
        k = 1 - Math.exp(-dt * 2.5),
        pu = t.u,
        pv = t.v;
      t.u += (sl.u - t.u) * k;
      t.v += (sl.v - t.v) * k;
      // bow points away from the ship along the towline
      const hh = Math.atan2(t.v - sl.av, t.u - sl.au);
      let dh = hh - t.h;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      t.h += dh * Math.min(1, dt * 1.5);
      t.spd = Math.hypot(t.u - pu, t.v - pv) / Math.max(dt, 1e-3);
      t.au = sl.au;
      t.av = sl.av;
      t.line = 1;
      if (o.tl >= P.tRel) {
        // let go, sheer off to the side of the channel and wait for the ship to pass before heading home
        t.st = "clear";
        t.rel = (t.rel || 0) + 1;
        const c = Math.cos(o.pose.h),
          sn = Math.sin(o.pose.h);
        let best = null;
        for (const sd of [1, -1])
          for (const d of [9, 11, 7]) {
            const pu = t.u - sn * sd * d + c * (t.i ? -4 : 2),
              pv = t.v + c * sd * d + sn * (t.i ? -4 : 2);
            if (!best && tugFits(P, pu, pv, 2)) best = [pu, pv];
          }
        t.wp = [best || [t.u - sn * 9, t.v + c * 9]];
      }
    } else if (t.st === "clear") {
      t.line = Math.max(0, t.line - dt * 0.5);
      if (t.wp.length) {
        if (tugSteer(t, t.wp[0][0], t.wp[0][1], dt, 1.6) < 0.6) t.wp.shift();
      } else {
        t.spd = 0;
        const gone = !o || Math.hypot(o.pose.u - t.u, o.pose.v - t.v) > SHIP.L * 0.5 + 12;
        if (gone) {
          t.st = "home";
          t.ship = null;
          t.wp = tugHomeWp(P, t);
        }
      }
    } else if (t.st === "home") {
      t.line = Math.max(0, t.line - dt * 0.5);
      if (!t.wp.length) {
        const b = P.tugBerth[t.i];
        if (tugSteer(t, b[0], b[1], dt, 1.0) < 0.25) {
          t.st = "idle";
          t.home = (t.home || 0) + 1;
        }
      } else {
        const w = t.wp[0];
        if (tugBlocked(P, t, ships)) t.spd = Math.max(0, t.spd - 2 * dt);
        else if (tugSteer(t, w[0], w[1], dt, TUG.V) < 1.2) t.wp.shift();
      }
    }
  }
}
// back to the berth along the ship's own departure track (known clear water), then along the tug lane
function tugHomeWp(P, t) {
  const q = P.ph[6],
    wp = [];
  let best = 0,
    bd = 1e9;
  for (let s = 0; s <= q.len; s += 2) {
    const p = polyAt(q, s),
      d = Math.hypot(p[0] - t.u, p[1] - t.v);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  for (let s = best - 4; s > 0; s -= 4) wp.push(polyAt(q, s));
  const so = P.ph[5];
  wp.push([so.b[0], so.b[1]]);
  const b = P.tugBerth[t.i];
  wp.push([P.tugLane, so.b[1]]);
  wp.push([P.tugLane, b[1]]);
  return wp;
}
function tugVis(P, t, vx0, vy0, vx1, vy1) {
  const w = PL(P, t.u, t.v),
    x = w[0] * TILE,
    y = w[1] * TILE,
    m = 12 * TILE;
  return x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
}
function tugHull(L, W) {
  ctx.beginPath();
  ctx.moveTo(L * 0.5, 0);
  ctx.bezierCurveTo(L * 0.5, -W * 0.3, L * 0.32, -W * 0.5, L * 0.12, -W * 0.5);
  ctx.lineTo(-L * 0.38, -W * 0.5);
  ctx.quadraticCurveTo(-L * 0.5, -W * 0.5, -L * 0.5, -W * 0.3);
  ctx.lineTo(-L * 0.5, W * 0.3);
  ctx.quadraticCurveTo(-L * 0.5, W * 0.5, -L * 0.38, W * 0.5);
  ctx.lineTo(L * 0.12, W * 0.5);
  ctx.bezierCurveTo(L * 0.32, W * 0.5, L * 0.5, W * 0.3, L * 0.5, 0);
  ctx.closePath();
}
// called inside portFrame (local port frame)
function drawTugs(P, vx0, vy0, vx1, vy1) {
  if (!P.tugs) return;
  const T_ = TILE,
    L = TUG.L * T_,
    W = TUG.W * T_;
  for (const t of P.tugs) {
    if (!tugVis(P, t, vx0, vy0, vx1, vy1)) continue;
    // towline (drawn first, under the tug)
    if (t.line > 0 && t.au != null) {
      const sx = t.u - Math.cos(t.h) * TUG.L * 0.36,
        sy = t.v - Math.sin(t.h) * TUG.L * 0.36;
      ctx.strokeStyle = "rgba(214,196,150," + 0.95 * Math.min(1, t.line) + ")";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx * T_, sy * T_);
      if (t.st === "tow") ctx.lineTo(t.au * T_, t.av * T_);
      else ctx.lineTo((sx - Math.cos(t.h) * 1.5 * t.line) * T_, (sy - Math.sin(t.h) * 1.5 * t.line) * T_);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(t.u * T_, t.v * T_);
    ctx.rotate(t.h);
    // wake + prop wash
    const sp = Math.min(1, Math.abs(t.spd) / 2);
    if (sp > 0.08) {
      ctx.fillStyle = "rgba(255,255,255," + 0.32 * sp + ")";
      ctx.beginPath();
      ctx.moveTo(-L * 0.45, -W * 0.35);
      ctx.lineTo(-L * 0.45 - 2.6 * T_ * sp, -W * 0.85);
      ctx.lineTo(-L * 0.45 - 2.6 * T_ * sp, W * 0.85);
      ctx.lineTo(-L * 0.45, W * 0.35);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255," + 0.22 * sp + ")";
      ctx.beginPath();
      ctx.moveTo(L * 0.48, 0);
      ctx.lineTo(L * 0.2, -W * 0.75);
      ctx.lineTo(L * 0.2, W * 0.75);
      ctx.fill();
    }
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.save();
    ctx.translate(3, 4);
    tugHull(L, W);
    ctx.fill();
    ctx.restore();
    // black rubber fendering all round (thick), then the red hull/bulwark
    tugHull(L + 5, W + 5);
    ctx.fillStyle = "#1b1b1b";
    ctx.fill();
    tugHull(L, W);
    ctx.fillStyle = "#9b1c1c";
    ctx.fill();
    // tyre fenders hung along the sides
    ctx.fillStyle = "#111";
    for (let x = -L * 0.32; x <= L * 0.2; x += L * 0.13)
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x, sd * (W / 2 + 2.6), 2.4, 1.6, 0, 0, 7);
        ctx.fill();
      }
    // stern fender block
    ctx.fillRect(-L / 2 - 3.5, -W * 0.32, 3, W * 0.64);
    // deck (dark grey steel), bulwark edge
    tugHull(L - 9, W - 9);
    ctx.fillStyle = "#555b62";
    ctx.fill();
    ctx.strokeStyle = "#c9302c";
    ctx.lineWidth = 1;
    ctx.stroke();
    // aft deck: towing winch + hook
    ctx.fillStyle = "#2b2e33";
    ctx.fillRect(-L * 0.3, -W * 0.17, L * 0.12, W * 0.34);
    ctx.fillStyle = "#e0b100";
    ctx.beginPath();
    ctx.arc(-L * 0.34, 0, 1.6, 0, 7);
    ctx.fill();
    // white superstructure, pushed forward, with the raised wheelhouse on top
    ctx.fillStyle = "#e9ecef";
    ctx.fillRect(-L * 0.12, -W * 0.3, L * 0.42, W * 0.6);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-L * 0.12 + 2, -W * 0.3 + 2, L * 0.42, W * 0.6); // wheelhouse shadow on the deckhouse
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(-L * 0.02, -W * 0.25, L * 0.26, W * 0.5);
    // all-round wheelhouse windows (dark glass)
    ctx.fillStyle = "#26323d";
    ctx.fillRect(L * 0.2, -W * 0.21, L * 0.035, W * 0.42);
    for (const sd of [-1, 1]) ctx.fillRect(0, sd * W * 0.25 - (sd > 0 ? 1.4 : 0), L * 0.2, 1.4);
    ctx.fillRect(-L * 0.02, -W * 0.18, 1.4, W * 0.36);
    // funnel pair + mast
    ctx.fillStyle = "#1c1c1c";
    for (const sd of [-1, 1]) ctx.fillRect(-L * 0.11, sd * W * 0.17 - 2, 3.4, 4);
    ctx.fillStyle = "#c9302c";
    for (const sd of [-1, 1]) ctx.fillRect(-L * 0.11, sd * W * 0.17 - 2, 3.4, 1.2);
    ctx.fillStyle = "#d4d4d4";
    ctx.fillRect(L * 0.06, -0.8, 5, 1.6);
    ctx.restore();
  }
}
// night dressing (drawn above the darkness): nav lights, deck floods, warm wheelhouse glow
function tugNight(P, K, vx0, vy0, vx1, vy1) {
  if (!P.tugs) return;
  const T_ = TILE,
    L = TUG.L * T_,
    W = TUG.W * T_,
    G_ = portGlow(),
    det = Math.sign(P.U[0] * P.V[1] - P.U[1] * P.V[0]) || 1;
  ctx.save();
  portFrame(P);
  for (const t of P.tugs) {
    if (!tugVis(P, t, vx0, vy0, vx1, vy1)) continue;
    ctx.save();
    ctx.translate(t.u * T_, t.v * T_);
    ctx.rotate(t.h);
    const glow = (x, y, r, a, col) => {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a * K;
      if (col) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col + "0.8)");
        g.addColorStop(1, col + "0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      } else ctx.drawImage(G_, x - r, y - r, 2 * r, 2 * r);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };
    // hull re-lit faintly so it reads on dark water
    ctx.globalAlpha = 0.5 * K;
    tugHull(L, W);
    ctx.fillStyle = "#9b1c1c";
    ctx.fill();
    ctx.fillStyle = "#e9ecef";
    ctx.fillRect(-L * 0.12, -W * 0.3, L * 0.42, W * 0.6);
    ctx.globalAlpha = 1;
    // deck floodlights over the aft working deck (warm, soft)
    glow(-L * 0.3, 0, 34, 0.45, "rgba(255,226,170,");
    // wheelhouse windows lit
    ctx.globalAlpha = 0.85 * K;
    ctx.fillStyle = "#ffd98a";
    ctx.fillRect(L * 0.2, -W * 0.21, L * 0.035, W * 0.42);
    for (const sd of [-1, 1]) ctx.fillRect(0, sd * W * 0.25 - (sd > 0 ? 1.4 : 0), L * 0.2, 1.4);
    ctx.globalAlpha = 1;
    const lamp = (x, y, col, rc, r) => {
      glow(x, y, r, 0.8, rc);
      ctx.globalAlpha = K;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 1.9, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    lamp(L * 0.08, 0, "#ffffff", "rgba(255,255,245,", 14); // masthead
    lamp(-L * 0.5, 0, "#ffffff", "rgba(255,255,245,", 10); // stern
    if (t.st === "tow") lamp(-L * 0.46, W * 0.12, "#ffd23f", "rgba(255,210,70,", 9); // towing light (yellow, over the stern)
    lamp(L * 0.12, -det * W * 0.32, "#ff3b30", "rgba(255,50,40,", 11); // port: red
    lamp(L * 0.12, det * W * 0.32, "#34e070", "rgba(40,230,100,", 11); // starboard: green
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
