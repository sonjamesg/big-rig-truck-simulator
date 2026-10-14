'use strict';
// ===================== cz stage 3b: truck model art overhaul (in-game + dealer) =====================
// Adds a detail pass on top of every model's base art: chrome trim, mirror heads, glass glare, panel seams, air lines,
// soft edge shading and a signature feature per model so each silhouette reads differently from above.
{ const ma0=modelArt, cache={}; modelArt=function(m,col){ const key=m.id+'|'+col; if(cache[key]) return cache[key]; const B=ma0(m,col), c=mkCanvas(B.W,B.H), g=c.getContext('2d'); g.drawImage(B.c,0,0);
  const S=PPM*ART_SCALE, X=v=>B.ox+v*S, Y=v=>B.oy+v*S, st=m.style||{}, nose=st.nose||0, front=CAB.front-nose, cab0=-5.0, cab1=st.roof==='high'?-2.25:-2.55, body=shade(col,1), dk=shade(col,0.55), lt=shade(col,1.45);
  const chrome=(x,y,w,h,r)=>{ const gr=g.createLinearGradient(0,y,0,y+h); gr.addColorStop(0,'#ffffff'); gr.addColorStop(0.45,'#a3abb4'); gr.addColorStop(1,'#eef2f5'); g.fillStyle=gr; rr(g,x,y,w,h,r||2); g.fill(); };
  // air lines + catwalk behind the cab
  g.fillStyle='#3a3d42'; g.fillRect(X(-0.6),Y(cab1+0.05),1.2*S,0.4*S); g.strokeStyle='#5a5e64'; g.lineWidth=1; for(let k=0;k<5;k++){ g.beginPath(); g.moveTo(X(-0.6),Y(cab1+0.1+k*0.08)); g.lineTo(X(0.6),Y(cab1+0.1+k*0.08)); g.stroke(); }
  g.lineWidth=0.05*S; for(const [cl,o] of [['#d33',-0.12],['#36f',0.12]]){ g.strokeStyle=cl; g.beginPath(); g.moveTo(X(o),Y(cab1+0.1)); g.bezierCurveTo(X(o+0.5),Y(cab1+0.5),X(o-0.5),Y(cab1+0.9),X(o*2),Y(-0.6)); g.stroke(); }
  // fifth wheel shine
  g.fillStyle='rgba(255,255,255,0.18)'; g.beginPath(); g.arc(X(-0.2),Y(0.1),0.35*S,0,7); g.fill();
  // cab edge shading (soft AO) + rim light
  g.save(); rr(g,X(-1.25),Y(cab0),2.5*S,(cab1-cab0)*S,0.35*S); g.clip(); const ao=g.createLinearGradient(X(-1.25),0,X(1.25),0); ao.addColorStop(0,'rgba(0,0,0,0.28)'); ao.addColorStop(0.12,'rgba(0,0,0,0)'); ao.addColorStop(0.88,'rgba(0,0,0,0)'); ao.addColorStop(1,'rgba(0,0,0,0.3)'); g.fillStyle=ao; g.fillRect(X(-1.3),Y(cab0),2.6*S,(cab1-cab0)*S);
  const sh=g.createLinearGradient(0,Y(cab0),0,Y(cab1)); sh.addColorStop(0,'rgba(255,255,255,0.12)'); sh.addColorStop(0.3,'rgba(255,255,255,0)'); sh.addColorStop(1,'rgba(0,0,0,0.22)'); g.fillStyle=sh; g.fillRect(X(-1.3),Y(cab0),2.6*S,(cab1-cab0)*S);
  // panel seams + door shut lines
  g.strokeStyle='rgba(0,0,0,0.28)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(X(-1.25),Y(cab0+1.35)); g.lineTo(X(-1.0),Y(cab0+1.35)); g.moveTo(X(1.0),Y(cab0+1.35)); g.lineTo(X(1.25),Y(cab0+1.35)); g.stroke();
  g.strokeStyle='rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(X(-1.12),Y(cab0+0.5)); g.lineTo(X(-1.12),Y(cab1-0.2)); g.moveTo(X(1.12),Y(cab0+0.5)); g.lineTo(X(1.12),Y(cab1-0.2)); g.stroke(); g.restore();
  // windscreen glare + wiper
  g.fillStyle='rgba(200,235,255,0.45)'; g.beginPath(); g.moveTo(X(-0.2),Y(cab0+0.05)); g.lineTo(X(0.15),Y(cab0+0.05)); g.lineTo(X(-0.05),Y(cab0+0.3)); g.lineTo(X(-0.4),Y(cab0+0.3)); g.fill(); g.fillStyle='#111'; g.fillRect(X(0.3),Y(cab0+0.2),0.5*S,1.5);
  // chrome mirror heads on arms
  for(const s of [-1,1]){ g.strokeStyle='#9aa2ab'; g.lineWidth=0.05*S; g.beginPath(); g.moveTo(X(s*1.2),Y(cab0+0.55)); g.lineTo(X(s*1.45),Y(cab0+0.4)); g.stroke(); chrome(X(s*1.45)-0.1*S,Y(cab0+0.22),0.2*S,0.36*S,0.06*S); g.fillStyle='rgba(30,50,70,0.8)'; g.fillRect(X(s*1.45)-0.06*S,Y(cab0+0.27),0.12*S,0.26*S); }
  // front: chrome grille strip / bumper lip + indicator corners
  chrome(X(-1.15),Y(front-0.06),2.3*S,0.09*S,2); g.fillStyle='#ffab2e'; for(const s of [-1,1]) g.fillRect(X(s>0?1.05:-1.2),Y(front-0.04),0.15*S,0.08*S);
  // signature details per model
  const id=m.id;
  if(id==='rigger'){ g.fillStyle=dk; rr(g,X(-0.3),Y(-3.55),0.6*S,0.4*S,0.06*S); g.fill(); g.fillStyle='rgba(255,255,255,0.25)'; g.fillRect(X(-0.25),Y(-3.5),0.5*S,0.06*S); g.strokeStyle='#111'; g.lineWidth=1.5; g.beginPath(); g.moveTo(X(0.9),Y(-3.0)); g.lineTo(X(0.9),Y(-2.5)); g.stroke(); g.fillStyle='#111'; g.beginPath(); g.arc(X(0.9),Y(-3.0),0.05*S,0,7); g.fill(); }
  if(id==='atlas'){ g.fillStyle='#d9dde2'; rr(g,X(-0.45),Y(cab1-1.35),0.9*S,0.6*S,0.08*S); g.fill(); g.fillStyle='#7f8892'; for(let k=0;k<5;k++) g.fillRect(X(-0.4),Y(cab1-1.3+k*0.11),0.8*S,0.04*S); g.fillStyle='#ffab2e'; for(let k=0;k<5;k++){ g.beginPath(); g.arc(X(-0.8+k*0.4),Y(cab0+0.62),0.05*S,0,7); g.fill(); } g.fillStyle='rgba(20,40,60,0.75)'; rr(g,X(-1.25),Y(cab1-0.8),0.1*S,0.5*S,1); g.fill(); rr(g,X(1.15),Y(cab1-0.8),0.1*S,0.5*S,1); g.fill(); }
  if(id==='northline'||id==='titan'){ // long bonnet: louvres, chrome hood strips, ornament
    for(const s of [-1,1]){ g.fillStyle='rgba(0,0,0,0.35)'; for(let k=0;k<6;k++) g.fillRect(X(s*0.62)-0.12*S,Y(front+0.3+k*0.18),0.24*S,0.05*S); }
    chrome(X(-0.05),Y(front+0.05),0.1*S,(nose-0.1)*S,1); g.fillStyle='#ffffff'; g.beginPath(); g.moveTo(X(0),Y(front+0.02)); g.lineTo(X(-0.1),Y(front+0.3)); g.lineTo(X(0.1),Y(front+0.3)); g.fill();
    if(id==='titan'){ chrome(X(-1.0),Y(front-0.2),2.0*S,0.2*S,3); g.fillStyle='#333'; for(let k=0;k<10;k++) g.fillRect(X(-0.9+k*0.2),Y(front-0.18),0.06*S,0.16*S); for(const s of [-1,1]){ chrome(X(s*0.45)-0.07*S,Y(cab0+0.2),0.14*S,0.75*S,0.07*S); chrome(X(s*0.68)-0.06*S,Y(cab0+0.2),0.12*S,0.6*S,0.06*S); } g.fillStyle='#fff6c8'; for(const s of [-1,1]){ g.beginPath(); g.arc(X(s*0.7),Y(front-0.3),0.11*S,0,7); g.fill(); } } }
  if(id==='volta'){ g.fillStyle='#14304f'; rr(g,X(-0.85),Y(cab0+0.9),1.7*S,1.25*S,0.08*S); g.fill(); g.strokeStyle='#4aa3ff'; g.lineWidth=1; for(let i=0;i<=5;i++){ g.beginPath(); g.moveTo(X(-0.85+i*0.34),Y(cab0+0.9)); g.lineTo(X(-0.85+i*0.34),Y(cab0+2.15)); g.stroke(); } for(let j=0;j<=3;j++){ g.beginPath(); g.moveTo(X(-0.85),Y(cab0+0.9+j*0.415)); g.lineTo(X(0.85),Y(cab0+0.9+j*0.415)); g.stroke(); }
    g.fillStyle='rgba(255,255,255,0.25)'; g.fillRect(X(-0.8),Y(cab0+0.95),0.3*S,1.15*S); g.fillStyle='#33e0ff'; g.beginPath(); g.arc(X(1.25),Y(cab1-0.4),0.08*S,0,7); g.fill(); }
  if(id==='kestrel'){ g.fillStyle='#16181b'; rr(g,X(-1.15),Y(cab1-0.35),2.3*S,0.22*S,0.06*S); g.fill(); for(const s of [-1,1]) g.fillRect(X(s*0.9)-0.04*S,Y(cab1-0.25),0.08*S,0.25*S); g.fillStyle='#16181b'; for(const s of [-1,1]) for(let k=0;k<3;k++) g.fillRect(X(s>0?1.12:-1.22),Y(cab0+1.2+k*0.2),0.1*S,0.1*S);
    g.fillStyle='rgba(0,0,0,0.5)'; rr(g,X(-0.3),Y(cab0+1.0),0.6*S,0.5*S,0.2*S); g.fill(); }
  g.strokeStyle='rgba(0,0,0,0.55)'; g.lineWidth=1.5; rr(g,X(-1.25),Y(cab0),2.5*S,(cab1-cab0)*S,0.35*S); g.stroke();
  return cache[key]={c,W:B.W,H:B.H,ox:B.ox,oy:B.oy}; }; }
