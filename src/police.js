'use strict';
// ===================== v28 POLICE AI: patrols from police stations, line-of-sight detection, chase, fines + arrest =====================
// Patrol cars are ordinary traffic vehicles (v.role='police') so they keep UK lane discipline + signals; a chasing car leaves the traffic
// sim and is driven kinematically behind the player. Local per client (MP fine). Uses SVC (services.js) and OFF (roadlaw.js).
const POL_FINES={speeding:100,redlight:100,pedestrian:500};
const POL={cars:[],chase:null,spawnT:6+Math.random()*14,want:2,stopT:0,pend:[],arrest:false,lostT:0,inJ:null,prev:null,seen:new Set(),fade:0,log:[]};
// ---------- shared emergency-vehicle art / audio / helpers (also used by ambulance.js)
const EMV={arts:{}};
// v29 detailed police vehicles (top-down, procedural): saloon / 4x4 SUV / Sprinter-style van, white with crisp blue+yellow battenburg,
// glass, mirrors, roof POLICE lettering and a red/blue light bar
const POL_T=['pol_car','pol_suv','pol_van'];
function polArt(type){ if(EMV.arts[type]) return EMV.arts[type]; const D={pol_car:[4.8,1.86,1.15,1.9,0.9],pol_suv:[4.9,2.0,1.0,2.4,0.75],pol_van:[5.9,2.06,0.95,3.9,0.15]}[type];
  const [L,W,bon,roofL,rear]=D, c=vCanvas(L,W), g=c.getContext('2d'), cx=c.width/2, X=m=>cx+m*VS, Y=m=>0.15*VS+m*VS;
  g.fillStyle='#101010'; for(const fy of [0.55+0.15,L-1.25]) for(const sd of [-1,1]) rr(g,X(sd*W/2-(sd>0?0.16:0.06)),Y(fy),0.22*VS,0.68*VS,2), g.fill();      // tyres
  g.fillStyle=grad(g,X(-W/2),X(W/2),'#f6f6f4'); rr(g,X(-W/2),Y(0),W*VS,L*VS,(type==='pol_van'?0.28:0.45)*VS); g.fill(); g.strokeStyle='rgba(0,0,0,0.55)'; g.lineWidth=1.2; g.stroke();
  g.fillStyle='#2b2f35'; g.fillRect(X(-W/2+0.15),Y(0.02),(W-0.3)*VS,0.12*VS); g.fillRect(X(-W/2+0.15),Y(L-0.14),(W-0.3)*VS,0.12*VS);     // bumpers
  g.fillStyle='#fff6c8'; for(const sd of [-1,1]) g.fillRect(X(sd*(W/2-0.38)-0.16),Y(0.05),0.32*VS,0.1*VS); g.fillStyle='#d0222a'; for(const sd of [-1,1]) g.fillRect(X(sd*(W/2-0.34)-0.14),Y(L-0.13),0.28*VS,0.09*VS);   // lamps
  const ws=bon, r0=ws+0.55, r1=r0+roofL;
  g.fillStyle='#16202b'; g.beginPath(); g.moveTo(X(-W/2+0.2),Y(r0)); g.lineTo(X(-W/2+0.32),Y(ws)); g.lineTo(X(W/2-0.32),Y(ws)); g.lineTo(X(W/2-0.2),Y(r0)); g.closePath(); g.fill();   // windscreen
  g.fillStyle='rgba(170,210,240,0.35)'; g.beginPath(); g.moveTo(X(-W/2+0.4),Y(ws+0.08)); g.lineTo(X(W/2-0.5),Y(ws+0.08)); g.lineTo(X(W/2-0.7),Y(ws+0.25)); g.lineTo(X(-W/2+0.45),Y(ws+0.25)); g.fill();
  g.fillStyle='#1e2833'; for(const sd of [-1,1]) g.fillRect(sd<0?X(-W/2+0.06):X(W/2-0.2),Y(r0+0.05),0.14*VS,(type==='pol_van'?1.0:roofL-0.1)*VS);   // side glass
  if(rear>0.3){ g.fillStyle='#16202b'; g.beginPath(); g.moveTo(X(-W/2+0.22),Y(r1)); g.lineTo(X(W/2-0.22),Y(r1)); g.lineTo(X(W/2-0.34),Y(r1+rear*0.55)); g.lineTo(X(-W/2+0.34),Y(r1+rear*0.55)); g.fill(); }
  g.fillStyle='#f2f2ef'; rr(g,X(-W/2+0.22),Y(r0),(W-0.44)*VS,(roofL)*VS,3); g.fill(); g.strokeStyle='rgba(0,0,0,0.18)'; g.stroke();          // roof
  g.fillStyle='#2b2f35'; for(const sd of [-1,1]){ g.beginPath(); g.ellipse(X(sd*(W/2+0.07)),Y(ws+0.25),0.13*VS,0.09*VS,0,0,7); g.fill(); }    // mirrors
  // battenburg: two rows of crisp blue/yellow checks along each flank (below the glass line)
  const cs=0.42, y0=type==='pol_van'?0.35:0.3, n=Math.floor((L-y0-0.25)/cs);
  for(let k=0;k<n;k++) for(const sd of [-1,1]) for(let row=0;row<2;row++){ g.fillStyle=((k+row)%2)?'#1d4fbf':'#f2e600'; const xx=sd<0?X(-W/2+0.02+row*0.11):X(W/2-0.13-row*0.11); g.fillRect(xx,Y(y0+k*cs),0.11*VS,cs*VS+0.4); }
  g.fillStyle='#1d4fbf'; g.fillRect(X(-W/2+0.22),Y(0.32),(W-0.44)*VS,0.07*VS);
  g.save(); g.translate(X(0),Y(r0+roofL*0.62)); g.rotate(Math.PI); g.fillStyle='#14204a'; g.font='900 '+Math.round(0.4*VS)+'px Arial Black,Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('POLICE',0,0); g.restore();
  if(type==='pol_van'){ g.strokeStyle='rgba(0,0,0,0.2)'; g.lineWidth=1; for(let k=1;k<4;k++){ g.beginPath(); g.moveTo(X(-W/2+0.3),Y(r0+k*roofL/4)); g.lineTo(X(W/2-0.3),Y(r0+k*roofL/4)); g.stroke(); } }
  const by=r0+0.12; g.fillStyle='#1a1a1a'; rr(g,X(-W/2+0.3),Y(by),(W-0.6)*VS,0.3*VS,2); g.fill(); g.fillStyle='#7a1d22'; g.fillRect(X(-W/2+0.36),Y(by)+2,(W/2-0.42)*VS,0.3*VS-4); g.fillStyle='#1f3a8a'; g.fillRect(X(0.06),Y(by)+2,(W/2-0.42)*VS,0.3*VS-4);
  const a={body:{c,sh:shadowOf(c)},L,W,kind:type==='pol_van'?'van':'estate',bar:L/2-by-0.15,rb:true}; return EMV.arts[type]=a; }
