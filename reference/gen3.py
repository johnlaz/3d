import cadquery as cq, math, sys, time
# ---------- parameters (mm) ----------
P_L, P_W, P_R = 100.0, 48.0, 24.0     # plate length, width (obround)
T_A, T_B = 4.0, 6.0                  # plate thicknesses
GAP = 26.0                           # frame width at trigger guard (boss height) -> ADJUST PER GUN
PLUG_W, PLUG_H = 18.0, 26.0          # plug footprint (along barrel x vertical)
X0 = 30.0                            # plug position along plate length
PITCH, MAJ, DEPTH = 2.5, 12.0, 1.4   # thread
CLR = 0.35                           # radial thread clearance (printed)
ENGAGE = 14.0
HEAD_D = 22.0
RING_IN, RING_W, RING_D = 5.0, 2.4, 1.2
CHAMFER = 0.6
SIZE_CODE = 'FS'      # fit class engraved under the wordmark (FS=full-size, C=compact, AR=AR-pattern)
LOGO_W, LOGO_D, LOGO_CX, LOGO_CY = 52.0, 1.2, -12.5, 2.8   # logo width (mm), emboss depth, centre x on plate
FONT_PATH = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
WORD = "ARMORY"

def obround(l, w):
    return cq.Workplane("XY").slot2D(l, w, 0)

def thread_solid(length, major, depth, pitch, clr=0.0):
    rmin = major/2 - depth + clr
    rmaj = major/2 + clr
    core = cq.Workplane("XY").circle(rmin + 0.05).extrude(length)
    turns = length/pitch
    helix = cq.Wire.makeHelix(pitch, length - pitch, rmin)  # leave room for profile
    tip = 0.25
    base = pitch*0.82
    prof = (cq.Workplane("XZ", origin=(0,0,0))
            .polyline([(rmin-0.05, -base/2), (rmaj, -tip/2), (rmaj, tip/2), (rmin-0.05, base/2)]).close())
    prof = prof.translate((0,0,pitch/2))
    sw = prof.sweep(cq.Workplane(obj=helix), isFrenet=True)
    return core.union(sw)


def logo(h):
    """ARMORY logo (hexagon outline + wordmark), centred at origin, extruded h in +Z, reads correctly from +Z."""
    # proportions measured from the supplied artwork (px): total 327x48, hex 41x48 stroke 6.5, text x 57..327 (270 wide), cap 47
    s = LOGO_W/327.0
    Hh = 48*s; R = Hh/2; t = 6.5*s
    hx = (-327/2 + (47-27)) * s            # hex centre x
    outer = cq.Workplane("XY").polygon(6, 2*R).extrude(h).rotate((0,0,0),(0,0,1),30)
    inner = cq.Workplane("XY").polygon(6, 2*(R - t/math.cos(math.radians(30)))).extrude(h).rotate((0,0,0),(0,0,1),30)
    hexring = outer.cut(inner).translate((hx,0,0))
    txt = cq.Workplane("XY").text(WORD, 10.0, h, fontPath=FONT_PATH, halign="left", valign="bottom")
    bb = txt.val().BoundingBox()
    # scale text to match artwork: width 270*s, cap height 47*s
    sx = (270*s)/bb.xlen; sy = (47*s)/bb.ylen
    tv = txt.val().transformGeometry(cq.Matrix([[sx,0,0,0],[0,sy,0,0],[0,0,1,0]]))
    bb2 = tv.BoundingBox()
    tx = (-327/2 + (84-27))*s - bb2.xmin
    ty = -bb2.ymin - (47*s)/2
    txt = cq.Workplane("XY").add(tv).translate((tx, ty, 0))
    out = hexring.union(txt)
    if SIZE_CODE:
        cap = 3.4
        c = cq.Workplane("XY").text(SIZE_CODE, 10.0, h, fontPath=FONT_PATH, halign="left", valign="bottom")
        cb = c.val().BoundingBox(); k = cap/cb.ylen
        cv = c.val().transformGeometry(cq.Matrix([[k,0,0,0],[0,k,0,0],[0,0,1,0]])); cb2 = cv.BoundingBox()
        c = cq.Workplane("XY").add(cv).translate((tx - cb2.xmin, -(47*s)/2 - 2.2 - cb2.ymax, 0))
        out = out.union(c)
    return out

