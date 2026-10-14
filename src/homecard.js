'use strict';
// ===================== Home card: one clear "who am I" card. Account remembered -> Welcome back <name> + CONTINUE + Switch account
// (no reset, no username form, no name box). Not signed in -> account form; a guest local save gets a small guest card with a guarded reset.
(function(){
const css=`#wbCard,#lobby #lbHost,html.invmode #homeCard{display:none!important}
#lobby>.row{display:none!important}
body.acctin #overlay>#acct{display:none!important} body.acctin #lobby .row:has(#lbName){display:none!important}
#homeCard{width:min(440px,88vw);margin:10px auto 4px;padding:14px 16px;border-radius:14px;background:rgba(14,20,32,.88);border:1px solid rgba(245,184,46,.5);box-shadow:0 8px 24px rgba(0,0,0,.45);text-align:center;display:flex;flex-direction:column;gap:8px;box-sizing:border-box;cursor:default}
#homeCard .hw{font-size:21px;font-weight:900;color:#f5b82e} #homeCard .hs{font-size:12.5px;opacity:.85}
#homeCard .hb{text-align:center;font:inherit;font-weight:900;font-size:17px;padding:11px;border-radius:11px;border:0;cursor:pointer;background:linear-gradient(#ffd36a,#f5a915);color:#1a1205;min-height:46px}
#homeCard .hb.g{background:rgba(255,255,255,.1);color:#dfe5ee;border:1px solid rgba(255,255,255,.22);font-size:14px;min-height:40px;font-weight:800}
#homeCard .hr{align-self:center;background:none;border:0;color:#9aa6b5;font-size:12px;text-decoration:underline;cursor:pointer;padding:4px 8px;min-height:0}
#homeCard button:focus{outline:3px solid #7dff8a;outline-offset:2px} #homeCard .hr.arm{color:#ff8a7a}`;
const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
const esc=s=>String(s||'').replace(/[<>&"]/g,'');
let sig='', prefilled=false;
function hasSave(){ try{ return localStorage.getItem('bigrig.guestPlayed')==='1'&&!!localStorage.getItem(saveKey()); }catch(e){ return false; } }
// a guest save only counts once someone has actually started driving without an account
setTimeout(()=>{ const sg=startGame; startGame=function(){ const was=typeof started!=='undefined'&&started; const r=sg.apply(this,arguments); if(!was&&started&&!ACC.tok) try{ localStorage.setItem('bigrig.guestPlayed','1'); }catch(e){} return r; }; },0);
function stats(){ try{ return `${money(truck.money)} \u2022 Level ${levelOf(career.xp)} \u2022 ${esc(modelById(career.cur).name)}${career.active?' \u2022 job in progress':''}`; }catch(e){ return ''; } }
function go(){ ACC.padT=0; startGame(); }
function render(force){ const ov=document.getElementById('overlay'); if(!ov||typeof world==='undefined'||!world.ready||(typeof started!=='undefined'&&started)) return;
  const tok=!!ACC.tok, guest=!tok&&hasSave(), s=[tok,ACC.name,guest,stats()].join('|'); let c=document.getElementById('homeCard');
  if(!force&&s===sig&&(c||(!tok&&!guest))) return; sig=s;
  document.body.classList.toggle('acctin',tok);
  if(!tok&&!guest){ if(c) c.remove(); return; }
  if(!c){ c=document.createElement('div'); c.id='homeCard'; for(const ev of ['pointerdown','click','keydown']) c.addEventListener(ev,e=>e.stopPropagation()); }
  const ac=document.getElementById('acct'); if(tok){ if(ac) ov.insertBefore(c,ac); else ov.insertBefore(c,document.getElementById('lobby')); } else if(ac) ac.after(c);
  const gn=esc(localStorage.getItem('bigrig.name')||'driver');
  c.innerHTML=tok?`<div class="hw">Welcome back, ${esc(ACC.name)}</div><div class="hs">${stats()}</div><div class="hs" style="opacity:.6">\u2601 Cloud save on${ACC.admin?' \u2022 admin':''}</div><button class="hb" id="hcGo">CONTINUE \u24B6</button><button class="hb g" id="hcSw">Switch account</button>`
    :`<div class="hw" style="font-size:18px">Guest save \u2022 ${gn}</div><div class="hs">${stats()}</div><button class="hb" id="hcGo">CONTINUE AS GUEST \u24B6</button><button class="hr" id="hcRs">Reset guest progress</button>`;
  c.querySelector('#hcGo').addEventListener('click',go);
  const sw=c.querySelector('#hcSw'); if(sw) sw.addEventListener('click',()=>{ try{ accPush(true); accRpc('logout',{token:ACC.tok},true).catch(()=>{}); }catch(e){} accClear(); const a=document.getElementById('acct'); if(a) a.style.display=''; ACC.refresh&&ACC.refresh(); render(true); const n=document.getElementById('acName'); if(n){ n.value=''; n.focus(); } });
  const rs=c.querySelector('#hcRs'); if(rs) rs.addEventListener('click',()=>{ if(ACC.tok) return; if(rs.dataset.arm){ resetGame(); return; } rs.dataset.arm=1; rs.classList.add('arm'); rs.textContent='Tap again to wipe the guest save'; setTimeout(()=>{ delete rs.dataset.arm; rs.classList.remove('arm'); rs.textContent='Reset guest progress'; },3500); });
  if(!document.activeElement||document.activeElement===document.body) c.querySelector('#hcGo').focus(); }
// expired session: keep the last account name and go straight to its PIN prompt
function prefill(){ if(prefilled||ACC.tok) return; const last=localStorage.getItem('bigrig.lastacct'), n=document.getElementById('acName'); if(!last||!n) return; prefilled=true; n.value=last; n.dispatchEvent(new Event('input')); }
setInterval(()=>{ render(false); prefill(); },400);
})();