function emArt(type){ if(EMV.arts[type]) return EMV.arts[type]; if(type==='police') return polArt('pol_car'); if(POL_T.includes(type)) return polArt(type);
  const kind=type==='police'?'estate':'van', t=VTYPES[kind], base=type==='police'?makeCarArt('estate','#f4f4f4'):makeVanArt('#f7f7f2',''), c=mkCanvas(base.width,base.height), g=c.getContext('2d'); g.drawImage(base,0,0);
  const cx=c.width/2, y0=0.15*VS, X=m=>cx+m*VS, Y=m=>y0+m*VS, W=t.W, L=t.L, A=type==='police'?['#1d4fbf','#f2e600']:['#2e9e3e','#f2e600'];
  // battenburg checks along both flanks
  const n=Math.round(L/0.55); for(let k=1;k<n-1;k++) for(const s of [-1,1]){ g.fillStyle=A[(k+(s>0?1:0))%2]; g.fillRect(s<0?X(-W/2+0.05):X(W/2-0.33),Y(k*L/n),0.28*VS,L/n*VS+0.5); }
  if(type==='ambulance'){ g.fillStyle='#2e9e3e'; g.fillRect(X(-W/2+0.4),Y(L*0.62),(W-0.8)*VS,0.22*VS); g.save(); g.translate(X(0),Y(L*0.75)); g.rotate(Math.PI); g.fillStyle='#2e9e3e'; g.font='bold '+Math.round(0.42*VS)+'px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('AMBULANCE',0,0); g.restore(); }
  else { g.fillStyle='#1d4fbf'; g.font='bold '+Math.round(0.45*VS)+'px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.save(); g.translate(X(0),Y(L*0.72)); g.rotate(Math.PI); g.fillText('POLICE',0,0); g.restore(); }
  // light bar (unlit)
  const by=type==='police'?L*0.42:0.95; g.fillStyle='#222'; g.fillRect(X(-W/2+0.3),Y(by),(W-0.6)*VS,0.3*VS); g.fillStyle='#3a58a8'; g.fillRect(X(-W/2+0.35),Y(by)+2,(W/2-0.4)*VS,0.3*VS-4); g.fillRect(X(0.05),Y(by)+2,(W/2-0.4)*VS,0.3*VS-4);
  const a={body:{c,sh:shadowOf(c)},L,W,kind,bar:L/2-by-0.15}; return EMV.arts[type]=a; }
function emDrawBar(v,on,type){ if(type==='police'&&v.polT) type=v.polT; const a=emArt(type), f=fwd(v.h), r=rgt(v.h), off=a.bar, cx=v.x+f[0]*off, cy=v.y+f[1]*off; if(!on) return;
  const ph=(timeS*4)%1<0.5; for(const s of [-1,1]){ const lit=(s<0)===ph; if(!lit) continue; const x=cx+r[0]*s*a.W*0.25, y=cy+r[1]*s*a.W*0.25, red=a.rb&&s<0;
    if(red){ ctx.fillStyle='rgba(255,60,60,0.95)'; ctx.beginPath(); ctx.arc(x*PPM,y*PPM,4.5,0,7); ctx.fill(); ctx.fillStyle='rgba(255,40,40,0.25)'; ctx.beginPath(); ctx.arc(x*PPM,y*PPM,16,0,7); ctx.fill(); if(typeof dnLight==='function') dnLight(x*PPM,y*PPM,90,'rgba(255,40,40,1)',0.9); continue; }
    ctx.fillStyle='rgba(120,170,255,0.95)'; ctx.beginPath(); ctx.arc(x*PPM,y*PPM,4.5,0,7); ctx.fill(); ctx.fillStyle='rgba(80,140,255,0.25)'; ctx.beginPath(); ctx.arc(x*PPM,y*PPM,16,0,7); ctx.fill();
    if(typeof dnLight==='function') dnLight(x*PPM,y*PPM,90,'rgba(60,120,255,1)',0.9); } }
function emBlit(v,type){ if(type==='police'&&v.polT) type=v.polT; const a=emArt(type); blitV(a.body.sh,v.x,v.y,v.h,a.L,a.W,4,4); blitV(a.body.c,v.x,v.y,v.h,a.L,a.W,0,0); }
// v31 sirens: all synthesised live with WebAudio (no sample files, no licences needed, ~0 bytes of build size). Kinds:
//  'police'  UK two-tone hi-lo, fast (responding)      'yelp'  rapid sawtooth yelp, rate rises with chase time
//  'ambulance' UK two-tone, slower and lower            'fire'  deep slow air-horn-style wail (sawtooth + sub octave)
//  s.whoop() = short police 'whoop'/phaser burst used when they want you to pull over
const SIRK={police:{c:850,dep:-120,lt:'square',lr:1.25,ot:'sawtooth',lp:2400},yelp:{c:1000,dep:420,lt:'sawtooth',lr:3.2,ot:'sawtooth',lp:2600},
  ambulance:{c:560,dep:-90,lt:'square',lr:0.6,ot:'triangle',lp:1700},fire:{c:520,dep:260,lt:'sine',lr:0.22,ot:'sawtooth',lp:1100,sub:1}};
function emSiren(kind){ try{ const c=audio.ctx; if(!c||!audio.master) return null; const K=SIRK[kind]||SIRK.police; const o=c.createOscillator(), l=c.createOscillator(), lg=c.createGain(), g=c.createGain(), f=c.createBiquadFilter(); let o2=null;
    o.type=K.ot; o.frequency.value=K.c; l.type=K.lt; l.frequency.value=K.lr; lg.gain.value=K.dep; l.connect(lg); lg.connect(o.frequency); f.type='lowpass'; f.frequency.value=K.lp; o.connect(f);
    if(K.sub){ o2=c.createOscillator(); o2.type='square'; const g2=c.createGain(); g2.gain.value=0.35; o2.frequency.value=K.c/2; const lg2=c.createGain(); lg2.gain.value=K.dep/2; l.connect(lg2); lg2.connect(o2.frequency); o2.connect(g2); g2.connect(f); }
    f.connect(g); g.gain.value=0; let pn=null; try{ pn=c.createStereoPanner(); g.connect(pn); pn.connect(audio.master); }catch(e){ g.connect(audio.master); } o.start(); l.start(); if(o2) o2.start();
    let last=0;
    return {g,kind,stop(){ try{ g.gain.setTargetAtTime(0,c.currentTime,0.05); setTimeout(()=>{ try{ o.stop(); l.stop(); if(o2) o2.stop(); g.disconnect(); }catch(e){} },400); }catch(e){} },
      set(v){ try{ const q=typeof v==='object'?v:{v,p:0}; last=q.v; g.gain.setTargetAtTime(q.v,c.currentTime,0.08); if(pn) pn.pan.setTargetAtTime(q.p,c.currentTime,0.08); }catch(e){} },
      mode(k){ const N=SIRK[k]; if(!N||this.kind===k) return; this.kind=k; const t=c.currentTime; l.type=N.lt; l.frequency.setTargetAtTime(N.lr,t,0.05); lg.gain.setTargetAtTime(N.dep,t,0.05); o.frequency.setTargetAtTime(N.c,t,0.05); },
      rate(r){ try{ l.frequency.setTargetAtTime(r,c.currentTime,0.3); }catch(e){} },
      whoop(){ try{ if(last<0.002) return; const t=c.currentTime, w=c.createOscillator(), wg=c.createGain(); w.type='sawtooth'; w.frequency.setValueAtTime(300,t); w.frequency.exponentialRampToValueAtTime(1500,t+0.35); w.frequency.exponentialRampToValueAtTime(500,t+0.6);
        wg.gain.setValueAtTime(0,t); wg.gain.linearRampToValueAtTime(last*1.6,t+0.04); wg.gain.linearRampToValueAtTime(0,t+0.62); w.connect(wg); wg.connect(pn||audio.master); w.start(t); w.stop(t+0.65); }catch(e){} } }; }catch(e){ return null; } }
// v31: quieter, falls off to silence about one screen from the player, stereo pan by side
function emSirenVol(x,y){ const vr=viewRectM(), R=Math.max(40,Math.max(vr[2]-vr[0],vr[3]-vr[1])/2), d=Math.hypot(x-truck.x,y-truck.y), f=Math.max(0,1-d/(R*1.3)); return {v:0.05*f*f*(3-2*f),p:Math.max(-1,Math.min(1,(x-truck.x)/R))*0.8}; }
// road point just outside a services site's driveway
function emRoadPt(s){ return {x:s.entrance.x,y:s.entrance.y-M_T*0.8}; }
// move a kinematic vehicle along a polyline (metres); returns true when done
function emFollow(v,dt,sp){ const P=v.path; if(!P||!P.length) return true; const q=P[0], dx=q[0]-v.x, dy=q[1]-v.y, d=Math.hypot(dx,dy); if(d<0.4){ P.shift(); return !P.length; }
  const st=Math.min(d,(sp||5)*dt); v.x+=dx/d*st; v.y+=dy/d*st; if(d>0.6){ const th=Math.atan2(dx,-dy); v.h+=wrapA((v.rev?th+Math.PI:th)-v.h)*Math.min(1,dt*5); } return false; }
// put a kinematic vehicle back into traffic as a normal AI car (keeps its role/art); null if no room
function emToTraffic(x,y,role){ const s=navSnap(x/M_T,y/M_T,10); if(!s) return null; const OFS=[[0,0]]; for(let d=1;d<=6;d++) OFS.push([d,0],[-d,0],[0,d],[0,-d]); for(const [ox,oy] of OFS){
    const v=spawnVehicle((s[0]+ox+0.5)*M_T,(s[1]+oy+0.5)*M_T,true,{kind:role==='police'?'estate':'van'}); if(v){ v.role=role; v.art=emArt(role).body; v.art={body:emArt(role).body}; return v; } } return null; }
const onView=(x,y)=>typeof onScreen==='function'&&onScreen(x,y,-2);
// ---------- patrols
function polStations(){ return typeof SVC!=='undefined'?SVC.byType.police:[]; }
function polMake(v,st){ v.role='police'; v.polT=v.polT||POL_T[(Math.random()*3)|0]; v.art={body:emArt(v.polT).body}; v.pol={st,end:timeS+90+Math.random()*480,home:false}; POL.cars.push(v); return v; }
// GTA2-style: patrols appear on roads just out of view (1-1.5 screens), biased ahead of the truck
function polViewR(){ const v=viewRectM(); return Math.max(v[2]-v[0],v[3]-v[1])/2; }
function polSpawn(){ const P=truck, R=polViewR(), f=fwd(P.h), mv=Math.abs(P.v)>3;
  for(let t=0;t<40;t++){ let a=Math.random()*6.283; if(mv&&Math.random()<0.7) a=Math.atan2(f[1],f[0])+(Math.random()-0.5)*1.8;
    const d=R*(1+Math.random()*0.5)+15, x=P.x+Math.cos(a)*d, y=P.y+Math.sin(a)*d; const tx=Math.floor(x/M_T), ty=Math.floor(y/M_T); if(!inb(tx,ty)) continue; const i=idx(tx,ty);
    if(world.roadH[i]<0&&world.roadV[i]<0||onScreen(x,y,12)) continue; if(POL.cars.length>=6) return null; const v=spawnVehicle(x,y,true,{kind:'estate'}); if(v&&onScreen(v.x,v.y,10)){ const k=traffic.vs.indexOf(v); if(k>=0) traffic.vs.splice(k,1); continue; } if(v){ let st=null,bd=1e18; for(const s of polStations()){ const q=(s.x-x)**2+(s.y-y)**2; if(q<bd){ bd=q; st=s; } } POL.spawns=(POL.spawns||0)+1; return polMake(v,st); } }
  return null; }
function polUpdatePatrols(dt){ POL.cars=POL.cars.filter(v=>traffic.vs.includes(v)||v===(POL.chase&&POL.chase.v));
  const R=polViewR(); for(const v of POL.cars.slice()){ if(v===(POL.chase&&POL.chase.v)) continue; if((v.pol&&v.pol.leave&&!onScreen(v.x,v.y,15))||Math.hypot(v.x-truck.x,v.y-truck.y)>R*2.6+60&&!onScreen(v.x,v.y,20)){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); } POL.cars.splice(POL.cars.indexOf(v),1); } }
  POL.spawnT-=dt*(Math.abs(truck.v)>2?1:0.3); if(POL.spawnT<=0){ POL.spawnT=Math.random()<0.25?6+Math.random()*10:15+Math.random()*Math.random()*70; POL.want=1+((Math.random()*3)|0); const n=POL.cars.filter(v=>Math.hypot(v.x-truck.x,v.y-truck.y)<R*2.6+60).length; if(n<POL.want) polSpawn(); }
  for(const v of POL.cars){ const p=v.pol; if(!p||v===(POL.chase&&POL.chase.v)) continue;
    if(!p.home&&timeS>p.end&&p.st&&typeof aiGoal==='function'){ p.home=true; const e=emRoadPt(p.st); aiGoal(v,{entrance:e,name:p.st.name}); v.pinT=0; }
    if(p.home&&p.st){ const e=emRoadPt(p.st); if(Math.hypot(v.x-e.x,v.y-e.y)<14){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); }
        const s=p.st; POL.parkIn=POL.parkIn||[]; POL.parkIn.push({x:v.x,y:v.y,h:v.h,path:[[e.x,s.entrance.y+2],[s.entrance.x,s.rect.y0+M_T*1.5]],t:0}); } } }
  if(POL.parkIn) POL.parkIn=POL.parkIn.filter(k=>!emFollow(k,dt,4)); }
