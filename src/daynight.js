// ---------- day / night cycle (game clock) ----------
const DAY_LEN=1200;             // real seconds per 24h game day (20 min => 1 game hour = 50 s)
let gameT=8;                    // game hour 0..24, starts 08:00
// phases (game hours): dawn 4.8-6.6 (1.5 min) | day 6.6-18.6 (10 min) | dusk 18.6-20.4 (1.5 min) | night 20.4-4.8 (7 min)
const DN={dark:0,dusk:0,mm:0,lit:null,grid:null,cell:2048,lc:null,lg:null,spr:null,cone:null,glow:{},sendT:0};
function dnSmooth(a,b,x){ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); }
function updateDayNight(dt,run){ if(run) gameT=(gameT+dt*24/DAY_LEN)%24; const h=gameT;
  DN.dark= h<12 ? 1-dnSmooth(4.8,6.6,h) : dnSmooth(18.6,20.4,h);
  DN.dusk= h<12 ? Math.max(0,1-Math.abs(h-5.7)/1.3) : Math.max(0,1-Math.abs(h-19.3)/1.3);
  if(typeof MP!=='undefined'&&MP.on&&MP.host){ DN.sendT-=dt; if(DN.sendT<=0){ DN.sendT=5; try{ mpSendAll({t:'clock',g:gameT,w:WX.st,wt:WX.timer}); }catch(e){} } } }
function dnClock(){ const m=Math.floor(gameT*60)%1440; return String((m/60)|0).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function dnSprite(r,stops){ const c=document.createElement('canvas'); c.width=c.height=r*2; const g=c.getContext('2d'), gr=g.createRadialGradient(r,r,0,r,r,r); for(const [o,col] of stops) gr.addColorStop(o,col); g.fillStyle=gr; g.fillRect(0,0,r*2,r*2); return c; }
function dnGlow(col){ return DN.glow[col]||(DN.glow[col]=dnSprite(32,[[0,col],[0.35,col.replace(/[\d.]+\)$/,'0.35)')],[1,col.replace(/[\d.]+\)$/,'0)')]])); }
function dnBuild(){ if(DN.grid) return; const G=new Map(), C=DN.cell; const add=(x,y,r,k,o)=>{ const key=((x/C)|0)+','+((y/C)|0); let a=G.get(key); if(!a) G.set(key,a=[]); a.push(Object.assign({x,y,r,k},o||{})); };
  for(const sg of world.segs||[]){ if(!sg||sg.b1===undefined) continue; let n=0; for(let a=sg.b0+2;a<sg.b1-1;a+=9){ const d=(n++&1)?1:-1; try{ const p=lanePt(sg,d,0,a); const o=sg.dir==='h'?[0,d*1.2]:[-d*1.2,0]; add((p[0]+o[0]*M_T)*PPM,(p[1]+o[1]*M_T)*PPM,95,'st'); }catch(e){} } }
  let s=7; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for(const o of world.objects) if(o.kind==='bldg'){ const win=[];
    if(typeof ROOF2!=='undefined'&&ROOF2[o.style]&&o.style!=='house'&&o.style!=='warehouse'){ const f=Math.min(o.h*0.32,Math.max(6,(o.height||30)*0.16)), fy=o.y+o.h-f; for(let j=3;j<f-4;j+=7) for(let k=4;k<o.w-6;k+=9) if(win.length<60) win.push([o.x+k,fy+j,rnd()<0.55]); for(let k=8;k<o.w-8;k+=12) if(win.length<80) win.push([o.x+k,o.y+5,rnd()<0.4]); }
    else { const nw=Math.min(14,Math.max(3,((o.w*o.h)/(32*32*2))|0)); for(let i=0;i<nw;i++) win.push([o.x+4+rnd()*(o.w-12),o.y+4+rnd()*(o.h-10),rnd()<0.5]); } add(o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)*0.55,'b',{o,win}); }
  for(const o of world.overhead) if(o.kind==='canopy') add(o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)*1.1,'fl');
  for(const d of world.depots||[]){ add(d.entrance.x*PPM,d.entrance.y*PPM,160,'fl'); for(const b of d.bays||[]) add(b.kx*PPM,b.ky*PPM,90,'fl'); }
  for(const P of (typeof portList==='function'?portList():[])) if(P.slots) for(let i=0;i<P.slots.length;i+=6){ const q=PL(P,P.slots[i][0],P.slots[i][1]); add(q[0]*TILE,q[1]*TILE,190,'fl'); }
  DN.grid=G; }
