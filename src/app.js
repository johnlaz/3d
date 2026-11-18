// ---------- app ----------
const $ = (s) => document.querySelector(s);
const CAL = [
  { id: "9mm", name: "9mm", c: "red" }, { id: "38", name: ".38 Special", c: "white" },
  { id: "556", name: "5.56 / .223", c: "blue" }, { id: "40", name: ".40 S&W", c: "green" },
  { id: "45", name: ".45 ACP", c: "green" }, { id: "300blk", name: "300 Blackout", c: "yellow" },
  { id: "12ga", name: "12 gauge", c: "orange" }, { id: "20ga", name: "20 gauge", c: "orange" },
  { id: "308", name: ".308 / 7.62x51", c: "orange" }, { id: "22lr", name: ".22 LR", c: "white" },
  { id: "44r", name: ".44 Henry rimfire", c: "white" }, { id: "custom", name: "Custom colour", c: "custom" },
];
const COL = { red: "#e02424", blue: "#2f6bff", green: "#1fa34a", yellow: "#f5c400", orange: "#ff7a1a", white: "#f2f2f2" };
const LEGEND = [["red", "9mm, .38 only if you prefer", "9mm"], ["blue", "5.56 / .223", ""], ["green", ".40 S&W, .45 ACP", ""], ["yellow", "300 Blackout", ""], ["orange", "12 ga, 20 ga, .308", ""], ["white", ".38 Special, .22 LR, .44 Henry rimfire", ""]];
LEGEND[0][1] = "9mm";
const S = { preset: "long", P: { ...PRESETS.long, faceA: "hex" }, cal: "9mm", custom: "#8844ff", base: "black" };
const BASE = { black: "#2b2b30", gray: "#9a9aa0" };
let wasm = null, res = null, meshes = null, explode = false, busy = false, timer = null;

