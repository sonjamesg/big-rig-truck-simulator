/**
 * @file ctrltheme.js — phone controller theme (v51, v58 near-black #050608-#0b0d12): black deck / side gutters, dark buttons, each with a crisp
 *   2 px neon-blue border (an outline, so no button moves or resizes), brighter while pressed. Colours only: the
 *   layout from mobile.js is untouched.
 * Exposes (globals): CTRL_NEON, CTRL_CSS
 * Depends on: mobile.js (#deck, .dside, #mob .b classes)
 * Load order: last in build.py (higher-specificity overrides, so order does not matter). All files share one global scope (see AGENTS.md).
 */
const CTRL_NEON = "#2ad4ff";
const CTRL_CSS = `
html body.touch #deck,html body.touch .dside{background:#07080b!important;box-shadow:inset 0 2px 0 rgba(42,212,255,.25),0 -6px 24px rgba(0,0,0,.6)!important}
html body.touch #deck .brand,html body.touch .dside .brand{color:${CTRL_NEON}!important} html body.touch #deck .brand b,html body.touch .dside .brand b{color:#ff3d7f!important}
html body.touch #mob .b{background:#0d0f14!important;color:#eef8ff!important;border-color:#0d0f14!important;box-shadow:0 3px 0 #020304!important;outline:2px solid ${CTRL_NEON};outline-offset:-2px;filter:none}
html body.touch #mob .b small{color:#8fe3ff!important}
html body.touch #mob .ab small{color:${CTRL_NEON}!important}
html body.touch #mob .gas,html body.touch #mob .brk,html body.touch #mob .ab{background:#0b0d12!important}
html body.touch #mob .gas,html body.touch #mob #mA{color:#7dffb0!important} html body.touch #mob .brk,html body.touch #mob #mB{color:#ff7aa0!important}
html body.touch #mob .steer{background:#08090c!important}
html body.touch #mob .knob{background:#101218!important;border:none!important;box-shadow:0 3px 0 #020304!important;outline:2px solid ${CTRL_NEON};outline-offset:-2px}
html body.touch #mob .dpc{outline:none;background:#0d0f14!important;box-shadow:none!important}
html body.touch #mob .b.dim{opacity:.4}
html body.touch #mob .b.on,html body.touch #mob .b.ctxon,html body.touch #mob .b.beamon{background:#0b2433!important;outline-color:#a8f0ff;color:#fff!important;filter:none!important}
html body.touch #mob .b.on{transform:translateY(2px)}
html body.touch #mob .b.ctxon{outline-color:#ffd34d}
`;
{
  const st = document.createElement("style");
  st.id = "ctrlTheme";
  st.textContent = CTRL_CSS;
  (document.head || document.documentElement).appendChild(st);
}
