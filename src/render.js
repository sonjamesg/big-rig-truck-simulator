'use strict';
// ===================== TEXTURES & CHUNK RENDERING =====================
function mkCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function speckle(ctx,w,h,cols,n,rnd,size=1){ for(let i=0;i<n;i++){ ctx.fillStyle=cols[(rnd()*cols.length)|0]; ctx.fillRect((rnd()*w)|0,(rnd()*h)|0,size,size); } }
const TEX={};
function makeTextures(){
  const V=4;
  function variants(name,fn){ TEX[name]=[]; for(let v=0;v<V;v++){ const c=mkCanvas(TILE,TILE), g=c.getContext('2d'); fn(g,mulberry(name.length*97+v*13+1)); TEX[name].push(c);} }
  variants('grass',(g,r)=>{ g.fillStyle='#5d9b3a'; g.fillRect(0,0,32,32); speckle(g,32,32,['#6aab45','#4f8a30','#74b64e','#558f35'],140,r); speckle(g,32,32,['#83c35a','#3f7426'],18,r,2); });
  variants('pgrass',(g,r)=>{ g.fillStyle='#6cb043'; g.fillRect(0,0,32,32); speckle(g,32,32,['#7bc150','#5f9f39','#86c95c'],120,r); if(r()<0.3){ g.fillStyle='#f4e04d'; g.fillRect((r()*30)|0,(r()*30)|0,2,2); g.fillStyle='#fff'; g.fillRect((r()*30)|0,(r()*30)|0,2,2);} });
  variants('asph',(g,r)=>{ g.fillStyle='#3d4047'; g.fillRect(0,0,32,32); speckle(g,32,32,['#474a52','#35383e','#50535b','#2f3237'],170,r); if(r()<0.25){ g.strokeStyle='rgba(20,20,24,0.5)'; g.beginPath(); g.moveTo(r()*32,r()*32); g.lineTo(r()*32,r()*32); g.stroke(); } });
  variants('walk',(g,r)=>{ g.fillStyle='#b9b6ae'; g.fillRect(0,0,32,32); speckle(g,32,32,['#c4c1b9','#aeaba3'],80,r); g.fillStyle='#9d9a92'; g.fillRect(0,0,32,1); g.fillRect(0,16,32,1); g.fillRect(0,0,1,32); g.fillRect(16,0,1,32); });
  variants('conc',(g,r)=>{ g.fillStyle='#a3a39c'; g.fillRect(0,0,32,32); speckle(g,32,32,['#adada6','#97978f','#8f8f88'],110,r); g.fillStyle='#86867e'; g.fillRect(0,0,32,1); g.fillRect(0,0,1,32); if(r()<0.3){g.fillStyle='rgba(60,50,40,0.18)'; g.beginPath(); g.ellipse(r()*32,r()*32,6,4,0,0,7); g.fill();} });
  variants('plaza',(g,r)=>{ g.fillStyle='#c9bfae'; g.fillRect(0,0,32,32); for(let y=0;y<32;y+=8) for(let x=0;x<32;x+=8){ g.fillStyle=['#cfc5b4','#c2b8a6','#d6ccbb'][(r()*3)|0]; g.fillRect(x+((y/8)%2?4:0),y,7,7);} });
  variants('gravel',(g,r)=>{ g.fillStyle='#8f8068'; g.fillRect(0,0,32,32); speckle(g,32,32,['#a08f74','#7c6e58','#b3a283','#6a5e4b'],260,r); });
  variants('sand',(g,r)=>{ g.fillStyle='#d8c98f'; g.fillRect(0,0,32,32); speckle(g,32,32,['#e3d59c','#cbbb80','#bfae72'],120,r); });
  variants('quay',(g,r)=>{ g.fillStyle='#8d9196'; g.fillRect(0,0,32,32); speckle(g,32,32,['#979ba0','#83878c','#7a7e83'],120,r); g.fillStyle='#777b80'; g.fillRect(0,31,32,1); g.fillRect(31,0,1,32); });
  variants('field',(g,r)=>{ g.fillStyle='#7a6a3f'; g.fillRect(0,0,32,32); speckle(g,32,32,['#86754a','#6d5e36'],120,r); });
  variants('island',(g,r)=>{ g.fillStyle='#6cb043'; g.fillRect(0,0,32,32); speckle(g,32,32,['#7bc150','#5f9f39'],120,r); });
  variants('rock',(g,r)=>{ g.fillStyle='#8e8b84'; g.fillRect(0,0,32,32); speckle(g,32,32,['#9a978f','#827f78','#a6a39b','#76736c'],200,r); if(r()<0.4){ g.strokeStyle='rgba(60,58,54,0.4)'; g.beginPath(); g.moveTo(r()*32,r()*32); g.lineTo(r()*32,r()*32); g.stroke(); } });
  variants('water',(g,r)=>{ g.fillStyle='#2f6fb3'; g.fillRect(0,0,32,32); speckle(g,32,32,['#3579bf','#2a66a6','#3a82c8'],90,r,2); g.strokeStyle='rgba(170,215,255,0.35)'; for(let i=0;i<2;i++){ const x=r()*24,y=r()*30; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+4,y-2,x+8,y); g.stroke(); } });
}
// ---- road markings per tile
function drawRoadTile(g,tx,ty,px,py){
  const i=idx(tx,ty), h=world.roadH[i], v=world.roadV[i];
  g.drawImage(TEX.asph[(hash2(tx,ty)*4)|0],px,py);
  const hs= h>=0?world.segs[h]:null, vs= v>=0?world.segs[v]:null;
  if((hs&&vs)||(!hs&&!vs)) return;        // junction / kerb corner: plain asphalt
  const s=hs||vs; const horiz=!!hs;
  const off = horiz? ty-s.a : tx-s.a;       // lane index across the road
  const along = horiz? tx : ty;
  // crosswalk if adjacent along-road tile is a junction
  const n1 = horiz? [tx-1,ty]:[tx,ty-1], n2 = horiz? [tx+1,ty]:[tx,ty+1];
  const jn = p=>inb(p[0],p[1]) && world.roadH[idx(p[0],p[1])]>=0 && world.roadV[idx(p[0],p[1])]>=0;
  if((s.type==='city'||s.type==='town'||s.type==='res') && (jn(n1)||jn(n2))){
    g.fillStyle='#e8e8e2';
    for(let k=3;k<32;k+=8){ if(horiz) g.fillRect(px+6,py+k,20,4); else g.fillRect(px+k,py+6,4,20); }
    return;
  }
  const line=(pos,col,dashed,w)=>{ g.fillStyle=col; // pos = offset across tile (0..32)
    for(let a=0;a<32;a++){ const wa=along*32+a; if(dashed && (wa%48)>=24) continue;
      if(horiz) g.fillRect(px+a,py+pos,1,w); else g.fillRect(px+pos,py+a,w,1); } };
  const half=s.w/2;
  if(s.type==='lane'){ if(off===0) line(1,'rgba(120,110,90,0.5)',false,3); if(off===s.w-1) line(28,'rgba(120,110,90,0.5)',false,3); return; }
  if(s.type==='dual'){ g.fillStyle='#8f9188'; if(off===half-1){ if(horiz) g.fillRect(px,py+25,32,7); else g.fillRect(px+25,py,7,32); g.fillStyle='#6a8f45'; if(horiz) g.fillRect(px,py+27,32,5); else g.fillRect(px+27,py,5,32); }
    if(off===half){ g.fillStyle='#8f9188'; if(horiz) g.fillRect(px,py,32,7); else g.fillRect(px,py,7,32); g.fillStyle='#6a8f45'; if(horiz) g.fillRect(px,py,32,5); else g.fillRect(px,py,5,32); } }
  if(s.type==='hwy'){ if(off===half-1) line(29,'#f2c230',false,2); if(off===half) line(1,'#f2c230',false,2); }
  else if(s.type!=='dual'){ if(off===half-1) line(30,'#ececec',true,2); }          // UK-style white centre line
  if(off===0) line(3,'#ececec',false,2);                     // edge lines
  if(off===s.w-1) line(27,'#ececec',false,2);
  if(off>0 && off<s.w && off!==half) line(0,'#ececec',true,2); // lane dividers at tile boundary
}
// ---- objects
function shade(hex,f){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255; const m=v=>Math.max(0,Math.min(255,Math.round(f>1? v+(255-v)*(f-1): v*f))); return `rgb(${m(r)},${m(g)},${m(b)})`; }
function drawShadowRect(g,x,y,w,h,s){ g.fillStyle='rgba(10,15,25,0.33)'; g.beginPath(); g.moveTo(x+w,y); g.lineTo(x+w+s,y+s); g.lineTo(x+w+s,y+h+s); g.lineTo(x+s,y+h+s); g.lineTo(x,y+h); g.lineTo(x+w,y+h); g.closePath(); g.fill(); }
function acUnit(g,x,y,r){ g.fillStyle='#d6d8dc'; g.fillRect(x,y,14,12); g.fillStyle='#9ea2a8'; g.fillRect(x,y+11,14,1); g.fillRect(x+13,y,1,12); g.fillStyle='#55595f'; g.beginPath(); g.arc(x+7,y+6,4,0,7); g.fill(); g.strokeStyle='#888'; g.beginPath(); g.moveTo(x+3,y+6); g.lineTo(x+11,y+6); g.moveTo(x+7,y+2); g.lineTo(x+7,y+10); g.stroke(); g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(x+14,y+2,3,12); }
function roof(g,o){
  if(ROOF2[o.style]) return roof2(g,o);
  const r=mulberry(o.seed), x=o.x,y=o.y,w=o.w,h=o.h, st=o.style;
  const pal={office:['#9aa3ad','#7f8893'],glass:['#5b88a8','#3f6a8a'],gravel:['#8f8a80','#7a756c'],tower:['#b8b4ac','#8f8b84'],brick:['#a0503c','#7f3b2b'],flat:['#c5c0b5','#a39e93'],green:['#6f9a5a','#557a44'],warehouse:['#8c97a3','#6f7a86'],depot:['#d77c2b','#a85b1b'],shop:['#d8d2c4','#b0a99a'],house:['#b5523b','#8a3a28']}[st]||['#999','#777'];
  if(st==='house'){
    const c=['#b5523b','#6b6f78','#8a5a3b','#3f5f7f','#a7453a'][(r()*5)|0];
    const horiz=w>=h; g.fillStyle=shade(c,1.15); g.fillRect(x,y,w,h);
    g.fillStyle=shade(c,0.78); if(horiz) g.fillRect(x,y+h/2,w,h/2); else g.fillRect(x+w/2,y,w/2,h);
    g.strokeStyle='rgba(0,0,0,0.18)'; g.lineWidth=1;
    for(let k=4;k<(horiz?h:w);k+=4){ g.beginPath(); if(horiz){ g.moveTo(x,y+k); g.lineTo(x+w,y+k);} else { g.moveTo(x+k,y); g.lineTo(x+k,y+h);} g.stroke(); }
    g.fillStyle=shade(c,0.6); if(horiz) g.fillRect(x,y+h/2-1,w,2); else g.fillRect(x+w/2-1,y,2,h);
    g.fillStyle='#777'; g.fillRect(x+w*0.7,y+h*0.2,6,6); g.strokeStyle=shade(c,0.5); g.strokeRect(x+0.5,y+0.5,w-1,h-1);
    return;
  }
  if(st==='barn'){ g.fillStyle='#9c2f22'; g.fillRect(x,y,w,h); g.fillStyle='#7d2419'; g.fillRect(x,y+h/2,w,h/2); g.strokeStyle='rgba(0,0,0,0.25)'; for(let k=3;k<w;k+=5){ g.beginPath(); g.moveTo(x+k,y); g.lineTo(x+k,y+h); g.stroke(); } g.fillStyle='#5a1a12'; g.fillRect(x,y+h/2-1,w,2); return; }
  if(st==='church'){ g.fillStyle='#8a8f96'; g.fillRect(x,y,w,h); const cw=w*0.32, ch=h*0.32; g.fillStyle='#6d5d4b';
    g.fillRect(x+w/2-cw/2,y,cw,h); g.fillRect(x,y+h*0.3,w,ch); g.fillStyle='#57493b'; g.fillRect(x+w/2-1,y,2,h); g.fillRect(x,y+h*0.3+ch/2-1,w,2);
    g.fillStyle='#4a4f57'; g.beginPath(); g.arc(x+w/2,y+h*0.12,cw*0.45,0,7); g.fill(); g.fillStyle='#d4ac0d'; g.fillRect(x+w/2-1,y+h*0.12-8,2,16); g.fillRect(x+w/2-6,y+h*0.12-3,12,2); return; }
  if(st==='stadium'){ const cx=x+w/2, cy=y+h/2; g.fillStyle='#9aa0a8'; g.beginPath(); g.ellipse(cx,cy,w/2,h/2,0,0,7); g.fill();
    for(let k=0;k<5;k++){ g.strokeStyle=k%2?'#c0392b':'#2e5c9a'; g.lineWidth=6; g.beginPath(); g.ellipse(cx,cy,w/2-8-k*7,h/2-8-k*7,0,0,7); g.stroke(); }
    g.lineWidth=1; g.fillStyle='#3f9b3a'; g.fillRect(cx-w*0.28,cy-h*0.2,w*0.56,h*0.4); g.fillStyle='#48a843'; for(let k=0;k<8;k+=2) g.fillRect(cx-w*0.28+k*w*0.07,cy-h*0.2,w*0.07,h*0.4);
    g.strokeStyle='#fff'; g.lineWidth=2; g.strokeRect(cx-w*0.28,cy-h*0.2,w*0.56,h*0.4); g.beginPath(); g.moveTo(cx,cy-h*0.2); g.lineTo(cx,cy+h*0.2); g.stroke(); g.beginPath(); g.arc(cx,cy,h*0.08,0,7); g.stroke(); g.lineWidth=1; return; }
  if(st==='carpark'){ g.fillStyle='#7f8389'; g.fillRect(x,y,w,h); g.strokeStyle='#e8e8e2'; g.lineWidth=2; for(let row=0;row<2;row++){ const yy=y+12+row*(h/2); for(let k=x+12;k<x+w-12;k+=22){ g.beginPath(); g.moveTo(k,yy); g.lineTo(k,yy+38); g.stroke(); if(r()<0.6){ g.fillStyle=['#c0392b','#ecf0f1','#2c3e50','#2980b9','#f1c40f'][(r()*5)|0]; g.fillRect(k+4,yy+3,14,32); g.fillStyle='rgba(30,40,60,0.8)'; g.fillRect(k+5,yy+9,12,6);} } }
    g.fillStyle='#f2c230'; g.fillRect(x+w-40,y+h/2-14,30,28); g.fillStyle='#333'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('P',x+w-25,y+h/2); g.strokeStyle='#55595f'; g.lineWidth=4; g.strokeRect(x+2,y+2,w-4,h-4); g.lineWidth=1; return; }
  // base slab + parapet
  g.fillStyle=pal[0]; g.fillRect(x,y,w,h);
  if(st==='gravel'){ speckle(g,w,h,[],0,r); for(let i=0;i<w*h/12;i++){ g.fillStyle=['#9a958a','#837e74','#a7a296'][(r()*3)|0]; g.fillRect(x+r()*w,y+r()*h,2,2);} }
  if(st==='glass'){ g.fillStyle='rgba(255,255,255,0.12)'; for(let k=0;k<w+h;k+=18){ g.beginPath(); g.moveTo(x+k,y); g.lineTo(x+k-h*0.6,y+h); g.lineTo(x+k-h*0.6+7,y+h); g.lineTo(x+k+7,y); g.fill(); } g.strokeStyle='rgba(20,40,60,0.4)'; for(let k=16;k<w;k+=16){ g.beginPath(); g.moveTo(x+k,y); g.lineTo(x+k,y+h); g.stroke(); } }
  if(st==='green'){ for(let i=0;i<w*h/30;i++){ g.fillStyle=['#7fae67','#5d8749','#8dbb72'][(r()*3)|0]; g.beginPath(); g.arc(x+4+r()*(w-8),y+4+r()*(h-8),2+r()*3,0,7); g.fill(); } }
  if(st==='warehouse'||st==='depot'){ g.fillStyle=pal[1]; for(let k=0;k<w;k+=6) g.fillRect(x+k,y,2,h);
    g.fillStyle='rgba(190,225,245,0.75)'; for(let k=12;k<w-12;k+=40) g.fillRect(x+k,y+8,10,h-16);
    if(st==='depot'){ g.fillStyle='#fff'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('BIG RIG HAULAGE',x+w/2,y+h/2); }
    if(o.logo){ g.save(); g.fillStyle='rgba(255,255,255,0.85)'; g.fillRect(x+w/2-o.logo.length*8-10,y+h/2-16,o.logo.length*16+20,32); g.fillStyle='#22324a'; g.font='900 22px Arial Black,Arial,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(o.logo,x+w/2,y+h/2+1); g.restore(); } }
  if(st==='solar'){ for(let yy=y+10;yy<y+h-20;yy+=16) for(let xx=x+10;xx<x+w-24;xx+=22){ g.fillStyle='#1f3b73'; g.fillRect(xx,yy,20,13); g.strokeStyle='#8fa8d8'; g.strokeRect(xx+0.5,yy+0.5,19,12); g.beginPath(); g.moveTo(xx+10,yy); g.lineTo(xx+10,yy+13); g.stroke(); } }
  if(st==='hospital'){ g.fillStyle='#e9ecef'; g.fillRect(x+4,y+4,w-8,h-8); g.fillStyle='#d32f2f'; const c=Math.min(w,h)*0.12; g.fillRect(x+w/2-c/2,y+h/2-c*1.5,c,c*3); g.fillRect(x+w/2-c*1.5,y+h/2-c/2,c*3,c); g.fillStyle='#d32f2f'; g.font='bold 16px sans-serif'; g.textAlign='center'; g.fillText('CITY HOSPITAL',x+w/2,y+18); }
  if(st==='supermarket'){ g.fillStyle='#e4e6e9'; g.fillRect(x+3,y+3,w-6,h-6); g.fillStyle='rgba(190,225,245,0.85)'; for(let k=20;k<w-20;k+=48) g.fillRect(x+k,y+12,26,h-24); }
  if(st==='shop'){ g.fillStyle=['#b9a48a','#9fa6ad','#c4b59a','#a39484'][(r()*4)|0]; g.fillRect(x,y,w,h); }
  if(st==='brick'){ g.fillStyle=pal[1]; for(let k=0;k<h;k+=5) g.fillRect(x,y+k,w,1); }
  // parapet
  g.strokeStyle=shade(pal[0],0.65); g.lineWidth=3; g.strokeRect(x+1.5,y+1.5,w-3,h-3); g.lineWidth=1;
  g.strokeStyle=shade(pal[0],1.25); g.strokeRect(x+3.5,y+3.5,w-7,h-7);
  // roof furniture
  if(st!=='warehouse'&&st!=='depot'&&st!=='green'){
    const n=Math.max(1,(w*h/4000)|0)+((r()*3)|0);
    for(let i=0;i<n;i++){ const ax=x+8+r()*(w-30), ay=y+8+r()*(h-28); if(r()<0.6) acUnit(g,ax,ay); else { g.fillStyle='#c8e4f4'; g.fillRect(ax,ay,16,10); g.fillStyle='#7fa7bf'; g.fillRect(ax,ay+9,16,1); g.fillRect(ax+8,ay,1,10);} }
    if(r()<0.5&&w>60&&h>60){ const tx=x+w-24, ty=y+20; g.fillStyle='rgba(0,0,0,0.25)'; g.beginPath(); g.arc(tx+4,ty+4,10,0,7); g.fill(); g.fillStyle='#7a6a5a'; g.beginPath(); g.arc(tx,ty,10,0,7); g.fill(); g.strokeStyle='#5a4a3a'; g.beginPath(); g.arc(tx,ty,6,0,7); g.stroke(); }
    if(r()<0.6){ g.fillStyle='#55585e'; g.fillRect(x+w*0.3,y+h*0.6,10,10); g.fillStyle='#3d4045'; g.fillRect(x+w*0.3+2,y+h*0.6+2,6,6); }
    if(r()<0.35&&w>50){ const sx=x+12+r()*(w-40), sy=y+h-26; g.fillStyle='#d9dde2'; g.beginPath(); g.ellipse(sx,sy,8,6,0.6,0,7); g.fill(); g.strokeStyle='#777'; g.beginPath(); g.moveTo(sx,sy); g.lineTo(sx+6,sy-5); g.stroke(); }
    if(r()<0.3&&w>60&&h>40){ const bx=x+w-34, by=y+h-30; g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(bx+4,by+4,24,18); g.fillStyle=shade(pal[0],0.85); g.fillRect(bx,by,24,18); g.fillStyle='#4a4f57'; g.fillRect(bx+6,by+12,12,6); }
    if(st==='tower'&&r()<0.6){ g.strokeStyle='#ddd'; g.lineWidth=2; g.beginPath(); g.moveTo(x+14,y+14); g.lineTo(x+14,y+40); g.stroke(); g.fillStyle='#e74c3c'; g.beginPath(); g.arc(x+14,y+14,3,0,7); g.fill(); g.lineWidth=1; }
    if(o.sign && st!=='shop'){ }
    if(st==='supermarket'||st==='shop'){ /* signs drawn below */ }
    if(o.cyber&&w>40&&h>40){ // v18 Kingsbridge downtown: stepped setbacks, window bands, neon trim, rooftop plant
      const nc=['#ff2bd6','#00d8ff','#b14bff','#39ff88','#ffd000'][(r()*5)|0], tiers=o.height>110?3:2;
      for(let t=1;t<=tiers;t++){ const m=t*Math.min(w,h)*0.12; g.fillStyle='rgba(0,0,0,0.22)'; g.fillRect(x+m+5,y+m+5,w-2*m,h-2*m); g.fillStyle=shade(pal[0],1+t*0.07); g.fillRect(x+m,y+m,w-2*m,h-2*m); g.strokeStyle=shade(pal[0],0.6); g.strokeRect(x+m+0.5,y+m+0.5,w-2*m-1,h-2*m-1); }
      g.fillStyle='rgba(150,205,240,0.8)'; for(let k=6;k<w-6;k+=7){ g.fillRect(x+k,y+4,4,3); g.fillRect(x+k,y+h-7,4,3); } for(let k=6;k<h-6;k+=7){ g.fillRect(x+4,y+k,3,4); g.fillRect(x+w-7,y+k,3,4); }
      g.fillStyle=nc; g.fillRect(x+2,y+2,w-4,2); g.fillRect(x+2,y+2,2,h-4);
      const m=tiers*Math.min(w,h)*0.12; for(let k=0;k<3;k++) acUnit(g,x+m+6+k*18,y+m+6); }
    if(st==='tower' && w>90){ g.strokeStyle='#e8e8e8'; g.lineWidth=3; g.beginPath(); g.arc(x+w/2,y+h/2,Math.min(w,h)*0.22,0,7); g.stroke(); g.fillStyle='#e8e8e8'; g.font='bold 30px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('H',x+w/2,y+h/2+1); g.lineWidth=1; }
  }
}
function drawSign(g,o){ if(!o.sign) return; const big=o.style==='supermarket'; g.save(); const fs=big?34:12; g.font=`900 ${fs}px Arial Black,Arial,sans-serif`; const tw=g.measureText(o.sign).width;
  let sx=o.x+o.w/2, sy=o.y+(big?o.h/2:10); if(o.front==='s') sy=o.y+o.h-10; if(o.front==='w'||o.front==='e'){ sy=o.y+o.h/2; }
  g.translate(sx,sy); if(o.front==='w') { g.translate(-o.w/2+10,0); g.rotate(-Math.PI/2); } if(o.front==='e'){ g.translate(o.w/2-10,0); g.rotate(Math.PI/2); }
  if(tw+8>(o.front==='w'||o.front==='e'?o.h:o.w)-4 && !big){ g.restore(); return; }
  g.fillStyle=big?'#c0392b':'rgba(20,24,30,0.85)'; g.fillRect(-tw/2-5,-fs/2-3,tw+10,fs+6); g.fillStyle=big?'#fff':['#f5d76e','#fff','#7fdcff','#ff8c8c'][o.seed%4]; g.textAlign='center'; g.textBaseline='middle'; g.fillText(o.sign,0,1); g.restore(); }
function drawObject(g,o){
  if(OBJX[o.kind]) return OBJX[o.kind](g,o);
  switch(o.kind){
  case 'bldg': if(ROOF2[o.style]){} else if(o.style!=='stadium') drawShadowRect(g,o.x,o.y,o.w,o.h,o.height*0.55); else { g.fillStyle='rgba(10,15,25,0.3)'; g.beginPath(); g.ellipse(o.x+o.w/2+14,o.y+o.h/2+14,o.w/2,o.h/2,0,0,7); g.fill(); } roof(g,o); drawSign(g,o); break;
  case 'awning': { const b=o.b, s=b.front, c=b.awning; const L= s==='n'||s==='s'? b.w : b.h; g.save();
    if(s==='n'){ g.translate(b.x,b.y-14); } else if(s==='s'){ g.translate(b.x,b.y+b.h); } else if(s==='w'){ g.translate(b.x-14,b.y); } else { g.translate(b.x+b.w,b.y); }
    const hor=(s==='n'||s==='s'); for(let k=0;k<L;k+=8){ g.fillStyle= (k/8)%2?'#f4f4f4':c; if(hor) g.fillRect(k,0,8,14); else g.fillRect(0,k,14,8); }
    g.fillStyle='rgba(0,0,0,0.25)'; if(hor) g.fillRect(0,s==='n'?14:0,L,2); else g.fillRect(s==='w'?14:0,0,2,L); g.restore(); break; }
  case 'drive': { const r=mulberry(o.seed); g.fillStyle='#8f8a80'; g.fillRect(o.x,o.y,22,32); if(r()<0.8){ const c=['#c0392b','#ecf0f1','#2c3e50','#2980b9','#7f8c8d','#16a085'][(r()*6)|0]; g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(o.x+6,o.y+4,13,28); g.fillStyle=c; g.fillRect(o.x+4,o.y+2,13,28); g.fillStyle='rgba(30,40,60,0.8)'; g.fillRect(o.x+5,o.y+8,11,6); g.fillRect(o.x+5,o.y+22,11,4);} break; }
  case 'field': { const r=mulberry(o.seed); const col={wheat:['#d9b44a','#c9a23c'],green:['#6fa83c','#5d9530'],plough:['#7a5c3a','#68492b'],rape:['#e6d42a','#cfbd1f'],pasture:['#7cb24a','#74a944']}[o.crop];
    g.fillStyle=col[0]; g.fillRect(o.x,o.y,o.w,o.h); if(o.crop==='pasture'){ for(let k=0;k<o.w*o.h/900;k++){ g.fillStyle=r()<0.5?'#86bd52':'#6c9e3f'; g.beginPath(); g.arc(o.x+r()*o.w,o.y+r()*o.h,4+r()*8,0,7); g.fill(); } g.fillStyle='#9aa0a6'; g.fillRect(o.x+o.w-30,o.y+10,16,10); break; } g.fillStyle=col[1]; if(o.vert){ for(let k=0;k<o.w;k+=6) g.fillRect(o.x+k,o.y,2,o.h); } else { for(let k=0;k<o.h;k+=6) g.fillRect(o.x,o.y+k,o.w,2); }
    if(o.crop==='wheat'&&r()<0.5){ g.strokeStyle='rgba(120,90,30,0.35)'; g.lineWidth=10; g.beginPath(); g.moveTo(o.x,o.y+o.h*r()); g.lineTo(o.x+o.w,o.y+o.h*r()); g.stroke(); g.lineWidth=1; } break; }
  case 'hedge': { g.fillStyle='rgba(10,20,10,0.3)'; g.beginPath(); g.arc(o.x+5,o.y+5,13,0,7); g.fill(); g.fillStyle='#2f5f24'; g.beginPath(); g.arc(o.x,o.y,13,0,7); g.fill(); g.fillStyle='#3e7a2f'; g.beginPath(); g.arc(o.x-3,o.y-3,8,0,7); g.fill(); break; }
  case 'bale': { g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.arc(o.x+4,o.y+4,9,0,7); g.fill(); g.fillStyle='#d8b55a'; g.beginPath(); g.arc(o.x,o.y,9,0,7); g.fill(); g.strokeStyle='#a8873a'; g.beginPath(); g.arc(o.x,o.y,5,0,7); g.stroke(); break; }
  case 'silo': { g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.arc(o.x+16,o.y+16,o.r,0,7); g.fill(); const gr=g.createRadialGradient(o.x-8,o.y-8,2,o.x,o.y,o.r); gr.addColorStop(0,'#f0f0f0'); gr.addColorStop(1,'#8d9196'); g.fillStyle=gr; g.beginPath(); g.arc(o.x,o.y,o.r,0,7); g.fill(); g.fillStyle='#666'; g.beginPath(); g.arc(o.x,o.y,4,0,7); g.fill(); break; }
  case 'fountain': { const R2=o.big?44:22; g.fillStyle='#9aa3ad'; g.beginPath(); g.arc(o.x,o.y,R2+5,0,7); g.fill(); g.fillStyle='#4a90d9'; g.beginPath(); g.arc(o.x,o.y,R2,0,7); g.fill(); g.fillStyle='#c8e6ff'; g.beginPath(); g.arc(o.x,o.y,R2*0.3,0,7); g.fill(); g.strokeStyle='rgba(255,255,255,0.6)'; g.beginPath(); g.arc(o.x,o.y,R2*0.6,0,7); g.stroke(); break; }
  case 'rb': { const rb=o.rb, X=rb.cx*TILE, Y=rb.cy*TILE; g.fillStyle=g.createPattern(TEX.asph[2],'repeat'); for(const am of rb.arms){ const sg=world.segs[am.seg]; const E=(am.side<0?sg.b0:sg.b1+1)*TILE, C=sg.dir==='h'?X:Y; const lo=Math.min(E,C), hi=Math.max(E,C); if(sg.dir==='h') g.fillRect(lo,sg.a*TILE,hi-lo,sg.w*TILE); else g.fillRect(sg.a*TILE,lo,sg.w*TILE,hi-lo); } g.beginPath(); g.arc(X,Y,rb.rout*TILE,0,7); g.fill();
    g.strokeStyle='#ececec'; g.lineWidth=2; g.setLineDash([16,16]); g.beginPath(); g.arc(X,Y,(rb.rin+rb.rout)/2*TILE,0,7); g.stroke(); g.setLineDash([]);
    g.strokeStyle='#ececec'; g.beginPath(); g.arc(X,Y,rb.rout*TILE-6,0,7); g.stroke();
    g.fillStyle='#8a877f'; g.beginPath(); g.arc(X,Y,rb.rin*TILE,0,7); g.fill(); g.fillStyle=g.createPattern(TEX.island[0],'repeat'); g.beginPath(); g.arc(X,Y,rb.rin*TILE-5,0,7); g.fill();
    const r=mulberry(o.seed); for(let k=0;k<6;k++){ const a=r()*6.28, d=r()*rb.rin*TILE*0.6; drawObject(g,{kind:'tree',x:X+Math.cos(a)*d,y:Y+Math.sin(a)*d,r:9+r()*6,seed:(r()*1e9)|0}); }
    // give-way triangles on each arm
    g.fillStyle='#ececec'; for(const a of rb.arms){ const px=X+Math.cos(a.ang)*(rb.rout*TILE+8), py=Y+Math.sin(a.ang)*(rb.rout*TILE+8); g.save(); g.translate(px,py); g.rotate(a.ang+Math.PI/2); for(let k=-40;k<=40;k+=10) g.fillRect(k,-2,6,4); g.restore(); }
    g.lineWidth=1; break; }
  case 'tree': { const r=mulberry(o.seed), sp=o.sp||0, R0=o.r;
    if(sp===1){ g.fillStyle='rgba(10,20,15,0.32)'; g.beginPath(); g.ellipse(o.x+R0*0.7,o.y+R0*0.7,R0*1.05,R0*0.85,0.6,0,7); g.fill();
      const cols=['#1d3f26','#24502e','#2d5f36','#3a7044']; for(let l=0;l<4;l++){ const rr=R0*(1-l*0.22); g.fillStyle=cols[l]; g.beginPath(); for(let k=0;k<16;k++){ const a=k/16*6.283+l*0.3, q=k%2?rr*0.72:rr; const x=o.x+Math.cos(a)*q-l, y=o.y+Math.sin(a)*q-l; k?g.lineTo(x,y):g.moveTo(x,y); } g.closePath(); g.fill(); }
      g.fillStyle='#4a3a2a'; g.beginPath(); g.arc(o.x-3,o.y-3,1.5,0,7); g.fill(); break; }
    if(sp===3){ g.fillStyle='rgba(10,20,10,0.3)'; g.beginPath(); g.ellipse(o.x+R0*1.6,o.y+R0*1.6,R0*1.9,R0*0.55,0.785,0,7); g.fill();
      const gr=g.createRadialGradient(o.x-R0*0.3,o.y-R0*0.3,1,o.x,o.y,R0*0.75); gr.addColorStop(0,'#78a84a'); gr.addColorStop(1,'#33602a'); g.fillStyle=gr; g.beginPath(); g.ellipse(o.x,o.y,R0*0.62,R0*0.7,0.785,0,7); g.fill(); break; }
    g.fillStyle='rgba(10,20,10,0.3)'; g.beginPath(); g.ellipse(o.x+R0*0.6,o.y+R0*0.6,R0,R0*0.9,0,0,7); g.fill();
    const base= sp===2? ['#7fae4a','#8cba52','#74a346'][(r()*3)|0] : ['#2f6b2a','#3a7a30','#2c5f2e','#467f2c','#3d6e25','#55802f'][(r()*6)|0];
    const gr=g.createRadialGradient(o.x-R0*0.35,o.y-R0*0.35,1,o.x,o.y,R0); gr.addColorStop(0,shade(base,1.15)); gr.addColorStop(1,shade(base,0.62)); g.fillStyle=gr; g.beginPath(); g.arc(o.x,o.y,R0,0,7); g.fill();
    for(let i=0;i<(sp===2?4:7);i++){ const a=r()*6.28, d=r()*R0*0.55; g.fillStyle=shade(base,0.8+r()*0.45); g.beginPath(); g.arc(o.x+Math.cos(a)*d-1,o.y+Math.sin(a)*d-1,R0*(0.3+r()*0.25),0,7); g.fill(); }
    if(sp===2){ g.fillStyle='#e8e4da'; g.fillRect(o.x-1,o.y-1,2,3); }
    g.fillStyle='rgba(255,255,220,0.2)'; g.beginPath(); g.arc(o.x-R0*0.35,o.y-R0*0.4,R0*0.32,0,7); g.fill(); break; }
  case 'lot': { g.strokeStyle='#e6e6e0'; g.lineWidth=2; const bay=24, r=mulberry(o.seed);
    for(const row of [0,1]){ const y0=o.y+(row?o.h/2:0); for(let x=o.x+4;x<o.x+o.w-4;x+=bay){ g.beginPath(); g.moveTo(x,y0+(row?o.h/2-40:4)); g.lineTo(x,y0+(row?o.h/2-4:40)); g.stroke();
      if(r()<0.45){ const c=['#c0392b','#ecf0f1','#2c3e50','#2980b9','#f1c40f','#7f8c8d'][(r()*6)|0]; const cy=y0+(row?o.h/2-38:6); g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(x+6,cy+3,14,32); g.fillStyle=c; g.fillRect(x+4,cy,14,32); g.fillStyle='rgba(30,40,60,0.8)'; g.fillRect(x+5,cy+7,12,6); g.fillRect(x+5,cy+22,12,4); } } }
    g.lineWidth=1; break; }
  case 'kerb': { const c=o.c, X=c.cx*TILE, Y=c.cy*TILE, Rr=c.R*TILE; g.save(); g.beginPath(); g.rect(o.x,o.y,o.w,o.h); g.clip();
    // asphalt everywhere outside the kerb circle, paving inside
    g.fillStyle=g.createPattern(TEX.asph[1],'repeat'); g.fillRect(o.x,o.y,o.w,o.h);
    g.fillStyle=g.createPattern(TEX.walk[0],'repeat'); g.beginPath(); g.arc(X,Y,Rr,0,7); g.fill();
    g.strokeStyle='#8a877f'; g.lineWidth=3; g.beginPath(); g.arc(X,Y,Rr-1,0,7); g.stroke(); g.lineWidth=1; g.restore(); break; }
  case 'pond': g.fillStyle='#d8c98f'; g.beginPath(); g.ellipse(o.x+o.w/2,o.y+o.h/2,o.w/2+4,o.h/2+4,0,0,7); g.fill(); break;
  case 'curve': drawCurve(g,o.cv); break;
  case 'taper': drawTaper(g,o.tp); break;
  case 'bush': { const r=mulberry(o.seed); g.fillStyle='rgba(10,20,10,0.28)'; g.beginPath(); g.arc(o.x+3,o.y+3,o.r+2,0,7); g.fill(); const base=['#4d7d33','#5a8a3a','#3f6f2e'][(r()*3)|0];
    for(let k=0;k<4;k++){ g.fillStyle=shade(base,0.85+r()*0.35); g.beginPath(); g.arc(o.x+(r()-0.5)*o.r,o.y+(r()-0.5)*o.r,o.r*(0.5+r()*0.4),0,7); g.fill(); }
    if(r()<0.3){ g.fillStyle=['#f4e04d','#fff','#e86fa0'][(r()*3)|0]; for(let k=0;k<4;k++) g.fillRect(o.x+(r()-0.5)*o.r*1.5,o.y+(r()-0.5)*o.r*1.5,2,2); } break; }
  case 'appr': drawApproach(g,o); break;
  case 'ldrop': drawLaneDrop(g,o); break;
  case 'fsign': drawFuelSign(g,o); break;
  case 'runway': { g.fillStyle='#3d4045'; g.fillRect(o.x,o.y,o.w,o.h); g.fillStyle='#ececec'; for(let k=o.x+120;k<o.x+o.w-120;k+=60) g.fillRect(k,o.y+o.h/2-2,32,4);
    for(const ex of [o.x+12,o.x+o.w-60]) for(let k=o.y+10;k<o.y+o.h-10;k+=14) g.fillRect(ex,k,48,7); g.font='bold 40px Arial'; g.save(); g.translate(o.x+90,o.y+o.h/2); g.rotate(Math.PI/2); g.textAlign='center'; g.fillText('09',0,12); g.restore();
    g.save(); g.translate(o.x+o.w-90,o.y+o.h/2); g.rotate(-Math.PI/2); g.textAlign='center'; g.fillText('27',0,12); g.restore(); g.fillStyle='#f2c230'; g.fillRect(o.x,o.y,o.w,2); g.fillRect(o.x,o.y+o.h-2,o.w,2); break; }
  case 'rock': { const r=mulberry(o.seed); g.fillStyle='rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(o.x+o.r*0.35,o.y+o.r*0.35,o.r,o.r*0.75,0.3,0,7); g.fill();
    const base=o.desert?'#a0745a':'#8a8a84'; for(let k=0;k<3;k++){ const ox=(r()-0.5)*o.r, oy=(r()-0.5)*o.r*0.6, rr=o.r*(0.5+r()*0.4); const gr=g.createRadialGradient(o.x+ox-rr*0.3,o.y+oy-rr*0.3,1,o.x+ox,o.y+oy,rr); gr.addColorStop(0,shade(base,1.25)); gr.addColorStop(1,shade(base,0.7)); g.fillStyle=gr; g.beginPath(); g.ellipse(o.x+ox,o.y+oy,rr,rr*0.8,r()*3,0,7); g.fill(); } break; }
  case 'scrub': { g.fillStyle='rgba(0,0,0,0.2)'; g.beginPath(); g.arc(o.x+3,o.y+3,o.r,0,7); g.fill(); g.fillStyle='#8a8a4a'; g.beginPath(); g.arc(o.x,o.y,o.r,0,7); g.fill(); g.fillStyle='#9fa05a'; g.beginPath(); g.arc(o.x-2,o.y-2,o.r*0.55,0,7); g.fill(); break; }
  case 'cactus': { g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(o.x+2,o.y-2,14,6); g.fillStyle='#4f7a3a'; g.beginPath(); g.arc(o.x,o.y,5,0,7); g.fill(); g.fillRect(o.x-11,o.y-2,22,4); g.fillStyle='#6d9a4e'; g.beginPath(); g.arc(o.x-1,o.y-1,2.5,0,7); g.fill(); break; }
  case 'boxj': drawBoxJunction(g,o); break;
  case 'tbay': drawTrailerBay(g,o); break;
  case 'yard': drawYardSign(g,o); break;
  case 'bay': g.fillStyle='#f2c230'; for(let k=0;k<o.w;k+=12){ g.fillRect(o.x+k,o.y,6,o.h); } break;
  case 'paint': g.fillStyle='rgba(240,240,230,0.85)'; g.font=o.small?'bold 24px sans-serif':'bold 40px sans-serif'; g.textBaseline='top'; g.fillText(o.text,o.x,o.y); break;
  case 'pump': g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(o.x+10,o.y+8,16,22); g.fillStyle='#e74c3c'; g.fillRect(o.x+6,o.y+4,16,22); g.fillStyle='#fff'; g.fillRect(o.x+9,o.y+8,10,6); break;
  case 'pallets': { const r=mulberry(o.seed); for(let i=0;i<3;i++){ const x=o.x+r()*10, y=o.y+i*14; g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(x+3,y+3,22,12); g.fillStyle='#b8894f'; g.fillRect(x,y,22,12); g.fillStyle='#8a6232'; g.fillRect(x,y+5,22,2);} break; }
  case 'tank': { g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.arc(o.x+14,o.y+14,o.r,0,7); g.fill(); const gr=g.createRadialGradient(o.x-o.r*0.3,o.y-o.r*0.3,2,o.x,o.y,o.r); gr.addColorStop(0,'#f4f4f4'); gr.addColorStop(1,'#a9adb2'); g.fillStyle=gr; g.beginPath(); g.arc(o.x,o.y,o.r,0,7); g.fill(); g.strokeStyle='#7d8186'; g.beginPath(); g.arc(o.x,o.y,o.r*0.6,0,7); g.stroke(); g.beginPath(); g.arc(o.x,o.y,o.r-1,0,7); g.stroke(); break; }
  case 'cont': { g.fillStyle='rgba(0,0,0,0.35)'; g.fillRect(o.x+10,o.y+10,o.w,o.h); const seg=o.w/3; [o.c1,o.c2,o.c3].forEach((c,k)=>{ const x=o.x+k*seg; g.fillStyle=c; g.fillRect(x+1,o.y+1,seg-2,o.h-2); g.fillStyle=shade(c,0.75); for(let q=4;q<seg-2;q+=4) g.fillRect(x+q,o.y+1,1,o.h-2); g.fillStyle=shade(c,1.25); g.fillRect(x+1,o.y+1,seg-2,2); }); break; }
  }
}
// ---- chunk cache
const chunkCache=new Map(); let chunkOrder=[];
function renderChunk(cx,cy){
  const c=mkCanvas(CHUNK,CHUNK), g=c.getContext('2d'); const ox=cx*CHUNK, oy=cy*CHUNK; const N=CHUNK/TILE;
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){
    const tx=cx*N+i, ty=cy*N+j, px=i*TILE, py=j*TILE; if(!inb(tx,ty)){ g.drawImage(TEX.water[0],px,py); continue; }
    const t=G[idx(tx,ty)], v=(hash2(tx,ty)*4)|0;
    switch(t){
      case T.ROAD: case T.BRIDGE: { const rh=world.roadH[idx(tx,ty)]; if(rh===-2) g.drawImage(t===T.BRIDGE?TEX.water[v]:TEX.grass[v],px,py); else if(rh===-3){ const u=world.under[idx(tx,ty)]; g.drawImage((u===T.WATER||t===T.BRIDGE)?TEX.water[v]:u===T.SAND?TEX.sand[v]:u===T.ROCK?TEX.rock[v]:u===T.FIELD?TEX.field[v]:TEX.grass[v],px,py); } else drawRoadTile(g,tx,ty,px,py); break; }
      case T.ROCK: g.drawImage(TEX.rock[v],px,py); break;
      case T.WALK: g.drawImage(TEX.walk[v],px,py); break;
      case T.WATER: g.drawImage(TEX.water[v],px,py); break;
      case T.PGRASS: case T.TREE: g.drawImage((get(tx,ty)===T.TREE && !isParkNear(tx,ty))?TEX.grass[v]:TEX.pgrass[v],px,py); break;
      case T.CONC: case T.TANK: case T.PUMP: g.drawImage(TEX.conc[v],px,py); break;
      case T.BLDG: case T.PLAZA: g.drawImage(TEX.plaza[v],px,py); break;
      case T.GRAVEL: g.drawImage(TEX.gravel[v],px,py); break;
      case T.QUAY: case T.CONT: g.drawImage(TEX.quay[v],px,py); break;
      case T.SAND: g.drawImage(TEX.sand[v],px,py); break;
      case T.LOT: g.drawImage(TEX.asph[v],px,py); break;
      case T.FIELD: g.drawImage(TEX.field[v],px,py); break;
      case T.ISLAND: g.drawImage(TEX.island[v],px,py); break;
      case T.HEDGE: g.drawImage(TEX.grass[v],px,py); break;
      default: g.drawImage(TEX.grass[v],px,py);
    }
    // curbs / shore foam / bridge rails
    if(t===T.WALK){ g.fillStyle='#8a877f'; if(get(tx,ty+1)===T.ROAD) g.fillRect(px,py+30,32,2); if(get(tx,ty-1)===T.ROAD) g.fillRect(px,py,32,2); if(get(tx+1,ty)===T.ROAD) g.fillRect(px+30,py,2,32); if(get(tx-1,ty)===T.ROAD) g.fillRect(px,py,2,32); }
    if(t===T.WATER){ g.fillStyle='rgba(220,240,255,0.45)'; const L=u=>u!==T.WATER&&u!==T.BRIDGE; if(L(get(tx,ty-1))) g.fillRect(px,py,32,3); if(L(get(tx,ty+1))) g.fillRect(px,py+29,32,3); if(L(get(tx-1,ty))) g.fillRect(px,py,3,32); if(L(get(tx+1,ty))) g.fillRect(px+29,py,3,32); }
    if(t===T.ROCK||(t===T.ROAD&&world.under[idx(tx,ty)]===T.ROCK)||(t===T.TREE&&nearHill(tx,ty))){ const e=hillElev(tx,ty); if(e>0){ const band=Math.floor(e*7); g.fillStyle=band%2?'rgba(255,255,250,'+(0.05+e*0.22)+')':'rgba(40,35,30,'+(0.12-e*0.08)+')'; g.fillRect(px,py,32,32);
        if(Math.floor(hillElev(tx+1,ty)*7)!==band||Math.floor(hillElev(tx,ty+1)*7)!==band){ g.fillStyle='rgba(70,60,50,0.25)'; g.fillRect(px,py+30,32,2); g.fillRect(px+30,py,2,32); } } }
    if(t===T.BRIDGE && world.roadH[idx(tx,ty)]>=-1){ const W=u=>u===T.WATER; g.fillStyle='#c9ccd1';
      if(W(get(tx,ty-1))){ g.fillRect(px,py,32,5); g.fillStyle='#6d7178'; for(let k=0;k<32;k+=8) g.fillRect(px+k,py,2,5); g.fillStyle='#c9ccd1'; }
      if(W(get(tx,ty+1))){ g.fillRect(px,py+27,32,5); g.fillStyle='#6d7178'; for(let k=0;k<32;k+=8) g.fillRect(px+k,py+27,2,5); g.fillStyle='#c9ccd1'; }
      if(W(get(tx-1,ty))){ g.fillRect(px,py,5,32); g.fillStyle='#6d7178'; for(let k=0;k<32;k+=8) g.fillRect(px,py+k,5,2); g.fillStyle='#c9ccd1'; }
      if(W(get(tx+1,ty))){ g.fillRect(px+27,py,5,32); g.fillStyle='#6d7178'; for(let k=0;k<32;k+=8) g.fillRect(px+27,py+k,5,2); } }
    if(t===T.QUAY && get(tx,ty+1)===T.WATER){ g.fillStyle='#f2c230'; for(let k=0;k<32;k+=10) g.fillRect(px+k,py+28,6,4); g.fillStyle='#333'; g.fillRect(px+14,py+22,5,5); }
  }
  if(typeof railChunk==='function') railChunk(g,ox,oy);
  g.save(); g.translate(-ox,-oy); CUR_CHUNK=[ox,oy,ox+CHUNK,oy+CHUNK];
  const list=world.chunkObjs.get(cx+','+cy)||[];
  for(const o of list) drawObject(g,o);
  CUR_CHUNK=null; g.restore();
  return c;
}
function hillElev(tx,ty){ let e=0; for(const h of world.hills){ const d=Math.hypot(tx-h.x,ty-h.y); if(d<h.r*1.15) e=Math.max(e,1-d/(h.r*1.1)); } return e; }
function nearHill(tx,ty){ for(const h of world.hills) if(Math.hypot(tx-h.x,ty-h.y)<h.r*1.1) return true; return false; }
let CUR_CHUNK=null;
function curvePath(g,P,i0,i1,off){ g.beginPath(); for(let i=i0;i<=i1;i++){ const a=P[Math.max(0,i-1)], b=P[Math.min(P.length-1,i+1)]; const tx=b[0]-a[0],ty=b[1]-a[1],l=Math.hypot(tx,ty)||1; const x=P[i][0]-ty/l*off, y=P[i][1]+tx/l*off; i===i0?g.moveTo(x,y):g.lineTo(x,y); } }
// v13: lane-drop taper — asphalt edge narrows smoothly from the wide road to the narrow one, pavement tapers out, UK merge arrows
function drawTaper(g,tp){ const P=tp.pts, n=P.length, T_=TILE;
  const nrm=i=>{ const a=P[Math.max(0,i-1)], b=P[Math.min(n-1,i+1)]; const tx=b[0]-a[0],ty=b[1]-a[1],l=Math.hypot(tx,ty)||1; return [-ty/l,tx/l]; };
  const NR=P.map((p,i)=>nrm(i)), at=(i,off)=>[(P[i][0]+NR[i][0]*off)*T_,(P[i][1]+NR[i][1]*off)*T_];
  const band=(f0,f1,sd)=>{ const F0=i=>f0(i,sd),F1=i=>f1(i,sd); g.beginPath(); for(let i=0;i<n;i++){ const q=at(i,sd*F0(i)); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); } for(let i=n-1;i>=0;i--){ const q=at(i,sd*F1(i)); g.lineTo(q[0],q[1]); } g.closePath(); g.fill(); };
  const poly=(f,sd)=>{ g.beginPath(); for(let i=0;i<n;i++){ const q=at(i,sd*f(i,sd)); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); } g.stroke(); };
  const hw=(i,sd)=>tp.hs(tp.s[i],sd); g.save(); g.lineJoin='round';
  if(tp.urban){ const pw=(i,sd)=>{ const u=Math.min(1,tp.s[i]/(tp.L*0.7)); return hw(i,sd)+1.02*(1-u*u*(3-2*u)); };
    g.fillStyle=g.createPattern(TEX.walk[0],'repeat'); for(const sd of [-1,1]) band(hw,pw,sd);
    g.strokeStyle='#8a877f'; g.lineWidth=2; for(const sd of [-1,1]) poly((i,sd)=>hw(i,sd)+0.03,sd); }
  g.fillStyle=g.createPattern(TEX.asph[1],'repeat'); const inn=()=>tp.wN/2-7/T_;
  for(const sd of [-1,1]) band(inn,hw,sd);
  if(tp.wN<=2&&!tp.urban){ g.strokeStyle='rgba(60,60,55,0.35)'; g.lineWidth=2; for(const sd of [-1,1]) poly((i,sd)=>hw(i,sd)-0.02,sd); }
  g.strokeStyle='#ececec'; g.lineWidth=2; for(const sd of [-1,1]) poly((i,sd)=>hw(i,sd)-5/T_,sd);
  // merge arrows in each dropped lane for traffic heading wide -> narrow (UK: drive on the left => negative offset side)
  const d=tp.dW, J=P[0], nx=-d[1], ny=d[0]; g.strokeStyle='#ececec'; g.fillStyle='#ececec'; g.lineWidth=5; g.lineCap='round';
  for(let j=0;j<tp.drop;j++){ const lo=-(tp.wN/2+j+0.5);
    const AK='arr'+j; if(!tp[AK]) tp[AK]=[18,9,1.5].filter(bk=>{ for(let al=-3;al<=2.5;al+=0.5){ const x=J[0]-d[0]*bk+d[0]*al+nx*lo, y=J[1]-d[1]*bk+d[1]*al+ny*lo;
        for(const Jn of world.junctions) if(x>Jn.x-2&&x<Jn.x+Jn.w+2&&y>Jn.y-2&&y<Jn.y+Jn.h+2) return false; if(bk>2&&get(Math.floor(x),Math.floor(y))!==T.ROAD) return false; } return true; });
    for(const back of tp[AK]){ const B=(al,lat)=>[(J[0]-d[0]*back+d[0]*al+nx*lat)*T_,(J[1]-d[1]*back+d[1]*al+ny*lat)*T_];
      const lat=back<2?lo*0.85:lo, a=B(-2.6,lat), b=B(0,lat), c=B(2.2,lat+0.75), dx=c[0]-b[0], dy=c[1]-b[1], l=Math.hypot(dx,dy), ux=dx/l, uy=dy/l;
      g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.lineTo(c[0]-ux*8,c[1]-uy*8); g.stroke();
      g.beginPath(); g.moveTo(c[0]+ux*4,c[1]+uy*4); g.lineTo(c[0]-ux*12-uy*7,c[1]-uy*12+ux*7); g.lineTo(c[0]-ux*12+uy*7,c[1]-uy*12-ux*7); g.closePath(); g.fill(); } }
  g.restore(); }