// ---------- mesh helpers ----------
function getMesh(m) {
  const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, n = vp.length / np;
  const v = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { v[i*3] = vp[i*np]; v[i*3+1] = vp[i*np+1]; v[i*3+2] = vp[i*np+2]; }
  return { v, t: new Uint32Array(g.triVerts) };
}
function stl(mesh, dx = 0, dy = 0, dz = 0) {
  const nt = mesh.t.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
  new TextEncoder().encodeInto("ARMORY plug builder", new Uint8Array(buf, 0, 80));
  dv.setUint32(80, nt, true);
  for (let i = 0, o = 84; i < nt; i++, o += 50) {
    const a = mesh.t[i*3], b = mesh.t[i*3+1], c = mesh.t[i*3+2], v = mesh.v;
    const p = [[v[a*3]+dx, v[a*3+1]+dy, v[a*3+2]+dz], [v[b*3]+dx, v[b*3+1]+dy, v[b*3+2]+dz], [v[c*3]+dx, v[c*3+1]+dy, v[c*3+2]+dz]];
    const ux = p[1][0]-p[0][0], uy = p[1][1]-p[0][1], uz = p[1][2]-p[0][2], wx = p[2][0]-p[0][0], wy = p[2][1]-p[0][1], wz = p[2][2]-p[0][2];
    let nx = uy*wz-uz*wy, ny = uz*wx-ux*wz, nz = ux*wy-uy*wx; const L = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx/L, true); dv.setFloat32(o+4, ny/L, true); dv.setFloat32(o+8, nz/L, true);
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) dv.setFloat32(o + 12 + k*12 + j*4, p[k][j], true);
    dv.setUint16(o + 48, 0, true);
  }
  return new Uint8Array(buf);
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (d) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) { // store-only zip
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), d = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, d);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), name); off += 30 + name.length + d.length;
  }
  const csz = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: "application/zip" });
}
function meshXml(mesh, id, name) {
  let vx = "", tx = "";
  for (let i = 0; i < mesh.v.length; i += 3) vx += `<vertex x="${mesh.v[i].toFixed(4)}" y="${mesh.v[i+1].toFixed(4)}" z="${mesh.v[i+2].toFixed(4)}"/>`;
  for (let i = 0; i < mesh.t.length; i += 3) tx += `<triangle v1="${mesh.t[i]}" v2="${mesh.t[i+1]}" v3="${mesh.t[i+2]}"/>`;
  return `<object id="${id}" type="model" name="${name}"><mesh><vertices>${vx}</vertices><triangles>${tx}</triangles></mesh></object>`;
}
const CT = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>';
const RELS = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
const MODEL_OPEN = (t) => `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${t}</metadata><resources>`;
const item = (id, x, y) => `<item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${x.toFixed(4)} ${y.toFixed(4)} 0.0000"/>`;
function colour3mf() {
  const r = [meshXml(meshes.A, 1, "plateA_body"), meshXml(meshes.decA, 2, "plateA_decor"), meshXml(meshes.B, 3, "plateB_body"), meshXml(meshes.decB, 4, "plateB_decor"),
    '<object id="10" type="model" name="Plate A"><components><component objectid="1"/><component objectid="2"/></components></object>',
    '<object id="11" type="model" name="Plate B"><components><component objectid="3"/><component objectid="4"/></components></object>'].join("");
  const model = MODEL_OPEN("ARMORY plug") + r + "</resources><build>" + item(10, 110, 60) + item(11, 110, 120) + "</build></model>";
  const cfg = '<?xml version="1.0" encoding="UTF-8"?>\n<config>' +
    '<object id="10"><metadata key="name" value="Plate A"/><metadata key="extruder" value="1"/><part id="1" subtype="normal_part"><metadata key="name" value="plateA_body"/><metadata key="extruder" value="1"/></part><part id="2" subtype="normal_part"><metadata key="name" value="plateA_decor"/><metadata key="extruder" value="2"/></part></object>' +
    '<object id="11"><metadata key="name" value="Plate B"/><metadata key="extruder" value="1"/><part id="3" subtype="normal_part"><metadata key="name" value="plateB_body"/><metadata key="extruder" value="1"/></part><part id="4" subtype="normal_part"><metadata key="name" value="plateB_decor"/><metadata key="extruder" value="2"/></part></object></config>';
  return zip([{ name: "[Content_Types].xml", data: CT }, { name: "_rels/.rels", data: RELS }, { name: "3D/3dmodel.model", data: model }, { name: "Metadata/model_settings.config", data: cfg }]);
}
function mono3mf() {
  const dx = res.q.PX/2 + 4;
  const model = MODEL_OPEN("ARMORY plug (mono)") + meshXml(meshes.A, 1, "Plate A") + meshXml(meshes.B, 2, "Plate B") + "</resources><build>" + item(1, 110 - dx, 110) + item(2, 110 + dx, 110) + "</build></model>";
  return zip([{ name: "[Content_Types].xml", data: CT }, { name: "_rels/.rels", data: RELS }, { name: "3D/3dmodel.model", data: model }]);
}
function stlFiles() {
  return [["plateA_body.stl", meshes.A], ["plateA_decor.stl", meshes.decA], ["plateB_body.stl", meshes.B], ["plateB_decor.stl", meshes.decB]].map(([n, m]) => ({ name: n, data: stl(m, 110, 110) }));
}
function tag() { const c = CAL.find(x => x.id === S.cal); return `${S.preset}_${c.id}_${c.c === "custom" ? S.custom.replace("#", "") : c.c}`; }
function save(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
function readme() {
  const q = res.q, c = CAL.find(x => x.id === S.cal);
  return `ARMORY plug - ${S.preset} / ${c.name}\nCore ${q.BX}x${q.BY} mm, frame width ${q.GAP} mm, plates ${q.PX}x${q.PY} mm\nColour 3MF: base = filament 1, ring/letters/hex = filament 2 (${c.c === "custom" ? S.custom : COL[c.c]})\nPrint: plate A outer face down (core up); plate B outer face up. No supports.\nMono: print the plate bodies only; the ring/letters stay open recesses.\n`;
}

// ---------- preview (tiny WebGL) ----------
const cv = $("#cv"), gl = cv.getContext("webgl", { antialias: true });
let yaw = -0.75, pitch = 0.62, dist = 100, buf = null, nVert = 0;
const VS = "attribute vec3 p,n;attribute vec3 c;uniform mat4 m;varying vec3 vc,vn;void main(){gl_Position=m*vec4(p,1.);vc=c;vn=n;}";
const FS = "precision mediump float;varying vec3 vc,vn;uniform vec3 L;void main(){float d=abs(dot(normalize(vn),normalize(L)));gl_FragColor=vec4(vc*(0.38+0.72*d),1.);}";
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
const hex2 = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i+2), 16) / 255);
function accent() { const c = CAL.find(x => x.id === S.cal); return c.c === "custom" ? S.custom : COL[c.c]; }
function buildBuffer() {
  const q = res.q, zB = q.coreTop + (explode ? 24 : 0), out = [];
  const add = (mesh, col, dz, decor) => {
    const v = mesh.v, t = mesh.t;
    for (let i = 0; i < t.length; i += 3) {
      const a = [0, 1, 2].map(k => [v[t[i+k]*3], v[t[i+k]*3+1], v[t[i+k]*3+2] + dz + (decor ? 0.02 : 0)]);
      const ux = a[1][0]-a[0][0], uy = a[1][1]-a[0][1], uz = a[1][2]-a[0][2], wx = a[2][0]-a[0][0], wy = a[2][1]-a[0][1], wz = a[2][2]-a[0][2];
      let nx = uy*wz-uz*wy, ny = uz*wx-ux*wz, nz = ux*wy-uy*wx; const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      for (const p of a) out.push(p[0], p[1], p[2], nx, ny, nz, col[0], col[1], col[2]);
    }
  };
  const base = hex2(BASE[S.base]), acc = hex2(accent());
  add(meshes.A, base, 0, false); add(meshes.decA, acc, 0, true); add(meshes.B, base, zB, false); add(meshes.decB, acc, zB, true);
  const arr = new Float32Array(out); nVert = arr.length / 9;
  buf = buf || gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  draw();
}
function mat4mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+j] * b[i*4+k]; o[i*4+j] = s; } return o; }
function draw() {
  if (!buf || !res) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h); gl.clearColor(0.09, 0.1, 0.12, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
  const q = res.q, cz = (q.coreTop + q.TB) / 2 + (explode ? 12 : 0);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const ex = dist * cp * sy, ey = -dist * cp * cy, ez = dist * sp + cz;
  // lookAt (z up)
  let fx = -ex, fy = -ey, fz = cz - ez; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = fy*1 - fz*0, ry = fz*0 - fx*1, rz = 0; const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  const ux = ry*fz - rz*fy, uy = rz*fx - rx*fz, uz = rx*fy - ry*fx;
  const V = new Float32Array([rx, ux, -fx, 0, ry, uy, -fy, 0, rz, uz, -fz, 0, -(rx*ex+ry*ey+rz*ez), -(ux*ex+uy*ey+uz*ez), (fx*ex+fy*ey+fz*ez), 1]);
  const asp = w / h, f = 1 / Math.tan(0.4), n = 5, fa = 600;
  const Pm = new Float32Array([f/asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa+n)/(n-fa), -1, 0, 0, 2*fa*n/(n-fa), 0]);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "m"), false, mat4mul(Pm, V));
  gl.uniform3f(gl.getUniformLocation(prog, "L"), -0.4, -0.6, 0.8);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  [["p", 0], ["n", 3], ["c", 6]].forEach(([nm, off]) => { const l = gl.getAttribLocation(prog, nm); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 36, off * 4); });
  gl.drawArrays(gl.TRIANGLES, 0, nVert);
}
{ const ptr = new Map(); let pd = 0;
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); pd = 0; });
  cv.addEventListener("pointerup", (e) => ptr.delete(e.pointerId)); cv.addEventListener("pointercancel", (e) => ptr.delete(e.pointerId));
  cv.addEventListener("pointermove", (e) => {
    if (!ptr.has(e.pointerId)) return; const o = ptr.get(e.pointerId);
    if (ptr.size === 1) { yaw += (e.clientX - o[0]) * 0.008; pitch = Math.max(-1.4, Math.min(1.5, pitch + (e.clientY - o[1]) * 0.008)); }
    else if (ptr.size === 2) { const pts = [...ptr.entries()].map(([id, p]) => id === e.pointerId ? [e.clientX, e.clientY] : p); const d = Math.hypot(pts[0][0]-pts[1][0], pts[0][1]-pts[1][1]); if (pd) dist = Math.max(50, Math.min(300, dist * pd / d)); pd = d; }
    ptr.set(e.pointerId, [e.clientX, e.clientY]); draw();
  });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.max(50, Math.min(300, dist * (1 + e.deltaY * 0.001))); draw(); }, { passive: false });
}

