// ===================== admin-only fly camera (G / FLY button): truck holds its handbrake, free camera pans/zooms, click/tap or Tab/LB/RB to follow AI vehicles =====================
const FLY = {
  on: false,
  x: 0,
  y: 0,
  z: 0.6,
  keys: new Set(),
  tgt: null,
  list: [],
  li: -1,
  btn: null,
  pb: [0, 0],
};
function flyAllowed() {
  return typeof ACC !== "undefined" && !!ACC.admin && !!ACC.tok && started;
}
function flySet(on) {
  if (on && !flyAllowed()) return;
  if (on === FLY.on) return;
  FLY.on = on;
  FLY.tgt = null;
  FLY.keys.clear();
  if (on) {
    FLY.x = cam.x;
    FLY.y = cam.y;
    FLY.z = Math.min(cam.z, 0.7);
    if (typeof flash === "function")
      flash(
        "FLY CAM \u2022 arrows/WASD pan (Shift fast) \u2022 wheel/+/- zoom \u2022 click a vehicle \u2022 Tab cycle \u2022 Esc exit",
      );
  }
  flyBtnSync();
}
function flyPos(t) {
  if (!t) return null;
  if (t.ptruck) {
    const T = t.ptruck;
    if (T.v && traffic.vs.includes(T.v)) return [T.v.x, T.v.y];
    if (T.x != null && T.st === "depot") return [T.x, T.y];
    return T._lp || null;
  }
  if (traffic.vs.includes(t)) return [t.x, t.y];
  return null;
}
function flyTargets() {
  const pt = (typeof PTRUCK !== "undefined" ? PTRUCK.list : [])
    .map((T) => ({ ptruck: T }))
    .filter((o) => flyPos(o));
  const vs = traffic.vs
    .filter((v) => !v.ptruck)
    .sort(
      (a, b) =>
        (b.kind === "lorry") - (a.kind === "lorry") ||
        Math.hypot(a.x - FLY.x / PPM, a.y - FLY.y / PPM) -
          Math.hypot(b.x - FLY.x / PPM, b.y - FLY.y / PPM),
    );
  return pt.concat(vs.map((v) => v));
}
function flyCycle(d) {
  const L = flyTargets();
  if (!L.length) return;
  let i = L.findIndex((o) => o === FLY.tgt || (o.ptruck && FLY.tgt && o.ptruck === FLY.tgt.ptruck));
  i = ((i < 0 ? (d > 0 ? -1 : 0) : i) + d + L.length) % L.length;
  FLY.tgt = L[i];
}
function flyPick(sx, sy) {
  const wx = ((sx - VW / 2) / cam.z + cam.x) / PPM,
    wy = ((sy - VH / 2) / cam.z + cam.y) / PPM;
  let best = null,
    bd = 8 / Math.min(1, cam.z);
  for (const v of traffic.vs) {
    const d = Math.hypot(v.x - wx, v.y - wy);
    if (d < bd) {
      bd = d;
      best = v.ptruck ? { ptruck: v.ptruck } : v;
    }
  }
  if (typeof PTRUCK !== "undefined")
    for (const T of PTRUCK.list)
      if (T.st === "depot" && T.x != null) {
        const d = Math.hypot(T.x - wx, T.y - wy);
        if (d < bd) {
          bd = d;
          best = { ptruck: T };
        }
      }
  FLY.tgt = best;
}
function flyInfo(t) {
  if (t.ptruck) {
    const T = t.ptruck,
      v = T.v;
    const st =
      {
        road: "on road",
        gate: "in port gate lane",
        depot: "at depot gantry",
        lost: "re-routing",
        new: "starting",
      }[T.st] || T.st;
    const dest =
      T.tgt === "port"
        ? (T.P && T.P.depot ? T.P.depot.name : "Port") + " gate"
        : (T.dest && T.dest.name) || (v && v.goal && v.goal.name) || "\u2014";
    return [
      "PORT LORRY" + (T.home ? " (own fleet)" : ""),
      st + " \u2022 " + (T.box ? "loaded" : "empty"),
      "\u2192 " + dest,
    ];
  }
  const v = t;
  return [
    (v.role || "civilian").toUpperCase() + " \u2022 " + (v.kind || "car"),
    Math.abs(v.v || 0) < 0.5 ? "stopped" : Math.round(Math.abs(v.v) * 2.23694) + " mph",
    "\u2192 " + ((v.goal && v.goal.name) || "cruising"),
  ];
}
function flyCamTick(dt) {
  if (!FLY.on) return;
  if (!flyAllowed()) {
    flySet(false);
    return;
  }
  let px = 0,
    py = 0;
  const K = FLY.keys;
  if (K.has("ArrowLeft") || K.has("KeyA")) px--;
  if (K.has("ArrowRight") || K.has("KeyD")) px++;
  if (K.has("ArrowUp") || K.has("KeyW")) py--;
  if (K.has("ArrowDown") || K.has("KeyS")) py++;
  if (K.has("Equal") || K.has("NumpadAdd")) FLY.z *= Math.exp(dt * 1.5);
  if (K.has("Minus") || K.has("NumpadSubtract")) FLY.z *= Math.exp(-dt * 1.5);
  const g = navigator.getGamepads
    ? [...navigator.getGamepads()].find((g) => g && g.connected)
    : null;
  if (g) {
    const dz = (a) => (Math.abs(a) < 0.18 ? 0 : a);
    px += dz(g.axes[0] || 0);
    py += dz(g.axes[1] || 0);
    const rb = g.buttons[5] && g.buttons[5].pressed,
      lb = g.buttons[4] && g.buttons[4].pressed;
    if (rb && !FLY.pb[1]) flyCycle(1);
    if (lb && !FLY.pb[0]) flyCycle(-1);
    FLY.pb = [lb, rb];
    const ry = dz(g.axes[3] || 0);
    if (ry) FLY.z *= Math.exp(-ry * dt * 1.5);
    if (g.buttons[1] && g.buttons[1].pressed && !FLY.pbB) flySet(false);
    FLY.pbB = g.buttons[1] && g.buttons[1].pressed;
  }
  FLY.z = Math.max(0.12, Math.min(1.6, FLY.z));
  if (px || py) {
    FLY.tgt = null;
    const sp = (K.has("ShiftLeft") || K.has("ShiftRight") ? 2400 : 800) / FLY.z;
    FLY.x += px * sp * dt;
    FLY.y += py * sp * dt;
  }
  if (FLY.tgt) {
    const p = flyPos(FLY.tgt);
    if (p) {
      if (FLY.tgt.ptruck) FLY.tgt.ptruck._lp = p;
      const k = 1 - Math.exp(-dt * 5);
      FLY.x += (p[0] * PPM - FLY.x) * k;
      FLY.y += (p[1] * PPM - FLY.y) * k;
    } else FLY.tgt = null;
  }
  cam.x = FLY.x;
  cam.y = FLY.y;
  cam.z = FLY.z;
}
function flyHUD() {
  if (!FLY.on) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = "bold 13px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(200,40,40,0.85)";
  ctx.fillRect(VW / 2 - 44, VH - 34, 88, 22);
  ctx.fillStyle = "#fff";
  ctx.fillText("FLY CAM", VW / 2, VH - 18);
  if (FLY.tgt && flyPos(FLY.tgt)) {
    const p = flyPos(FLY.tgt),
      sx = (p[0] * PPM - cam.x) * cam.z + VW / 2,
      sy = (p[1] * PPM - cam.y) * cam.z + VH / 2,
      L = flyInfo(FLY.tgt);
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(14, 40 * cam.z), 0, 7);
    ctx.stroke();
    ctx.font = "bold 12px system-ui,sans-serif";
    const w = Math.max(...L.map((s) => ctx.measureText(s).width)) + 16,
      bx = Math.min(VW - w / 2 - 6, Math.max(w / 2 + 6, sx)),
      by = sy - Math.max(14, 40 * cam.z) - 12 - L.length * 15;
    ctx.fillStyle = "rgba(10,14,22,0.82)";
    ctx.fillRect(bx - w / 2, by - 4, w, L.length * 15 + 8);
    ctx.fillStyle = "#ffd23f";
    L.forEach((s, i) => {
      ctx.fillText(s, bx, by + 11 + i * 15);
      ctx.fillStyle = "#e8eef5";
    });
  }
  ctx.restore();
}
function flyBtnSync() {
  const b = FLY.btn;
  if (!b) return;
  b.style.display = flyAllowed() ? "block" : "none";
  b.style.background = FLY.on ? "#c62828" : "rgba(15,20,30,0.78)";
}
// input (capture phase: while flying, movement keys / Tab / Esc belong to the camera)
addEventListener(
  "keydown",
  (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.code === "KeyG" && !e.repeat && flyAllowed() && !career.uiOpen) {
      flySet(!FLY.on);
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!FLY.on) return;
    if (e.code === "Escape") {
      flySet(false);
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === "Tab") {
      flyCycle(e.shiftKey ? -1 : 1);
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Equal",
        "Minus",
        "NumpadAdd",
        "NumpadSubtract",
        "ShiftLeft",
        "ShiftRight",
      ].includes(e.code)
    ) {
      FLY.keys.add(e.code);
      if (e.code === "Equal" || e.code === "Minus") e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  true,
);
addEventListener("keyup", (e) => FLY.keys.delete(e.code), true);
addEventListener("blur", () => FLY.keys.clear());
addEventListener("load", () => {
  const cv0 = document.querySelector("canvas");
  if (!cv0) return;
  const host = cv0.parentElement;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const b = document.createElement("button");
  b.id = "flyBtn";
  b.textContent = "FLY";
  b.title = "Admin fly camera (G)";
  b.style.cssText =
    "position:absolute;right:12px;top:150px;z-index:30;display:none;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);color:#fff;font:700 12px system-ui,sans-serif;letter-spacing:1px;cursor:pointer;background:rgba(15,20,30,0.78)";
  for (const ev of ["pointerdown", "touchstart"])
    b.addEventListener(ev, (e) => e.stopPropagation());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    flySet(!FLY.on);
    b.blur();
  });
  host.appendChild(b);
  FLY.btn = b;
  setInterval(flyBtnSync, 1000);
  // pointer: drag pans, pinch / wheel zooms, tap follows
  const P = new Map();
  let down = null,
    pinch = null;
  cv0.addEventListener(
    "pointerdown",
    (e) => {
      if (!FLY.on) return;
      e.stopImmediatePropagation();
      const p = canvasPos(e);
      P.set(e.pointerId, p);
      if (P.size === 1) down = { p, x: FLY.x, y: FLY.y, moved: false };
      else if (P.size === 2) {
        const [a, c] = [...P.values()];
        pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]), z: FLY.z };
        down = null;
      }
    },
    true,
  );
  cv0.addEventListener(
    "pointermove",
    (e) => {
      if (!FLY.on || !P.has(e.pointerId)) return;
      const p = canvasPos(e);
      P.set(e.pointerId, p);
      if (pinch && P.size === 2) {
        const [a, c] = [...P.values()];
        FLY.z = Math.max(
          0.12,
          Math.min(1.6, (pinch.z * Math.hypot(a[0] - c[0], a[1] - c[1])) / Math.max(10, pinch.d)),
        );
      } else if (down) {
        const dx = p[0] - down.p[0],
          dy = p[1] - down.p[1];
        if (Math.hypot(dx, dy) > 8) {
          down.moved = true;
          FLY.tgt = null;
        }
        if (down.moved) {
          FLY.x = down.x - dx / FLY.z;
          FLY.y = down.y - dy / FLY.z;
        }
      }
    },
    true,
  );
  const up = (e) => {
    if (!FLY.on) {
      P.delete(e.pointerId);
      return;
    }
    if (down && !down.moved && P.size === 1) flyPick(...canvasPos(e));
    P.delete(e.pointerId);
    if (P.size < 2) pinch = null;
    if (!P.size) down = null;
  };
  cv0.addEventListener("pointerup", up, true);
  cv0.addEventListener(
    "pointercancel",
    (e) => {
      P.delete(e.pointerId);
      pinch = null;
      down = null;
    },
    true,
  );
  cv0.addEventListener(
    "wheel",
    (e) => {
      if (!FLY.on) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      FLY.z = Math.max(0.12, Math.min(1.6, FLY.z * Math.exp(-e.deltaY * 0.0015)));
    },
    { passive: false, capture: true },
  );
  setTimeout(() => {
    const dh = drawHUD;
    drawHUD = function () {
      dh.apply(this, arguments);
      flyHUD();
    };
  }, 0);
});