def build():
    # ---- plate A (print: outer face on bed, boss up) ----
    A = obround(P_L, P_W).extrude(T_A).faces("<Z").edges().chamfer(CHAMFER)
    plug = cq.Workplane("XY").workplane(offset=T_A).center(X0, 0).slot2D(PLUG_H, PLUG_W, 90).extrude(GAP)
    plug = plug.edges(">Z").chamfer(1.0)
    A = A.union(plug)
    hole = thread_solid(ENGAGE+1, MAJ, DEPTH, PITCH, CLR).translate((X0, 0, T_A+GAP-ENGAGE-1+0.0))
    A = A.cut(hole)
    # entry chamfer on hole
    A = A.cut(cq.Workplane("XY").workplane(offset=T_A+GAP-1.0).center(X0,0).circle(MAJ/2+CLR+0.2).workplane(offset=1.0).circle(MAJ/2+CLR+1.4).loft())
    # ring groove + deboss text on outer (bed) face
    def mkring():
        o = obround(P_L-2*RING_IN, P_W-2*RING_IN).extrude(RING_D)
        i = obround(P_L-2*RING_IN-2*RING_W, P_W-2*RING_IN-2*RING_W).extrude(RING_D)
        return o.cut(i)
    decorA = mkring().union(logo(LOGO_D).mirror('YZ').translate((LOGO_CX,LOGO_CY,0)))
    A_body = A.cut(decorA)
    # ---- plate B (print: countersink up) ----
    B = obround(P_L, P_W).extrude(T_B).faces(">Z").edges().chamfer(CHAMFER)
    # through hole + 90deg countersink
    B = B.cut(cq.Workplane("XY").center(X0,0).circle(MAJ/2+CLR+0.4).extrude(T_B))
    cs_top = HEAD_D/2 + 0.4
    cs_bot = MAJ/2+CLR+0.4
    cs_depth = cs_top-cs_bot
    B = B.cut(cq.Workplane("XY").workplane(offset=T_B-cs_depth).center(X0,0).circle(cs_bot).workplane(offset=cs_depth).circle(cs_top).loft())
    decorB = mkring().translate((0,0,T_B-RING_D)).union(logo(LOGO_D).translate((LOGO_CX,LOGO_CY,T_B-LOGO_D)))
    B_body = B.cut(decorB)
    # ---- screw (print: head down, shank up) ----
    head_h = cs_top - MAJ/2 + 0.0
    L = T_B - cs_depth + ENGAGE            # shank length under head
    head = (cq.Workplane("XY").circle(HEAD_D/2).workplane(offset=cs_depth-0.2).circle(MAJ/2-DEPTH+0.2).loft())
    head = head  # cone, wide at z=0 (bed)
    shank = thread_solid(L, MAJ, DEPTH, PITCH, 0.0).translate((0,0,cs_depth-0.2))
    screw = head.union(shank)
    # slot on head face (bed side)
    slot = cq.Workplane("XY").rect(HEAD_D+2, 2.4).extrude(2.0)
    screw = screw.cut(slot)
    return A_body, decorA, B_body, decorB, screw

if __name__ == "__main__":
    t=time.time()
    A, rA, B, rB, S = build()
    out = sys.argv[1] if len(sys.argv)>1 else "."
    for n,o in [("plateA_body",A),("plateA_decor",rA),("plateB_body",B),("plateB_decor",rB),("screw",S)]:
        cq.exporters.export(o, f"{out}/{n}.stl", tolerance=0.02, angularTolerance=0.1)
        bb=o.val().BoundingBox()
        print(n, round(bb.xlen,1), round(bb.ylen,1), round(bb.zlen,1), "valid", o.val().isValid(), "vol", round(o.val().Volume()))
    print("t", round(time.time()-t,1))
