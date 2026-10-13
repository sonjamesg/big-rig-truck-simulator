'use strict';
// ===================== v14 Albion container terminal: ships sail in, berth, gantry cranes unload them, ships leave (loop) =====================
const PORTSIM={t:0};
function portInit(){ const P=world.port; if(!P||P.ready) return; P.ready=1; P.landed=0; for(const b of P.berths) b.wait=2+b.i*9; }
function updatePort(dt){ const P=world.port; if(!P||!P.berths) return; portInit(); const laneX=P.edge+16, dockX=P.edge+5;
  for(const b of P.berths){ const yc=(b.y0+b.y1)/2; let s=b.ship;
    if(!s){ b.wait-=dt; if(b.wait<=0){ const n=18+((Math.random()*12)|0); b.ship=s={x:laneX,y:150,st:'in',n,n0:n,hue:(Math.random()*360)|0,cols:Array.from({length:n},()=>['#c0392b','#2e86c1','#e67e22','#27ae60','#8e44ad','#d4ac0d','#7f8c8d','#16a085'][(Math.random()*8)|0])}; } continue; }
    if(s.st==='in'){ const d=yc-s.y; s.y+=Math.sign(d)*Math.min(Math.abs(d),dt*Math.max(0.8,Math.min(6,Math.abs(d)*0.12))); if(Math.abs(d)<0.2){ s.st='berth'; } }
    else if(s.st==='berth'){ s.x-=dt*Math.max(0.4,(s.x-dockX)*0.25); if(s.x<=dockX){ s.x=dockX; s.st='dock'; } }
    else if(s.st==='dock'){ if(s.n<=0){ s.st='unberth'; s.hold=2; } }
    else if(s.st==='unberth'){ s.hold-=dt; if(s.hold<0){ s.x+=dt*1.2; if(s.x>=laneX){ s.x=laneX; s.st='out'; s.v=0; } } }
    else if(s.st==='out'){ s.v=Math.min(6,s.v+dt*0.5); s.y+=s.v*dt; if(s.y>470){ b.ship=null; b.wait=8+Math.random()*14; } } }
  // cranes: crane 0 -> berth 0, cranes 1&2 -> berth 1, crane 3 -> berth 2
  const asg=[0,1,1,2], off=[0,-9,9,0];
  for(const c of P.cranes){ const b=P.berths[asg[c.i]], s=b.ship, yc=(b.y0+b.y1)/2+off[c.i]; c.ty=yc; c.y+=Math.sign(c.ty-c.y)*Math.min(Math.abs(c.ty-c.y),dt*1.5);
    const work=s&&s.st==='dock'&&s.n>0&&Math.abs(c.y-c.ty)<0.5;
    if(c.ph===0){ const tgt=work?1:0.15; c.tr+=Math.sign(tgt-c.tr)*Math.min(Math.abs(tgt-c.tr),dt*0.45); if(work&&c.tr>=1){ c.ph=1; c.w=0.8; } }
    else if(c.ph===1){ c.w-=dt; if(c.w<=0){ if(s&&s.n>0){ s.n--; c.car=s.cols[s.n]; } c.ph=2; } }
    else if(c.ph===2){ c.tr=Math.max(0,c.tr-dt*0.4); if(c.tr<=0){ c.ph=3; c.w=0.6; } }
    else { c.w-=dt; if(c.w<=0){ c.car=null; P.landed++; c.ph=0; } } } }
function drawPortLow(vx0,vy0,vx1,vy1){ const P=world.port; if(!P||!P.berths) return; if(P.edge*TILE<vx0-3000||P.x0*TILE>vx1+3000) return; const T_=TILE;
  for(const b of P.berths){ const s=b.ship; if(!s) continue; const L=36*T_, W=7*T_, x=s.x*T_, y=s.y*T_;
    ctx.save(); ctx.translate(x,y); ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(-W/2+14,-L/2+14,W,L); ctx.rotate(Math.PI);
    ctx.fillStyle='hsl('+s.hue+',45%,32%)'; ctx.beginPath(); ctx.moveTo(-W/2,-L/2+W*0.2); ctx.lineTo(0,-L/2-W*0.6); ctx.lineTo(W/2,-L/2+W*0.2); ctx.lineTo(W/2,L/2); ctx.lineTo(-W/2,L/2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#8f2a1d'; ctx.fillRect(-W/2+4,-L/2+W*0.2,W-8,L-W*0.2-4);
    ctx.fillStyle='#ecf0f1'; ctx.fillRect(-W/2+6,L/2-4*T_,W-12,3.2*T_); ctx.fillStyle='#2c3e50'; ctx.fillRect(-W/2+12,L/2-3.6*T_,W-24,0.8*T_);
    const cw=(W-16)/3, ch=2.9*T_/2; for(let k=0;k<s.n0;k++){ if(k>=s.n) break; const col=k%3, row=(k/3)|0; ctx.fillStyle=s.cols[k]; ctx.fillRect(-W/2+8+col*cw,-L/2+W*0.5+row*ch*1.05,cw-2,ch-2); }
    ctx.restore(); }
  // crane rails along the apron
  ctx.fillStyle='rgba(60,60,60,0.55)'; for(const rx of [P.quayX-1.2,P.edge-0.6]) ctx.fillRect(rx*T_,P.y0*T_,4,(P.y1-P.y0)*T_); }
function drawPortHigh(vx0,vy0,vx1,vy1){ const P=world.port; if(!P||!P.cranes) return; if(P.edge*TILE<vx0-3000||P.x0*TILE>vx1+3000) return; const T_=TILE;
  for(const c of P.cranes){ const y=c.y*T_, xa=(P.quayX-3)*T_, xb=(P.edge+12)*T_, w=2.6*T_;
    ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(xa+30,y-w/2+30,xb-xa,w);
    ctx.fillStyle='#e8a317'; ctx.fillRect(xa,y-w/2,xb-xa,w); ctx.strokeStyle='#8a5d08'; ctx.lineWidth=2; for(let x=xa;x<xb;x+=18){ ctx.beginPath(); ctx.moveTo(x,y-w/2); ctx.lineTo(x+18,y+w/2); ctx.stroke(); }
    ctx.fillStyle='#b77d0e'; for(const lx of [P.quayX-1.6,P.edge-1]) { ctx.fillRect(lx*T_-8,y-w/2-10,16,w+20); }
    ctx.fillStyle='#d0d3d6'; ctx.fillRect(xa-3*T_,y-w/2-4,3*T_,w+8);
    const tx=((P.quayX-1)+(P.edge+5-(P.quayX-1))*c.tr)*T_; ctx.fillStyle='#34495e'; ctx.fillRect(tx-14,y-16,28,32);
    if(c.car){ ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(tx-14+10,y-3*T_+10,28,6*T_); ctx.fillStyle=c.car; ctx.fillRect(tx-14,y-3*T_,28,6*T_); ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.strokeRect(tx-14,y-3*T_,28,6*T_); } }
  ctx.lineWidth=1; }
