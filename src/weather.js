// ---------- weather: random clear / rain / fog cycles (host-synced in MP, saved) ----------
const WX={st:'clear',rain:0,fog:0,wet:0,timer:240,grip:1,drops:null,wip:0};
function wxPick(){ const r=Math.random(); WX.st=r<0.58?'clear':r<0.85?'rain':'fog'; WX.timer=(WX.st==='clear'?240:150)+Math.random()*240; }
function updateWeather(dt,run){ const host=!(typeof MP!=='undefined'&&MP.on&&!MP.host);
  if(run&&host){ WX.timer-=dt; if(WX.timer<=0) wxPick(); }
  const tr=WX.st==='rain'?1:0, tf=WX.st==='fog'?1:0; WX.rain+=(tr-WX.rain)*Math.min(1,dt*0.15); WX.fog+=(tf-WX.fog)*Math.min(1,dt*0.12);
  WX.wet=Math.max(WX.rain, WX.wet-dt*0.006); WX.grip=1-0.3*WX.wet; WX.wip+=dt*(WX.rain>0.2?3.2:0); }
function drawWeather(vx0,vy0,vx1,vy1,z){ const W=WX.wet, Rn=WX.rain, F=WX.fog; if(W<0.02&&F<0.02) return; ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  if(W>0.02){ ctx.globalCompositeOperation='multiply'; ctx.fillStyle='rgba(150,165,190,'+(0.45*W)+')'; ctx.fillRect(0,0,VW,VH); ctx.globalCompositeOperation='source-over';
    // wet sheen: soft diagonal glints that drift with the camera
    ctx.globalCompositeOperation='screen'; ctx.fillStyle='rgba(120,140,170,'+(0.08*W)+')'; const off=((vx0+vy0)*z)%160; for(let k=-200;k<VW+VH;k+=160){ ctx.beginPath(); ctx.moveTo(k-off,0); ctx.lineTo(k-off+40,0); ctx.lineTo(k-off+40-VH*0.5,VH); ctx.lineTo(k-off-VH*0.5,VH); ctx.fill(); } ctx.globalCompositeOperation='source-over'; }
  if(Rn>0.02){ if(!WX.drops){ WX.drops=[]; for(let i=0;i<420;i++) WX.drops.push([Math.random()*VW,Math.random()*VH,0.6+Math.random()*0.8]); }
    ctx.strokeStyle='rgba(200,215,235,'+(0.45*Rn)+')'; ctx.lineWidth=1.2; ctx.beginPath(); const n=(WX.drops.length*Rn)|0;
    for(let i=0;i<n;i++){ const d=WX.drops[i]; d[1]+=14*d[2]; d[0]-=3*d[2]; if(d[1]>VH){ d[1]=-10; d[0]=Math.random()*VW*1.1; } if(d[0]<-10) d[0]+=VW; ctx.moveTo(d[0],d[1]); ctx.lineTo(d[0]+3*d[2],d[1]-14*d[2]); } ctx.stroke();
    ctx.fillStyle='rgba(220,230,245,'+(0.35*Rn)+')'; for(let i=0;i<40*Rn;i++){ const x=Math.random()*VW, y=Math.random()*VH; ctx.fillRect(x,y,2,1); } }   // splashes
  if(F>0.02){ const tx=VW/2, ty=VH/2, night=(typeof DN!=='undefined')?DN.dark:0, c=night>0.5?'30,36,50':'205,210,215'; const gr=ctx.createRadialGradient(tx,ty,60,tx,ty,Math.max(VW,VH)*0.55); gr.addColorStop(0,'rgba('+c+','+(0.25*F)+')'); gr.addColorStop(1,'rgba('+c+','+(0.85*F)+')'); ctx.fillStyle=gr; ctx.fillRect(0,0,VW,VH); }
  ctx.restore(); }
function drawWeatherHUD(){ if(WX.rain<0.2&&WX.fog<0.2) return; const x=VW-126, y=98, w=112, h=26; ctx.save(); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; ctx.fillStyle='rgba(13,15,20,0.85)'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,h,8):ctx.rect(x,y,w,h); ctx.fill(); ctx.strokeStyle='rgba(207,227,255,0.45)'; ctx.lineWidth=1.5; ctx.stroke(); ctx.fillStyle='#cfe3ff'; ctx.font='700 13px system-ui,sans-serif'; ctx.textBaseline='middle';
  if(WX.rain>=0.2){ const a=Math.sin(WX.wip)*0.9; ctx.strokeStyle='#cfe3ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x+16,y+20,12,Math.PI*1.1,Math.PI*1.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+16,y+20); ctx.lineTo(x+16+Math.sin(a)*12,y+20-Math.cos(a)*12); ctx.stroke(); ctx.fillText('RAIN \u2022 wipers',x+32,y+13); }
  else ctx.fillText('\u2601 FOG \u2022 low vis',x+10,y+13); ctx.restore(); }

// v37: puddles live on the road surface, drawn in world space before vehicles so everything drives over them
function drawPuddles(vx0,vy0,vx1,vy1,z){ const W=WX.wet; if(!(W>0.02)) return; const t0x=Math.floor(vx0/TILE), t1x=Math.ceil(vx1/TILE), t0y=Math.floor(vy0/TILE), t1y=Math.ceil(vy1/TILE), step=z<0.4?2:1;
  for(let ty=t0y;ty<=t1y;ty+=step) for(let tx=t0x;tx<=t1x;tx+=step){ const hsh=((tx*73856093)^(ty*19349663))>>>0; if(hsh%23) continue; const t=get(tx,ty); if(t!==T.ROAD) continue;
    const px=tx*TILE+(hsh>>>8)%20, py=ty*TILE+(hsh>>>13)%20, rx=10+(hsh>>>5)%14, ry=rx*0.55;
    ctx.fillStyle='rgba(40,55,80,'+(0.35*W)+')'; ctx.beginPath(); ctx.ellipse(px,py,rx,ry,0,0,7); ctx.fill();
    ctx.fillStyle='rgba(200,220,255,'+(0.22*W)+')'; ctx.beginPath(); ctx.ellipse(px-rx*0.25,py-ry*0.3,rx*0.45,ry*0.3,0,0,7); ctx.fill(); } }
