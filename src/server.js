/**
 * @file server.js — Public servers over Supabase Realtime (no host needed). Presence = player list + cap, Broadcast = poses.
 *   Home MULTIPLAYER card: SERVERS modal (list, count/cap, tap to join) + HOST GAME modal (PeerJS code, link, copy/share, players x/6).
 * Exposes (globals): SERVERS, SRV, srvLib, srvCount, srvPeek, CSS, srvCard, SM_CSS, smKind, smOpen, smClose,
 *   smHost, smLink, smRender, srvName, srvJoin,
 *   srvRate, srvSend, srvLeave, srvGone
 * Depends on: world.js, physics.js, depots.js, career.js, mp.js, main.js, accounts.js
 * Load order: #54 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== Public servers over Supabase Realtime (no host needed). Presence = player list + cap, Broadcast = poses.
// Free-plan quota: 100 Realtime events/s per project, where an event is a message sent OR delivered. N players at r Hz cost
// N*r sent + N*r*(N-1) delivered = N^2*r events/s, so r = budget/N^2 (budget 80/s keeps headroom for presence/chat/drops).
// Parked/idle trucks only send a heartbeat every 4 s, so real use is well below the ceiling.
const SERVERS = [{ id: "server-1", name: "Server 1", region: "UK" }];
const SRV = {
  cap: Math.max(1, Math.min(15, +(new URLSearchParams(location.search).get("srvcap") || 15))),
  budget: 80,
  sb: null,
  ch: null,
  peek: {},
  peekCh: {},
  cur: null,
  lastPose: null,
  lastSend: 0,
};
function srvLib() {
  if (SRV.lib) return SRV.lib;
  SRV.lib = new Promise((ok, no) => {
    if (window.supabase && window.supabase.createClient) return ok();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.onload = () => ok();
    s.onerror = () => {
      SRV.lib = null;
      no(new Error("lib"));
    };
    document.head.appendChild(s);
  }).then(() => {
    if (!SRV.sb)
      SRV.sb = window.supabase.createClient(ACC.url, ACC.key, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 20 } },
      });
    return SRV.sb;
  });
  return SRV.lib;
}
const srvCount = (st) => Object.keys(st || {}).length;
// ---- lightweight peek: a separate presence-only '<id>-lobby' channel (no position traffic reaches the home screen)
function srvPeek(S) {
  srvLib()
    .then((sb) => {
      if (SRV.peekCh[S.id]) return;
      const ch = sb.channel(S.id + "-lobby", {
        config: { presence: { key: "w" + Math.random().toString(36).slice(2, 9) } },
      });
      SRV.peekCh[S.id] = ch;
      ch.on("presence", { event: "sync" }, () => {
        const st = ch.presenceState();
        SRV.peek[S.id] = Object.values(st).filter((v) => v[0] && v[0].p).length;
        srvCard();
      });
      ch.subscribe((stt) => {
        if (stt === "SUBSCRIBED") {
          SRV.peek[S.id] = SRV.peek[S.id] || 0;
          srvCard();
        } else if (stt === "CHANNEL_ERROR" || stt === "TIMED_OUT") {
          SRV.peek[S.id] = -1;
          srvCard();
        }
      });
    })
    .catch(() => {
      SRV.peek[S.id] = -1;
      srvCard();
    });
}
const CSS = `#srvCard{width:min(440px,90vw);margin:4px auto;padding:10px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(22,30,46,.92),rgba(10,15,25,.92));border:1px solid rgba(41,182,255,.45);box-shadow:0 6px 18px rgba(0,0,0,.4);box-sizing:border-box;text-align:left}
#srvCard .sh{font-size:11px;letter-spacing:3px;font-weight:900;color:#7fd8ff;margin-bottom:6px;text-align:center}
#srvCard .sv{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05)}
#srvCard .sn{flex:1;font-weight:900;font-size:15px;color:#fff} #srvCard .sn small{display:block;font-weight:600;font-size:12px;opacity:.75}
#srvCard .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;background:#3ddc84;box-shadow:0 0 6px #3ddc84} #srvCard .dot.full{background:#ff5a4a;box-shadow:0 0 6px #ff5a4a} #srvCard .dot.off{background:#888;box-shadow:none}
#srvCard .ct{font-weight:900;font-variant-numeric:tabular-nums;color:#7dff9a;font-size:15px}
#srvCard button{font:inherit;font-weight:900;font-size:14px;letter-spacing:1px;border:0;border-radius:20px;padding:9px 18px;cursor:pointer;background:#2f81f7;color:#fff;min-height:40px} #srvCard button:disabled{background:#444;color:#aaa;cursor:default}
#srvCard button:focus{outline:3px solid #7dff8a;outline-offset:2px}`;
function srvCard() {
  const lb = document.getElementById("lobby");
  if (!lb) return;
  let c = document.getElementById("srvCard");
  if (!c) {
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    c = document.createElement("div");
    c.id = "srvCard";
    lb.insertBefore(c, lb.firstChild);
    for (const ev of ["pointerdown", "click", "keydown"])
      c.addEventListener(ev, (e) => e.stopPropagation());
    for (const S of SERVERS) srvPeek(S);
  }
  if (!c.firstChild)
    c.innerHTML =
      '<div class="sh">\u{1F310} MULTIPLAYER</div><div class="hbtns"><button id="hmSrv">\u{1F310} SERVERS</button><button id="hmHost" class="hh">\u{1F3AE} HOST GAME</button></div>';
  c.querySelector("#hmSrv").onclick = () => smOpen("srv");
  c.querySelector("#hmHost").onclick = () => smHost();
  smRender();
}
// ---- home modals: Servers list + Host game (PeerJS invite code, cap MP.max). Fixed overlay, phone-sized.
const SM_CSS = `#smBack{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) 10px}
#smBox{width:min(440px,94vw);max-height:92vh;overflow:auto;box-sizing:border-box;padding:14px 16px;border-radius:16px;background:linear-gradient(180deg,#18202f,#0d131e);border:1px solid rgba(41,182,255,.45);box-shadow:0 12px 36px rgba(0,0,0,.6);color:#fff;font:14px system-ui,sans-serif;display:flex;flex-direction:column;gap:10px;text-align:left}
#smBox h3{margin:0;font-size:18px;letter-spacing:2px;color:#7fd8ff;display:flex;align-items:center} #smBox h3 span{flex:1}
#smBox .x{background:rgba(255,255,255,.1);color:#fff;border:0;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer}
#smBox .sv{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,.06);cursor:pointer}
#smBox .sn{flex:1;font-weight:900;font-size:15px} #smBox .sn small{display:block;font-weight:600;font-size:12px;opacity:.75}
#smBox .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;background:#3ddc84} #smBox .dot.full{background:#ff5a4a} #smBox .dot.off{background:#888}
#smBox .ct{font-weight:900;color:#7dff9a;font-variant-numeric:tabular-nums}
#smBox button.b{font:inherit;font-weight:900;font-size:14px;border:0;border-radius:12px;padding:10px 14px;min-height:44px;cursor:pointer;background:#2f81f7;color:#fff} #smBox button.b:disabled{background:#444;color:#aaa}
#smBox button.b.go{background:linear-gradient(#ffd36a,#f5a915);color:#1a1205} #smBox button.b.g{background:rgba(255,255,255,.1)}
#smBox .code{font-size:30px;font-weight:900;letter-spacing:3px;color:#f5b82e;text-align:center}
#smBox .lk{font-size:12px;word-break:break-all;opacity:.85;background:rgba(0,0,0,.3);padding:8px;border-radius:8px;user-select:all}
#smBox .r2{display:flex;gap:8px} #smBox .r2>*{flex:1}
#smBox .pl div{padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.05);margin-top:4px}
#smBox .st{font-size:12px;opacity:.8;min-height:14px}
#smBox .cols{display:flex;flex-direction:column;gap:10px} #smBox .cl{display:flex;flex-direction:column;gap:8px;min-width:0}
@media (max-height:500px){#smBox{width:min(640px,96vw);padding:10px 12px;gap:8px} #smBox .cols{flex-direction:row} #smBox .cl{flex:1} #smBox .code{font-size:22px} #smBox button.b{min-height:40px;padding:8px}}
#smBox button:focus{outline:3px solid #7dff8a;outline-offset:2px}
#srvCard .hbtns{display:flex;gap:8px} #srvCard .hbtns button{flex:1} #srvCard button.hh{background:#f5a915;color:#1a1205} #lbHostBox{display:none!important}`;
let smKind = null;
function smOpen(k) {
  smKind = k;
  let bk = document.getElementById("smBack");
  if (!bk) {
    const st = document.createElement("style");
    st.textContent = SM_CSS;
    document.head.appendChild(st);
    bk = document.createElement("div");
    bk.id = "smBack";
    bk.innerHTML = '<div id="smBox"></div>';
    for (const ev of ["pointerdown", "click", "keydown"])
      bk.addEventListener(ev, (e) => e.stopPropagation());
    bk.addEventListener("click", (e) => {
      if (e.target === bk) smClose();
    });
    bk.addEventListener("keydown", (e) => {
      if (e.key === "Escape") smClose();
    });
    document.body.appendChild(bk);
  }
  bk.style.display = "flex";
  if (k === "srv") for (const S of SERVERS) srvPeek(S);
  smRender(true);
}
function smClose() {
  const bk = document.getElementById("smBack");
  if (bk) bk.style.display = "none";
  if (smKind === "host" && MP.on && MP.host && !started) mpLeave();
  smKind = null;
}
function smHost() {
  if (typeof Peer === "undefined") return mpStatus("Multiplayer library unavailable");
  const nm = srvName();
  if (!nm) return;
  localStorage.setItem("bigrig.name", nm);
  smOpen("host");
  if (!(MP.on && MP.host)) mpHost();
}
function smLink() {
  const base = location.href.split("?")[0].split("#")[0];
  return (
    base +
    "?join=" +
    MP.code +
    "&v=" +
    Date.now().toString(36).slice(-5) +
    "&h=" +
    encodeURIComponent(String(MP.name || "").slice(0, 16))
  );
}
function smRender(focus) {
  const bx = document.getElementById("smBox");
  if (!bx || !smKind || document.getElementById("smBack").style.display === "none") return;
  const e = (t) =>
    String(t || "").replace(
      /[<>&"]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
    );
  if (smKind === "srv") {
    bx.innerHTML =
      '<h3><span>\u{1F310} SERVERS</span><button class="x" id="smX">\u2715</button></h3>' +
      SERVERS.map((S) => {
        const n = SRV.peek[S.id],
          off = n === undefined || n < 0,
          full = !off && n >= SRV.cap;
        return `<div class="sv" data-s="${S.id}"><div class="sn">${S.name} (${S.region})<small><span class="dot ${off ? "off" : full ? "full" : ""}"></span>${n === undefined ? "Checking\u2026" : n < 0 ? "Offline" : full ? "FULL" : "Online"}</small></div><div class="ct">${off ? "\u2013" : n} / ${SRV.cap}</div><button class="b" data-s="${S.id}" ${full || n < 0 ? "disabled" : ""}>${full ? "FULL" : "JOIN"}</button></div>`;
      }).join("") +
      '<div class="st">Tap a server to join. Public servers run all the time.</div>';
    for (const r of bx.querySelectorAll(".sv"))
      r.onclick = () => {
        const b = r.querySelector("button");
        if (b.disabled) return;
        const S = SERVERS.find((x) => x.id === r.dataset.s);
        smClose();
        srvJoin(S);
      };
  } else {
    const up = MP.on && MP.host && MP.code,
      ps = Object.values(MP.players || {}),
      n = ps.length + 1;
    bx.innerHTML =
      '<h3><span>\u{1F3AE} HOST GAME</span><button class="x" id="smX">\u2715</button></h3>' +
      (up
        ? `<div class="cols"><div class="cl"><div style="font-size:11px;letter-spacing:2px;opacity:.7;text-align:center">INVITE CODE</div><div class="code">${e(MP.code)}</div><div class="lk" id="smLk">${e(smLink())}</div><div class="r2"><button class="b g" id="smCopy">\u{1F4CB} Copy link</button><button class="b g" id="smShare">\u{1F4E4} Share</button></div></div><div class="cl"><div style="font-weight:900">Players ${n} / ${MP.max}</div><div class="pl"><div>\u2B50 ${e(MP.name)} (you, host)</div>${ps.map((p) => `<div>\u{1F69A} ${e(p.n)}</div>`).join("")}</div></div></div>`
        : '<div class="code" style="font-size:18px">Opening room\u2026</div>') +
      `<div class="st" id="smSt"></div><div class="r2"><button class="b g" id="smCl">Close</button><button class="b go" id="smGo" ${up ? "" : "disabled"}>\u25B6 START</button></div>`;
    const st = (t) => (bx.querySelector("#smSt").textContent = t);
    if (up) {
      bx.querySelector("#smCopy").onclick = () => {
        const t = smLink();
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
          () => st("Invite link copied"),
          () => {
            const r = document.createRange();
            r.selectNodeContents(bx.querySelector("#smLk"));
            getSelection().removeAllRanges();
            getSelection().addRange(r);
            st("Link selected \u2014 copy it");
          },
        );
      };
      const sh = bx.querySelector("#smShare");
      if (!navigator.share) sh.style.display = "none";
      sh.onclick = () =>
        navigator
          .share({
            title: "Big Rig Truck Simulator",
            text: "Drive with me! Code " + MP.code,
            url: smLink(),
          })
          .catch(() => st("Share cancelled"));
      bx.querySelector("#smGo").onclick = () => {
        document.getElementById("smBack").style.display = "none";
        smKind = null;
        startGame();
      };
    }
    bx.querySelector("#smCl").onclick = smClose;
  }
  bx.querySelector("#smX").onclick = smClose;
  if (focus) {
    const f = bx.querySelector(
      smKind === "srv" ? ".sv button:not(:disabled)" : "#smGo:not(:disabled)",
    );
    (f || bx.querySelector("#smX")).focus();
  }
}
{
  const lh = mpLobbyHosted;
  mpLobbyHosted = function () {
    lh.apply(this, arguments);
    smRender(true);
  };
  const rd = mpRender;
  mpRender = function () {
    rd.apply(this, arguments);
    if (smKind === "host") smRender(false);
  };
}
function srvName() {
  if (typeof ACC !== "undefined" && ACC.tok && ACC.name) return ACC.name;
  let n = (
    (document.getElementById("lbName") || {}).value ||
    localStorage.getItem("bigrig.name") ||
    ""
  ).trim();
  if (!n) {
    n = (prompt("Driver name for " + SERVERS[0].name + " (guest)") || "").trim().slice(0, 16);
    if (n) {
      const i = document.getElementById("lbName");
      if (i) i.value = n;
    }
  }
  return n;
}
async function srvJoin(S) {
  if (MP.on || SRV.ch) return;
  const name = srvName();
  if (!name) {
    mpStatus("Log in, or pick a guest name, to join");
    return;
  }
  if (!world.ready) {
    mpStatus("Loading the world\u2026 try again in a moment");
    return;
  }
  try {
    localStorage.setItem("bigrig.name", name);
  } catch (e) {}
  mpStatus("Joining " + S.name + "\u2026");
  let sb;
  try {
    sb = await srvLib();
  } catch (e) {
    mpStatus("Couldn't load the server library \u2014 check your connection");
    return;
  }
  mpReset();
  const me = "s" + Math.random().toString(36).slice(2, 10);
  const ch = sb.channel(S.id, { config: { broadcast: { self: false }, presence: { key: me } } });
  SRV.ch = ch;
  SRV.cur = S;
  let joined = false;
  const meta = () => ({
    n: name.slice(0, 16),
    m: career.cur,
    c: career.colors[career.cur] || "",
    tr: truck.trl ? truck.trl.type : "",
  });
  ch.on("broadcast", { event: "p" }, ({ payload }) => {
    if (MP.srv && Array.isArray(payload)) mpOnMsg(payload, null);
  })
    .on("broadcast", { event: "m" }, ({ payload }) => {
      if (MP.srv && payload) mpOnMsg(payload, null);
    })
    .on("presence", { event: "sync" }, () => {
      const st = ch.presenceState();
      if (!joined) return;
      for (const id in st) {
        if (id === me) continue;
        const v = st[id][0] || {};
        if (!MP.players[id]) {
          MP.players[id] = mpNewPlayer(id, v.n);
          mpToast("\u{1F69A} " + (v.n || "Driver") + " joined");
        }
        MP.players[id].n = v.n || MP.players[id].n;
      }
      for (const id in MP.players) if (!st[id]) mpPlayerGone(id);
      srvRate();
      mpRender();
    });
  ch.subscribe(async (stt) => {
    if (stt === "SUBSCRIBED" && !joined) {
      // presence state arrives right after subscribe: wait briefly, then enforce the cap before tracking
      await new Promise((r) => setTimeout(r, 900));
      const n = srvCount(ch.presenceState());
      if (n >= SRV.cap) {
        mpStatus(S.name + " is FULL (" + n + " / " + SRV.cap + ") \u2014 try again soon");
        mpToast("\u26D4 " + S.name + " is full");
        sb.removeChannel(ch);
        SRV.ch = null;
        return;
      }
      joined = true;
      await ch.track(meta());
      const lc = SRV.peekCh[S.id];
      if (lc) lc.track({ p: 1 }).catch(() => {});
      Object.assign(MP, {
        on: true,
        srv: true,
        host: false,
        myId: me,
        name: name.slice(0, 16),
        code: S.name + " \u2022 " + S.region,
        ended: false,
      });
      srvRate();
      mpStatus("");
      mpLobbyClose();
      startGame();
      mpToast("Connected to " + S.name);
      mpRender();
      BigRig.emit("mpJoined", { id: me, server: S.id });
    } else if ((stt === "CHANNEL_ERROR" || stt === "TIMED_OUT") && !joined) {
      mpStatus("Couldn't reach " + S.name + " \u2014 try again");
      sb.removeChannel(ch);
      SRV.ch = null;
    } else if (stt === "CLOSED" && joined && MP.srv) {
      srvGone("Disconnected from " + S.name);
    }
  });
}
// send rate from the event budget: r = budget / N^2 (capped 10 Hz, floor 0.25 Hz); interpolation delay stretches to cover the gap
function srvRate() {
  const N = Math.max(1, srvCount(SRV.ch && SRV.ch.presenceState()));
  const hz = Math.max(0.25, Math.min(10, SRV.budget / (N * N)));
  MP.rate = 1 / hz;
  MP.delay = Math.max(130, 1250 / hz);
  SRV.hz = hz;
  SRV.n = N;
}
function srvSend(msg, pose) {
  const ch = SRV.ch;
  if (!ch || !MP.srv) return;
  if (Array.isArray(msg)) {
    // idle trucks: heartbeat every 4 s
    const now = performance.now(),
      lp = SRV.lastPose,
      still =
        Math.abs(msg[6]) < 0.05 &&
        lp &&
        Math.abs(lp[3] - msg[3]) < 0.05 &&
        Math.abs(lp[4] - msg[4]) < 0.05 &&
        lp[9] === msg[9] &&
        lp[10] === msg[10];
    if (still && now - SRV.lastSend < 4000) return;
    SRV.lastPose = msg;
    SRV.lastSend = now;
    ch.send({ type: "broadcast", event: "p", payload: msg });
    return;
  }
  ch.send({ type: "broadcast", event: "m", payload: msg });
}
function srvLeave() {
  const S = SRV.cur,
    ch = SRV.ch;
  MP.srv = false;
  SRV.ch = null;
  if (ch) {
    try {
      ch.untrack();
      SRV.sb.removeChannel(ch);
    } catch (e) {}
  }
  const lc = S && SRV.peekCh[S.id];
  if (lc) lc.untrack().catch(() => {});
  MP.srv = false;
  MP.rate = 1 / 20;
  MP.delay = 0;
  mpReset();
  mpRender();
  started = false;
  const ov = document.getElementById("overlay");
  if (ov) ov.classList.remove("hidden");
  mpLobbyOpen();
  mpStatus("Left " + (S ? S.name : "the server"));
  srvCard();
}
function srvGone(why) {
  mpToast(why);
  srvLeave();
  mpStatus(why + " \u2014 back home");
}
addEventListener("pagehide", () => {
  if (SRV.ch)
    try {
      SRV.ch.untrack();
    } catch (e) {}
});
// mount the card once the lobby exists (normal lobby only; the invite landing hides #lobby anyway)
(function wait() {
  if (document.getElementById("lobby")) srvCard();
  else setTimeout(wait, 300);
})();
window.__srv = SRV;
