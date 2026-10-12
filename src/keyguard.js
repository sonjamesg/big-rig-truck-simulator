// v10.1 key guard — loaded FIRST. Every game keydown/keyup handler registered on window is wrapped so that:
// 1) typing in any input/textarea never reaches the game (no hotkeys, no preventDefault) — the field's own listeners still run;
// 2) until the game has started (lobby/title screen) every game hotkey is ignored; only Enter (start solo) passes.
const isTyping=t=>!!t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
{ const add=window.addEventListener.bind(window);
  window.addEventListener=function(type,fn,opt){ if((type==='keydown'||type==='keyup')&&typeof fn==='function'){ const raw=fn;
      fn=function(e){ if(isTyping(e.target)) return; let st=true; try{ st=started; }catch(_){ st=false; } if(!st&&type==='keydown'&&e.code!=='Enter'&&e.code!=='NumpadEnter') return; return raw.call(this,e); }; }
    return add(type,fn,opt); }; }