// ---------- detection
function polSees(v){ return onView(v.x,v.y)&&onView(truck.x,truck.y); }
function polCanSee(){ return POL.cars.filter(v=>v.pol&&polSees(v)); }
function polOffence(type,v,reason){ const c=POL.chase; if(c&&c.offs.some(o=>o.type===type)) return; if(!c){ polStartChase(v); } const ch=POL.chase; if(!ch) return;
  const amt=(typeof OFF!=='undefined'&&OFF.FINES&&OFF.FINES[type])||POL_FINES[type]; ch.offs.push({type,amount:amt,reason}); if(type==='pedestrian') ch.arrest=true; POL.log.push({type,t:timeS});
  if(typeof toast==='function') toast('\u{1F6A8} Police: '+reason); }
function polStartChase(v){ if(!v) return; const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); }
  POL.chase={v,offs:[],arrest:false,t:0,siren:emSiren('police'),sp:Math.abs(v.v||8)}; POL.stopT=0; POL.lostT=0; }
function polEndChase(back){ const c=POL.chase; if(!c) return; if(c.siren) c.siren.stop(); POL.chase=null; POL.stopT=0;
  if(back){ const nv=emToTraffic(c.v.x,c.v.y,'police'); if(nv){ nv.polT=c.v.polT; polMake(nv,c.v.pol&&c.v.pol.st); nv.pol.end=timeS+60+Math.random()*300; } } }
