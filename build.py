import os, zipfile, shutil
d=os.path.dirname(os.path.abspath(__file__)); s=os.path.join(d,'src')
js=open(os.path.join(s,'peerjs.min.js')).read()+"\n;\n"+"const ENGINE_WAV_B64='"+open(os.path.join(s,'engine_b64.txt')).read().strip()+"';\n"
# map data (src/map/, see AGENTS.md): inlined as window.MAP_DATA, gzip+base64; mapload.js decodes it on boot
def _map_data():
    """returns (gzip state bytes, {tile key: gzip bytes}) or None"""
    import json as _j, gzip as _g
    md=os.path.join(s,'map'); mf=os.path.join(md,'manifest.json')
    if not os.path.exists(mf): return None
    man=_j.load(open(mf)); parts=[]
    for p in man['parts']:
        if p.get('derived'): parts.append(p); continue
        parts.append({'root':p['root'],'key':p['key'],'value':_j.load(open(os.path.join(md,p['file'])))})
    st=_g.compress(_j.dumps({'parts':parts},separators=(',',':'),ensure_ascii=False).encode(),9,mtime=0)
    return st,{k:open(os.path.join(md,'tiles',k+'.rle.gz'),'rb').read() for k in man['tiles']}
_MD=_map_data()
def _map_inline():
    # BigRig.html (single file, works from file://): data inlined as base64
    import json as _j, base64 as _b
    if not _MD: return ''
    return 'window.MAP_DATA='+_j.dumps({'state':_b.b64encode(_MD[0]).decode(),'tiles':{k:_b.b64encode(v).decode() for k,v in _MD[1].items()}},separators=(',',':'))+';\n'
def _map_bin():
    # index.html / dist: mapdata.bin fetched at boot (see mapload.js mapParseBin)
    import json as _j, struct as _st
    blobs=[]; off=0; h={'tiles':{}}
    def add(b):
        nonlocal off
        r=[off,len(b)]; blobs.append(b); off+=len(b); return r
    h['state']=add(_MD[0])
    for k,v in _MD[1].items(): h['tiles'][k]=add(v)
    hb=_j.dumps(h,separators=(',',':')).encode()
    return _st.pack('<I',len(hb))+hb+b''.join(blobs)
for f in ['signfit.js','keyguard.js','world.js','render.js','bldg2.js','lorry.js','rigart.js','physics.js','horns.js','audio.js','traffic.js','markings.js','signals.js','peds.js','pedlife.js','depots.js','fuel.js','sites.js','ltg.js','volcano.js','services.js','career.js','ui.js','ambient.js','satnav.js','gamepad.js','mp.js','mobile.js','haptics.js','breakdown.js','indicators.js','beams.js','fx.js','crash.js','port.js','tugs.js','porttrucks.js','owndepot.js','homes.js','tune.js','tune2.js','tune3.js','tune4.js','turntable.js','repair.js','park.js','rail.js','daynight.js','nightmap.js','mapov.js','weather.js','mapload.js','main.js','home.js','roadlaw.js','police.js','wanted.js','rbx.js','j103.js','airport.js','milbase.js','heli.js','bm.js','army.js','ambulance.js','fire.js','bikes.js','liftbridge.js','gfx.js','gfxshade.js','gfx3d.js','gfxcity.js','flycam.js','accounts.js','invite.js','server.js','homecard.js','ctrltheme.js','milrig.js','wheelspec.js','fog.js','pause.js','mapdbg.js']: js+=open(os.path.join(s,f)).read()+"\n"
import datetime,subprocess
try: _rev=subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=d).decode().strip()
except Exception: _rev='dev'
_bk=os.path.join(s,'railbake.json')
if os.path.exists(_bk): js="window.RAIL_BAKE="+open(_bk).read().strip()+";\n"+js
js="window.BIGRIG_VERSION='Build "+datetime.date.today().strftime('%d %b %Y')+" \\u00b7 "+_rev+"';\n"+js
_bid=datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')
_tpl=open(os.path.join(s,'template.html')).read()
_mk=lambda j:_tpl.replace('/*SCRIPT*/',j).replace('__BUILD_ID__',_bid)
_bin=_map_bin() if _MD else None
open(os.path.join(d,'BigRig.html'),'w').write(_mk(_map_inline()+js))
html=_mk(("window.MAP_URL='mapdata.bin?v="+_bid+"';\n" if _bin else '')+js)
open(os.path.join(d,'index.html'),'w').write(html)
if _bin: open(os.path.join(d,'mapdata.bin'),'wb').write(_bin)
dist=os.path.join(d,'dist','BigRigWeb'); shutil.rmtree(os.path.join(d,'dist'),ignore_errors=True); os.makedirs(dist)
open(os.path.join(dist,'index.html'),'w').write(html)
if _bin: open(os.path.join(dist,'mapdata.bin'),'wb').write(_bin)
open(os.path.join(dist,'CREDITS.txt'),'w').write("Big Rig Truck Simulator (web preview)\n\nEngine sound: 'Truck engine' (Iveco Daily diesel) by Joseph Sardin, https://bigsoundbank.com/truck-engine-s1145.html - CC0 public domain.\nAll graphics are procedurally generated in code. Other sounds synthesised with WebAudio.\n\nOpen index.html in Chrome (double-click works, no server needed).\n")
with zipfile.ZipFile(os.path.join(d,'BigRigWeb.zip'),'w',zipfile.ZIP_DEFLATED) as z:
    for f in os.listdir(dist): z.write(os.path.join(dist,f),'BigRigWeb/'+f)
print('built',len(html))