function drawCurve(g,cv){
  if(!cv.px) cv.px=cv.pts.map(p=>[p[0]*TILE,p[1]*TILE]); const P=cv.px, W=cv.w*TILE, n=P.length;
  // only the part of the curve inside this chunk (plus margin)
  let i0=0,i1=n-1; if(CUR_CHUNK){ const [x0,y0,x1,y1]=CUR_CHUNK, m=W+60; i0=n; i1=-1; for(let i=0;i<n;i++){ const p=P[i]; if(p[0]>x0-m&&p[0]<x1+m&&p[1]>y0-m&&p[1]<y1+m){ if(i<i0) i0=i; i1=i; } } if(i1<0) return; i0=Math.max(0,i0-1); i1=Math.min(n-1,i1+1); }
  g.save(); g.lineCap='butt'; g.lineJoin='round';
  const wet=i=>{ const tx=Math.floor(cv.pts[i][0]),ty=Math.floor(cv.pts[i][1]); return get(tx,ty)===T.BRIDGE; };
  if(cv.bridge){ let a=-1; for(let i=i0;i<=i1+1;i++){ const w=i<=i1&&wet(i); if(w&&a<0) a=i; if(!w&&a>=0){ const b=Math.min(i1,i+2), s=Math.max(i0,a-2);
        g.save(); g.translate(18,18); curvePath(g,P,s,b,0); g.strokeStyle='rgba(5,25,45,0.35)'; g.lineWidth=W+18; g.stroke(); g.restore();
        curvePath(g,P,s,b,0); g.strokeStyle='#a4a8ad'; g.lineWidth=W+16; g.stroke();
        for(const sd of [-1,1]){ curvePath(g,P,s,b,sd*(W/2+5)); g.strokeStyle='#dfe2e6'; g.lineWidth=4; g.stroke(); curvePath(g,P,s,b,sd*(W/2+5)); g.strokeStyle='#6d7178'; g.lineWidth=4; g.setLineDash([2,10]); g.stroke(); g.setLineDash([]); }
        a=-1; } } }
  if(cv.type==='dirt'){ curvePath(g,P,i0,i1,0); g.strokeStyle='#8a7350'; g.lineWidth=W+6; g.stroke(); curvePath(g,P,i0,i1,0); g.strokeStyle='#a68b60'; g.lineWidth=W; g.stroke();
    for(const sd of [-1,1]){ curvePath(g,P,i0,i1,sd*W*0.22); g.strokeStyle='rgba(90,70,45,0.45)'; g.lineWidth=5; g.stroke(); } curvePath(g,P,i0,i1,0); g.strokeStyle='rgba(150,170,90,0.35)'; g.lineWidth=3; g.stroke(); g.restore(); return; }
  if(cv.type==='hwy'||cv.type==='dual'){ curvePath(g,P,i0,i1,0); g.strokeStyle='#8a8c86'; g.lineWidth=W+5; g.stroke(); }
  curvePath(g,P,i0,i1,0); g.strokeStyle=g.createPattern(TEX.asph[1],'repeat'); g.lineWidth=W; g.stroke();
  const line=(off,col,w,dash)=>{ curvePath(g,P,i0,i1,off); g.strokeStyle=col; g.lineWidth=w; g.setLineDash(dash||[]); g.stroke(); g.setLineDash([]); };
  const half=cv.w/2;
  if(cv.type==='lane'){ for(const sd of [-1,1]) line(sd*(W/2-3),'rgba(120,110,90,0.5)',3); g.restore(); return; }
  for(const sd of [-1,1]) line(sd*(W/2-5),'#ececec',2);
  if(cv.type==='hwy'){ line(0,'#9a9ca0',6); line(0,'#5c5f64',2); for(const sd of [-1,1]) line(sd*5,'#f2c230',2); }
  else if(cv.type==='dual'){ line(0,'#8f9188',14); line(0,'#6a8f45',9); }
  else line(0,'#ececec',2,[24,24]);
  for(let k=1;k<half;k++) for(const sd of [-1,1]) line(sd*k*TILE,'#ececec',2,[24,24]);
  g.restore(); }
