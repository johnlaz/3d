import Module from '../vendor/manifold.js';
import { build, PRESETS } from '../src/plug.js';
const wasm = await Module(); wasm.setup();
for (const key of ['long','pistol']) {
  const P = { ...PRESETS[key], faceA: 'hex' };
  const t0 = Date.now(); const r = build(wasm, P); 
  const out = {};
  for (const k of ['A','decA','B','decB']) { const m = r[k]; const bb = m.boundingBox(); out[k] = { vol: +m.volume().toFixed(1), size: [bb.max[0]-bb.min[0], bb.max[1]-bb.min[1], bb.max[2]-bb.min[2]].map(v=>+v.toFixed(1)), genus: m.genus(), tris: m.numTri() }; }
  console.log(key, Date.now()-t0, 'ms', JSON.stringify(out)); console.log(' derived', JSON.stringify({cavBot:r.q.cavBot,cavTop:r.q.cavTop,cavH:r.q.cavH,wall:r.q.wall,PX:r.q.PX,PY:r.q.PY}));
}
