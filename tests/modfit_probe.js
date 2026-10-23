// in-page: diff bbox (metres) of each visual part vs stock, top (czArt) and side (czSide). returns {model:{part:{top:[x0,x1,y0,y1],side:[...]}}}
(() => {
  const VIS = ['exs','exh','tnk','skt','mud','spl','rbar','bmp','bem','bcn','vis','led','plt','arm','bpl'];
  const S = PPM * ART_SCALE, R = {};
  const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const bbox = (a, b, w, h) => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4;
      if (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]) + Math.abs(a[i+3]-b[i+3]) > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? null : [x0, x1 + 1, y0, y1 + 1]; };
  const SC = 40, SW = 480, SH = 260, CX = 300, CY = 230;
  const side = (m, col, fit) => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; czSide(c.getContext('2d'), CX, CY, SC, m, col, fit); return c; };
  const r2 = (v) => Math.round(v * 100) / 100;
  for (const m of TRUCK_MODELS) {
    const col = m.cols[0], a0 = czArt(m, col, {}), s0 = px(side(m, col, {})), t0 = px(a0.c);
    const out = (R[m.id] = { _body: { top: null, side: null } });
    // stock body extents
    { const d = t0; let x0=1e9,x1=-1,y0=1e9,y1=-1; for (let y=0;y<a0.H;y++) for (let x=0;x<a0.W;x++) if (d[(y*a0.W+x)*4+3]>40){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
      out._body.top = [(x0-a0.ox)/S,(x1+1-a0.ox)/S,(y0-a0.oy)/S,(y1+1-a0.oy)/S].map(r2); }
    for (const sl of VIS) for (const p of CZ_PARTS.filter((q) => q.slot === sl)) {
      const fit = { [sl]: p.id }; let a, t, s;
      try { a = czArt(m, col, fit); } catch (e) { out[p.id] = { err: String(e) }; continue; }
      const res = {};
      if (a.W === a0.W && a.H === a0.H) { const b = bbox(px(a.c), t0, a.W, a.H); res.top = b && [(b[0]-a.ox)/S,(b[1]-a.ox)/S,(b[2]-a.oy)/S,(b[3]-a.oy)/S].map(r2); }
      else res.top = 'size';
      const b2 = bbox(px(side(m, col, fit)), s0, SW, SH);
      res.side = b2 && [(b2[0]-CX)/SC,(b2[1]-CX)/SC,(CY-b2[3])/SC,(CY-b2[2])/SC].map(r2); // x0,x1 along; y0,y1 up
      out[p.id] = res;
    }
  }
  return R;
})()