const DN_COL={st:'rgba(255,214,140,0.55)',fl:'rgba(235,240,255,0.5)',b:'rgba(255,200,110,0.35)'};
const DN_NEON=['rgba(255,40,200,0.9)','rgba(40,230,255,0.9)','rgba(170,90,255,0.9)','rgba(255,90,60,0.9)'];
function drawNight(vx0,vy0,vx1,vy1,z){ const K=DN.dark, D=DN.dusk; if(K<0.01&&D<0.01) return;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  if(D>0.01){ ctx.globalCompositeOperation='multiply'; ctx.fillStyle='rgba(255,150,80,'+(0.32*D)+')'; ctx.fillRect(0,0,VW,VH); }
  if(K<0.01){ ctx.restore(); return; }
  ctx.globalCompositeOperation='multiply'; ctx.fillStyle='rgba(70,95,170,'+(0.55*K)+')'; ctx.fillRect(0,0,VW,VH); ctx.globalCompositeOperation='source-over';
  dnBuild(); const q=0.5, W=Math.ceil(VW*q), H=Math.ceil(VH*q);
  if(!DN.lc||DN.lc.width!==W||DN.lc.height!==H){ DN.lc=document.createElement('canvas'); DN.lc.width=W; DN.lc.height=H; DN.lg=DN.lc.getContext('2d'); }
  if(!DN.spr){ DN.spr=dnSprite(64,[[0,'rgba(0,0,0,1)'],[0.45,'rgba(0,0,0,0.75)'],[1,'rgba(0,0,0,0)']]); const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d'), gr=g.createRadialGradient(0,32,0,0,32,128); gr.addColorStop(0,'rgba(0,0,0,1)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.beginPath(); g.moveTo(0,28); g.lineTo(128,0); g.lineTo(128,64); g.lineTo(0,36); g.closePath(); g.fill(); DN.cone=c; }
  const L=DN.lg; L.setTransform(1,0,0,1,0,0); L.globalCompositeOperation='source-over'; L.clearRect(0,0,W,H); L.fillStyle='rgba(4,8,22,'+(0.72*K)+')'; L.fillRect(0,0,W,H);
  L.globalCompositeOperation='destination-out'; const sx=x=>(x-vx0)*z*q, sy=y=>(y-vy0)*z*q, pad=300;
  const lights=[]; const C=DN.cell; for(let cy=Math.floor((vy0-pad)/C);cy<=Math.floor((vy1+pad)/C);cy++) for(let cx=Math.floor((vx0-pad)/C);cx<=Math.floor((vx1+pad)/C);cx++){ const a=DN.grid.get(cx+','+cy); if(a) for(const l of a) if(l.x>vx0-pad&&l.x<vx1+pad&&l.y>vy0-pad&&l.y<vy1+pad) lights.push(l); }
  for(const P of (typeof portList==='function'?portList():[])) if(P.cranes) for(const c of P.cranes){ for(const u of [P.legL,-1,c.u,16]){ const p=PL(P,u,c.y); const x=p[0]*TILE,y=p[1]*TILE; if(x>vx0-300&&x<vx1+300&&y>vy0-300&&y<vy1+300) dnLight(x,y,u===c.u?150:70,u===c.u?'rgba(235,240,255,0.7)':'rgba(255,60,40,0.9)',0.8); } }
  const dyn=DN.dyn||[]; for(const l of lights.concat(dyn)){ if(l.k==='b') continue; const r=l.r*z*q; L.globalAlpha=l.k==='st'?0.85:0.95; L.drawImage(DN.spr,sx(l.x)-r,sy(l.y)-r,r*2,r*2); }
  const veh=[]; const pushV=(x,y,h,big)=>veh.push([x*PPM,y*PPM,h,big]); pushV(truck.x,truck.y,truck.h,1); for(const v of (traffic.vs||[])) if(v.x!==undefined) pushV(v.x,v.y,v.h||0,v.kind==='lorry'||v.kind==='cab');
  L.globalAlpha=1; for(const [x,y,h,big] of veh){ if(x<vx0-400||x>vx1+400||y<vy0-400||y>vy1+400) continue; const f=fwd(h), ang=Math.atan2(f[1],f[0]), Lh=(big?2.6:1.9)*PPM; L.save(); L.translate(sx(x+f[0]*Lh),sy(y+f[1]*Lh)); L.rotate(ang); const s=z*q*(big?1.5:1.1); L.scale(s,s); L.drawImage(DN.cone,0,-32); L.restore(); }
  L.globalCompositeOperation='source-over'; L.globalAlpha=1;
  ctx.globalCompositeOperation='source-over'; ctx.drawImage(DN.lc,0,0,VW,VH);
  // additive colour: lamp glows, windows/neon, tail + nav lights
  ctx.globalCompositeOperation='lighter'; const gz=(col,x,y,r,a)=>{ const R=r*z; ctx.globalAlpha=a*K; ctx.drawImage(dnGlow(col),(x-vx0)*z-R,(y-vy0)*z-R,R*2,R*2); };
  let nb=0; for(const l of lights){ if(l.k==='st') gz(DN_COL.st,l.x,l.y,l.r*0.55,0.6); else if(l.k==='fl') gz(DN_COL.fl,l.x,l.y,l.r*0.5,0.45);
    else if(l.k==='b'&&nb++<500){ const o=l.o; ctx.globalAlpha=0.75*K; const cy=o.cyber; ctx.fillStyle=cy?'#9ff':'#ffd27a'; for(const w of l.win){ if(!w[2]&&!cy) continue; ctx.fillRect((w[0]-vx0)*z,(w[1]-vy0)*z,Math.max(1.5,5*z),Math.max(1.5,4*z)); }
      if(cy){ const col=DN_NEON[(o.seed>>>3)%4]; ctx.globalAlpha=0.8*K; ctx.strokeStyle=col; ctx.lineWidth=Math.max(1.5,3*z); ctx.strokeRect((o.x-vx0)*z+2,(o.y-vy0)*z+2,o.w*z-4,o.h*z-4); gz(col,o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)*0.6,0.25); } } }
  for(const l of dyn) gz(l.c||DN_COL.fl,l.x,l.y,l.r*0.5,l.a||0.6);
  for(const [x,y,h,big] of veh){ if(x<vx0-200||x>vx1+200||y<vy0-200||y>vy1+200) continue; const f=fwd(h), r=[-f[1],f[0]], bk=(big?(x===truck.x*PPM?(truck.trl?15:4):9):2.2)*PPM; for(const sd of [-1,1]) gz('rgba(255,30,20,0.9)',x-f[0]*bk+r[0]*sd*1*PPM,y-f[1]*bk+r[1]*sd*1*PPM,10,0.9); for(const sd of [-1,1]) gz('rgba(255,250,220,0.9)',x+f[0]*(big?3:2.2)*PPM+r[0]*sd*0.9*PPM,y+f[1]*(big?3:2.2)*PPM+r[1]*sd*0.9*PPM,9,0.9); }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; ctx.restore(); DN.dyn=[]; }
