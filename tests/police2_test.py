"""v-pol2 police checks: stuck reverse-out (with steering) + resume, no building clipping on an alley chase,
roadblock count over 10 min of 2-star wanted, no stingers. Shots -> outdir. Usage: police2_test.py [html] [outdir]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
SRC=sys.argv[1] if len(sys.argv)>1 else 'BigRig.html'; OUT=sys.argv[2] if len(sys.argv)>2 else '/workspace/police2'
os.makedirs(OUT,exist_ok=True); R=[]
def chk(n,ok,info=""):
  R.append(bool(ok)); print("ok  " if ok else "FAIL",n,info)
CLIP="""(v)=>{const f=fwd(v.h),r=rgt(v.h),L=(v.L||4.6)/2-0.3,W=(v.W||1.9)/2-0.25;for(const a of [-L,0,L])for(const b of [-W,W])if(solidAtM(v.x+f[0]*a+r[0]*b,v.y+f[1]*a+r[1]*b))return true;return false}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto('file://'+os.path.abspath(SRC)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=300000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    await pg.evaluate("(()=>{gameT=12;WX.st='clear';WX.rain=0;WX.fog=0;WX.timer=1e6;const T=truck;if(T.trl){T.trl.coupled=false;T.trl=null;}window.__clip="+CLIP+"})()")
    # ---- 1. stuck: police nose-first against a building, rig behind it down the road
    s=await pg.evaluate("""(()=>{for(let i=MW*300+7;i<MW*(MH-300);i+=7){const x=i%MW,y=(i/MW)|0;if(x<20||x>MW-20)continue;
        let ok=true;for(let k=0;k<14&&ok;k++)ok=isRoadT(idx(x-k,y))&&isRoadT(idx(x-k,y-1));if(!ok)continue;
        let w=0;for(let d=1;d<=3&&!w;d++)if(isSolidTile(x+d,y)&&isSolidTile(x+d,y-1)&&isSolidTile(x+d,y+1)&&isSolidTile(x+d,y-2))w=d;
        if(!w)continue;return {x:(x+w)*M_T-2.5,y:y*M_T,tx:(x-12)*M_T,ty:y*M_T,w}}return null})()""")
    chk("found a road end against a building", s, json.dumps(s))
    if s:
      await pg.evaluate("""(s)=>{const T=truck;T.x=s.tx;T.y=s.ty;T.h=-1.5708;T.v=0;POL.chase=null;POL.reverses=0;POL.wallHits=0;
        const v=spawnVehicle(s.x,s.y,true,{kind:'estate'})||{};v.x=s.x;v.y=s.y;v.h=1.5708;v.v=6;polMake(v,polStations()[0]);polStartChase(v);
        const c=POL.chase;c.sp=6;c.goal=[s.x+30,s.y]; // pretend it's heading past the wall (worst case)
        window.__camHold=[s.x*PPM-120,s.y*PPM];cam.zLock=2.2;window.__S={x0:v.x,h0:v.h,clip:0,n:0,revMax:0};
        (function tick(){const c=POL.chase;if(!c)return;__S.n++;if(__clip(c.v))__S.clip++;if(c.rev>0)__S.revMax=Math.max(__S.revMax,1);requestAnimationFrame(tick)})();
        setTimeout(()=>{if(POL.chase)POL.chase.goal=null},1500)}""", s)
      for k,t in enumerate([0,500,500,500,600,900,1500]):
        await pg.wait_for_timeout(t); await pg.screenshot(path=f'{OUT}/stuck_{k}.png')
      r=await pg.evaluate("""(()=>{const c=POL.chase;return {chase:!!c,rev:POL.reverses,wall:POL.wallHits,clip:__S.clip,frames:__S.n,
        x:c&&c.v.x,dx:c&&+(c.v.x-__S.x0).toFixed(2),dh:c&&+wrapA(c.v.h-__S.h0).toFixed(2),sp:c&&+c.sp.toFixed(1),reving:c&&c.rev}})()""")
      chk("stuck: hit the wall and reversed out", r['rev']>=1 and r['wall']>=1, json.dumps(r))
      chk("stuck: turned while reversing (heading changed)", r['chase'] and abs(r['dh'])>0.4, json.dumps(r))
      chk("stuck: chase resumed (driving forward, not lost)", r['chase'] and r['reving']==0 and r['sp']>0, json.dumps(r))
      chk("stuck: never inside the building", r['clip']==0, json.dumps(r))
      await pg.evaluate("(()=>{polLose&&POL.chase&&polLose('test');POL.chase=null;window.__camHold=null;cam.zLock=0})()")
    # ---- 2. alley chase: rig in a narrow alley, police the other side of the block (straight line crosses buildings)
    a=await pg.evaluate("""(()=>{const rd=(x,y)=>inb(x,y)&&isRoadT(idx(x,y));
      const sn=(x,y,d)=>{for(let k=1;k<=d;k++)if(isSolidTile(x,y+k*1))return true;return false},sn2=(x,y,d)=>{for(let k=1;k<=d;k++)if(isSolidTile(x,y-k))return true;return false};
      for(let i=MW*200+11;i<MW*(MH-200);i+=3){const x=i%MW,y=(i/MW)|0;if(x<30||x>MW-30||!rd(x,y))continue;
        if(!(sn(x,y,3)&&sn2(x,y,3)&&rd(x-1,y)&&rd(x+1,y)))continue; // narrow alley running E-W, buildings within 2 tiles both sides
        for(let q=7;q<=24;q++)for(const [dx,dy] of [[0,q],[0,-q],[q,0],[-q,0]]){const px=x+dx,py=y+dy;if(!rd(px,py))continue;
          const A=(x+.5)*M_T,B=(y+.5)*M_T,C=(px+.5)*M_T,D=(py+.5)*M_T;if(polRay(C,D,A,B))continue;
          const s=navSnap(px,py,6),e=navSnap(x,y,8);if(!s||!e)continue;const pth=navAStar(s[0],s[1],e[0],e[1]);if(!pth||pth.length<3)continue;
          return {x:A,y:B,px:C,py:D,path:pth.length}}}return null})()""")
    chk("found an alley with police across a block", a, json.dumps(a))
    if a:
      await pg.evaluate("""(a)=>{const T=truck;T.x=a.x;T.y=a.y;T.h=1.5708;T.v=0;POL.chase=null;
        let v=null;for(let t=0;t<40&&!v;t++)v=spawnVehicle(a.px+(t%7-3)*2,a.py+((t/7|0)-3)*2,true,{kind:'estate'});if(!v)return;polMake(v,polStations()[0]);polStartChase(v);POL.chase.sp=8;
        window.__A={clip:0,n:0,minD:1e9,start:__clip(v),sx:v.x,sy:v.y};(function tick(){const c=POL.chase;if(!c)return;__A.n++;if(__clip(c.v))__A.clip++;__A.minD=Math.min(__A.minD,Math.hypot(c.v.x-truck.x,c.v.y-truck.y));requestAnimationFrame(tick)})();
        window.__camHold=[a.x*PPM,a.y*PPM];cam.zLock=0.9}""", a)
      for k in range(3):
        await pg.wait_for_timeout(5000); await pg.screenshot(path=f'{OUT}/alley_{k}.png')
      r=await pg.evaluate("(()=>window.__A?({...__A,chase:!!POL.chase}):{clip:-1,n:0})()")
      chk("alley chase: police never inside a building", r['clip']==0 and r['n']>50, json.dumps(r))
      await pg.evaluate("(()=>{POL.chase&&polLose('test');POL.chase=null;window.__camHold=null;cam.zLock=0})()")
    # ---- 3. roadblocks over 10 min at 2 stars (rig on a long straight, sim time stepped)
    rb=await pg.evaluate("""(()=>{for(let i=MW*400;i<MW*MH;i+=991){const x=i%MW,y=(i/MW)|0;let ok=true;for(let k=0;k<=90&&ok;k++)ok=inb(x+k,y)&&isRoadT(idx(x+k,y));
        if(ok){const T=truck;T.x=(x+2)*M_T;T.y=(y+0.5)*M_T;T.h=1.5708;T.v=8;break}}
      const t0=timeS;RB.made=0;RB.cool=0;RB.list.slice().forEach(rbRemove);RB.made=0;RB.cool=0;RB.ep=undefined;WANT.lvl=2;WANT.star=timeS;
      let stg=0;const onS=window.onScreen;window.onScreen=()=>false;
      for(let s=0;s<600;s++){timeS=t0+s;for(let f=0;f<21;f++)rbTry();for(const B of RB.list.slice()){if(B.st)stg++;if(timeS-B.t>20)rbRemove(B)}}
      window.onScreen=onS;const n=RB.made;RB.list.slice().forEach(rbRemove);WANT.lvl=0;truck.v=0;timeS=t0;return {made:n,stingers:stg,live:RB.list.length}})()""")
    chk("roadblocks: at most 2 in 10 min of 2-star wanted", rb['made']<=2, json.dumps(rb))
    await pg.wait_for_timeout(300)
    st=await pg.evaluate("(()=>RB.list.some(B=>B.st))()")
    chk("no spike strips on roadblocks", not st and rb['stingers']==0, json.dumps(rb))
    chk("no page errors", not errs, json.dumps(errs[:3]))
    print(f"{sum(R)}/{len(R)} passed"); await b.close(); sys.exit(0 if all(R) else 1)
asyncio.run(main())
