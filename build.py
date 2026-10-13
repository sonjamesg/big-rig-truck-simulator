import os, zipfile, shutil
d=os.path.dirname(os.path.abspath(__file__)); s=os.path.join(d,'src')
js=open(os.path.join(s,'peerjs.min.js')).read()+"\n;\n"+"const ENGINE_WAV_B64='"+open(os.path.join(s,'engine_b64.txt')).read().strip()+"';\n"
for f in ['keyguard.js','world.js','render.js','bldg2.js','lorry.js','physics.js','audio.js','traffic.js','markings.js','signals.js','depots.js','fuel.js','sites.js','career.js','ui.js','ambient.js','satnav.js','gamepad.js','mp.js','mobile.js','breakdown.js','indicators.js','fx.js','port.js','daynight.js','weather.js','main.js']: js+=open(os.path.join(s,f)).read()+"\n"
html=open(os.path.join(s,'template.html')).read().replace('/*SCRIPT*/',js)
open(os.path.join(d,'BigRig.html'),'w').write(html)
dist=os.path.join(d,'dist','BigRigWeb'); shutil.rmtree(os.path.join(d,'dist'),ignore_errors=True); os.makedirs(dist)
open(os.path.join(dist,'index.html'),'w').write(html)
open(os.path.join(dist,'CREDITS.txt'),'w').write("Big Rig Truck Simulator (web preview)\n\nEngine sound: 'Truck engine' (Iveco Daily diesel) by Joseph Sardin, https://bigsoundbank.com/truck-engine-s1145.html - CC0 public domain.\nAll graphics are procedurally generated in code. Other sounds synthesised with WebAudio.\n\nOpen index.html in Chrome (double-click works, no server needed).\n")
with zipfile.ZipFile(os.path.join(d,'BigRigWeb.zip'),'w',zipfile.ZIP_DEFLATED) as z:
    for f in os.listdir(dist): z.write(os.path.join(dist,f),'BigRigWeb/'+f)
print('built',len(html))