function polDetect(dt){ if(POL.chase&&POL.chase.paying) return; const P=truck, mph=Math.abs(P.v)*(typeof MPH!=='undefined'?MPH:2.237), lim=(typeof SPL!=='undefined'&&SPL.cur)||30;
  // speeding past a police car
  if(mph>lim*1.1+2) for(const v of polCanSee()){ if(Math.hypot(v.x-P.x,v.y-P.y)<40){ polOffence('speeding',v,Math.round(mph)+' mph in a '+lim+' zone'); break; } }
  // red light: player enters a signal-controlled junction box on a red
  const tx=P.x/M_T, ty=P.y/M_T; let J=null; for(const j of world.junctions||[]) if(j.lights&&tx>=j.x&&tx<j.x+j.w&&ty>=j.y&&ty<j.y+j.h){ J=j; break; }
  if(J&&J!==POL.inJ&&POL.prev&&typeof sigState==='function'){ const sg=slSegAt(POL.prev[0],POL.prev[1]); if(sg&&sg.js&&sg.js.includes(J)){ const dd=sg.dir==='h'?Math.sign(P.x-POL.prev[0]):Math.sign(P.y-POL.prev[1]);
      if(dd){ const key=sg.id+':'+dd, red=['S','L','R'].every(m=>sigState(J,key,m)==='r'); if(red&&Math.abs(P.v)>2){ POL.redRuns=(POL.redRuns||0)+1; const w=polCanSee()[0]; if(w) polOffence('redlight',w,'ran a red light'); } } } }
  POL.inJ=J; if(!J) POL.prev=[P.x,P.y]; }
function polPedHit(p){ const w=polCanSee()[0]; if(w||(POL.chase&&polSees(POL.chase.v))) polOffence('pedestrian',w||POL.chase.v,'hit a pedestrian'); else if(!POL.chase){ WANT.lvl=1; WANT.t=60; WANT.sp=1; } }
// ---------- v29 wanted level: unseen ped hit -> 1 star, 60 s; searchers roam near (not on) the player; spotted -> chase -> fine/arrest
const WANT={lvl:0,t:0,sp:0,chased:false};
function wantSearchGoal(v){ const a=Math.random()*6.283, d=30+Math.random()*120; if(typeof aiGoal==='function') aiGoal(v,{entrance:{x:truck.x+Math.cos(a)*d,y:truck.y+Math.sin(a)*d},name:'search'}); v.pol.sg=timeS+12+Math.random()*10; }
function wantUpdate(dt){ if(!WANT.lvl) return;
  if(POL.chase){ WANT.chased=true; WANT.t=60; return; }
  if(WANT.chased){ wantClear(); return; }               // chase over (fined/arrested or lost): wanted level ends
  const hid=hideAt(truck.x,truck.y)&&Math.abs(truck.v)<0.5; WANT.hid=hid; const w=!hid&&polCanSee()[0]; if(w){ polOffence('pedestrian',w,'hit a pedestrian'); return; }
  WANT.t-=dt*(hid?6:1); if(WANT.t<=0){ wantClear(); return; }
  WANT.sp-=dt; const n=POL.cars.filter(v=>v.pol&&v.pol.search).length; if(WANT.sp<=0){ WANT.sp=5+Math.random()*7; if(n<4){ const v=polSpawn(); if(v){ v.pol.search=true; v.pinT=timeS+1e6; wantSearchGoal(v); } } }
  for(const v of POL.cars) if(v.pol&&v.pol.search&&timeS>v.pol.sg&&traffic.vs.includes(v)) wantSearchGoal(v); }
function wantClear(){ WANT.lvl=0; WANT.chased=false; WANT.t=0; for(const v of POL.cars) if(v.pol&&v.pol.search){ v.pol.search=false; v.pinT=0; v.pol.end=timeS; v.pol.home=false; v.pol.leave=true; } }
function drawWantedHUD(){ if(!WANT.lvl) return; const x=VW-34, y=VH*0.13+70, fl=POL.chase||WANT.t>10||(timeS*4)%1<0.6;
  ctx.save(); ctx.translate(x,y); ctx.beginPath(); for(let i=0;i<10;i++){ const r=i%2?7:17, a=i*Math.PI/5-Math.PI/2; ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); } ctx.closePath();
  ctx.fillStyle=fl?'#ffd21e':'rgba(255,210,30,0.35)'; ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.stroke(); ctx.fill();
  ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.font='bold 13px system-ui,sans-serif'; ctx.textAlign='center'; const tx=POL.chase?'CHASE':'WANTED '+Math.ceil(WANT.t)+'s'; ctx.strokeText(tx,0,32); ctx.fillText(tx,0,32); ctx.restore(); }
function polMapDots(px,py){ const ph=(timeS*4)%1<0.5, L=POL.cars.filter(v=>v.pol&&(v.pol.search||WANT.lvl)&&traffic.vs.includes(v)).map(v=>v); if(POL.chase) L.push(POL.chase.v);
  for(const v of L){ const X=px(v.x),Y=py(v.y); const R=(typeof bigmap!=='undefined'&&bigmap.open)?8:5; ctx.fillStyle=ph?'rgba(255,32,48,0.35)':'rgba(42,91,255,0.35)'; ctx.beginPath(); ctx.arc(X,Y,R*2,0,7); ctx.fill(); ctx.fillStyle=ph?'#ff2030':'#2a5bff'; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(X,Y,R,0,7); ctx.fill(); ctx.stroke(); } }
// ---------- chase
// v31 chase: re-paths over the road network to the player's current position every ~0.5 s and follows the same roads (junction boxes may be cut);
// steers around traffic; can be lost (stuck behind traffic, crash/spin, or out of sight for a while) -> 1-star 60 s search
function polChasePath(c,tx,ty){ const v=c.v, s=navSnap(v.x/M_T,v.y/M_T,6), e=navSnap(tx/M_T,ty/M_T,8); c.path=null; if(!s||!e) return; const p=navAStar(s[0],s[1],e[0],e[1]); if(!p||p.length<2) return;
  c.path=p.map(i=>[(i%MW+0.5)*M_T,(Math.floor(i/MW)+0.5)*M_T]); c.pk=0; }
function polChaseAim(c){ const v=c.v, P=c.path; if(!P) return null; let k=c.pk||0, bd=1e18; for(let q=k;q<Math.min(P.length,k+12);q++){ const d=(P[q][0]-v.x)**2+(P[q][1]-v.y)**2; if(d<bd){ bd=d; k=q; } } c.pk=k;
  const q=P[Math.min(P.length-1,k+3)], r=P[Math.min(P.length-1,k+4)]; if(!q) return null; const dx=r[0]-q[0], dy=r[1]-q[1], l=Math.hypot(dx,dy)||1; return [q[0]-dy/l*1.4,q[1]+dx/l*1.4]; }   // keep-left lane-ish
