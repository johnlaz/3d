import cadquery as cq, math, gen3
FONT="/usr/share/fonts/opentype/inter/Inter-Bold.otf"
import os
if os.path.exists("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"): FONT="/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
# ---- plug v7 (mm) ----
BOSS_X, BOSS_Y, BOSS_R, GAP = 24.0, 22.0, 4.0, 26.0
PX, PY, PR = 38.0, 38.0, 8.0
T_A, T_B, CHAMFER = 5.0, 6.0, 0.6          # plate B 6 mm: thicker floor under the clip head
D = 1.0                                     # inlay depth (5 layers @0.2)
HEAD_D, HEAD_DEPTH = 20.0, 2.5
HOLE_D, BORE_D, CAV_D = 8.5, 10.5, 14.0     # roomy: legs can compress through the hole and spread in the cavity
WEB_T, CAV_DEPTH = 3.0, 8.0
SHOULDER = 13.0                             # head underside -> web underside. Clip measured ~16 long from photo; legs must exit the web to spring open
NOTCH_W = 4.0
SPIGOT_H = 1.5
SP_X, SP_Y, SP_R = BOSS_X-5.0, BOSS_Y-5.0, 3.0
HEX_R, HEX_T = 7.0, 1.8
RING_A = (2.0, 1.2); RING_B = (1.6, 1.0)    # (inset, width)

def rrect(x,y,r,z0,h): return cq.Workplane("XY").workplane(offset=z0).rect(x,y).extrude(h).edges("|Z").fillet(r)
BORE_D2 = 10.2                              # entry bore (user: initial entry width is perfect at this size)
CAV_D2, CAV_TOP, CAV_BOT = 13.2, 28.0, 14.5 # expansion cavity: pin-expanded legs measure ~12 mm; 13.2 leaves printing clearance. ceiling at z=28 catches the bowed legs
def pocket(top):
    bore = cq.Workplane("XY").workplane(offset=CAV_BOT).circle(BORE_D2/2).extrude(top+SPIGOT_H+0.5-CAV_BOT)
    cav  = cq.Workplane("XY").workplane(offset=CAV_BOT).circle(CAV_D2/2).extrude(CAV_TOP-CAV_BOT)
    return bore.union(cav)
def word(h,W,txt="ARMORY"):
    t=cq.Workplane("XY").text(txt,10.0,h,fontPath=FONT,halign="center",valign="center")
    bb=t.val().BoundingBox(); k=W/bb.xlen
    kv=t.val().transformGeometry(cq.Matrix([[k,0,0,0],[0,W*(47/270)/bb.ylen,0,0],[0,0,1,0]]))
    c=cq.Workplane("XY").add(kv); b=c.val().BoundingBox()
    return c.translate((-(b.xmin+b.xmax)/2,-(b.ymin+b.ymax)/2,0))
def ring(inset,w,h):
    o=rrect(PX-2*inset,PY-2*inset,PR-inset,0,h); i=rrect(PX-2*inset-2*w,PY-2*inset-2*w,max(PR-inset-w,0.5),0,h)
    return o.cut(i)
def hexring(h,R,t):
    o=cq.Workplane("XY").polygon(6,2*R).extrude(h).rotate((0,0,0),(0,0,1),30)
    i=cq.Workplane("XY").polygon(6,2*(R-t/math.cos(math.radians(30)))).extrude(h).rotate((0,0,0),(0,0,1),30)
    return o.cut(i)
def build():
    top=T_A+GAP
    A=rrect(PX,PY,PR,0,T_A).faces("<Z").edges().chamfer(CHAMFER)
    A=A.union(rrect(BOSS_X,BOSS_Y,BOSS_R,T_A,GAP)).union(rrect(SP_X,SP_Y,SP_R,top,SPIGOT_H)).cut(pocket(top))
    wd=word(D,24); cap=wd.val().BoundingBox().ylen; tot=2*HEX_R+3.0+cap
    decA=hexring(D,HEX_R,HEX_T).translate((0,tot/2-HEX_R,0)).union(wd.translate((0,-(tot/2-cap/2),0))).union(ring(*RING_A,D)).mirror('YZ')
    A_body=A.cut(decA)
    B=rrect(PX,PY,PR,0,T_B).faces(">Z").edges().chamfer(CHAMFER)
    B=B.cut(rrect(SP_X+0.4,SP_Y+0.4,SP_R,0,SPIGOT_H+0.3))
    B=B.cut(cq.Workplane("XY").circle((HOLE_D+0.3)/2).extrude(T_B))
    B=B.cut(cq.Workplane("XY").workplane(offset=T_B-HEAD_DEPTH).circle((HEAD_D+0.5)/2).extrude(HEAD_DEPTH+1))
    B=B.cut(cq.Workplane("XY").workplane(offset=T_B-HEAD_DEPTH).center((HEAD_D+0.5)/2+0.5,0).rect(3.0+NOTCH_W,NOTCH_W).extrude(HEAD_DEPTH+1))
    ry=-((HEAD_D/2+0.25)+(PY/2-RING_B[0]-RING_B[1]))/2
    decB=word(D,23).translate((0,ry,0)).union(ring(*RING_B,D)).translate((0,0,T_B-D))
    return A_body,decA,B.cut(decB),decB
def coupon_old(shoulders=(10,11.5,13,14.5,16)):
    cols=[]
    for i,s in enumerate(shoulders):
        H=s+HEAD_DEPTH+CAV_DEPTH+3.0; col=cq.Workplane("XY").circle(12.5).extrude(H)
        zh=H-HEAD_DEPTH
        col=col.cut(cq.Workplane("XY").workplane(offset=zh).circle((HEAD_D+0.5)/2).extrude(HEAD_DEPTH+1))
        col=col.cut(cq.Workplane("XY").workplane(offset=zh-1.8).circle((HOLE_D+0.3)/2).extrude(2))
        bore=cq.Workplane("XY").workplane(offset=zh-(s-WEB_T)).circle(BORE_D/2).extrude(s-WEB_T)
        hole=cq.Workplane("XY").workplane(offset=zh-s).circle(HOLE_D/2).extrude(WEB_T+0.2)
        cav=cq.Workplane("XY").workplane(offset=zh-s-CAV_DEPTH).circle(CAV_D/2).extrude(CAV_DEPTH)
        col=col.cut(bore.union(hole).union(cav))
        lab=("%g"%s)
        tab=cq.Workplane("XY").center(0,12.5+2.0).rect(15,8).extrude(1.0)
        txt=cq.Workplane("XY").workplane(offset=1.0).center(0,12.5+2.0).text(lab,5.0,0.8,fontPath=FONT,halign="center",valign="center")
        col=col.union(tab).union(txt).translate(((i%3)*36,-(i//3)*36,0)); cols.append((s,col))
    return cols
if __name__=="__main__":
    A,dA,B,dB=build(); Bz=B.translate((0,0,T_A+GAP))
    def v(a,b):
        i=a.intersect(b); return round(i.val().Volume(),3) if i.vals() else 0
    print(FONT.split('/')[-1],"valid",A.val().isValid(),B.val().isValid(),"B∩A",v(Bz,A),"dA∩A",v(dA,A),"dB∩B",v(dB,B))
    print("A vol",round(A.val().Volume()),"bbox z",round(A.val().BoundingBox().zmax,1))
