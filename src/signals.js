/**
 * @file signals.js — SIGNAL PHASING (UK, drive on the left)
 * Exposes (globals): SIG_CLEAR, sigMovePaths, sigConflict, SIG_RA2, sigOpp, sigAllowedPair, SIG_PED, sigPedLeft,
 *   buildSig, sigOf, sigCur, sigState, sigFilter, sigArrow, lightState, sigOncoming (+1 more)
 * Depends on: world.js, physics.js, traffic.js, markings.js, indicators.js
 * Load order: #10 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v12 SIGNAL PHASING (UK, drive on the left) =====================
// Each movement (approach key + L/S/R) gets a conflict-free stage. Stages are built greedily from the actual
// vehicle paths: two movements may only share a stage if their swept paths never come within SIG_CLEAR metres.
// Cycle per stage: green → amber (3 s) → all-red (2 s, the last 1.5 s shows red+amber to the next stage).
const SIG_CLEAR = 2.6,
  SIG_AMBER = 3,
  SIG_ALLRED = 1,
  SIG_RA = 2;
function sigMovePaths(J, key, mv) {
  const [sid, ds] = key.split(":"),
    sg = world.segs[+sid],
    d = +ds,
    o = jOptions(J, sg, d),
    ap = J.appr && J.appr[key],
    nl = nLanes(sg),
    out = [];
  for (let l = 0; l < nl; l++) {
    if (ap && ap.lanes && !(ap.lanes[l] && ap.lanes[l].indexOf(mv) >= 0)) continue;
    const p = lanePt(sg, d, l, o.stop),
      pts = [];
    if (mv === "S") {
      const q = lanePt(sg, d, l, o.exitA);
      for (let k = 0; k <= 12; k++)
        pts.push([p[0] + ((q[0] - p[0]) * k) / 12, p[1] + ((q[1] - p[1]) * k) / 12]);
    } else {
      const ch = o.opts.find((c) => c[0] === mv);
      if (!ch) continue;
      const C2 = ch[1],
        cd = ch[2],
        l2 = mv === "L" ? 0 : Math.min(nLanes(C2) - 1, l),
        ex = cd > 0 ? o.ce : o.cs,
        q = lanePt(C2, cd, l2, ex),
        c = sg.dir === "h" ? [q[0], p[1]] : [p[0], q[1]];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16,
          u = 1 - t;
        pts.push([
          u * u * p[0] + 2 * u * t * c[0] + t * t * q[0],
          u * u * p[1] + 2 * u * t * c[1] + t * t * q[1],
        ]);
      }
    }
    out.push(pts);
  }
  return out;
}
function sigConflict(J, a, b) {
  if (a.key === b.key) return false;
  for (const P of a.paths)
    for (const Q of b.paths)
      for (const p of P)
        for (const q of Q)
          if (
            Math.abs(p[0] - q[0]) < SIG_CLEAR &&
            Math.abs(p[1] - q[1]) < SIG_CLEAR &&
            Math.hypot(p[0] - q[0], p[1] - q[1]) < SIG_CLEAR
          )
            return true;
  return false;
}
// UK staging (TSM ch.6 / TAL 1/06): one stage per road axis — both opposing approaches run ahead + left together and
// right-turners FILTER (full green, give way to oncoming, clear in the intergreen). Dedicated right-turn lanes get a
// protected stage where both opposing rights run together (offside-to-offside, still giving way to each other).
// T-junctions get an early cut-off: the approach opposing the main-road right turn stops first and the right turn
// gets an indicative green arrow. Left filter arrows run in any other stage they don't conflict with.
// Intergreen: amber 3 s → all-red 1 s → red+amber 2 s.
const SIG_RA2 = 2;
const sigOpp = (k) => {
  const [a, d] = k.split(":");
  return a + ":" + -d;
};
function sigAllowedPair(a, b, fa, fb) {
  // permitted opposed movements (give-way): a filtering right turn vs anything from the opposite approach; opposing rights
  if (a.key === sigOpp(b.key)) {
    if (a.mv === "R" && fa) return true;
    if (b.mv === "R" && fb) return true;
    if (a.mv === "R" && b.mv === "R") return true;
  }
  return false;
}
function buildSig(J) {
  const keys = Object.keys(J.appr || {}),
    mvs = [],
    by = new Map();
  const axisOf = (k) => world.segs[+k.split(":")[0]].dir;
  for (const k of keys) {
    const [sid, d] = k.split(":");
    const o = jOptions(J, world.segs[+sid], +d);
    for (const c of o.opts) {
      const paths = sigMovePaths(J, k, c[0]);
      if (!paths.length) continue;
      const m = { key: k, mv: c[0], ax: axisOf(k), paths, id: k + "|" + c[0] };
      mvs.push(m);
      by.set(m.id, m);
    }
  }
  const get = (k, mv) => by.get(k + "|" + mv);
  const dedR = (k) => {
    const ap = J.appr[k];
    return ap && ap.lanes && ap.lanes.length >= 2 && ap.lanes.some((l) => l === "R");
  };
  const stages = [];
  const ax0 = hash2(J.x, J.y) < 0.5 ? "v" : "h";
  // v29 UK split phasing at 4-arm junctions: each approach runs alone in turn (protected right arrow), so opposing right-turners never meet in the box
  const four = ["h", "v"].every((a) => keys.filter((k) => axisOf(k) === a).length >= 2);
  if (four) {
    const cx = (J.x + J.w / 2) * M_T,
      cy = (J.y + J.h / 2) * M_T,
      ang = (k) => {
        const [sid, d] = k.split(":"),
          sg = world.segs[+sid],
          o = jOptions(J, sg, +d),
          p = lanePt(sg, +d, 0, o.stop);
        return Math.atan2(p[0] - cx, -(p[1] - cy));
      };
    const ord = keys.slice().sort((a, b) => ((ang(a) + 7) % 6.2832) - ((ang(b) + 7) % 6.2832));
    const off = (hash2(J.x + 3, J.y) * ord.length) | 0;
    for (let i = 0; i < ord.length; i++) {
      const k = ord[(i + off) % ord.length];
      const st = { kind: "split", ax: axisOf(k), mv: [] };
      for (const mv of ["L", "S", "R"]) {
        const m = get(k, mv);
        if (m) st.mv.push({ m, filter: false });
      }
      if (st.mv.length) stages.push(st);
    }
  } else
    for (const ax of [ax0, ax0 === "v" ? "h" : "v"]) {
      const ks = keys.filter((k) => axisOf(k) === ax);
      if (!ks.length) continue;
      const main = { kind: "main", ax, mv: [] };
      for (const k of ks)
        for (const mv of ["L", "S", "R"]) {
          const m = get(k, mv);
          if (!m) continue;
          const opp = ks.indexOf(sigOpp(k)) >= 0 && (get(sigOpp(k), "S") || get(sigOpp(k), "L"));
          main.mv.push({ m, filter: mv === "R" && !!opp });
        }
      stages.push(main);
      const rs = ks.map((k) => get(k, "R")).filter(Boolean);
      if (rs.length && ks.length === 2 && ks.every(dedR)) {
        stages.push({ kind: "arrow", ax, mv: rs.map((m) => ({ m, filter: false })) });
      } // protected opposing rights
      else if (rs.length === 1 && ks.length === 2) {
        const r = rs[0],
          keep = main.mv.filter((x) => x.m.key === r.key).map((x) => ({ m: x.m, filter: false })); // early cut-off (T-junction main road)
        stages.push({ kind: "eco", ax, mv: keep });
      }
    }
  // v53c: UK junctions end every cycle with an all-red pedestrian stage (green man on every crossing, James 19 Oct)
  if (J.uk && stages.length) stages.push({ kind: "ped", ax: null, mv: [] });
  // left filter arrows alongside any non-conflicting stage
  for (const s of stages) {
    if (s.kind === "ped") continue;
    for (const m of mvs) {
      if (m.mv !== "L" || s.mv.some((x) => x.m === m)) continue;
      if (s.mv.every((x) => !sigConflict(J, x.m, m))) s.mv.push({ m, filter: false, extra: true });
    }
  }
  // timings: cycle ~60-90 s
  for (const s of stages)
    s.g =
      s.kind === "split"
        ? 13
        : s.kind === "main"
          ? stages.length > 2
            ? 22
            : 27
          : s.kind === "ped"
            ? SIG_PED
            : 7;
  let t = 0;
  const of = new Map();
  stages.forEach((s, i) => {
    s.t0 = t;
    t += s.g + SIG_AMBER + SIG_ALLRED + SIG_RA2;
    s.idx = new Map(s.mv.map((x) => [x.m.id, x]));
    for (const x of s.mv) {
      if (!of.has(x.m.id)) of.set(x.m.id, new Set());
      of.get(x.m.id).add(i);
    }
  });
  return { stages, T: t, of, mvs };
}
const SIG_PED = 9; // green-man seconds; the vehicle intergreen after it (amber + all-red + red/amber, 6 s) clears the crossing
// seconds of green man left on a UK junction's crossings (0 = red man)
function sigPedLeft(J) {
  if (!J.uk) return 0;
  const [S, cur, u] = sigCur(J),
    st = S.stages[cur];
  return st.kind === "ped" && u < st.g ? st.g - u : 0;
}
function sigOf(J) {
  return J.sig || (J.sig = buildSig(J));
}
function sigCur(J) {
  const S = sigOf(J),
    t = (((timeS + J.phase * 3) % S.T) + S.T) % S.T;
  let cur = S.stages.length - 1;
  for (let k = 0; k < S.stages.length; k++) if (t >= S.stages[k].t0) cur = k;
  return [S, cur, t - S.stages[cur].t0];
}
function sigState(J, key, mv) {
  const [S, cur, u] = sigCur(J),
    id = key + "|" + mv,
    set = S.of.get(id);
  if (!set) return "r";
  const st = S.stages[cur],
    nx = (cur + 1) % S.stages.length;
  if (set.has(cur)) {
    if (u < st.g) return "g";
    if (set.has(nx)) return "g";
    return u < st.g + SIG_AMBER ? "a" : "r";
  }
  if (set.has(nx) && u >= st.g + SIG_AMBER + SIG_ALLRED) {
    const x = S.stages[nx].idx.get(id);
    return x && x.extra ? "r" : "ra";
  } // filter arrows appear without red+amber
  return "r";
}
// true while a green right turn must give way to oncoming traffic (filtering under a full green)
function sigFilter(J, key, mv) {
  if (mv !== "R") return false;
  const [S, cur, u] = sigCur(J);
  const x = S.stages[cur].idx.get(key + "|" + mv);
  return !!(x && x.filter);
} // the arrow only takes over once its own stage starts (after the full intergreen)
function sigArrow(J, key, mv) {
  const [S, cur, u] = sigCur(J);
  const st = S.stages[cur];
  let x = st.idx.get(key + "|" + mv);
  if (st.kind === "split" && !(x && x.extra))
    return mv === "R" && !!x && sigState(J, key, mv) === "g";
  return !!(x && (st.kind !== "main" || x.extra) && !x.filter && sigState(J, key, mv) === "g");
}
// legacy (corner pole lights): any movement on that axis
function lightState(J, ns) {
  const S = sigOf(J);
  let best = "r";
  for (const m of S.mvs) {
    if ((m.ax === "v") !== ns) continue;
    const s = sigState(J, m.key, m.mv);
    if (s === "g") return "g";
    if (s === "a") best = "a";
    else if (s === "ra" && best === "r") best = "ra";
  }
  return best;
}
// is there oncoming traffic a filtering right-turner must give way to?
function sigOncoming(v, J, oppKey) {
  for (const o of traffic.vs) {
    if (o === v) continue;
    for (const mk of o.mk) {
      if (mk.kind !== "light" || mk.J !== J || mk.key !== oppKey || mk.move === "R") continue;
      const front = o.s + o.L / 2,
        gap = mk.d - front;
      if (gap < -(mk.dEnd - mk.d) - 1) continue;
      if (gap < 0) return true;
      if (gap < 38 && o.v > 1.5 && sigState(J, oppKey, mk.move) !== "r") return true;
      if (gap < 3 && mk.go) return true;
    }
  }
  // the player coming the other way
  const t = truck,
    cx = (J.x + J.w / 2) * M_T,
    cy = (J.y + J.h / 2) * M_T,
    d = Math.hypot(t.x - cx, t.y - cy);
  if (d < 45 && Math.abs(t.v) > 1 && !(typeof IND !== "undefined" && IND.side === 2)) {
    const f = fwd(t.h),
      fv = fwd(v.h || 0);
    if ((cx - t.x) * f[0] + (cy - t.y) * f[1] > 0 && f[0] * fv[0] + f[1] * fv[1] < -0.6)
      return true;
  }
  return false;
}
// vehicles (AI or the player) already inside the junction on a crossing heading
function jBusy(v, J) {
  const x0 = J.x * M_T - 1,
    y0 = J.y * M_T - 1,
    x1 = (J.x + J.w) * M_T + 1,
    y1 = (J.y + J.h) * M_T + 1,
    fv = fwd(v.h || 0);
  const chk = (x, y, h) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const f = fwd(h);
    return Math.abs(f[0] * fv[0] + f[1] * fv[1]) < 0.8;
  };
  for (const o of traffic.vs) {
    if (
      o !== v &&
      !o.filtering &&
      (chk(o.x, o.y, o.h || 0) || (o.trl && chk(o.trl.x, o.trl.y, o.trl.h)))
    )
      return true;
  } // v25: a lorry's trailer still crossing counts
  if (chk(truck.x, truck.y, truck.h)) return true;
  if (truck.trl && chk(truck.trl.x, truck.trl.y, truck.trl.th || 0)) return true;
  return false;
}