function polUpdateChase(dt){ const c=POL.chase; if(!c) return; const v=c.v, P=truck; c.t+=dt;
  const back=P.trl?20:9, f=fwd(P.trl?P.th:P.h), tx=(P.trl?P.trl.x:P.x)-f[0]*back, ty=(P.trl?P.trl.y:P.y)-f[1]*back, dP=Math.hypot(P.x-v.x,P.y-v.y);
  if(c.spin>0){ c.spin-=dt; v.h+=dt*5*c.spinD; c.sp*=Math.max(0,1-dt*3); const fv=fwd(v.h); v.x+=fv[0]*c.sp*dt; v.y+=fv[1]*c.sp*dt; v.v=c.sp; polSep(c); if(c.siren) c.siren.set(emSirenVol(v.x,v.y)); if(c.spin<=0&&dP>45){ polLose('crashed'); } return; }
  c.rp=(c.rp||0)-dt; let aim=null; const direct=Math.hypot(tx-v.x,ty-v.y)<28;
  if(!direct){ if(c.rp<=0){ c.rp=0.5; polChasePath(c,tx,ty); } aim=polChaseAim(c); }
  // v31: close in, follow the player's own tyre track (breadcrumbs) so the car stays on the road instead of cutting across verges
  c.trT=(c.trT||0)-dt; if(c.trT<=0){ c.trT=0.25; (c.trail=c.trail||[]).push([P.x,P.y]); if(c.trail.length>80) c.trail.shift(); }
  if(direct&&c.trail&&c.trail.length>2){ let k=-1, bd=1e18; for(let q=0;q<c.trail.length;q++){ const d2=(c.trail[q][0]-v.x)**2+(c.trail[q][1]-v.y)**2; if(d2<bd){ bd=d2; k=q; } }
    for(let q=k;q<c.trail.length;q++){ const t=c.trail[q]; if(Math.hypot(t[0]-v.x,t[1]-v.y)>6){ aim=t; break; } } }
  if(!aim) aim=[tx,ty]; let dx=aim[0]-v.x, dy=aim[1]-v.y; const d=Math.hypot(tx-v.x,ty-v.y);
  // steer around traffic directly ahead
  const fv0=fwd(v.h); let blk=null, bdist=1e9; for(const o of traffic.vs){ if(o===v) continue; const ox=o.x-v.x, oy=o.y-v.y, al=ox*fv0[0]+oy*fv0[1]; if(al<0||al>22) continue; const lat=ox*fv0[1]-oy*fv0[0]; if(Math.abs(lat)<2.8&&al<bdist){ bdist=al; blk={o,lat,al}; } }
  if(blk){ const r=rgt(v.h), sd=blk.lat>0?-1:1; dx+=r[0]*sd*3.5*(16-blk.al)/4; dy+=r[1]*sd*3.5*(16-blk.al)/4; if(blk.al<3.2){ if(c.sp>13){ c.spin=1.6; c.spinD=Math.random()<0.5?-1:1; POL.crashes=(POL.crashes||0)+1; return; } c.sp=Math.min(c.sp,Math.abs(blk.o.v||0)); } }
  const want=d>25?Math.max(Math.abs(P.v)+6,15):d>6?Math.abs(P.v)+d*0.25:Math.abs(P.v)*0.6, turn=Math.abs(wrapA(Math.atan2(dx,-dy)-v.h)), cap=turn>0.6?9:turn>0.3?16:40;
  c.sp+=Math.max(-10*dt,Math.min(5*dt,Math.min(cap,want)-c.sp)); if(dP<7) c.sp=Math.min(c.sp,1);
  if(Math.hypot(dx,dy)>1.2){ const th=Math.atan2(dx,-dy); v.h+=Math.max(-2.8*dt,Math.min(2.8*dt,wrapA(th-v.h))); } const fv=fwd(v.h); v.x+=fv[0]*c.sp*dt; v.y+=fv[1]*c.sp*dt; v.v=c.sp; polSep(c);
  if(c.siren){ c.siren.set(emSirenVol(v.x,v.y)); if(c.t>4){ c.siren.mode('yelp'); c.siren.rate(Math.min(7,3.2+(c.t-4)*0.08)); } if(dP<30&&timeS-(c.wh||0)>3.5){ c.wh=timeS; c.siren.whoop(); } }
  // losing them
  if(c.sp<2&&dP>40&&Math.abs(P.v)>2){ c.stuckT=(c.stuckT||0)+dt; if(c.stuckT>6){ polLose('stuck'); return; } } else c.stuckT=0;
  if(!onView(v.x,v.y)&&dP>polViewR()*1.2){ POL.lostT+=dt; if(POL.lostT>10){ polLose('sight'); return; } } else POL.lostT=0;
  if(Math.abs(P.v)<0.3&&dP<32&&!c.paying){ POL.stopT+=dt; if(POL.stopT>5) polFinePopup(); } else if(!c.paying) POL.stopT=0; }
function polLose(why){ const c=POL.chase; if(!c) return; POL.lostWhy=why; POL.lost=(POL.lost||0)+1; toast('\u{1F694} You lost the police \u2014 lie low'); polEndChase(true);
  const nv=POL.cars[POL.cars.length-1]; if(nv&&nv.pol){ nv.pol.search=true; nv.pinT=timeS+1e6; wantSearchGoal(nv); }
  WANT.lvl=1; WANT.t=60; WANT.chased=false; WANT.sp=3; }
function polFinePopup(){ const c=POL.chase; if(!c||c.paying) return; c.paying=true; P_input_clear(); const tot0=c.offs.reduce((a,o)=>a+o.amount,0), tot=Math.min(tot0,Math.max(0,Math.floor(truck.money||0)));
  const rows=c.offs.map(o=>`<div style="display:flex;justify-content:space-between;gap:18px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.12)"><span>${esc(o.reason)}${o.type==='pedestrian'?' <b style="color:#ff6b6b">\u2022 ARREST</b>':''}</span><b>${money(o.amount)}</b></div>`).join('');
  const b=openModal('police',`<h2 style="margin:0 0 6px">\u{1F694} Police \u2014 Fixed Penalty</h2><p style="opacity:.8;margin:0 0 10px">You were pulled over. Offences:</p>${rows}
    <div style="display:flex;justify-content:space-between;margin:10px 0 14px;font-size:1.15em"><span>Total</span><b>${money(tot0)}</b></div>${tot<tot0?`<p style="color:#ffd27a;margin:0 0 10px">You only have ${money(tot)} — the officer takes what you have (no debt).</p>`:''}${c.arrest?'<p style="color:#ff8a8a;margin:0 0 10px">Hitting a pedestrian is a serious offence: you will be <b>arrested</b> and taken to the nearest police station. '+(typeof career!=='undefined'&&career.active?'Your current job will be <b>cancelled</b> (no pay).':'')+'</p>':''}
    <button class="btn go" id="polPay" style="width:100%;font-size:1.1em;padding:12px">PAY ${money(tot)}${c.arrest?' & GO WITH OFFICER':''} <kbd>${typeof pad!=='undefined'&&pad.active?'\u24B6':'Enter'}</kbd></button>`,'polfine');
  if(!document.getElementById('polCss')){ const st=document.createElement('style'); st.id='polCss'; st.textContent='body #ui .mback .modal.polfine{width:min(420px,92vw)!important;height:auto!important;max-height:88dvh!important;border-radius:16px!important;border:1px solid rgba(255,255,255,.12)!important;padding:16px 18px!important;margin:auto!important;overflow:auto;box-sizing:border-box;font-size:15px} body #ui .mback .modal.polfine h2{font-size:20px} @media (orientation:landscape) and (max-height:500px){ body #ui .mback .modal.polfine{max-height:92dvh!important;padding:10px 14px!important;font-size:13px} body #ui .mback .modal.polfine h2{font-size:17px} }'; document.head.appendChild(st); }
  b.addEventListener('pointerdown',e=>e.stopPropagation(),true); const btn=b.querySelector('#polPay'); btn.addEventListener('click',()=>polPay()); }
