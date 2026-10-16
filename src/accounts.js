/**
 * @file accounts.js — Supabase accounts: name + 4-digit PIN via SECURITY DEFINER RPCs; cloud save sync; guest/offline fallback
 * Exposes (globals): ACC, accRpc, accNorm, accSetSession, accClear, accPull, accPush, accAdmin
 * Depends on: world.js, career.js, mp.js, main.js
 * Load order: #52 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== Supabase accounts: name + 4-digit PIN via SECURITY DEFINER RPCs; cloud save sync; guest/offline fallback =====================
const ACC = {
  url: "https://sirsawhnqnvioqzmqihk.supabase.co",
  key: "sb_publishable_RFxDkU5Iq_XUy4w6zg1t8A_FTBvz31a",
  tok: null,
  name: null,
  admin: false,
  mode: null,
  timer: 0,
  online: true,
};
try {
  ACC.tok = localStorage.getItem("bigrig.tok");
  ACC.name = localStorage.getItem("bigrig.acct");
} catch (e) {}
async function accRpc(fn, args, keep) {
  const r = await fetch(ACC.url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    keepalive: !!keep,
    headers: {
      apikey: ACC.key,
      Authorization: "Bearer " + ACC.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error("rpc " + r.status);
  return r.json();
}
const accNorm = (n) =>
  String(n || "")
    .trim()
    .replace(/\s+/g, " ");
function accSetSession(j) {
  document.body && document.body.classList.add("acctin");
  ACC.tok = j.token || ACC.tok;
  ACC.name = j.name || ACC.name;
  ACC.admin = !!j.is_admin;
  try {
    localStorage.setItem("bigrig.tok", ACC.tok);
    localStorage.setItem("bigrig.acct", ACC.name);
    localStorage.setItem("bigrig.lastacct", ACC.name);
    localStorage.setItem("bigrig.name", ACC.name);
  } catch (e) {}
  const nm = document.getElementById("lbName");
  if (nm) nm.value = ACC.name;
}
function accClear(keepName) {
  if (!keepName)
    try {
      localStorage.removeItem("bigrig.lastacct");
    } catch (e) {}
  document.body && document.body.classList.remove("acctin");
  ACC.tok = null;
  ACC.name = null;
  ACC.admin = false;
  try {
    localStorage.removeItem("bigrig.tok");
    localStorage.removeItem("bigrig.acct");
  } catch (e) {}
}
// pull the cloud save into localStorage and reload it into the live game (only if the world is ready and we haven't started driving)
async function accPull() {
  if (!ACC.tok) return;
  try {
    const j = await accRpc("load_save", { token: ACC.tok });
    if (!j.ok) {
      accClear(true);
      return;
    }
    ACC.admin = !!j.is_admin;
    // newest save wins: the cloud copy replaces the local one unless the local save is strictly newer (then it is pushed up instead)
    if (j.save && j.save.k && j.save.d) {
      let loc = null;
      try {
        loc = JSON.parse(localStorage.getItem(j.save.k) || "null");
      } catch (e) {}
      const ct = +(j.save.d.t || j.save.t || 0),
        lt = +((loc && loc.t) || 0);
      if (!loc || ct >= lt) {
        localStorage.setItem(j.save.k, JSON.stringify(j.save.d));
        if (
          typeof world !== "undefined" &&
          world.ready &&
          typeof loadGame === "function" &&
          (typeof started === "undefined" || !started || ct > lt)
        )
          loadGame();
        ACC.pulled = 1;
      } else {
        ACC.pulled = 1;
        accPush(false);
      }
    } else ACC.pulled = 1;
  } catch (e) {
    ACC.online = false;
  }
}
function accPush(keep) {
  if (!ACC.tok || !ACC.online || !ACC.pulled) return; // never push before the cloud save has been compared (stale local must not overwrite it)
  try {
    const k = saveKey(),
      s = localStorage.getItem(k);
    if (!s) return;
    accRpc(
      "store_save",
      { token: ACC.tok, data: { k, d: JSON.parse(s), t: Date.now() } },
      keep,
    ).catch(() => {});
  } catch (e) {}
}
// is_admin only unlocks admin tools (fly cam etc.); it no longer grants money, XP or yard tiers
function accAdmin() {}
// ---- login card ----
(function () {
  const css = `#acct{width:min(440px,88vw);margin:14px auto 4px;padding:14px 16px;border-radius:14px;background:rgba(14,20,32,.82);border:1px solid rgba(245,184,46,.4);box-shadow:0 8px 24px rgba(0,0,0,.45);text-align:center;display:flex;flex-direction:column;gap:8px}
#acct .ah{font-size:11px;letter-spacing:3px;font-weight:800;color:#f5b82e}
#acct input{font-size:18px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#0b111d;color:#fff;text-align:center;min-height:44px;box-sizing:border-box;width:100%}
#acct input.pin:placeholder-shown{letter-spacing:2px}
#acct input.pin{letter-spacing:10px;-webkit-text-security:disc;font-variant-numeric:tabular-nums}
#acct .ab{font-weight:800;font-size:15px;padding:10px;border-radius:10px;border:0;cursor:pointer;background:linear-gradient(#ffd36a,#f5a915);color:#1a1205;min-height:44px}
#acct .ab.g{background:rgba(255,255,255,.1);color:#dfe5ee;border:1px solid rgba(255,255,255,.2)}
#acct input:focus,#acct .ab:focus{outline:3px solid #7dff8a;outline-offset:2px}
#acct .am{font-size:13px;color:#cfe8d2;min-height:17px} #acct .am.e{color:#ff8a7a}
body.acctin #wbNew,body.acctin #reset{display:none!important} #wbCard{display:flex;flex-wrap:wrap;justify-content:center;gap:8px} #wbCard>div{flex-basis:100%}
#acct.in .lg{display:none!important} #acct:not(.in) .lo{display:none}
@media (orientation:landscape) and (max-height:500px){ body.touch #overlay>#acct{grid-column:1;grid-row:5;width:min(44vw,400px);padding:6px 10px;gap:4px;margin:0} body.touch #overlay:has(#acct:not([style*=none]))>#logo{max-height:24vh!important} body.touch #acct .ah{display:none} body.touch #acct .lg[id^=acP]{display:inline-block;width:49%} body.touch #acct .am{font-size:11px;min-height:0} body.touch #acct #acGuest{min-height:30px;padding:4px;font-size:13px} body.touch #acct input,body.touch #acct .ab{min-height:36px;padding:6px 10px} }`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
  function build() {
    const ov = document.getElementById("overlay");
    if (!ov || document.getElementById("acct")) return;
    const a = document.createElement("div");
    a.id = "acct";
    a.innerHTML = `<div class="ah">DRIVER ACCOUNT</div>
  <div class="lg"><input id="acName" maxlength="16" placeholder="Username" autocomplete="username" autocapitalize="off" spellcheck="false"></div>
  <div class="lg" id="acP1w" style="display:none"><input id="acPin" class="pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="PIN" autocomplete="off"></div>
  <div class="lg" id="acP2w" style="display:none"><input id="acPin2" class="pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="Confirm PIN" autocomplete="off"></div>
  <button class="ab lg" id="acGo">Continue</button>
  <div class="lo" id="acWho"></div>
  <div class="am" id="acMsg"></div>
  <button class="ab g lg" id="acGuest">Play as guest (local save)</button>`;
    const ref = document.getElementById("lobby") || ov.querySelector(".go");
    ov.insertBefore(a, ref || null);
    for (const ev of ["pointerdown", "click", "touchstart", "keydown"])
      a.addEventListener(ev, (e) => e.stopPropagation());
    const $ = (id) => a.querySelector("#" + id),
      msg = (t, e) => {
        $("acMsg").textContent = t;
        $("acMsg").className = "am" + (e ? " e" : "");
      };
    const digits = (el) =>
      el.addEventListener("input", () => {
        el.value = el.value.replace(/\D/g, "").slice(0, 4);
      });
    digits($("acPin"));
    digits($("acPin2"));
    let ct = 0,
      exists = null,
      busy = false;
    const show = () => {
      $("acP1w").style.display = exists === null ? "none" : "";
      $("acP2w").style.display = exists === false ? "" : "none";
      $("acGo").textContent = exists === false ? "Create account" : exists ? "Log in" : "Continue";
    };
    const check = async () => {
      const n = accNorm($("acName").value);
      if (!n) {
        exists = null;
        show();
        msg("");
        return;
      }
      try {
        const j = await accRpc("name_check", { name: n });
        if (accNorm($("acName").value) !== n) return;
        if (!j.ok) {
          exists = null;
          msg(j.error, 1);
        } else {
          exists = !!j.exists;
          msg(
            exists
              ? "Welcome back \u2022 enter your PIN"
              : "New name \u2022 choose a 4-digit PIN (no recovery!)",
          );
        }
        ACC.online = true;
      } catch (e) {
        ACC.online = false;
        exists = null;
        msg("Offline \u2022 you can play as guest", 1);
      }
      show();
    };
    $("acName").addEventListener("input", () => {
      clearTimeout(ct);
      ct = setTimeout(check, 350);
    });
    const submit = async () => {
      if (busy) return;
      if (exists === null) {
        await check();
        if (exists === null) return;
        if ($("acPin").offsetParent) {
          $("acPin").focus();
          return;
        }
      }
      const n = accNorm($("acName").value),
        p = $("acPin").value,
        p2 = $("acPin2").value;
      if (!/^\d{4}$/.test(p)) {
        msg("PIN must be 4 digits", 1);
        $("acPin").focus();
        return;
      }
      busy = true;
      msg("\u2026");
      try {
        const j = exists
          ? await accRpc("verify", { name: n, pin: p })
          : await accRpc("register", { name: n, pin: p, pin_confirm: p2 });
        if (!j.ok) {
          msg(
            j.error +
              (typeof j.attempts_left === "number" && j.attempts_left > 0
                ? ` \u2022 ${j.attempts_left} attempt${j.attempts_left > 1 ? "s" : ""} left`
                : ""),
            1,
          );
          $("acPin").value = "";
          $("acPin2").value = "";
        } else {
          accSetSession(j);
          await accPull();
          refresh();
          msg("");
        }
      } catch (e) {
        msg("Offline \u2022 you can play as guest", 1);
      }
      busy = false;
    };
    $("acGo").addEventListener("click", submit);
    for (const id of ["acName", "acPin", "acPin2"])
      $(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
    $("acGuest").addEventListener("click", () => {
      ACC.mode = "guest";
      accClear();
      ACC.padT = 0;
      if (typeof MP !== "undefined" && MP.on && typeof mpLeave === "function") mpLeave();
      startGame();
    });
    function refresh() {
      a.classList.toggle("in", !!ACC.tok);
      document.body.classList.toggle("acctin", !!ACC.tok);
      $("acWho").innerHTML = ACC.tok
        ? `Signed in as <b>${String(ACC.name).replace(/[<>&"]/g, "")}</b>${ACC.admin ? " \u2022 admin" : ""} \u2022 cloud save on`
        : "";
    }
    ACC.refresh = refresh;
    refresh();
    // logout in the settings panel
    const sp = document.getElementById("setPanel");
    if (sp && !document.getElementById("acOut")) {
      const b = document.createElement("button");
      b.id = "acOut";
      b.className = "ab";
      b.style.cssText =
        "font-weight:800;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#dfe5ee;cursor:pointer";
      b.textContent = "Log out";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!ACC.tok) {
          toast("Not signed in");
          return;
        }
        accPush(true);
        const t = ACC.tok;
        accRpc("logout", { token: t }, true).catch(() => {});
        accClear();
        a.style.display = "";
        refresh();
        toast("Logged out \u2022 local save kept");
      });
      sp.appendChild(b);
      const sync = () => {
        b.style.display = ACC.tok ? "" : "none";
      };
      sync();
      setInterval(sync, 1000);
    }
  }
  addEventListener("load", () =>
    setTimeout(() => {
      build();
      if (ACC.tok)
        accRpc("session_touch", { token: ACC.tok })
          .then((j) => {
            if (j.ok) {
              ACC.name = j.name;
              ACC.admin = !!j.is_admin;
              accPull();
            } else {
              accClear(true);
              if (typeof toast === "function")
                toast("Session expired \u2022 enter your PIN to log back in");
            }
            ACC.refresh && ACC.refresh();
          })
          .catch(() => {
            ACC.online = false;
          });
    }, 50),
  );
  // hooks: debounced cloud push after each local save, push on exit, admin perks while signed in
  setTimeout(() => {
    const sg = saveGame;
    saveGame = function () {
      const r = sg.apply(this, arguments);
      if (r && ACC.tok) {
        clearTimeout(ACC.timer);
        ACC.timer = setTimeout(() => accPush(false), 5000);
      }
      return r;
    };
    addEventListener("pagehide", () => {
      if (started)
        try {
          saveGame();
        } catch (e) {}
      accPush(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (started)
          try {
            saveGame();
          } catch (e) {}
        accPush(true);
      }
    });
    const sgm = startGame;
    startGame = function () {
      const ae = document.activeElement;
      if (
        ae &&
        ae.closest &&
        ae.closest("#overlay") &&
        ae.tagName !== "CANVAS" &&
        Date.now() < (ACC.padT || 0)
      )
        return;
      return sgm.apply(this, arguments);
    };
    // Xbox: D-pad up/down moves through the account card, A presses the focused button (inputs open the on-screen keyboard)
    let prev = [];
    (function pp() {
      requestAnimationFrame(pp);
      if (typeof started !== "undefined" && started) return;
      const a = document.getElementById("overlay");
      if (!a || (window.INV && INV.on)) return;
      const gp = (navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : []).find(
        (g) => g && g.connected,
      );
      if (!gp) return;
      const b = gp.buttons.map((x) => x.pressed),
        hit = (i) => b[i] && !prev[i];
      prev = b;
      const els = [...a.querySelectorAll("input,button")].filter(
        (e) => e.offsetParent && !e.disabled,
      );
      let i = els.indexOf(document.activeElement);
      const mv = (d) => {
        i = i < 0 ? 0 : Math.max(0, Math.min(els.length - 1, i + d));
        els[i].focus();
      };
      if (hit(13) || (gp.axes[1] > 0.6 && !ACC.ax)) mv(1);
      if (hit(12) || (gp.axes[1] < -0.6 && !ACC.ax)) mv(-1);
      ACC.ax = Math.abs(gp.axes[1] || 0) > 0.6;
      if (hit(0) && i >= 0 && els[i].tagName === "BUTTON") {
        ACC.padT = Date.now() + 300;
        els[i].click();
      }
      if (hit(1) && i >= 0) {
        ACC.padT = Date.now() + 300;
        document.activeElement.blur();
      }
    })();
  }, 0);
})();
