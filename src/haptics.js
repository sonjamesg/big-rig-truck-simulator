/**
 * @file haptics.js — Haptics: phone vibration on touch controls. Feature-detected, touch-only, toggle in SETTINGS.vib (saved with game).
 * Exposes (globals): HAP, HAP_PRESS, haptic, HAP_STRONG, HAP_DP, hapPress, HAP_SLIDE, hapRecent, setVib
 * Depends on: physics.js, depots.js, career.js
 * Load order: #22 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
// Haptics: phone vibration on touch controls. Feature-detected, touch-only, toggle in SETTINGS.vib (saved with game).
const HAP = { touch: 0, last: 0, dmg: null, dmgT: 0 };
if (SETTINGS.vib === undefined) SETTINGS.vib = true;
const HAP_PRESS = 22; // ms; 12ms was below what many Android vibration motors render, so taps felt dead
addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType === "touch") {
      HAP.touch = 1;
      HAP.last = performance.now();
    } else if (e.pointerType === "mouse") HAP.touch = 0;
  },
  true,
);
addEventListener(
  "keydown",
  () => {
    HAP.touch = 0;
  },
  true,
);
function haptic(p, force) {
  try {
    if (
      (!HAP.touch && !force) ||
      (SETTINGS.vib === false && SETTINGS.vibV === 2) ||
      typeof navigator.vibrate !== "function"
    )
      return;
    navigator.vibrate(p);
  } catch (e) {}
}
const HAP_STRONG = { mHorn: 1, mCouple: 1, mFuel: 1, mUnload: 1 };
// short crisp click (12 ms) on the D-pad arms and A/B: fired first thing in touchstart/pointerdown
const HAP_DP = { mLeft: 12, mRight: 12, mUp: 12, mDown: 12, mA: 12, mB: 12 };
// Old saves: an off switch from before vibV=2 (start screen became scrollable, easy to knock) is ignored until re-chosen.
// Deck presses are touch by definition: force past the HAP.touch gate (a keydown from a paired pad/keyboard used to zero it), dedupe pointerdown+touchstart.
function hapPress(id) {
  const n = performance.now();
  if (HAP.pid === id && n - HAP.pt < 60) return; // same press seen by touchstart and pointerdown
  if (SETTINGS.vib !== false || SETTINGS.vibV !== 2)
    try {
      navigator.vibrate && navigator.vibrate(HAP_STRONG[id] ? 35 : HAP_DP[id] || HAP_PRESS);
    } catch (e) {}
  HAP.pid = id;
  HAP.pt = n;
  HAP.touch = 1;
  HAP.last = n;
}
// Instant buzz: touchstart on the button itself (capture, passive) calls vibrate before any other logic.
// Holding never repeats (one buzz per touch); sliding a finger onto another deck button buzzes once for it
// (touch pointers are implicitly captured, so the new button never gets its own pointerdown).
const HAP_SLIDE = {};
addEventListener(
  "touchstart",
  (e) => {
    for (const t of e.changedTouches) {
      const b = t.target && t.target.closest && t.target.closest("#mob .b");
      if (b && b.id) {
        hapPress(b.id);
        HAP_SLIDE[t.identifier] = b.id;
      }
    }
  },
  { capture: true, passive: true },
);
addEventListener(
  "touchmove",
  (e) => {
    for (const t of e.changedTouches) {
      if (!(t.identifier in HAP_SLIDE)) continue;
      const el = document.elementFromPoint(t.clientX, t.clientY),
        b = el && el.closest && el.closest("#mob .b");
      const id = b && b.id && b.id !== "mSteer" && b.id !== "mCen" ? b.id : null;
      if (id && id !== HAP_SLIDE[t.identifier]) hapPress(id);
      if (id) HAP_SLIDE[t.identifier] = id;
    }
  },
  { capture: true, passive: true },
);
for (const ev of ["touchend", "touchcancel"])
  addEventListener(
    ev,
    (e) => {
      for (const t of e.changedTouches) delete HAP_SLIDE[t.identifier];
    },
    { capture: true, passive: true },
  );
const hapRecent = () => performance.now() - HAP.last < 800;
for (const ev of ["couple", "uncouple", "refuel", "unloadStart", "missionStart"])
  BigRig.on &&
    BigRig.on(ev, () => {
      if (hapRecent()) haptic(35);
    });
for (const ev of ["explode", "breakdown"]) BigRig.on && BigRig.on(ev, () => haptic([80, 40, 120]));
(function dmgWatch() {
  try {
    if (typeof truck !== "undefined" && typeof truck.damage === "number") {
      const d = truck.damage;
      if (HAP.dmg !== null && d - HAP.dmg > 0.5) {
        const n = performance.now();
        if (n - HAP.dmgT > 400) {
          HAP.dmgT = n;
          haptic(d - HAP.dmg > 5 ? [90, 50, 140] : [50, 30, 60]);
        }
      }
      HAP.dmg = d;
    }
  } catch (e) {}
  requestAnimationFrame(dmgWatch);
})();
function setVib(on) {
  SETTINGS.vib = !!on;
  SETTINGS.vibV = 2;
  const el = document.getElementById("vibM");
  if (el) el.checked = SETTINGS.vib;
  try {
    saveGame();
  } catch (e) {}
  if (on) haptic(20);
}
addEventListener("load", () => {
  if (!document.body.classList.contains("touch") || typeof navigator.vibrate !== "function") return;
  const ov = document.getElementById("overlay");
  if (!ov || document.getElementById("vibM")) return;
  const d = document.createElement("label");
  d.style.cssText =
    "margin-top:10px;display:flex;align-items:center;gap:10px;justify-content:center;color:#cfd6e0;font-weight:700;pointer-events:auto";
  d.innerHTML =
    '&#x1F4F3; Vibration <input id="vibM" type="checkbox" style="width:22px;height:22px;accent-color:#e8a317">';
  ov.appendChild(d);
  const el = d.querySelector("input");
  el.checked = !(SETTINGS.vib === false && SETTINGS.vibV === 2);
  el.addEventListener("change", (e) => {
    e.stopPropagation();
    setVib(el.checked);
  });
  for (const ev of ["pointerdown", "click", "touchstart"])
    d.addEventListener(ev, (e) => e.stopPropagation());
  setTimeout(() => {
    el.checked = !(SETTINGS.vib === false && SETTINGS.vibV === 2);
  }, 500);
});