function P_input_clear(){ if(typeof input!=='undefined') for(const k in input) input[k]=false; }
function polPay(){ const c=POL.chase; if(!c) return; let left=Math.max(0,Math.floor(truck.money||0)); for(const o of c.offs){ const amt=Math.min(o.amount,left); left-=amt; if(typeof OFF!=='undefined') OFF.add({type:o.type,amount:amt,reason:o.reason,police:true}); else truck.money-=amt; }
  closeUI(); const arrest=c.arrest; if(arrest){ polArrest(); polEndChase(false); } else { toast('\u2714 Fine paid \u2014 drive safely'); polEndChase(true); } }
function polArrest(){ let st=null,bd=1e18; for(const s of polStations()){ const q=(s.x-truck.x)**2+(s.y-truck.y)**2; if(q<bd){ bd=q; st=s; } }
  const ov=document.createElement('div'); ov.id='polArrest'; ov.style.cssText='position:fixed;inset:0;z-index:90;background:#000;opacity:0;transition:opacity .9s;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:700 18px system-ui;text-align:center;pointer-events:none';
  ov.innerHTML=`<div style="font-size:44px;color:#ff4d4d;letter-spacing:3px">ARRESTED</div><div style="margin-top:10px;opacity:.85">Taken to ${esc(st?st.name:'the police station')}</div><div style="margin-top:6px;opacity:.6;font-weight:500">${career&&career.active?'Your delivery job has been cancelled. ':''}Your truck will be in the station car park.</div>`;
  document.body.appendChild(ov); POL.arrested=(POL.arrested||0)+1; requestAnimationFrame(()=>ov.style.opacity='1');
  setTimeout(()=>{ if(st) polPark(st); },1100); setTimeout(()=>{ ov.style.opacity='0'; setTimeout(()=>ov.remove(),1000); },3400); }
function polEndMission(){ const a=typeof career!=='undefined'&&career.active; const jt=a&&a.trailer; if(a&&typeof abandonJob==='function') abandonJob(true);
  if(jt){ if(truck.trl===jt){ jt.coupled=false; truck.trl=null; } if(jt.bay&&jt.bay.trailer===jt) jt.bay.trailer=null; const i=world.trailers.indexOf(jt); if(i>=0) world.trailers.splice(i,1); }
  if(typeof clearRoute==='function') clearRoute(); if(typeof saveGame==='function') saveGame(); }
function polPark(st){ polEndMission(); const pk=st.parts.park, x=(pk.x+pk.w/2)*M_T, y=(pk.y+2.2)*M_T; truck.h=0; truck.th=0; truck.x=x; truck.y=y; truck.v=0; if(truck.vx!==undefined){ truck.vx=0; truck.vy=0; }
  if(truck.trl){ const tr=truck.trl; tr.th=0; const k=kingpin(truck); tr.x=k[0]; tr.y=k[1]; tr.v=0; } if(typeof cam!=='undefined'){ cam.x=truck.x*PPM; cam.y=truck.y*PPM; }
  if(typeof NAV!=='undefined'&&NAV.route&&NAV.route.target&&typeof setRoute==='function'){ const t=NAV.route.target; try{ setRoute(t.ref||{x:t.x,y:t.y,name:t.name}); }catch(e){} } }
addEventListener('keydown',e=>{ if(typeof career!=='undefined'&&career.uiOpen==='police'&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); const b=document.getElementById('polPay'); if(b) b.click(); } });
// ---------- parked cars in station bays (static decoration, cheap)
function polDrawParked(vx0,vy0,vx1,vy1){ for(const s of polStations()){ if(s.rect.x1*PPM<vx0||s.rect.x0*PPM>vx1||s.rect.y1*PPM<vy0||s.rect.y0*PPM>vy1) continue;
    s.bays.forEach((b,i)=>{ if((i*7+s.tx)%3) return; emBlit({x:b.x,y:b.y,h:b.h,polT:POL_T[(i+s.tx)%3===2?1:0]},'police'); }); } }

// ---------- v29 blue-light yield: traffic ahead (both directions) slows, pulls to its kerb and stops; the emergency vehicle takes the centre
const EMY={src:[],n:0};
function emSources(){ const out=[]; const c=POL.chase; if(c&&!c.paying) out.push(c.v); if(typeof AMBU!=='undefined') for(const j of AMBU.jobs){ if(j.st==='go'&&j.v) out.push(j.v); else if(j.st==='pull'&&j.k) out.push(j.k); } return out; }
function emInJ(v){ const tx=v.x/M_T, ty=v.y/M_T; for(const J of world.junctions||[]) if(tx>J.x-1&&tx<J.x+J.w+1&&ty>J.y-1&&ty<J.y+J.h+1) return true; return false; }
function emYield(v,acc,dt){ if(v.role==='police'||v.role==='ambulance'||v.role==='fire'){ v.emResp=!!(v.amb&&v.amb.st==='go')||!!(v.fireE&&v.fireE.stt==='go'); if(v.emResp){ v.ghostT=Math.max(v.ghostT||0,0.3); emShift(v,1.3,dt); } return acc; }
  let y=false; for(const E of EMY.src){ const f=fwd(E.h), dx=v.x-E.x, dy=v.y-E.y, al=dx*f[0]+dy*f[1], lat=Math.abs(dx*f[1]-dy*f[0]), par=Math.abs(Math.cos((v.h||0)-(E.h||0))); if(par>0.7&&al>-4&&al<110&&lat<14){ y=true; break; } }
  if(y&&(emInJ(v)||v.ring!=null||v.jHeld)) y=false;   // never stop inside a junction box (no deadlocks): clear it first
  if(y){ v.emY=timeS; EMY.n++; emShift(v,-1.4,dt); return Math.min(acc,-Math.max(1.5,v.v*1.2)); }
  if(beamYield(v,dt)) return acc; if(v.emO) emShift(v,0,dt); return acc; }