function dnLight(x,y,r,c,a){ if(DN.dark<0.05) return; (DN.dyn||(DN.dyn=[])).push({x,y,r,c,a,k:'d'}); }
function drawClockHUD(){ const x=VW-126, y=62, w=112, h=30, day=DN.dark<0.5; ctx.save(); ctx.fillStyle='rgba(13,15,20,0.72)'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,h,8):ctx.rect(x,y,w,h); ctx.fill();
  if(day){ ctx.fillStyle='#ffcf3f'; ctx.beginPath(); ctx.arc(x+17,y+15,6,0,7); ctx.fill(); ctx.strokeStyle='#ffcf3f'; ctx.lineWidth=2; for(let i=0;i<8;i++){ const a=i*Math.PI/4; ctx.beginPath(); ctx.moveTo(x+17+Math.cos(a)*8,y+15+Math.sin(a)*8); ctx.lineTo(x+17+Math.cos(a)*11,y+15+Math.sin(a)*11); ctx.stroke(); } }
  else { ctx.fillStyle='#dfe6ff'; ctx.beginPath(); ctx.arc(x+17,y+15,8,0,7); ctx.fill(); ctx.fillStyle='rgba(13,15,20,1)'; ctx.beginPath(); ctx.arc(x+21,y+12,7,0,7); ctx.fill(); }
  ctx.fillStyle='#fff'; ctx.font='800 18px system-ui,sans-serif'; ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText(dnClock(),x+36,y+16); ctx.restore(); }
function dnMapShade(x,y,w,h,k){ const a=DN.dark*(k||0.45); if(a<0.02) return; ctx.save(); ctx.fillStyle='rgba(6,12,32,'+a+')'; ctx.fillRect(x,y,w,h); ctx.restore(); }
