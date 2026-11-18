import gen10 as g, cadquery as cq, zipfile, os, sys, io
OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)
A, dA, B, dB = g.build()

def mesh(wp, tol=0.02):
    v, t = wp.val().tessellate(tol, 0.1)
    idx = {}; V = []; T = []
    def vid(p):
        k = (round(p.x, 4), round(p.y, 4), round(p.z, 4))
        if k not in idx: idx[k] = len(V); V.append(k)
        return idx[k]
    for a, b, c in t:
        ia, ib, ic = vid(v[a]), vid(v[b]), vid(v[c])
        if len({ia, ib, ic}) == 3: T.append((ia, ib, ic))
    return V, T

def write_stl(path, wp, dx, dy, dz=0.0, tol=0.02):
    v, t = wp.val().tessellate(tol, 0.1)
    import struct
    tris = [(v[a], v[b], v[c]) for a, b, c in t]
    with open(path, "wb") as f:
        f.write(b"ARMORY trigger deterrent".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for p, q, r in tris:
            P = [(x.x + dx, x.y + dy, x.z + dz) for x in (p, q, r)]
            ux, uy, uz = [P[1][i]-P[0][i] for i in range(3)]; vx, vy, vz = [P[2][i]-P[0][i] for i in range(3)]
            nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
            L = (nx*nx+ny*ny+nz*nz) ** 0.5 or 1
            f.write(struct.pack("<12fH", nx/L, ny/L, nz/L, *P[0], *P[1], *P[2], 0))

# ---- separate STLs (plate + its decor share one offset so they stay registered) ----
parts = [("plateA_body", A), ("plateA_decor", dA), ("plateB_body", B), ("plateB_decor", dB)]
for n, o in parts: write_stl(f"{OUT}/{n}.stl", o, 110, 110)

# ---- combined 3MF: three assemblies (Plate A, Plate B, Screw); decor + screw on filament 2 ----
bodies = [("plateA_body", A, 1), ("plateA_decor", dA, 2), ("plateB_body", B, 1), ("plateB_decor", dB, 2)]
res = []; ids = {}
for i, (n, o, ex) in enumerate(bodies, start=1):
    V, T = mesh(o); ids[n] = i
    vx = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in V)
    tx = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in T)
    res.append(f'<object id="{i}" type="model" name="{n}"><mesh><vertices>{vx}</vertices><triangles>{tx}</triangles></mesh></object>')
asm = [(10, "Plate A", ["plateA_body", "plateA_decor"], (110, 60, 0)),
       (11, "Plate B", ["plateB_body", "plateB_decor"], (110, 120, 0))]
build = []
for oid, name, comps, pos in asm:
    c = "".join(f'<component objectid="{ids[k]}"/>' for k in comps)
    res.append(f'<object id="{oid}" type="model" name="{name}"><components>{c}</components></object>')
    build.append(f'<item objectid="{oid}" transform="1 0 0 0 1 0 0 0 1 {pos[0]:.4f} {pos[1]:.4f} {pos[2]:.4f}"/>')
model = ('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
         '<metadata name="Title">ARMORY trigger cover v10 plug</metadata><resources>' + "".join(res) + '</resources><build>' + "".join(build) + '</build></model>')
ex = {n: e for n, _, e in bodies}
cfg = ['<?xml version="1.0" encoding="UTF-8"?>\n<config>']
for oid, name, comps, pos in asm:
    cfg.append(f'<object id="{oid}"><metadata key="name" value="{name}"/><metadata key="extruder" value="{ex[comps[0]]}"/>')
    for k in comps:
        cfg.append(f'<part id="{ids[k]}" subtype="normal_part"><metadata key="name" value="{k}"/><metadata key="extruder" value="{ex[k]}"/></part>')
    cfg.append('</object>')
cfg.append('</config>')
ct = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
      '<Default Extension="config" ContentType="text/xml"/></Types>')
rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
with zipfile.ZipFile(f"{OUT}/full_set.3mf", "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", ct); z.writestr("_rels/.rels", rels)
    z.writestr("3D/3dmodel.model", model); z.writestr("Metadata/model_settings.config", "".join(cfg))
print("ok", os.listdir(OUT))
