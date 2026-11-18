#!/usr/bin/env python3
"""Assemble the single-file builder: python3 src/build.py  ->  index.html (repo root)."""
import base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src, ven = root / "src", root / "vendor"
plug = (src / "plug.js").read_text().replace("export ", "")
app = (src / "app.js").read_text()
t = (src / "template.html").read_text()
b64 = lambda p: base64.b64encode(p.read_bytes()).decode()
html = (t.replace("__MJS__", b64(ven / "manifold.js")).replace("__WASM__", b64(ven / "manifold.wasm"))
         .replace("__PLUG__", plug).replace("__APP__", app))
(root / "index.html").write_text(html)
print("wrote index.html", len(html) // 1024, "KB")
