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
| Rooms | Choose a room or outdoor zone to jump there. The pool jump lands on the deck facing the house. |
| Measure | Pick two points on the model in either mode. Pick a third point to begin a new measurement, or use Clear. |
| Settings | Choose language, units, labels, and shadow quality. These preferences are saved on the device. |

Open a URL such as `?at=3.75,12.3,90,10` to start in Walk at plan coordinates `x,y` in metres. Heading is in degrees (0° = +x, 90° = +y). Pitch is optional and defaults to 0° (level). Positive pitch looks up, and valid pitches range from −90° to 90°. The camera starts at eye height above the floor. Invalid or blocked locations use the default start.

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

## v2 finishes, landscape and lighting – assumptions

The reference photos set the look; anything they and the blueprint don't settle is a guess, listed here.

**Roof**
- One flat roof at a single level (top +3.82 m above the street, 0.25 m slab) following the dashed PROJEÇÃO DO BEIRAL lines extracted from the PDF (`roof.eave` in house.json, 227.7 m²). The sheet also has dashed lines *inside* the house (x = 3.76, 7.88, 13.46; y = 4.70, 13.80); they look like roof breaks between the 2.70 / 2.80 / 3.00 m ceiling zones but are recorded only, not modelled as separate levels.
- Overhangs follow the plan: about 0.80 m over the front walk and garage front (x = 3.08), 0.80 m north of the first semi-suite (y = 1.20), 0.35 m on the east side (x = 19.85, a solid thin line, no dashes), over the veranda/gourmet out to the pillars (x = 16.46), and partly over the terrace (to y = 7.54). The other bedroom walls on the north side have no overhang (none is drawn).
- Black fascia 0.30 m tall, 0.04 m proud of the slab edge; soffit in warm wood planks. The roof top is plain grey.
- The roof is always shown in walk mode; in dollhouse it is hidden by default ("Roof in dollhouse" toggle in Settings).

**Wall finishes** (per wall side, classified automatically: a side whose outside sample point falls in an indoor room is interior)
- Stacked stone: all pillars (and wall pieces under 0.35 m²), the street-facing faces of the front bedroom block (y < 5.7 m), and the garage front pillars.
- Dark textured stucco (photo 2): north-facing faces along the side walkway (breezeway) and the exterior of the garage / service / powder-room block (y > 12.8 m).
- Dark vertical wood cladding: every other exterior face (veranda, terrace, garden/pool side and the rest of the street side).
- Interior: warm off-white plaster; bathrooms and the powder room in light stone tile; one charcoal feature wall (the living/dining north wall).
- Perimeter boundary walls: light grey rendered concrete behind the bamboo.

**Glass**
- Floor-to-ceiling black-framed glass with mullions every ~1.2 m at P10 (veranda), P08 (suite → terrace), P07 and J01 (front living window); the other windows get the same black frame at their sill/head.
- P10 is modelled as 4.0 m of fixed glass (a collider) plus a 2.1 m open sliding doorway at its south end; P08 has a 0.65 m glass leaf parked at its west end (not a collider) and is otherwise open; P07 (0.70 m) is a black frame only.

**Floors**
- Interior: polished light-grey concrete; wet rooms in stone tile.
- Veranda, gourmet, terrace, entry and the new pool deck: large light concrete pavers (1.2 × 0.6 m). Garage: plain concrete. Front walk, rear path, entry path and driveway: darker concrete pavers.
- Side walkway (north breezeway): weathered wood deck.

**Pool and lounge (new, not on the blueprint)**
- Pool deck: pavers over x 16.46–26.40, y 9.74–16.60, plus a 1.2 m band around the pool.
- Pool: dark mosaic tile, 0.30 m light concrete coping, turquoise water by day / glowing at night, 5 round underwater lights 0.40 m below the waterline.
- Sunken fire-pit lounge: 4.2 × 2.8 m at x 21.4–25.6, y 6.9–9.7 (north of the pool, east of the terrace), floor 0.45 m below the deck, 3 steps down on the west side with step lights, built-in concrete bench on the other three sides, black fire-pit trough 2.2 × 0.45 × 0.40 m centred at (23.5, 8.3). Listed in the room list as "Fire-Pit Lounge".
- Wood deck walkway: 1.2 m wide from the gourmet area (x 15.66) east to the pool deck (x 18.0) at y 12.8–14.0.

**Plants** (all instanced, seeded so they're the same on every load)
- Bamboo hedge (3.0–4.2 m) along the north, east and eastern part of the south perimeter walls.
- Horsetail reeds (0.5–0.9 m) along both sides of the side walkway, the front walk and the east walkway.
- Ornamental grasses: blue fescue and feather grass in the front garden, around the pool deck, the lounge and the rear garden strip.
- Trees: 3 columnar junipers (front garden at y = 3 and 9, pool deck NE corner) and 2 small olive-like multi-stem trees in the east garden. Species are illustrative.
- Black planter boxes (1.2 × 0.4 × 0.5 m): two at the terrace edge of the pool deck, two by the lounge, two in the front garden beside the walk (kept off the entry path).
- Trunks, planters, the bench and the fire pit are colliders; grasses and reeds aren't.

**Lighting**
- Day: sun (the only shadow-casting light, 1024 px map on desktop / 512 on phones, off when Shadows = Off) + sky.
- Night (dusk): deep-blue gradient sky with a faint warm horizon, dim moon without shadows, warm emissive downlight discs (~1 per 3 m²) on ceilings and soffits, 2 warm interior point lights, 1 cyan pool light, 1 fire light, emissive step lights. At most 6 real lights at night.
- Textures are tiny procedural canvas textures (128–256 px, tiled, generated at load), so there are no image files to download or compress; they stay deliberately subtle.
- Adaptive DPR (1 → 2, starting at 1.5 on touch devices). Add `?stats` to the URL to see FPS, draw calls, triangles and DPR.
- The white model is still available (Settings → Style → White model) and looks the same as v1 by day.
