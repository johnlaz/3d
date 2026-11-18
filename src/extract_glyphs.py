#!/usr/bin/env python3
"""Regenerate src/armory_glyphs.json (ARMORY outlines, width 1, height 47/270) from Inter ExtraBold."""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
FONT = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap()
class P(BasePen):
    def __init__(s, gs): super().__init__(gs); s.c = []; s.cur = None
    def _moveTo(s, p): s.cur = [p]
    def _lineTo(s, p): s.cur.append(p)
    def _curveToOne(s, a, b, c):
        p0 = s.cur[-1]
        for i in range(1, 9):
            t = i/8; u = 1-t
            s.cur.append((u**3*p0[0]+3*u*u*t*a[0]+3*u*t*t*b[0]+t**3*c[0], u**3*p0[1]+3*u*u*t*a[1]+3*u*t*t*b[1]+t**3*c[1]))
    def _qCurveToOne(s, a, b):
        p0 = s.cur[-1]
        for i in range(1, 9):
            t = i/8; u = 1-t
            s.cur.append((u*u*p0[0]+2*u*t*a[0]+t*t*b[0], u*u*p0[1]+2*u*t*a[1]+t*t*b[1]))
    def _closePath(s):
        if s.cur and len(s.cur) > 2: s.c.append(s.cur)
        s.cur = None
    _endPath = _closePath
x = 0; allc = []
for ch in "ARMORY":
    g = gs[cmap[ord(ch)]]; p = P(gs); g.draw(p)
    for c in p.c: allc.append([(a+x, b) for a, b in c])
    x += g.width
xs = [a for c in allc for a, b in c]; ys = [b for c in allc for a, b in c]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys); H = 47/270
out = [[[round((a-x0)/(x1-x0)-0.5, 5), round(((b-y0)/(y1-y0)-0.5)*H, 5)] for a, b in c] for c in allc]
json.dump(out, open("src/armory_glyphs.json", "w"), separators=(',', ':'))
