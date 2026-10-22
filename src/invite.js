/**
 * @file invite.js — Invite landing: opened via ?join=TRUCK-1234 -> dedicated "You're invited" card (log in / create / guest / remembered), then straight into the host's game
 * Exposes (globals): (no top-level names; registers hooks/listeners only)
 * Depends on: world.js, ui.js, gamepad.js, mp.js, main.js, accounts.js
 * Load order: #53 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== Invite landing: opened via ?join=TRUCK-1234 -> dedicated "You're invited" card (log in / create / guest / remembered), then straight into the host's game =====================
(function () {
  const Q = new URLSearchParams(location.search),
    HQ = new URLSearchParams(location.hash.replace(/^#/, ""));
  const pick = (k) => Q.get(k) || HQ.get(k) || "",
    RAW = (pick("join") || pick("room") || pick("code") || "").replace(/\D/g, "").slice(0, 6);
  if (RAW.length < 4) return;
  document.documentElement.classList.add("invmode");
  const CODE = "TRUCK-" + RAW,
    HOST = String(pick("h") || pick("host") || "")
      .replace(/[<>&"]/g, "")
      .trim()
      .slice(0, 16);
  const INV = { on: true, view: "pick", busy: false, joining: false };
  window.INV = INV;
  const css = `#invite{width:min(460px,90vw);margin:12px auto 6px;padding:16px 18px 12px;border-radius:16px;background:linear-gradient(180deg,rgba(22,30,46,.95),rgba(10,15,25,.95));border:1px solid rgba(245,184,46,.55);box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06);text-align:center;display:flex;flex-direction:column;gap:9px;cursor:default;box-sizing:border-box}
#invite .ib{align-self:center;font-size:11px;font-weight:900;letter-spacing:3px;color:#1a1205;background:linear-gradient(#ffd36a,#f5a915);padding:4px 12px;border-radius:20px}
#invite .it{font-size:24px;font-weight:900;color:#fff;line-height:1.15} #invite .it b{color:#f5b82e}
#invite .ic{font-size:12px;letter-spacing:2px;color:#7dff9a;font-weight:800;opacity:.85}
#invite .opts{display:flex;flex-direction:column;gap:8px}
#invite button{font:inherit;font-weight:900;font-size:16px;padding:12px;border-radius:12px;border:0;cursor:pointer;min-height:48px;color:#fff;background:#2b3444;display:flex;align-items:center;justify-content:center;gap:8px}
#invite button small{font-weight:600;opacity:.75;font-size:12px}
#invite .go{background:linear-gradient(#5fd17f,#1f9d55);font-size:20px;letter-spacing:1px;animation:none}
#invite .log{background:linear-gradient(#ffd36a,#f5a915);color:#1a1205} #invite .new{background:#2f81f7} #invite .gst{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22)}
#invite input{font-size:18px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#0b111d;color:#fff;text-align:center;min-height:46px;box-sizing:border-box;width:100%}
#invite input.pin{letter-spacing:10px;-webkit-text-security:disc}
#invite input:focus,#invite button:focus,#invite a:focus{outline:3px solid #7dff8a;outline-offset:2px}
#invite .im{font-size:13px;color:#cfe8d2;min-height:17px} #invite .im.e{color:#ff8a7a}
#invite .note{font-size:12px;opacity:.7}
#invite .row2{display:flex;gap:8px} #invite .row2>*{flex:1}
#invite a{color:#9fb3c8;font-size:13px;text-decoration:underline;cursor:pointer;align-self:center;padding:4px 8px}
#invite .spin{width:34px;height:34px;border-radius:50%;border:4px solid rgba(255,255,255,.15);border-top-color:#7dff9a;animation:invspin .9s linear infinite;align-self:center}
@keyframes invspin{to{transform:rotate(360deg)}}
html.invmode #lobby,html.invmode #acct,html.invmode #wbCard,html.invmode #overlay>.go{display:none!important}
#invite .home{position:absolute;left:10px;top:10px;font-size:12px;font-weight:800;min-height:0;padding:5px 10px;border-radius:9px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22)} #invite{position:relative}
@media (orientation:landscape) and (max-height:500px){ body.touch #overlay>#invite{grid-column:2;grid-row:1/span 5;align-self:center;width:min(46vw,440px);padding:10px 12px;gap:6px} body.touch #invite .it{font-size:19px} body.touch #invite button{min-height:40px;padding:8px} body.touch #invite .opts{gap:6px} }`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
  const esc = (s) => String(s || "").replace(/[<>&"]/g, "");
  let card = null;
  const $ = (id) => card.querySelector("#" + id);
  function msg(t, e) {
    const m = card && card.querySelector(".im");
    if (m) {
      m.textContent = t || "";
      m.className = "im" + (e ? " e" : "");
    }
  }
  function render() {
    if (!card) return;
    const who = HOST ? `Join <b>${esc(HOST)}</b>'s game` : `Join game <b>${CODE}</b>`;
    let body = "";
    const v = INV.view;
    if (v === "pick" && ACC.tok)
      body = `<div class="it" style="font-size:18px">Welcome back, <b>${esc(ACC.name)}</b></div><div class="opts"><button class="go" id="ivGo">\u25B6 JOIN GAME</button></div><div class="im"></div><a id="ivSwitch" tabindex="0">Not you? Use another account</a>`;
    else if (v === "pick")
      body = `<div class="opts"><button class="log" id="ivLog">\u{1F511} Log in <small>name + PIN</small></button><button class="new" id="ivNew">\u2728 Create account <small>free, 10 sec</small></button><button class="gst" id="ivGst">\u{1F464} Join as guest</button></div><div class="im"></div>`;
    else if (v === "log")
      body = `<input id="ivName" maxlength="16" placeholder="Username" autocomplete="username" autocapitalize="off" spellcheck="false"><input id="ivPin" class="pin" inputmode="numeric" maxlength="4" placeholder="PIN" autocomplete="off"><button class="go" id="ivSub">LOG IN &amp; JOIN</button><div class="im"></div><a id="ivBack" tabindex="0">\u2190 Back</a>`;
    else if (v === "new")
      body = `<input id="ivName" maxlength="16" placeholder="Pick a username" autocapitalize="off" spellcheck="false"><div class="row2"><input id="ivPin" class="pin" inputmode="numeric" maxlength="4" placeholder="PIN"><input id="ivPin2" class="pin" inputmode="numeric" maxlength="4" placeholder="Confirm"></div><div class="note">4-digit PIN. There's no recovery, so remember it!</div><button class="go" id="ivSub">CREATE &amp; JOIN</button><div class="im"></div><a id="ivBack" tabindex="0">\u2190 Back</a>`;
    else if (v === "gst")
      body = `<input id="ivName" maxlength="16" placeholder="Driver name" autocapitalize="off" spellcheck="false" value="${esc(localStorage.getItem("bigrig.name") || "")}"><div class="note">Guests can drive together, but progress isn't saved to an account.</div><button class="go" id="ivSub">JOIN AS GUEST</button><div class="im"></div><a id="ivBack" tabindex="0">\u2190 Back</a>`;
    else if (v === "wait")
      body = `<div class="spin"></div><div class="im">Connecting to ${esc(HOST || "the host")}\u2026</div><a id="ivCancel" tabindex="0">Cancel</a>`;
    else if (v === "err")
      body = `<div class="im e">${esc(INV.err)}</div><div class="opts"><button class="go" id="ivRetry">\u21BB TRY AGAIN</button></div>`;
    card.innerHTML = `<button class="home" id="ivHome">\u2302 Home</button><div class="ib">YOU'RE INVITED</div><div class="it">${who}</div>${HOST ? `<div class="ic">${CODE}</div>` : ""}${body}${v === "wait" ? "" : '<a id="ivSolo" tabindex="0">Not now, play solo</a>'}`;
    for (const p of card.querySelectorAll(".pin"))
      p.addEventListener("input", () => {
        p.value = p.value.replace(/\D/g, "").slice(0, 4);
      });
    const on = (id, f) => {
      const e = card.querySelector("#" + id);
      if (e)
        e.addEventListener("click", (ev) => {
          ev.preventDefault();
          f();
        });
    };
    on("ivGo", () => join(ACC.name));
    on("ivSwitch", () => {
      accClear();
      ACC.refresh && ACC.refresh();
      go("pick");
    });
    on("ivLog", () => go("log"));
    on("ivNew", () => go("new"));
    on("ivGst", () => go("gst"));
    on("ivBack", () => go("pick"));
    on("ivSub", submit);
    on("ivRetry", () => join(INV.name));
    on("ivCancel", () => {
      INV.joining = false;
      try {
        mpReset();
      } catch (e) {}
      go("pick");
    });
    on("ivSolo", () => {
      solo();
      startGame();
    });
    on("ivHome", solo);
    for (const i of card.querySelectorAll("input"))
      i.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const n =
            i.nextElementSibling && i.nextElementSibling.tagName === "INPUT"
              ? i.nextElementSibling
              : null;
          if (n && !n.value) n.focus();
          else submit();
        }
      });
    for (const a of card.querySelectorAll("a"))
      a.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          a.click();
        }
      });
    const f = card.querySelector("input,button.go,button");
    if (f && !(document.body.classList.contains("touch") && f.tagName === "INPUT"))
      setTimeout(() => f.focus(), 0);
  }
  function go(v) {
    INV.view = v;
    render();
  }
  async function submit() {
    if (INV.busy) return;
    const n = accNorm(($("ivName") || {}).value);
    if (!n) {
      msg("Enter a name first", 1);
      $("ivName").focus();
      return;
    }
    if (INV.view === "gst") {
      ACC.mode = "guest";
      join(n);
      return;
    }
    const p = ($("ivPin") || {}).value || "",
      p2 = ($("ivPin2") || {}).value || "";
    if (!/^\d{4}$/.test(p)) {
      msg("PIN must be 4 digits", 1);
      $("ivPin").focus();
      return;
    }
    if (INV.view === "new" && p !== p2) {
      msg("PINs don't match", 1);
      $("ivPin2").value = "";
      $("ivPin2").focus();
      return;
    }
    INV.busy = true;
    msg("\u2026");
    try {
      const c = await accRpc("name_check", { name: n });
      if (!c.ok) {
        msg(c.error, 1);
        INV.busy = false;
        return;
      }
      if (INV.view === "log" && !c.exists) {
        msg("No account called " + n + " \u2022 create one instead?", 1);
        INV.busy = false;
        return;
      }
      if (INV.view === "new" && c.exists) {
        msg("That name is taken \u2022 log in, or pick another", 1);
        INV.busy = false;
        return;
      }
      const j =
        INV.view === "log"
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
        $("ivPin").value = "";
        if ($("ivPin2")) $("ivPin2").value = "";
        INV.busy = false;
        return;
      }
      accSetSession(j);
      await accPull();
      ACC.refresh && ACC.refresh();
      INV.busy = false;
      join(ACC.name);
    } catch (e) {
      INV.busy = false;
      msg("Can't reach accounts \u2022 try again, or join as guest", 1);
    }
  }
  function join(name) {
    INV.name = name;
    try {
      localStorage.setItem("bigrig.name", name);
    } catch (e) {}
    if (typeof profUse === "function" && profUse(name)) return; // v67: own save per driver (the ?join link survives the reload)
    const nm = document.getElementById("lbName");
    if (nm) nm.value = name;
    if (typeof Peer === "undefined") {
      INV.err = "Multiplayer library unavailable \u2022 check your connection";
      go("err");
      return;
    }
    INV.joining = true;
    go("wait");
    const start = () => {
      if (!INV.joining) return;
      if (!world.ready || !document.getElementById("lbName")) {
        const p = document.getElementById("loadPct");
        msg("Loading the world" + (p ? " \u2022 " + p.textContent.split(" ")[0] : "") + "\u2026");
        setTimeout(start, 300);
        return;
      }
      document.getElementById("lbName").value = name;
      mpJoin(CODE);
    };
    start();
    const kick = setInterval(() => {
      if (!INV.joining) {
        clearInterval(kick);
        return;
      }
      if (MP.on && !started && world.ready) {
        startGame();
      }
      if (started) {
        clearInterval(kick);
        INV.joining = false;
        finish();
      }
    }, 250);
  }
  function finish() {
    INV.on = false;
    document.documentElement.classList.remove("invmode");
    if (card) card.remove();
    card = null;
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) {}
  }
  function solo() {
    INV.joining = false;
    try {
      if (MP.peer) mpReset();
    } catch (e) {}
    const cd = document.getElementById("lbCode");
    if (cd) cd.value = "";
    mpStatus("");
    finish();
  }
  INV.solo = solo;
  // surface mpJoin's status (it writes to the hidden lobby line) on the card
  const ms = mpStatus;
  mpStatus = function (t) {
    ms(t);
    if (!INV.on || !INV.joining || !card) return;
    t = String(t || "");
    if (!t) return;
    if (/not online|couldn't|Network error|unavailable/i.test(t) && !/retrying/i.test(t)) {
      INV.joining = false;
      INV.err = /not online/i.test(t)
        ? (HOST || "The host") +
          " isn't online right now \u2022 the game may have closed or the code expired."
        : /couldn't/i.test(t)
          ? "Found the game but couldn't connect \u2022 try Wi-Fi and try again."
          : t;
      try {
        mpReset();
      } catch (e) {}
      go("err");
    } else
      msg(
        /retrying/i.test(t)
          ? "Still looking for " + (HOST || "the host") + "\u2026"
          : "Connecting to " + (HOST || "the host") + "\u2026",
      );
  };
  // lobby can't start solo play behind the card (overlay tap, Enter, pad A) until the visitor joins or says "not now"
  setTimeout(() => {
    const sg = startGame;
    startGame = function () {
      if (INV.on && !MP.on) return;
      return sg.apply(this, arguments);
    };
  }, 0);
  function mount() {
    const ov = document.getElementById("overlay");
    if (!ov || card) return;
    card = document.createElement("div");
    card.id = "invite";
    const lg = document.getElementById("logo");
    if (lg && lg.nextSibling) ov.insertBefore(card, lg.nextSibling);
    else ov.appendChild(card);
    for (const ev of ["pointerdown", "click", "touchstart", "keydown"])
      card.addEventListener(ev, (e) => e.stopPropagation());
    render();
    // session check from accounts.js may clear a stale token after load: re-render the pick view if it changed
    let last = ACC.tok;
    setInterval(() => {
      if (INV.on && ACC.tok !== last) {
        last = ACC.tok;
        if (INV.view === "pick") render();
      }
    }, 400);
  }
  addEventListener("load", () => setTimeout(mount, 80));
  // Xbox: D-pad/stick moves focus through the card, A presses, B goes back
  let prev = [],
    ax = false;
  (function pp() {
    requestAnimationFrame(pp);
    if (!INV.on || !card) return;
    const gp = (navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : []).find(
      (g) => g && g.connected,
    );
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed),
      hit = (i) => b[i] && !prev[i];
    prev = b;
    const els = [...card.querySelectorAll("input,button,a")].filter((e) => e.offsetParent);
    let i = els.indexOf(document.activeElement);
    const mv = (d) => {
      i = i < 0 ? 0 : Math.max(0, Math.min(els.length - 1, i + d));
      els[i].focus();
    };
    const y = gp.axes[1] || 0;
    if (hit(13) || hit(15) || (y > 0.6 && !ax)) mv(1);
    if (hit(12) || hit(14) || (y < -0.6 && !ax)) mv(-1);
    ax = Math.abs(y) > 0.6;
    if (hit(0)) {
      if (i < 0) mv(0);
      else if (els[i].tagName !== "INPUT") els[i].click();
      else els[i].focus();
    }
    if (hit(1)) {
      const bk = card.querySelector("#ivBack");
      if (bk) bk.click();
    }
  })();
})();