// ---------- UI ----------
const FIELDS = [["BX", "Core width (along barrel)", "mm"], ["BY", "Core height (guard window)", "mm"], ["GAP", "Frame width at guard", "mm"], ["TB", "Plate B thickness", "mm"],
  ["clipLen", "Clip length (head underside to tip)", "mm"], ["HEADD", "Clip head diameter", "mm"], ["HEADDEPTH", "Head recess depth", "mm"], ["HOLE", "Clip stem hole in plate B", "mm"],
  ["BORE", "Entry bore (clip, unexpanded)", "mm"], ["CAV", "Cavity (clip, expanded + ~1.2)", "mm"], ["CEIL", "Ceiling thickness", "mm"], ["NOTCH", "Pry notch width", "mm"]];
function ui() {
  $("#presets").innerHTML = ["long", "pistol", "custom"].map(k => `<button data-p="${k}" class="${S.preset === k ? "on" : ""}">${k === "long" ? "Long-gun" : k === "pistol" ? "Pistol*" : "Custom"}</button>`).join("");
  $("#cal").innerHTML = CAL.map(c => `<option value="${c.id}" ${c.id === S.cal ? "selected" : ""}>${c.name}${c.c === "custom" ? "" : " - " + c.c}</option>`).join("");
  $("#faceA").innerHTML = [["hex", "Hex + letters"], ["letters", "Letters only"]].map(([k, n]) => `<button data-f="${k}" class="${S.P.faceA === k ? "on" : ""}">${n}</button>`).join("");
  $("#base").innerHTML = [["black", "Black base"], ["gray", "Gray base"]].map(([k, n]) => `<button data-b="${k}" class="${S.base === k ? "on" : ""}">${n}</button>`).join("");
  $("#assumed").style.display = S.preset === "pistol" ? "block" : "none";
  $("#customcol").style.display = S.cal === "custom" ? "inline-block" : "none";
  $("#sw").style.background = accent();
  $("#fields").innerHTML = FIELDS.map(([k, l, u]) => `<label>${l}<span><input data-k="${k}" type="number" step="0.1" value="${S.P[k]}" inputmode="decimal"> ${u}</span></label>`).join("");
  $("#legend").innerHTML = LEGEND.map(([c, t]) => `<div class="lg"><i style="background:${COL[c]}"></i><b>${c}</b> ${t}</div>`).join("");
}
function schedule() { clearTimeout(timer); $("#status").textContent = "Building..."; timer = setTimeout(rebuild, 250); }
function rebuild() {
  if (!wasm) return;
  try {
    if (res) for (const k of ["A", "decA", "B", "decB"]) res[k].delete();
    res = build(wasm, S.P);
    meshes = { A: getMesh(res.A), decA: getMesh(res.decA), B: getMesh(res.B), decB: getMesh(res.decB) };
    const q = res.q, w = checks(q);
    $("#derived").innerHTML = `Plates ${q.PX} x ${q.PY} mm &middot; side wall ${q.wall.toFixed(1)} mm &middot; cavity ${q.cavH.toFixed(1)} mm tall (z ${q.cavBot.toFixed(1)}-${q.cavTop.toFixed(1)})`;
    $("#warn").innerHTML = w.map(x => `<div class="w">&#9888; ${x}</div>`).join("");
    const fl = q.TB - D;
    $("#pause").innerHTML = `Mono colour band (plate B only): pause at <b>${(fl - 0.6).toFixed(1)} mm</b> and swap to the accent filament, then pause at <b>${fl.toFixed(1)} mm</b> to swap back. Plate A's recess is on the bed face, so it can't be coloured on a mono printer.`;
    buildBuffer(); $("#status").textContent = "";
  } catch (e) { console.error(e); $("#status").textContent = "Error: " + e.message; }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.p) { S.preset = b.dataset.p; if (b.dataset.p !== "custom") S.P = { ...PRESETS[b.dataset.p], faceA: S.P.faceA }; ui(); schedule(); }
  if (b.dataset.f) { S.P.faceA = b.dataset.f; ui(); schedule(); }
  if (b.dataset.b) { S.base = b.dataset.b; ui(); if (res) buildBuffer(); }
  if (b.id === "ex") { explode = !explode; b.textContent = explode ? "Assemble" : "Explode"; if (res) buildBuffer(); }
  if (b.id === "dl1") save(colour3mf(), `ARMORY_plug_${tag()}_COLOUR_CFS.3mf`);
  if (b.id === "dl2") save(mono3mf(), `ARMORY_plug_${S.preset}_MONO.3mf`);
  if (b.id === "dl3") save(zip(stlFiles()), `ARMORY_plug_${tag()}_STLs.zip`);
});
async function blobBytes(b) { return new Uint8Array(await b.arrayBuffer()); }
async function allZip() { return zip([...stlFiles(), { name: `full_set_COLOUR_CFS.3mf`, data: await blobBytes(colour3mf()) }, { name: "mono_set.3mf", data: await blobBytes(mono3mf()) }, { name: "README.txt", data: readme() }]); }
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.k) { const v = parseFloat(t.value); if (isFinite(v)) { S.P[t.dataset.k] = v; S.preset = "custom"; $("#presets").querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.p === "custom")); $("#assumed").style.display = "none"; schedule(); } }
  if (t.id === "cal") { S.cal = t.value; ui(); if (res) buildBuffer(); }
  if (t.id === "customcol") { S.custom = t.value; $("#sw").style.background = accent(); if (res) buildBuffer(); }
});
$("#dl4").onclick = async () => save(await allZip(), `ARMORY_plug_${tag()}_ALL.zip`);
window.addEventListener("resize", draw);

// ---------- boot ----------
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
(async () => {
  ui(); $("#status").textContent = "Loading geometry engine...";
  try {
    const url = URL.createObjectURL(new Blob([b64(MJS_B64)], { type: "text/javascript" }));
    const Module = (await import(url)).default;
    wasm = await Module({ wasmBinary: b64(WASM_B64), locateFile: (f) => f }); wasm.setup();
    rebuild();
  } catch (e) { console.error(e); $("#status").textContent = "Engine failed to load: " + e.message; }
})();