// dealer showroom: add a lit floor + a side-profile render under the top view
{ const rd0=renderDealer; renderDealer=function(stageOnly){ rd0(stageOnly); const b=uiRoot.querySelector('.mback'); if(!b||career.uiOpen!=='dealer') return; const stg=b.querySelector('.stage'), fl=stg&&stg.querySelector('.floor'); if(!fl||stg.querySelector('.czds')) return;
  const m=modelById(dealerState.sel), col=dealerState.col||career.colors[m.id]||m.cols[0]; const cv=document.createElement('canvas'); cv.className='czds'; cv.width=560; cv.height=220; cv.style.cssText='width:min(100%,280px);height:auto;display:block;margin:4px auto 0';
  fl.insertAdjacentElement('afterend',cv); const g=cv.getContext('2d'), sg=g.createRadialGradient(280,190,10,280,190,260); sg.addColorStop(0,'rgba(255,240,200,0.28)'); sg.addColorStop(1,'rgba(255,240,200,0)'); g.fillStyle=sg; g.fillRect(0,0,560,220);
  g.fillStyle='rgba(255,255,255,0.06)'; g.fillRect(0,196,560,24); const sc=54; czSide(g,280+1.8*sc,196,sc,m,col,czFitted(m.id));
  g.save(); g.globalAlpha=0.12; g.translate(0,392); g.scale(1,-1); czSide(g,280+1.8*sc,196,sc,m,col,czFitted(m.id)); g.restore(); }; }