function isParkNear(tx,ty){ return get(tx+1,ty)===T.PGRASS||get(tx-1,ty)===T.PGRASS||get(tx,ty+1)===T.PGRASS||get(tx,ty-1)===T.PGRASS; }
function getChunk(cx,cy,allowRender){
  const k=cx+','+cy; let c=chunkCache.get(k);
  if(c) return c; if(!allowRender) return null;
  c=renderChunk(cx,cy); chunkCache.set(k,c); chunkOrder.push(k);
  if(chunkOrder.length>90){ const old=chunkOrder.shift(); chunkCache.delete(old); }
  return c;
}
// ---- minimap
let MINIMAP=null;
function makeMinimap(){
  const c=mkCanvas(MW,MH), g=c.getContext('2d'), im=g.createImageData(MW,MH);
  const col={[T.GRASS]:[86,135,58],[T.ROAD]:[38,38,40],[T.WALK]:[196,196,196],[T.WATER]:[110,138,172],[T.BRIDGE]:[60,60,64],[T.PGRASS]:[104,160,70],[T.CONC]:[170,170,170],[T.BLDG]:[240,240,240],[T.GRAVEL]:[150,135,110],[T.TREE]:[44,92,40],[T.QUAY]:[160,160,160],[T.CONT]:[205,205,205],[T.SAND]:[226,196,108],[T.PLAZA]:[200,200,200],[T.LOT]:[120,120,124],[T.TANK]:[230,230,230],[T.PUMP]:[230,230,230],[T.FIELD]:[148,166,82],[T.ISLAND]:[104,160,70],[T.HEDGE]:[60,100,45],[T.ROCK]:[158,156,152]};
  const DES=[184,152,112];
  // v9: tile colours sampled from the same textures the world is drawn with, so the zoomed-out map reads like the world
  const avg=n=>{ const t=TEX[n]&&TEX[n][0]; if(!t) return null; const d=t.getContext('2d').getImageData(0,0,t.width,t.height).data; let r=0,g2=0,b=0; for(let i=0;i<d.length;i+=4){ r+=d[i]; g2+=d[i+1]; b+=d[i+2]; } const m=d.length/4; return [r/m|0,g2/m|0,b/m|0]; };
  for(const [k,n] of [[T.GRASS,'grass'],[T.WALK,'walk'],[T.WATER,'water'],[T.PGRASS,'pgrass'],[T.CONC,'conc'],[T.PLAZA,'plaza'],[T.GRAVEL,'gravel'],[T.QUAY,'quay'],[T.SAND,'sand'],[T.LOT,'asph'],[T.FIELD,'field'],[T.ISLAND,'island'],[T.ROCK,'rock'],[T.HEDGE,'grass'],[T.ROAD,'asph'],[T.TANK,'conc'],[T.PUMP,'conc']]){ const c3=avg(n); if(c3) col[k]=c3; }
  col[T.BRIDGE]=[col[T.ROAD][0]+8,col[T.ROAD][1]+8,col[T.ROAD][2]+8]; col[T.BLDG]=[178,172,164]; col[T.CONT]=[170,120,90]; const GR=col[T.GRASS];
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){ const i=y*MW+x; const t=G[i]; let c3=col[t]||[0,0,0];
    if(t===T.SAND && world.des[i]) c3=DES;
    if(t===T.GRASS){ const f=world.fd[i]/255; if(f>0.6) c3=[GR[0]*0.7|0,GR[1]*0.78|0,GR[2]*0.7|0]; else if(f<0.38) c3=[GR[0]*1.12|0,GR[1]*1.06|0,GR[2]*1.05|0]; }
    if(t===T.ROCK&&0){ const e=hillElev(x,y); const b=Math.floor(e*7)%2?14:0; c3=[150+b+e*40,148+b+e*40,144+b+e*40]; }
    im.data[i*4]=c3[0]; im.data[i*4+1]=c3[1]; im.data[i*4+2]=c3[2]; im.data[i*4+3]=255; }
  g.putImageData(im,0,0); MINIMAP=c;
}