// lateral shift relative to heading (+ = right / centre line, - = left / kerb), eased; tracked separately from crash offsets
function emShift(v,to,dt){ const cur=v.emO||0, nw=cur+(to-cur)*Math.min(1,dt*1.6), d=nw-cur, r=rgt(v.h||0); v.offX+=r[0]*d; v.offY+=r[1]*d; v.emO=Math.abs(nw)<0.02&&to===0?0:nw; if(v.emO===0){ v.offX-=r[0]*nw; v.offY-=r[1]*nw; } }
setTimeout(()=>{ const ub=updateBreakdown; updateBreakdown=function(dt){ EMY.src=emSources(); return ub.apply(this,arguments); }; },0);
// ---------- per-frame + drawing
function updatePolice(dt){ if(!world.ready||typeof started!=='undefined'&&!started||(typeof uiBlocking==='function'&&uiBlocking())) return; polUpdatePatrols(dt); polUpdateChase(dt); if(POL.chase&&POL.chase.v) polSep(POL.chase); polDetect(dt); wantUpdate(dt); }
function drawPolice(vx0,vy0,vx1,vy1){ try{ drawHideSpots(vx0,vy0,vx1,vy1); }catch(e){} polDrawParked(vx0,vy0,vx1,vy1); for(const v of POL.cars) if(v.pol&&traffic.vs.includes(v)) emDrawBar(v,false,'police');
  if(POL.parkIn) for(const k of POL.parkIn) emBlit(k,'police'); const c=POL.chase; if(c){ emBlit(c.v,'police'); emDrawBar(c.v,true,'police'); } }
function drawPoliceHUD(){ const c=POL.chase; if(!c||c.paying) return; const w=Math.min(VW-30,360), x=VW/2-w/2, y=VH*0.13, ph=(timeS*3)%1<0.5;
  ctx.save(); ctx.fillStyle=ph?'rgba(200,20,30,0.88)':'rgba(25,60,200,0.88)'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,52,12):ctx.rect(x,y,w,52); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='900 19px system-ui,sans-serif'; ctx.fillText('\u{1F6A8} POLICE \u2014 PULL OVER',VW/2,y+23);
  ctx.font='12px system-ui,sans-serif'; ctx.fillText(POL.stopT>0?'Stay stopped\u2026 '+Math.max(0,5-POL.stopT).toFixed(1)+' s':'Stop the truck and wait for the officer',VW/2,y+42); ctx.restore(); }
setTimeout(()=>{
  const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ updatePolice(dt); }catch(e){ console.warn('[police]',e); } };
  const dt0=drawTraffic; drawTraffic=function(vx0,vy0,vx1,vy1){ const r=dt0.apply(this,arguments); try{ drawPolice(vx0,vy0,vx1,vy1); if(typeof drawAmbulance==='function') drawAmbulance(vx0,vy0,vx1,vy1); }catch(e){ console.warn('[police draw]',e); } return r; };
  const dh=drawHUD; drawHUD=function(){ dh.apply(this,arguments); if(!(typeof bigmap!=='undefined'&&bigmap.open)) { drawPoliceHUD(); drawWantedHUD(); } };
  if(typeof svcMapIcons==='function'){ const sm=svcMapIcons; svcMapIcons=function(icon,px,py){ sm.apply(this,arguments); try{ hideMapDots(px,py); polMapDots(px,py); }catch(e){} }; }
  if(typeof BigRig!=='undefined'){ BigRig.police=()=>({cars:POL.cars.length,chase:!!POL.chase,offences:POL.chase?POL.chase.offs.map(o=>o.type):[]}); }
},0);

// ---------- v31 hide spots: blue dashed bays in car parks / alleys / under bridges; parked inside one while wanted -> cooldown ~6x faster, unseen
const HIDE={list:null};
function hideBad(x,y){ const S=typeof SVC!=='undefined'&&SVC.byType?Object.values(SVC.byType).flat():[]; for(const s of S){ const r=s.rect; if(r&&x>r.x0-12&&x<r.x1+12&&y>r.y0-12&&y<r.y1+12) return true; }
  for(const g of world.garages||[]) if(Math.hypot(g.x-x,g.y-y)<45) return true; for(const f of world.fuel||[]) if(Math.hypot(f.x-x,f.y-y)<40) return true; for(const d of world.depots||[]) if(d.entrance&&Math.hypot(d.entrance.x-x,d.entrance.y-y)<30) return true; return false; }
function hideBuild(){ const L=[], C=70; const ok=(x,y)=>{ if(!inb(x,y)) return false; const t=get(x,y); return t===T.LOT||t===T.CONC||t===T.PLAZA; };
  const nearRd=(x,y)=>{ for(let d=-2;d<=5;d++) for(const [a,b] of [[x+d,y-1],[x+d,y+2],[x-1,y],[x+4,y+1]]) if(inb(a,b)&&isRoadT(idx(a,b))) return true; return false; };
  for(let cy=0;cy<MH;cy+=C) for(let cx=0;cx<MW;cx+=C){ let f=null; for(let y=cy+4;y<cy+C-4&&!f;y+=2) for(let x=cx+4;x<cx+C-6&&!f;x+=2){ let g=true; for(let b=0;b<2&&g;b++) for(let a=0;a<4&&g;a++) if(!ok(x+a,y+b)) g=false; if(g&&nearRd(x,y)) f=[x,y]; }
    if(f&&hideBad(f[0]*M_T,f[1]*M_T)) f=null;
    if(f) L.push({x:f[0]*M_T,y:f[1]*M_T,w:4*M_T,h:2*M_T,kind:get(f[0],f[1])===T.LOT?'car park':'alley'}); }
  // under bridges: road tiles beneath an overpass
  if(world.bridges) for(const b of world.bridges.slice(0,40)){ if(b.under) L.push({x:b.under.x,y:b.under.y,w:4*M_T,h:2*M_T,kind:'bridge'}); }
  HIDE.list=L; return L; }
function hideAt(x,y){ const L=HIDE.list||hideBuild(); for(const h of L) if(x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h) return h; return null; }
function drawHideSpots(vx0,vy0,vx1,vy1){ const L=HIDE.list||hideBuild(); const W1=WANT.lvl||POL.chase, pu=0.75+0.25*Math.sin(timeS*3); ctx.save();
  for(const h of L){ const X=h.x*PPM, Y=h.y*PPM, W=h.w*PPM, H=h.h*PPM; if(X>vx1||X+W<vx0||Y>vy1||Y+H<vy0) continue;
    if(W1){ ctx.shadowColor='rgba(60,150,255,0.9)'; ctx.shadowBlur=18*pu; }   // v38: subtle glow while wanted
    ctx.fillStyle=W1?'rgba(40,120,255,'+(0.30*pu+0.08)+')':'rgba(40,120,255,0.18)'; ctx.fillRect(X,Y,W,H); ctx.shadowBlur=0;
    ctx.setLineDash([8,5]); ctx.lineWidth=3; ctx.strokeStyle='rgba(110,180,255,1)'; ctx.strokeRect(X+1.5,Y+1.5,W-3,H-3); ctx.setLineDash([]);
    const fs=Math.round(PPM*1.6); ctx.font='bold '+fs+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineWidth=4; ctx.strokeStyle='rgba(10,30,70,0.85)'; ctx.strokeText('HIDE',X+W/2,Y+H/2); ctx.fillStyle='#cfe4ff'; ctx.fillText('HIDE',X+W/2,Y+H/2);
    if(W1&&typeof dnLight==='function') dnLight(X+W/2,Y+H/2,Math.max(W,H)*0.8,'rgba(70,150,255,1)',0.5); }
  ctx.restore(); }
