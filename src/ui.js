/**
 * @file ui.js — UI: job board, dealership, results, tier unlock (DOM overlay inside #frame so it works in fullscreen)
 * Exposes (globals): UICSS, uiRoot, uiInit, uiBlocking, closeUI, openModal, esc, money, trlSVG,
 *   boardState, openBoard, renderBoard, startMission, renderSide, TRIG, trigFresh, trigUsed, trigReset,
 *   uiBoardFit (+9 more)
 * Depends on: physics.js, audio.js, depots.js, career.js, main.js
 * Load order: #16 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// v50: edge-triggered popups (yard sale, homes, dealers, depot / Black Market boards): a trigger zone only fires after the truck
// has *driven into* it. The first look after load, respawn or fast travel (trigReset) just records the zone it is in, so a save
// parked on a trigger never pops the card. key = the zone the truck is in (geometric, any speed) or null.
const TRIG = { gen: 0 };
function trigFresh(sys, key) {
  const T = TRIG[sys] || (TRIG[sys] = { k: undefined, arm: false, gen: -1 });
  if (T.gen !== TRIG.gen) {
    T.gen = TRIG.gen;
    T.k = key;
    T.arm = false;
    return false;
  }
  if (key !== T.k) {
    T.k = key;
    T.arm = key != null;
  }
  return T.arm;
}
function trigUsed(sys) {
  if (TRIG[sys]) TRIG[sys].arm = false;
}
function trigReset() {
  TRIG.gen++;
}
// ===================== v7 UI: job board, dealership, results, tier unlock (DOM overlay inside #frame so it works in fullscreen) =====================
const UICSS = `
#ui{position:absolute;inset:12px;pointer-events:none;z-index:6;border-radius:6px;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#ui *{box-sizing:border-box}
#ui canvas{background:transparent;border-radius:0;display:block}
#hudbtns{position:absolute;left:14px;top:206px;display:flex;flex-direction:column;gap:6px;pointer-events:auto}
.hb{background:linear-gradient(180deg,rgba(28,35,50,.92),rgba(12,16,26,.92));color:#fff;border:1px solid rgba(245,184,46,.55);border-radius:10px;padding:7px 12px;font-weight:800;font-size:12px;letter-spacing:.5px;cursor:pointer;display:flex;gap:7px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .15s,background .15s}
.hb:hover{transform:translateY(-1px);background:linear-gradient(180deg,#f5b82e,#d18f0c);color:#1b1205}
.hb kbd{background:rgba(255,255,255,.14);border-radius:4px;padding:0 5px;font-size:10px}
.mback{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(10,14,24,.55),rgba(4,6,12,.85));display:flex;align-items:center;justify-content:center;pointer-events:auto;opacity:0;transition:opacity .25s}
.mback.on{opacity:1}
.modal{width:916px;height:552px;background:linear-gradient(160deg,#1a2233 0%,#0f1522 60%,#0c1019 100%);border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);color:#e6edf3;display:flex;flex-direction:column;transform:translateY(18px) scale(.97);transition:transform .3s cubic-bezier(.2,.9,.3,1.2);overflow:hidden}
.mback.on .modal{transform:none}
.mh{display:flex;align-items:center;gap:14px;padding:14px 18px 10px;border-bottom:1px solid rgba(255,255,255,.06);background:linear-gradient(90deg,rgba(245,184,46,.12),transparent 55%)}
.mh h2{margin:0;font-size:20px;font-weight:900;letter-spacing:1.5px}
.mh .sub{font-size:12px;opacity:.65}
.mh .sp{flex:1}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:all .15s;color:#e6edf3}
.chip:hover{background:rgba(255,255,255,.12)} .chip.on{background:#f5b82e;color:#1b1205;border-color:#f5b82e}
.x{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;font-size:18px;cursor:pointer}
.x:hover{background:#da3633}
.bar{display:flex;gap:8px;align-items:center;padding:10px 18px}
.bar .lbl{font-size:11px;opacity:.55;text-transform:uppercase;letter-spacing:1px;margin-right:2px}
.body{display:flex;flex:1;min-height:0}
.grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px 12px 14px 18px;overflow-y:auto;align-content:start}
.grid::-webkit-scrollbar{width:8px} .grid::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}
.card{position:relative;display:flex;gap:10px;padding:10px;border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s;animation:cin .45s both}
.card:hover{transform:translateY(-2px);border-color:rgba(245,184,46,.5);box-shadow:0 8px 22px rgba(0,0,0,.35)}
.card.sel{border-color:#f5b82e;box-shadow:0 0 0 2px rgba(245,184,46,.35),0 10px 26px rgba(0,0,0,.4)}
@keyframes cin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.ill{width:84px;height:84px;border-radius:10px;flex:none;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.ill .em{font-size:38px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.4));z-index:1;margin-top:-14px}
.ill svg{position:absolute;bottom:4px;left:4px;width:76px}
.cinfo{flex:1;min-width:0}
.cn{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ct{font-size:11px;opacity:.65;margin:1px 0 5px}
.route{font-size:11.5px;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}
.route b{font-weight:700;overflow:hidden;text-overflow:ellipsis} .route i{color:#f5b82e;font-style:normal}
.meta{display:flex;gap:10px;margin-top:6px;font-size:11px;opacity:.85}
.pay{position:absolute;right:10px;top:9px;text-align:right}
.pay .m{font-size:16px;font-weight:900;color:#7dff9a} .pay .xp{font-size:11px;color:#ffd866;font-weight:700}
.tb{display:inline-block;font-size:10px;font-weight:900;padding:2px 7px;border-radius:10px;color:#0b1016;letter-spacing:.5px}
.card .tb{position:absolute;right:10px;bottom:10px}
.card.lock{cursor:not-allowed;filter:grayscale(.95) brightness(.6)} .card.lock:hover{transform:none;box-shadow:none;border-color:rgba(255,255,255,.08)}
.lockov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;letter-spacing:.5px;color:#fff;background:rgba(10,12,18,.62);border-radius:12px;text-shadow:0 2px 6px #000}
.side{width:300px;flex:none;border-left:1px solid rgba(255,255,255,.06);padding:10px 16px;display:flex;flex-direction:column;gap:7px;overflow:hidden;background:rgba(0,0,0,.15)}
.side canvas{display:block;width:268px;height:138px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#6e8aac}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;font-size:12px}
.kv div span{display:block;font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.8px}
.kv div b{font-size:13px}
.btn{border:none;border-radius:10px;padding:11px 14px;font-weight:900;font-size:14px;letter-spacing:.8px;cursor:pointer;transition:transform .12s,filter .12s;color:#1b1205;background:linear-gradient(180deg,#ffd166,#f5a50a);box-shadow:0 6px 18px rgba(245,165,10,.3)}
.btn:hover{transform:translateY(-1px);filter:brightness(1.08)} .btn:disabled{background:#3a414c;color:#8b949e;box-shadow:none;cursor:not-allowed;transform:none}
.btn.g{background:linear-gradient(180deg,#3ddc84,#1f9d55);color:#04150b} .btn.ghost{background:rgba(255,255,255,.07);color:#e6edf3;box-shadow:none;border:1px solid rgba(255,255,255,.12)}
.foot{display:flex;align-items:center;gap:10px;padding:8px 18px;border-top:1px solid rgba(255,255,255,.06);font-size:11.5px;opacity:.9}
.foot .sp{flex:1} .warn{color:#ff7b72}
.xpb{width:160px;height:8px;border-radius:4px;background:#222a36;overflow:hidden;display:inline-block;vertical-align:middle} .xpb i{display:block;height:100%;background:linear-gradient(90deg,#f5b82e,#ffdf7a)}
.result{width:520px;height:auto;padding:0}
.result .big{font-size:44px;font-weight:900;color:#7dff9a;text-align:center;margin:8px 0 0;text-shadow:0 4px 18px rgba(61,220,132,.35)}
.lines{padding:6px 24px;font-size:13px} .lines div{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,.08)}
.neg{color:#ff7b72} .pos{color:#7dff9a}
.celebrate{position:absolute;inset:0;pointer-events:auto;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center,rgba(40,30,8,.55),rgba(0,0,0,.85));opacity:0;transition:opacity .3s}
.celebrate.on{opacity:1}
.cbox{position:relative;z-index:1;text-align:center;transform:scale(.6);transition:transform .6s cubic-bezier(.2,1.4,.4,1)} .celebrate.on .cbox{transform:none}
.cbox .t1{font-size:16px;letter-spacing:8px;color:#ffd866;font-weight:800}
.cbox .t2{font-size:64px;font-weight:900;letter-spacing:3px;background:linear-gradient(180deg,#fff6c9,#f5b82e 60%,#b7790b);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 24px rgba(245,184,46,.5));margin:4px 0}
.cbox .t3{font-size:20px;font-weight:800;color:#fff}
.cbox ul{list-style:none;padding:0;margin:14px 0 18px;font-size:14px;color:#e6edf3} .cbox li{margin:5px 0} .cbox li:before{content:'\\2714  ';color:#3ddc84}
.badge{width:120px;height:120px;margin:0 auto 8px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:900;color:#0b1016;box-shadow:0 0 0 6px rgba(255,255,255,.15),0 0 60px rgba(245,184,46,.7);animation:spin 1.2s cubic-bezier(.2,.9,.3,1)}
@keyframes spin{from{transform:rotate(-200deg) scale(.2)}to{transform:none}}
#ui #confetti{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.show{display:flex;flex:1;min-height:0}
.tl{width:250px;flex:none;padding:10px 12px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:rgba(245,184,46,.55) transparent;border-right:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:7px}
.ti{display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;transition:all .15s;animation:cin .4s both}
.ti:hover{border-color:rgba(245,184,46,.5)} .ti.sel{border-color:#f5b82e;background:rgba(245,184,46,.1)}
#ui .ti canvas{width:34px!important;height:64px!important;flex:none;max-width:34px} .ti{flex:none;min-width:0} .ti.lock{opacity:.55} .ti .q{font-size:10px;font-weight:800;color:#ff8a7a} .tl::-webkit-scrollbar{width:6px;height:6px} .tl::-webkit-scrollbar-track{background:transparent} .tl::-webkit-scrollbar-thumb{background:rgba(245,184,46,.45);border-radius:6px} .ti .n{font-weight:800;font-size:13px} .ti .p{font-size:12px;color:#7dff9a;font-weight:700} .ti .o{font-size:10px;font-weight:900;color:#3ddc84;letter-spacing:1px}
.stage{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;padding:12px 16px}
.stage .floor{width:100%;height:250px;border-radius:14px;background:radial-gradient(ellipse at 50% 60%,#3b4a63 0%,#1b2333 55%,#0f1522 100%);position:relative;overflow:hidden}
.stage .floor canvas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg);animation:float 4s ease-in-out infinite;filter:drop-shadow(-14px 10px 10px rgba(0,0,0,.55))}
.stage .floor canvas.tt360{left:0;top:0;transform:none;animation:none;filter:none;width:100%;height:100%;touch-action:none}
@keyframes float{50%{transform:translate(-50%,-52%) rotate(92deg)}}
.stage .floor:after{content:'';position:absolute;left:50%;top:56%;width:340px;height:120px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse,rgba(255,255,255,.12),transparent 70%);pointer-events:none}
.stage h3{margin:10px 0 2px;font-size:22px;font-weight:900;letter-spacing:.5px}
.stats{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin-top:8px}
.st{font-size:11px} .st .l{display:flex;justify-content:space-between;opacity:.8} .st .b{height:7px;border-radius:4px;background:#222a36;margin-top:3px;overflow:hidden} .st .b i{display:block;height:100%;background:linear-gradient(90deg,#2f81f7,#7ee0ff);transition:width .5s}
.cols{display:flex;gap:8px;margin-top:10px} .sw{width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.3);cursor:pointer;transition:transform .15s} .sw:hover{transform:scale(1.15)} .sw.on{border-color:#fff;box-shadow:0 0 0 3px #f5b82e}
.buyrow{display:flex;gap:10px;align-items:center;margin-top:12px;width:100%}
.buyrow .price{font-size:24px;font-weight:900;color:#7dff9a;flex:1}
.nshort,.sub2{display:none}.wallet{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:99px;background:rgba(125,255,154,.1);border:1px solid rgba(125,255,154,.35);font-size:12px;font-weight:700;white-space:nowrap;color:#cfe}.wallet b{color:#7dff9a;font-size:15px}
.tlw{display:flex;flex-direction:column;min-height:0;min-width:0}.tlw .tl{flex:1}.tlh{display:none;font-size:11px;text-align:center;opacity:.7;padding:2px 0 4px}
body:not(.touch) .tl{gap:5px;padding:8px 10px} body:not(.touch) .tl .ti{padding:4px 8px} body:not(.touch) #ui .tl .ti canvas{width:22px!important;height:42px!important;max-width:22px}
.bigbuy{min-height:48px;font-size:16px;padding:0 22px} .need{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border-radius:10px;background:rgba(255,123,114,.12);border:1px solid rgba(255,123,114,.4)}.need b{color:#ff9b90;font-size:15px}.need span{font-size:11px;opacity:.8}
.padfocus{outline:3px solid #f5b82e!important;outline-offset:2px;box-shadow:0 0 0 6px rgba(245,184,46,.25)!important}
body:not(.padmode) .padhelp{display:none!important} body.padmode #help:not(.padhelp){display:none!important}
#ui .grid{overflow-x:hidden;min-width:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
/* v9 job board: 3-column cards, nothing absolutely positioned, detail bar with START MISSION */
#ui .grid{grid-template-columns:repeat(3,minmax(0,1fr));padding:4px 18px 12px}
#ui .card{flex-direction:column;gap:7px;padding:10px 11px}
#ui .ctop{display:flex;gap:10px;align-items:center;min-width:0}
#ui .ill{width:58px;height:58px} #ui .ill .em{font-size:26px;margin-top:-12px} #ui .ill svg{width:52px;bottom:3px;left:3px}
#ui .cn{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.2}
#ui .ct{margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ui .prow{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}
#ui .prow .m{font-size:17px;font-weight:900;color:#7dff9a} #ui .prow .xp{font-size:11.5px;color:#ffd866;font-weight:800} #ui .prow .tb{margin-left:auto;position:static}
#ui .rt{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 6px;font-size:11.5px;align-items:center}
#ui .rt span{font-size:9.5px;font-weight:900;letter-spacing:.6px;opacity:.55} #ui .rt b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
#ui .meta{flex-wrap:wrap;gap:4px 10px;margin:0} #ui .meta span{white-space:nowrap}
#ui .lockov{font-size:13px;text-align:center;padding:0 10px}
#ui .detail{display:flex;align-items:center;gap:16px;padding:10px 18px;border-top:1px solid rgba(245,184,46,.3);background:linear-gradient(90deg,rgba(245,184,46,.10),rgba(0,0,0,.2));min-height:78px}
#ui .detail .dic{font-size:34px} #ui .detail .dt{min-width:0;flex:1}
#ui .detail .dn{font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ui .detail .ds{font-size:12px;opacity:.85;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #ui .detail .ds i{color:#f5b82e;font-style:normal}
#ui .detail .dm{font-size:11.5px;opacity:.7;margin-top:2px}
#ui .btn.start{font-size:17px;padding:14px 26px;letter-spacing:1.5px;flex:none;background:linear-gradient(180deg,#3ddc84,#1f9d55);color:#04150b;box-shadow:0 6px 22px rgba(61,220,132,.35)}
#ui .btn.start kbd{background:rgba(0,0,0,.18);border-radius:5px;padding:1px 6px;margin-left:8px;font-size:12px}
.hb.ab{border-color:rgba(255,110,100,.6)} .hb.ab:hover{background:linear-gradient(180deg,#ff6b5b,#c0392b);color:#fff}
.toast{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:rgba(8,12,20,.9);border:1px solid rgba(245,184,46,.5);padding:8px 14px;border-radius:10px;font-weight:700;z-index:5;pointer-events:none;font-size:13px;pointer-events:none;animation:cin .3s both}
`;
let uiRoot = null;
function uiInit() {
  if (uiRoot) return;
  const st = document.createElement("style");
  st.textContent = UICSS;
  document.head.appendChild(st);
  uiRoot = document.createElement("div");
  uiRoot.id = "ui";
  document.getElementById("frame").appendChild(uiRoot);
  const hb = document.createElement("div");
  hb.id = "hudbtns";
  hb.innerHTML =
    '<button class="hb" id="bJobs">\u{1F4CB} JOBS <kbd>J</kbd></button><button class="hb ab" id="bAbandon" style="display:none">\u2715 ABANDON</button>';
  uiRoot.appendChild(hb);
  const ab = hb.querySelector("#bAbandon");
  ab.addEventListener("click", (e) => {
    e.stopPropagation();
    if (ab.dataset.arm) {
      abandonJob();
      delete ab.dataset.arm;
      ab.textContent = "\u2715 ABANDON";
      return;
    }
    ab.dataset.arm = 1;
    ab.textContent = "Click again to abandon";
    setTimeout(() => {
      delete ab.dataset.arm;
      ab.textContent = "\u2715 ABANDON";
    }, 3000);
  });
  hb.querySelector("#bJobs").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!started) return;
    openBoard();
  });
}
function uiBlocking() {
  return !!career.uiOpen || (typeof PM !== "undefined" && PM.on); // v69: pause menu (incl. its Map tab)
}
function closeUI() {
  const m = uiRoot && uiRoot.querySelector(".mback,.celebrate");
  career.uiOpen = null;
  for (const k in input) input[k] = false;
  if (m) {
    m.classList.remove("on");
    setTimeout(() => m.remove(), 260);
  }
}
function openModal(kind, html, cls) {
  uiInit();
  if (typeof bigmap !== "undefined" && bigmap.open && typeof closeMap === "function") closeMap();
  const old = uiRoot.querySelector(".mback,.celebrate");
  if (old) old.remove();
  career.uiOpen = kind;
  for (const k in input) input[k] = false;
  const b = document.createElement("div");
  b.className = "mback";
  b.innerHTML = `<div class="modal ${cls || ""}">${html}</div>`;
  uiRoot.appendChild(b);
  requestAnimationFrame(() => b.classList.add("on"));
  b.addEventListener("pointerdown", (e) => {
    if (e.target === b && kind !== "result") closeUI();
  });
  const x = b.querySelector(".x");
  if (x) x.addEventListener("click", closeUI);
  if (kind === "board" || kind === "bmboard" || kind === "armyboard" || kind === "pause") uiBoardFit(b.firstChild);
  return b;
}
// v50: desktop job boards (normal + Black Market) fill ~88% of the game area: the 916x552 card is zoomed (crisp text, bigger
// cards) to the #ui box, which matters in fullscreen where the frame is far bigger than the 984px core. Phones: unchanged.
const UI_BOARD_K = 0.88;
function uiBoardFit(m) {
  if (!m || !uiRoot || document.body.classList.contains("touch")) return;
  const w = uiRoot.clientWidth,
    h = uiRoot.clientHeight;
  if (!w || !h) return;
  const k = Math.max(1, Math.min((w * UI_BOARD_K) / 916, (h * UI_BOARD_K) / 552, 3));
  m.style.zoom = k.toFixed(3);
  m.dataset.k = k.toFixed(3);
}
addEventListener("resize", () => {
  if (typeof uiRoot === "undefined" || !uiRoot) return;
  const m = uiRoot.querySelector(".mback .modal");
  if (
    m &&
    (career.uiOpen === "board" || career.uiOpen === "bmboard" || career.uiOpen === "armyboard")
  )
    uiBoardFit(m);
});
document.addEventListener("fullscreenchange", () =>
  setTimeout(() => {
    const m = uiRoot && uiRoot.querySelector(".mback .modal");
    if (
      m &&
      (career.uiOpen === "board" || career.uiOpen === "bmboard" || career.uiOpen === "armyboard")
    )
      uiBoardFit(m);
  }, 60),
);
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const money = (n) => {
  n = +n || 0;
  const a = Math.abs(n),
    s = n < 0 ? "-" : "";
  if (a >= 1e9) {
    const v = a / 1e9;
    return (
      s + "\u00a3" + (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : +v.toFixed(1)) + "B"
    );
  }
  if (a >= 1e6) {
    const v = a / 1e6;
    return (
      s + "\u00a3" + (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : +v.toFixed(1)) + "M"
    );
  }
  if (a >= 10000) {
    const v = a / 1e3;
    return (
      s + "\u00a3" + (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : +v.toFixed(1)) + "k"
    );
  }
  return s + "\u00a3" + Math.round(a).toLocaleString("en-GB");
};
function trlSVG(type, col) {
  const body =
    {
      curtain: `<rect x="14" y="6" width="58" height="20" rx="2" fill="${col}"/><g stroke="rgba(0,0,0,.25)">${[22, 30, 38, 46, 54, 62].map((x) => `<line x1="${x}" y1="7" x2="${x}" y2="25"/>`).join("")}</g>`,
      box: `<rect x="14" y="5" width="58" height="21" rx="2" fill="#f4f4f4"/><rect x="14" y="20" width="58" height="3" fill="${col}"/>`,
      fridge: `<rect x="14" y="5" width="58" height="21" rx="2" fill="#eef3f8"/><rect x="10" y="9" width="5" height="10" fill="#4a4f57"/><text x="43" y="19" font-size="8" text-anchor="middle" fill="${col}" font-weight="900">\u2744 FRESH</text>`,
      cont: `<rect x="16" y="6" width="54" height="19" fill="${col}"/><g stroke="rgba(0,0,0,.3)">${[20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64].map((x) => `<line x1="${x}" y1="6" x2="${x}" y2="25"/>`).join("")}</g>`,
      tank: `<rect x="14" y="7" width="58" height="18" rx="9" fill="#dfe3e6"/><rect x="14" y="14" width="58" height="3" fill="${col}"/>`,
      flat: `<rect x="14" y="20" width="58" height="4" fill="#5b4a3a"/><rect x="20" y="12" width="44" height="8" fill="${col}"/>`,
    }[type] || "";
  return `<svg viewBox="0 0 80 34"><rect x="0" y="9" width="12" height="17" rx="2" fill="#d63b2f"/><rect x="2" y="11" width="6" height="6" fill="#9ec9e8"/>${body}<rect x="12" y="25" width="62" height="2" fill="#222"/>${[6, 52, 60, 68].map((x) => `<circle cx="${x}" cy="28" r="3.3" fill="#111"/>`).join("")}</svg>`;
}
// ---------- job board
const boardState = { filter: "all", sort: "near", sel: null };
function openBoard() {
  if (!started) return;
  if (typeof bmOpenBoard === "function" && bmOpenBoard()) return; // v46: at a Black Market yard -> its own board
  boardState.sort = "near";
  boardState.sel = null;
  if (!world.malls || !world.malls.length) return;
  fillBoard();
  const T_ = tierInfo(career.tier),
    lv = levelOf(career.xp),
    a0 = levelNeed(lv),
    a1 = levelNeed(lv + 1);
  const tiers = TIERS.map(
    (t) => `<span class="chip" data-f="${t.tier}">Tier ${t.tier}</span>`,
  ).join("");
  const b = openModal(
    "board",
    `<div class="mh"><div style="font-size:28px">\u{1F4CB}</div><div><h2>JOB BOARD</h2><div class="sub">Deliveries to shopping malls, retail parks &amp; supermarkets \u2022 pick up at depots, docks &amp; warehouses</div></div><div class="sp"></div>
    <div style="text-align:right;font-size:12px"><span class="tb" style="background:${T_.color}">TIER ${career.tier}</span> <b>${esc(T_.name)}</b> \u2022 Lv ${lv}<br><span class="xpb"><i style="width:${Math.min(100, ((career.xp - a0) / (a1 - a0)) * 100)}%"></i></span> <span style="opacity:.7">${career.xp} XP</span></div><button class="x">\u2715</button></div>
    <div class="bar"><span class="lbl">Show</span><span class="chip" data-f="all">All</span><span class="chip" data-f="avail">Available</span>${tiers}<div style="flex:1"></div><span class="lbl">Sort</span><span class="chip" data-s="near" title="Nearest pickup first (N)">\u{1F4CD} Nearest</span><span class="chip" data-s="pay">\u{1F4B7} Pay</span><span class="chip" data-s="km">\u{1F4CF} Distance</span><span class="chip" data-s="xp">\u2B50 XP</span></div>
    <div class="body"><div class="grid"></div></div><div class="detail"></div>
    <div class="foot"><span>\u{1F4B0} ${money(truck.money)}</span><span>\u2714 ${career.done} jobs \u2022 ${money(career.earned)} earned</span>${career.active ? `<span style="color:#ffd866">Active: ${esc(career.active.job.cargo.name)} \u2192 ${esc(career.active.job.to.name)}</span><button class="chip" id="abandon">Abandon job</button>` : ""}<span class="sp"></span><button class="chip" id="reset">\u21BA Reset progress</button></div>`,
  );
  b.querySelectorAll("[data-f]").forEach((c) =>
    c.addEventListener("click", () => {
      boardState.filter = c.dataset.f;
      renderBoard();
    }),
  );
  b.querySelectorAll("[data-s]").forEach((c) =>
    c.addEventListener("click", () => {
      boardState.sort = c.dataset.s;
      renderBoard();
    }),
  );
  const ab = b.querySelector("#abandon");
  if (ab)
    ab.addEventListener("click", () => {
      abandonJob();
      closeUI();
    });
  const rs = b.querySelector("#reset");
  rs.addEventListener("click", () => {
    if (rs.dataset.arm) {
      resetGame();
      return;
    }
    rs.dataset.arm = 1;
    rs.textContent = "Click again to wipe save";
    rs.classList.add("warn");
    setTimeout(() => {
      delete rs.dataset.arm;
      rs.textContent = "\u21BA Reset progress";
      rs.classList.remove("warn");
    }, 3000);
  });
  b.addEventListener("keydown", (e) => {});
  renderBoard();
}
function renderBoard() {
  const b = uiRoot && uiRoot.querySelector(".mback");
  if (!b || career.uiOpen !== "board") return;
  const g = b.querySelector(".grid");
  b.querySelectorAll("[data-f]").forEach((c) =>
    c.classList.toggle("on", c.dataset.f === boardState.filter),
  );
  b.querySelectorAll("[data-s]").forEach((c) =>
    c.classList.toggle("on", c.dataset.s === boardState.sort),
  );
  let js = career.jobs.slice();
  const f = boardState.filter;
  if (f === "avail") js = js.filter((j) => j.tier <= career.tier);
  else if (f !== "all") js = js.filter((j) => j.tier === +f);
  const away = (j) => Math.hypot(j.from.entrance.x - truck.x, j.from.entrance.y - truck.y);
  for (const j of js) j.away = away(j);
  js.sort((a, b2) =>
    boardState.sort === "near"
      ? (a.tier > career.tier) - (b2.tier > career.tier) || a.away - b2.away
      : boardState.sort === "km"
        ? a.km - b2.km
        : boardState.sort === "xp"
          ? b2.xp - a.xp
          : b2.pay - a.pay,
  );
  if (!boardState.sel || !js.includes(boardState.sel))
    boardState.sel = js.find((j) => j.tier <= career.tier) || js[0] || null;
  g.innerHTML =
    js
      .map((j, i) => {
        const lock = j.tier > career.tier,
          T_ = tierInfo(j.tier),
          c = j.cargo;
        return `<div class="card ${lock ? "lock" : ""} ${j === boardState.sel ? "sel" : ""}" data-j="${j.id}" style="animation-delay:${i * 30}ms">
      <div class="ctop"><div class="ill" style="background:linear-gradient(145deg,${c.col},${shade(c.col, 0.45)})"><span class="em">${c.icon}</span>${trlSVG(c.trl, shade(c.col, 1.3))}</div>
      <div class="cinfo"><div class="cn" title="${esc(c.name)}">${esc(c.name)}</div>${j.band === "long" ? `<span style="display:inline-block;font-size:9.5px;font-weight:900;letter-spacing:.5px;background:#7c3aed;color:#fff;border-radius:4px;padding:1px 5px;margin:2px 4px 0 0">LONG HAUL \u2022 ${j.km.toFixed(0)} km \u2022 ~${j.mins} min</span>` : j.band === "local" ? '<span style="display:inline-block;font-size:9.5px;font-weight:900;background:#0e7490;color:#fff;border-radius:4px;padding:1px 5px;margin:2px 4px 0 0">LOCAL</span>' : ""}${j.repeat ? `<span style="display:inline-block;font-size:9.5px;font-weight:900;background:#b45309;color:#fff;border-radius:4px;padding:1px 5px;margin-top:2px">\u21BB REPEAT${j.repeat > 1 ? " \u00d7" + j.repeat : ""}</span>` : ""}<div class="ct">${esc(TRAILER_TYPES[c.trl].name)} \u2022 ${(j.weight / 1000).toFixed(1)} t</div></div></div>
      <div class="prow"><span class="m">${money(j.pay)}</span><span class="xp">+${j.xp} XP</span><span class="aw" style="font-size:11px;opacity:.8">\u{1F4CD} ${(j.away / 1000).toFixed(1)} km away</span><span class="tb" style="background:${T_.color}">TIER ${j.tier}</span></div>
      <div class="rt"><span>FROM</span><b title="${esc(j.from.name)}">${esc(j.from.name)}</b><span>TO</span><b title="${esc(j.to.name)}">${esc(j.to.name)}</b></div>
      <div class="meta"><span>\u{1F4CD} ${j.approx ? "~" : ""}${j.km.toFixed(1)} km</span><span>\u23F1 ${j.mins} min</span><span>\u{1F5FA} ${esc(j.to.region)}</span></div>
      ${lock ? `<div class="lockov">\u{1F512} Tier ${j.tier} required</div>` : ""}</div>`;
      })
      .join("") || '<div style="opacity:.6;padding:20px">No jobs match this filter.</div>';
  g.querySelectorAll(".card").forEach((el) =>
    el.addEventListener("click", () => {
      const j = career.jobs.find((x) => x.id === el.dataset.j);
      if (!j || j.tier > career.tier) return;
      if (boardState.sel === j && el.classList.contains("sel") && el.dataset.armed) {
        startMission(j);
        return;
      }
      boardState.sel = j;
      g.querySelectorAll(".card").forEach((e2) => {
        e2.classList.toggle("sel", e2 === el);
        delete e2.dataset.armed;
      });
      setTimeout(() => {
        el.dataset.armed = 1;
      }, 0);
      renderSide();
    }),
  );
  renderSide();
}
function startMission(j) {
  career.blockMsg = null;
  let ok = false;
  try {
    ok = acceptJob(j);
  } catch (e) {
    console.error("startMission failed", e);
    career.blockMsg = "Couldn't start this job (" + String((e && e.message) || e) + ")";
  }
  if (ok) {
    closeUI();
    BigRig.emit("missionStart", { job: j });
    return true;
  }
  // v44: a refused start used to flash on the canvas HUD, hidden behind the board, so the button seemed dead
  uiStartBlocked(career.blockMsg || "This job can't be started right now");
  return false;
}
function uiStartBlocked(msg) {
  const b = uiRoot && uiRoot.querySelector("#accept");
  if (!b) return;
  let n = uiRoot.querySelector("#acceptMsg");
  if (!n) {
    n = document.createElement("div");
    n.id = "acceptMsg";
    n.style.cssText =
      "margin:6px 0 0;padding:8px 12px;border-radius:8px;background:#7f1d1d;color:#fff;font:700 13px system-ui;text-align:center";
    b.insertAdjacentElement("afterend", n);
  }
  n.textContent = "\u26A0 " + msg;
}
function renderSide() {
  const b = uiRoot.querySelector(".mback");
  const sd = b && b.querySelector(".detail");
  if (!sd) return;
  const j = boardState.sel;
  if (!j) {
    sd.innerHTML = '<div style="opacity:.6">Select a job to see the details</div>';
    return;
  }
  jobRoute(j);
  const lock = j.tier > career.tier,
    c = j.cargo;
  sd.innerHTML = `<div class="dic">${c.icon}</div><div class="dt"><div class="dn">${esc(c.name)} <span style="font-size:12px;opacity:.6;font-weight:700">\u2022 ${esc(TRAILER_TYPES[c.trl].name)} \u2022 ${(j.weight / 1000).toFixed(1)} t</span></div>
    <div class="ds"><b>1</b> Pick up at <b>${esc(j.from.name)}</b> <i>\u2192</i> <b>2</b> Deliver to <b>${esc(j.to.name)}</b></div>
    <div class="dm">\u{1F4CD} ${j.km.toFixed(1)} km \u2022 \u23F1 ${j.mins} min \u2022 <b style="color:#7dff9a">${money(j.pay)}</b> \u2022 <b style="color:#ffd866">+${j.xp} XP</b>${career.active ? ' \u2022 <span class="warn">replaces your current mission</span>' : ""}</div></div>
    <button class="btn start" id="accept" ${lock ? "disabled" : ""}>${lock ? "\u{1F512} TIER " + j.tier + " REQUIRED" : "\u25B6 START MISSION"}${lock ? "" : "<kbd>" + (pad.active ? GLYPH.A : "Enter") + "</kbd>"}</button>`;
  sd.querySelector("#accept").addEventListener("click", () => startMission(j));
  const r = b.querySelectorAll(".card");
  r.forEach((el) => {
    if (el.dataset.j === j.id) {
      const m = el.querySelector(".meta span");
      if (m) m.textContent = "\u{1F4CD} " + j.km.toFixed(1) + " km";
      const p = el.querySelector(".prow .m");
      if (p) p.textContent = money(j.pay);
      const x = el.querySelector(".prow .xp");
      if (x) x.textContent = "+" + j.xp + " XP";
    }
  });
}
addEventListener(
  "keydown",
  (e) => {
    if (
      career.uiOpen === "board" &&
      (e.code === "Enter" || e.code === "NumpadEnter") &&
      boardState.sel
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      startMission(boardState.sel);
    }
  },
  true,
);
function drawPreview(cv2, j) {
  const g = cv2.getContext("2d"),
    W = cv2.width,
    H = cv2.height;
  const p = j.path;
  const pts = [
    [j.from.entrance.x / M_T, j.from.entrance.y / M_T],
    [j.to.entrance.x / M_T, j.to.entrance.y / M_T],
    [truck.x / M_T, truck.y / M_T],
  ];
  if (p) for (let k = 0; k < p.length; k += 8) pts.push([p[k] % MW, (p[k] / MW) | 0]);
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  for (const q of pts) {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  const pad = 40,
    sc = Math.min((W - 20) / (x1 - x0 + pad * 2), (H - 20) / (y1 - y0 + pad * 2)),
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  const X = (t) => W / 2 + (t - cx) * sc,
    Y = (t) => H / 2 + (t - cy) * sc;
  g.fillStyle = "#6e8aac";
  g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = true;
  g.drawImage(MINIMAP, X(0), Y(0), MW * sc, MH * sc);
  g.fillStyle = "rgba(8,12,20,0.18)";
  g.fillRect(0, 0, W, H);
  if (p) {
    g.lineJoin = "round";
    g.lineCap = "round";
    for (const [w, col] of [
      [10, "rgba(0,0,0,0.45)"],
      [6, "#ff3df0"],
    ]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      for (let k = 0; k < p.length; k += 3) {
        const i = p[k];
        const px = X((i % MW) + 0.5),
          py = Y(((i / MW) | 0) + 0.5);
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
  }
  const pin = (x, y, c, t) => {
    g.fillStyle = "rgba(0,0,0,.4)";
    g.beginPath();
    g.arc(X(x) + 2, Y(y) + 2, 12, 0, 7);
    g.fill();
    g.fillStyle = c;
    g.beginPath();
    g.arc(X(x), Y(y), 12, 0, 7);
    g.fill();
    g.strokeStyle = "#fff";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#fff";
    g.font = "bold 13px system-ui";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(t, X(x), Y(y) + 1);
  };
  pin(j.from.entrance.x / M_T, j.from.entrance.y / M_T, "#2f81f7", "A");
  pin(j.to.entrance.x / M_T, j.to.entrance.y / M_T, "#d6336c", "B");
  g.fillStyle = "#ffdd33";
  g.beginPath();
  g.arc(X(truck.x / M_T), Y(truck.y / M_T), 7, 0, 7);
  g.fill();
  g.strokeStyle = "#000";
  g.lineWidth = 2;
  g.stroke();
}
// ---------- delivery result
function showResult(r, bay) {
  const b = openModal(
    "result",
    `<div class="mh"><div style="font-size:28px">\u2705</div><div><h2>DELIVERY COMPLETE</h2><div class="sub">${esc(r.job.cargo.name)} \u2192 ${esc(r.job.to.name)} \u2022 bay ${bay.id}</div></div><div class="sp"></div></div>
   <div class="big">+${money(r.total)}</div><div style="text-align:center;color:#ffd866;font-weight:800">+${r.xp} XP</div>
   <div class="lines">${r.lines.map((l) => `<div><span>${esc(l[0])}</span><b class="${l[1] < 0 ? "neg" : "pos"}">${l[1] < 0 ? "-" : "+"}${money(Math.abs(l[1]))}</b></div>`).join("")}<div><span><b>Total</b></span><b>${money(r.total)}</b></div></div>
   <div style="padding:6px 24px 4px;font-size:12px;opacity:.75">The trailer is empty. Leave it at the dock, or keep it coupled?</div>
   <div style="display:flex;gap:10px;padding:10px 24px 20px"><button class="btn ghost" id="keep" style="flex:1">Keep trailer</button><button class="btn g" id="leave" style="flex:1">Leave trailer at dock</button></div>`,
    "result",
  );
  b.querySelector("#leave").addEventListener("click", () => {
    closeUI();
    if (truck.trl) {
      uncouple();
      bay.parked = truck.trl || true;
    }
    setTimeout(() => {
      if (career.pendingTier) celebrateTier(career.pendingTier);
    }, 300);
  });
  b.querySelector("#keep").addEventListener("click", () => {
    closeUI();
    setTimeout(() => {
      if (career.pendingTier) celebrateTier(career.pendingTier);
    }, 300);
  });
}
// ---------- tier unlock celebration
function celebrateTier(t) {
  uiInit();
  if (career.uiOpen === "result") {
    career.pendingTier = t;
    return;
  }
  career.pendingTier = null;
  const T_ = tierInfo(t);
  const old = uiRoot.querySelector(".mback,.celebrate");
  if (old) old.remove();
  career.uiOpen = "tier";
  const d = document.createElement("div");
  d.className = "celebrate";
  d.innerHTML = `<canvas id="confetti" width="960" height="600"></canvas><div class="cbox"><div class="badge" style="background:radial-gradient(circle at 35% 30%,#fff,${T_.color} 60%)">${t}</div><div class="t1">NEW TIER UNLOCKED</div><div class="t2">TIER ${t}</div><div class="t3">${esc(T_.name)}</div><ul>${T_.perks.map((p) => `<li>${esc(p)}</li>`).join("")}</ul><button class="btn">LET'S ROLL</button></div>`;
  uiRoot.appendChild(d);
  requestAnimationFrame(() => d.classList.add("on"));
  d.querySelector(".btn").addEventListener("click", closeUI);
  fanfare();
  BigRig.emit("celebrate", { tier: t });
  const cv2 = d.querySelector("#confetti"),
    g = cv2.getContext("2d");
  const P = [];
  for (let i = 0; i < 220; i++)
    P.push({
      x: 480 + (Math.random() - 0.5) * 80,
      y: 300,
      vx: (Math.random() - 0.5) * 18,
      vy: -6 - Math.random() * 14,
      r: Math.random() * 6,
      c: ["#f5b82e", "#ff5a8a", "#3ddc84", "#2f81f7", "#fff", "#a371f7"][i % 6],
      a: Math.random() * 6,
      s: 3 + Math.random() * 5,
    });
  let n = 0;
  (function anim() {
    if (!d.isConnected || n++ > 420) return;
    g.clearRect(0, 0, 960, 600);
    for (const p of P) {
      p.vy += 0.28;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += 0.2;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.a);
      g.fillStyle = p.c;
      g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    requestAnimationFrame(anim);
  })();
}
function fanfare() {
  const c = audio.ctx;
  if (!c || !audio.master) return;
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.12);
    g.gain.linearRampToValueAtTime(0.18, t + i * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + (i === 3 ? 0.9 : 0.3));
    o.connect(g);
    g.connect(audio.master);
    o.start(t + i * 0.12);
    o.stop(t + i * 0.12 + 1);
  });
}
// ---------- dealership
const dealerState = { sel: null, col: null, dealer: null };
function openDealer(d) {
  if (!started) return;
  dealerState.dealer = d || dealerState.dealer;
  dealerState.sel = dealerState.sel || career.cur;
  openModal(
    "dealer",
    `<div class="mh"><div style="font-size:28px">\u{1F69B}</div><div class="mht"><h2><span class="nfull">${esc((d && d.name) || "BIG RIG TRUCKS")}</span><span class="nshort">${/ \u2022 Garage$/.test((d && d.name) || "") ? "Garage" : esc((d && d.name) || "BIG RIG TRUCKS")}</span></h2>${/ \u2022 Garage$/.test((d && d.name) || "") ? `<div class="sub2">${esc(d.name.replace(/ \u2022 Garage$/, ""))}</div>` : ""}<div class="sub">Showroom \u2022 buy, paint and swap your tractor unit</div></div><div class="sp"></div><div class="wallet" title="Your bank balance">\u{1F45B} Bank <b id="cash">${money(truck.money)}</b></div><button class="x" aria-label="Close">\u2715</button></div>
   <div class="show"><div class="tlw"><div class="tl"></div><div class="tlh">swipe for more trucks</div></div><div class="stage"></div></div>`,
  );
  renderDealer();
}
function renderDealer(stageOnly) {
  const b = uiRoot.querySelector(".mback");
  if (!b || career.uiOpen !== "dealer") return;
  const tl = b.querySelector(".tl"),
    stg = b.querySelector(".stage");
  b.querySelector("#cash").textContent = money(truck.money);
  if (!stageOnly) {
    tl.innerHTML = TRUCK_MODELS.map((m, i) => {
      const own = career.owned.includes(m.id);
      return `<div class="ti ${dealerState.sel === m.id ? "sel" : ""} ${!own && truck.money < m.price ? "lock" : ""}" data-m="${m.id}" style="animation-delay:${i * 50}ms"><canvas width="68" height="128"></canvas><div><div class="n">${esc(m.name)}</div>${own ? `<div class="o">${career.cur === m.id ? "\u25CF DRIVING" : "OWNED"}</div>` : `<div class="p">${money(m.price)}</div>${truck.money < m.price ? `<div class="q">\u{1F512} Need ${money(m.price - truck.money)} more</div>` : ""}`}<div style="font-size:10px;opacity:.6">${m.hp} hp \u2022 ${Math.round(m.vmax * 2.23694)} mph</div></div></div>`;
    }).join("");
    tl.querySelectorAll(".ti").forEach((el, i) => {
      const m = TRUCK_MODELS[i];
      const a = modelArt(m, career.colors[m.id] || m.cols[0]);
      const g = el.querySelector("canvas").getContext("2d");
      const s = Math.min(60 / a.W, 120 / a.H);
      g.drawImage(a.c, 34 - (a.W * s) / 2, 64 - (a.H * s) / 2, a.W * s, a.H * s);
      el.addEventListener("click", () => {
        if (dealerState.sel === m.id) return;
        dealerState.sel = m.id;
        dealerState.col = null;
        tl.querySelectorAll(".ti").forEach((e) => e.classList.toggle("sel", e === el));
        renderDealer(true);
      });
    });
  }
  const m = modelById(dealerState.sel),
    own = career.owned.includes(m.id),
    col = dealerState.col || career.colors[m.id] || m.cols[0],
    a = modelArt(m, col);
  const mx = { hp: 750, vmax: 28, tank: 800 },
    econ = (v) => Math.round(36 * v);
  const tt360 = typeof ttShowroom === "function";
  stg.innerHTML = `<div class="floor">${tt360 ? '<canvas class="tt360" style="width:100%;height:100%;min-height:180px;cursor:grab"></canvas><div style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:10px;opacity:.55;pointer-events:none">drag / right stick / Z X to turn</div>' : `<canvas width="${a.W}" height="${a.H}" style="width:${a.W * 1.45}px;height:${a.H * 1.45}px"></canvas>`}</div><h3>${esc(m.name)}</h3><div style="font-size:12px;opacity:.7">${esc(m.blurb)}</div>
   <div class="stats">${[
     ["Power", m.hp + " hp", m.hp / mx.hp],
     ["Top speed", Math.round(m.vmax * 2.23694) + " mph", m.vmax / mx.vmax],
     ["Fuel tank", m.tank + " L", m.tank / mx.tank],
     ["Economy", econ(m.econ) + " L/100 km", 1.25 - m.econ * 0.75],
   ]
     .map(
       (s) =>
         `<div class="st"><div class="l"><span>${s[0]}</span><b>${s[1]}</b></div><div class="b"><i style="width:${Math.max(6, Math.min(100, s[2] * 100))}%"></i></div></div>`,
     )
     .join("")}</div>
   ${own ? `<div class="cols" style="display:flex;align-items:center;gap:8px;font-size:12px;opacity:.85">${career.cur === m.id && typeof czOpen === "function" ? '<button class="btn" id="repaint">\u{1F3A8} Repaint in the paint shop</button>' : "<span>\u{1F3A8} Drive this truck, then repaint it in the paint shop</span>"}</div>` : `<div class="cols">${m.cols.map((c) => `<div class="sw ${c === col ? "on" : ""}" data-c="${c}" style="background:${c}"></div>`).join("")}</div>`}
   <div class="buyrow"><div class="price">${own ? "Owned" : money(m.price)}</div>${own ? (career.cur === m.id && col === (career.colors[m.id] || m.cols[0]) ? '<button class="btn ghost bigbuy" disabled>\u2713 Currently driving</button>' : `<button class="btn g bigbuy" id="use">${career.cur === m.id ? "Apply colour" : "DRIVE THIS TRUCK"}</button>`) : truck.money < m.price ? `<div class="need"><b>\u{1F512} Need ${money(m.price - truck.money)} more</b><span>You have ${money(truck.money)} in the bank \u2022 earn it by delivering</span></div>` : `<button class="btn bigbuy" id="buy">BUY \u2022 ${money(m.price)}</button>`}</div>`;
  if (tt360)
    ttShowroom(stg.querySelector(".floor canvas"), () => {
      const mm = modelById(dealerState.sel);
      return {
        m: mm,
        col: dealerState.col || career.colors[mm.id] || mm.cols[0],
        fit: career.owned.includes(mm.id) && typeof czFitted === "function" ? czFitted(mm.id) : {},
      };
    });
  else stg.querySelector(".floor canvas").getContext("2d").drawImage(a.c, 0, 0);
  stg.querySelectorAll(".sw").forEach((el) =>
    el.addEventListener("click", () => {
      dealerState.col = el.dataset.c;
      renderDealer();
    }),
  );
  const rp = stg.querySelector("#repaint");
  if (rp)
    rp.addEventListener("click", () => {
      closeUI();
      CZ.tab = "paint";
      setTimeout(() => czOpen(), 60);
    });
  const bu = stg.querySelector("#buy");
  if (bu) bu.addEventListener("click", () => buyTruck(m.id, col));
  const us = stg.querySelector("#use");
  if (us)
    us.addEventListener("click", () => {
      applyModel(m.id, col);
      saveGame();
      toast("Now driving: " + m.name);
      renderDealer();
    });
}
function buyTruck(id, col) {
  const m = modelById(id);
  if (career.owned.includes(id)) return false;
  if (truck.money < m.price) {
    toast("Not enough cash");
    return false;
  }
  truck.money -= m.price;
  career.owned.push(id);
  applyModel(id, col);
  saveGame();
  BigRig.emit("truckBought", { model: id, price: m.price });
  toast("\u{1F389} Bought " + m.name + " \u2014 enjoy the drive!");
  if (career.uiOpen === "dealer") renderDealer();
  return true;
}
function toast(t) {
  uiInit();
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = t;
  uiRoot.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}
