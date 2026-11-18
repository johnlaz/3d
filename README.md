# 3d - ARMORY 3D Kit Maker

**ARMORY Plug Builder** - a single-file web tool (`index.html`) that generates the ARMORY trigger-guard deterrent plug for 3D printing. Deterrent only: use on an unloaded firearm; a safe or lockbox stays the primary storage.

Open `index.html` in a browser (or serve the repo with GitHub Pages). No install, no network needed after load.

## What it does
- **Size presets:** Long-gun (v10, the size that was print-tested) and Pistol (**assumed**, not yet verified), plus Custom with every dimension editable.
- **Caliber -> accent colour** (base black):

  | Colour | Calibers |
  |---|---|
  | Red | 9mm |
  | Blue | 5.56 / .223 |
  | Green | .40 S&W, .45 ACP |
  | Yellow | 300 Blackout |
  | Orange | 12 ga, 20 ga, .308 |
  | White | .38 Special, .22 LR, .44 Henry rimfire |

- **Outputs:** colour 3MF for the Creality CFS (ring/letters/hex on filament 2), mono 3MF (plate bodies only), separate STLs, or everything in one zip.
- **Mono colour band:** the page shows the two pause heights for plate B (groove floor minus 0.6 mm, and the floor). Plate A's recess is on the bed face and can't be colour-swapped on a mono printer.

## Design notes
- Plate A (flat side) is one part with the solid core; plate B (clip side) drops onto the core's oval spigot. A push-pin clip through plate B expands in a smooth cavity inside the core and locks against a solid ceiling.
- Long-gun preset: core 24 x 22 mm, frame width 26 mm, 8 mm-class pin clip (expands to ~12 mm), cavity 13.2 mm, entry bore 10.2 mm.
- Pistol preset is a guess (core 18 x 20 mm, small ~6 mm clip). Print `gauge/fit_gauge.stl` to find the largest block that passes through the guard opening, measure the clip, then correct it under Custom.
- Print: plate A outer face down (core up); plate B outer face up. 0.2 mm layers, no supports.

## Layout
- `index.html` - built single-file app (generated; do not edit by hand)
- `src/` - `plug.js` (geometry), `app.js` (UI, exporters, preview), `template.html`, `armory_glyphs.json`, `build.py`, `extract_glyphs.py`
- `vendor/` - manifold-3d (Apache-2.0) used for the geometry booleans
- `reference/` - the CadQuery scripts the geometry was developed with (`gen10.py` = long-gun reference)
- `test/geometry.test.mjs` - `node test/geometry.test.mjs`; long-gun volumes match the CadQuery reference within ~0.4%
- `gauge/fit_gauge.stl` - 14/16/18/20/22 mm go/no-go blocks

## Rebuild
```
python3 src/build.py     # writes index.html
```

## Not yet verified
- Pistol preset dimensions and clip.
- Mono pauses are instructions only (not embedded in the file).
