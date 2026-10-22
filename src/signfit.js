// ---- sign text fitting (v71): every in-world sign board draws its text through signFit so it never overruns.
// Shrinks the font to fit maxW (down to a readable minimum), then wraps to two lines, and as a last resort
// squashes horizontally via fillText's maxWidth. Respects the caller's textAlign / textBaseline / fillStyle.
// SIGNFIT.log = [] turns on an audit log (used by tests/sign_fit_test.py).
const SIGNFIT = { log: typeof window !== "undefined" && window.__SIGNLOG ? [] : null, minPx: 7 };
function signMeasure(g, t, pre, s, fam) {
  g.font = pre + s + "px " + fam;
  return g.measureText(t).width;
}
// pre: font prefix like "bold " / "900 "; fam: font family; o: {min, maxH, id, wrap}
function signFit(g, text, x, y, maxW, px, pre, fam, o) {
  o = o || {};
  text = String(text == null ? "" : text);
  pre = pre || "";
  fam = fam || "Arial";
  maxW = Math.max(1, maxW);
  const min = Math.min(px, o.min || Math.max(SIGNFIT.minPx, Math.round(px * 0.6)));
  let s = px,
    w = signMeasure(g, text, pre, s, fam);
  const w0 = w;
  if (w > maxW) {
    s = Math.max(min, Math.floor((px * maxW) / w));
    w = signMeasure(g, text, pre, s, fam);
    while (w > maxW && s > min) w = signMeasure(g, text, pre, --s, fam);
  }
  let lines = [text];
  if (w > maxW && o.wrap !== false && text.trim().includes(" ")) {
    // two lines: split at the space nearest the middle, size so both fit (and the pair fits maxH if given)
    const sp = [];
    for (let i = 0; i < text.length; i++) if (text[i] === " ") sp.push(i);
    let best = sp[0];
    for (const i of sp) if (Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2)) best = i;
    const L = [text.slice(0, best).trim(), text.slice(best + 1).trim()];
    let s2 = px;
    if (o.maxH) s2 = Math.min(s2, Math.floor(o.maxH / 2.1));
    const mw = () => Math.max(signMeasure(g, L[0], pre, s2, fam), signMeasure(g, L[1], pre, s2, fam));
    let w2 = mw();
    while (w2 > maxW && s2 > min) {
      s2--;
      w2 = mw();
    }
    if (w2 <= maxW || w2 < w) {
      lines = L;
      s = s2;
      w = w2;
    }
  }
  g.font = pre + s + "px " + fam;
  const lh = s * 1.05;
  for (let i = 0; i < lines.length; i++) {
    const dy = (i - (lines.length - 1) / 2) * lh;
    g.fillText(lines[i], x, y + dy, maxW); // maxWidth only bites in the last-resort case
  }
  if (SIGNFIT.log)
    SIGNFIT.log.push({ id: o.id || "", t: text, w0: Math.round(w0), w: Math.round(Math.min(w, maxW) * 10) / 10, sq: w > maxW + 0.5 ? Math.round((maxW / w) * 100) / 100 : 0, maxW: Math.round(maxW * 10) / 10, px: s, px0: px, lines: lines.length });
  return { w, s, lines: lines.length };
}
// width the text would need at full size (for boards that can widen)
function signNeed(g, text, px, pre, fam) {
  return signMeasure(g, String(text), pre || "", px, fam || "Arial");
}
// same, but takes the size/weight/family from the current g.font (drop-in for g.fillText on a board)
function fitText(g, text, x, y, maxW, id, o) {
  const m = /^(.*?)(\d+(?:\.\d+)?)px\s+(.*)$/.exec(g.font) || [0, "bold ", "12", "Arial"];
  return signFit(g, text, x, y, maxW, +m[2], m[1], m[3], Object.assign({ id: id }, o || {}));
}
