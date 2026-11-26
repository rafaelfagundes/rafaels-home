# Rafael's Home

A mobile-first 3D walkthrough and dollhouse view of Rafael’s single-storey home, built from the extracted AutoCAD blueprint. The model uses metres internally and supports English and Brazilian Portuguese, with Imperial or metric display units.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` to check the project. Use `npm run preview` to serve the built site. For static hosting on Vercel, use the Vite preset with `npm run build` and output directory `dist`.

## Controls

| Tool | Controls |
| --- | --- |
| Walk | Use the joystick on touchscreens or WASD / arrow keys on desktop. Drag to look around. Tap or click a floor to walk straight toward it. |
| Dollhouse | Drag to orbit. Pinch or scroll to zoom. Use two fingers or right-drag to pan. Tap an indoor room to jump in. |
| Floor plan | Expand or hide the minimap. Tap either plan view to move to a nearby walkable point. |
| Rooms | Choose a room or outdoor zone to jump there. The pool opens from the deck so you can look into the basin. |
| Measure | Pick two points on the model in either mode. Pick a third point to begin a new measurement, or use Clear. |
| Settings | Choose language, units, labels, and shadow quality. These preferences are saved on the device. |

The living and dining rooms are named separately to match *Sala de Estar* and *Sala de Jantar* on the plan. Together they form an open living and dining area.

## Geometry extraction

The app reads the generated `src/data/house.json`. To regenerate it from the source blueprint, run:

```sh
cd tools/extract
pip install -r requirements.txt
python extract_house.py
```

The extractor also renders `tools/extract/plan_debug.png` for comparison. Plan coordinates map to Three.js as `(x, elevation, y)`. The SVG plan uses the same axes.

## Project structure

- `src/data/` contains the extracted blueprint data.
- `src/model/` contains geometry, collision, localization, settings, and their tests.
- `src/view/` contains the Three.js mesh builder and interactive scene.
- `src/main.tsx` and `src/styles.css` contain the viewer controls and overlays.
- `public/` contains the web manifest and icon.
- `tools/extract/` contains the source blueprint and extractor.

## Blueprint interpretation notes
Extraction results (`python tools/extract/extract_house.py`):

- **Scale:** the sheet is plotted at 1:50 (1 pt = 17.64 mm). This is confirmed by the lot (31.50 × 19.00 m measured from the perimeter wall lines, within 0.01 m) and by the 372 / 16 / 400 cm dimension chain over the first semi-suite.
- **Walls** are the grey-filled poché polygons, merged together. Exterior walls are about 16 cm thick and interior walls about 12 cm.
- **Openings** are gaps between collinear wall pieces, each named after the nearest P##/J## tag. All 12 doors (P01–P12) and all windows (J01–J04, plus J05 in the powder room) were found. The sheet has no door or window schedule, so heights are typical values: doors 2.10 m, bedroom windows (J02) with a 1.00 m sill and 1.20 m height, bathroom and powder-room windows (J03/J04/J05) with a 1.60 m sill and 0.60 m height, and J01 as 2.40 m full-height glazing behind the brise soleil. Door swings aren't modelled; doorways are left open. Doors marked "corre" are sliding.
- **Two unlabelled openings** were found and left as open passages: garage → service area (1.0 m) and service area → rear walkway (2.0 m).
- **Room polygons:** enclosed rooms come straight from the free space between walls, and their areas match the labels within 1% (semi-suites 13.46 vs 13.52 m², bathroom 6.71 vs 6.76, suite 14.78 vs 14.85, closet 3.44 vs 3.45, suite bath 4.26 vs 4.30). The open-plan zones have no walls between them, so they were split as follows:
  - Kitchen: from the ESTANTE shelf line (x ≈ 6.35 m) to the top of the shelf (y ≈ 9.88 m). That gives 18.57 m², exactly the label.
  - Living/dining: split on a vertical line at x ≈ 8.28 m, chosen so the areas keep the labelled 24.50 : 18.20 ratio.
  - Hallway (Circulação, 1.58 m²): a 1 m strip by P05/P06/P07.
  - Hall: the strip between the kitchen wall and the powder room. It has no labels, so its 2.70 m ceiling is assumed.
- **Veranda / Espaço Gourmet:** the label of 28.15 m² covers both. The model splits them at the powder-room wall line (y = 12.88 m).
- **Outdoor zones** come from the thin lines on the sheet:
  - Terrace: 15.66–20.50 × 6.74–9.74 m.
  - Pool: the 6.00 × 4.00 m quad (24.00 m², as labelled). The 1.40 m depth is assumed.
  - Side and rear walkways and the garden strips.
  - Everything else inside the walls is lawn.
  Their exact edges are a best reading of the lines.
- **Levels:** taken from the level marks, relative to the street: interior and veranda +0.47, entrance +0.45, garage and yard +0.28, street 0.00. The driveway ramp ("SOBE 9,00%") rises from 0.00 to 0.28. As instructed, "SOBE" is treated as the ramp, not a stair; there is no upper floor.
- **Setback:** the label says 3.80 m. The front wall's outer face measures 3.72 m from the lot line (372 cm on the dimension chain), so the drawn geometry is used as is.
- **Perimeter walls** are 15 cm thick and 2.20 m high on the back, side and rear. Along the street there is a 0.60 m double line from the corner to the entrance, which is modelled as a wall but could be a planter. The driveway and entry path are open to the street.
- **Ceilings (pé-direito):** read from each room label. Wall tops use the highest ceiling of the rooms they touch. There's no roof in v1: walk mode shows flat ceilings, and dollhouse mode shows none.