function hideMapDots(px,py){ if(!(WANT.lvl||POL.chase)) return; const L=HIDE.list||hideBuild(); ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='bold 9px sans-serif';
  for(const h of L){ const X=px(h.x+h.w/2), Y=py(h.y+h.h/2); if(X<-10||Y<-10||X>VW+10||Y>VH+10) continue; ctx.fillStyle='#1e6cff'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect(X-7,Y-7,14,14,3); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff'; ctx.fillText('H',X,Y+0.5); } ctx.restore(); }
// v38: hide boxes as sat-nav targets (full map tap/click/controller pick) while wanted
function hidePOIs(){ if(!(WANT.lvl||POL.chase)) return []; return (HIDE.list||hideBuild()).map((h,i)=>h.poi||(h.poi={name:'Hide box '+(i+1),x:h.x+h.w/2,y:h.y+h.h/2,hide:h})); }

// v31: full beam behind a car in the outer (fast) lane of a multi-lane road -> it indicates left and moves over one lane when clear (UK keep-left)
function bySeg(v){ const tx=Math.floor(v.x/M_T), ty=Math.floor(v.y/M_T); if(!inb(tx,ty)) return null; const i=idx(tx,ty), h=world.roadH[i], vv=world.roadV[i]; const H=Math.abs(Math.sin(v.h||0))>0.8;
  const id=H?h:vv; if(id==null||id<0) return null; const sg=world.segs[id]; if(!sg||nLanes(sg)<2||(sg.dir==='h')!==H) return null; const lt=(H?v.y:v.x)/M_T; return {sg,cen:Math.abs(lt-(sg.a+sg.w/2))<1.05}; }
function beamYield(v,dt){ const P=truck;
  if(v.byT){ v.byT+=dt; const f=fwd(v.h), al=(P.x-v.x)*f[0]+(P.y-v.y)*f[1]; v.sigBY=v.emO>-3.6?-1:0; emShift(v,-4,dt); if((al>30&&v.byT>3)||v.byT>20||!bySeg(v)){ v.byT=0; v.sigBY=0; BYD.done++; return false; } return true; }
  if(!(typeof HB!=='undefined'&&HB.on)||Math.abs(P.v)<8||Math.abs(v.v||0)<6||v.emO) return false; const f=fwd(v.h), dx=P.x-v.x, dy=P.y-v.y, al=dx*f[0]+dy*f[1], lat=dx*f[1]-dy*f[0];
  if(al>-5||al<-40||Math.abs(lat)>2.5||Math.cos((P.h||0)-(v.h||0))<0.9) return false; const s=bySeg(v); if(!s||!s.cen) return false;
  const r=rgt(v.h); for(const o of traffic.vs){ if(o===v) continue; const ox=o.x-v.x, oy=o.y-v.y, oa=ox*f[0]+oy*f[1], ol=ox*r[0]+oy*r[1]; if(Math.abs(oa)<14&&ol<-2.2&&ol>-6.5) return false; }   // left lane must be clear
  v.byT=0.01; BYD.n++; return true; }
const BYD={n:0,done:0};
setTimeout(()=>{ const dt0=drawTraffic; drawTraffic=function(){ for(const v of traffic.vs) if(v.sigBY) v.sig=v.sigBY; return dt0.apply(this,arguments); }; },0);

// v38: police never pass through vehicles: capsule separation against traffic, parked/attached trailers and the player's rig.
// Blocked -> slow to the blocker's speed / queue; the only way past is a real gap (the steer-around above).
function polObst(){ const L=[]; for(const o of traffic.vs) L.push([o,o.x,o.y,o.h||0,(o.L||4.6),(o.W||2)]);
  for(const t of world.trailers||[]) L.push([t,t.x,t.y,t.th||0,13.6,2.6]);
  if(traffic.parkedIdx&&POL.chase){ const v=POL.chase.v, cx=Math.floor(v.x/64), cy=Math.floor(v.y/64); for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++){ const a=traffic.parkedIdx.get((cx+i)+','+(cy+j)); if(a) for(const o of a) L.push([o,o.x,o.y,o.h||0,o.L||4.4,o.W||1.9]); } }   // parked cars are solid too
  L.push([truck,truck.x,truck.y,truck.h,6.2,2.5]); if(truck.trl){ const t=truck.trl; L.push([t,t.x,t.y,truck.th!=null?truck.th:t.th,13.6,2.6]); } return L; }
function polCaps(x,y,h,len){ const f=fwd(h), a=len/2; return [x-f[0]*a,y-f[1]*a,x+f[0]*a,y+f[1]*a]; }
function polSegD(a,b){ let best=[1e9]; for(let i=0;i<=4;i++){ const px=a[0]+(a[2]-a[0])*i/4, py=a[1]+(a[3]-a[1])*i/4, ex=b[2]-b[0], ey=b[3]-b[1], l2=ex*ex+ey*ey||1, u=Math.max(0,Math.min(1,((px-b[0])*ex+(py-b[1])*ey)/l2)), qx=b[0]+ex*u, qy=b[1]+ey*u, d=Math.hypot(px-qx,py-qy); if(d<best[0]) best=[d,px-qx,py-qy]; }
  for(let i=0;i<=4;i++){ const px=b[0]+(b[2]-b[0])*i/4, py=b[1]+(b[3]-b[1])*i/4, ex=a[2]-a[0], ey=a[3]-a[1], l2=ex*ex+ey*ey||1, u=Math.max(0,Math.min(1,((px-a[0])*ex+(py-a[1])*ey)/l2)), qx=a[0]+ex*u, qy=a[1]+ey*u, d=Math.hypot(px-qx,py-qy); if(d<best[0]) best=[d,qx-px,qy-py]; } return best; }
function polSep(c){ const v=c.v; const me=polCaps(v.x,v.y,v.h,(v.L||4.6)-2); let hit=0;
  for(const [o,x,y,h,len,w] of polObst()){ if(o===v||Math.abs(x-v.x)>18||Math.abs(y-v.y)>18) continue; const ob=polCaps(x,y,h,Math.max(0.1,len-w)), [d,nx,ny]=polSegD(me,ob), need=(w+(v.W||2))/2+0.15;
    if(d<need){ const l=Math.hypot(nx,ny)||1, k=need-d; v.x+=nx/l*k; v.y+=ny/l*k; me[0]+=nx/l*k; me[1]+=ny/l*k; me[2]+=nx/l*k; me[3]+=ny/l*k; hit++;
      const f=fwd(v.h), ov=o===truck?truck.v:(o.v||0), along=(x-v.x)*f[0]+(y-v.y)*f[1]; if(along>0) c.sp=Math.min(c.sp,Math.max(0,Math.abs(ov)*0.9)); } }
  c.blocked=hit>0; POL.blockN=(POL.blockN||0)+hit; }
