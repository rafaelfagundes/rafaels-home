# Rafael's House

A mobile-first 3D walkthrough and dollhouse view of Rafael’s single-storey house, built from the extracted AutoCAD blueprint. The model uses metres internally and supports English and Brazilian Portuguese, with Imperial or metric display units.

Live: https://rafaels-house.vercel.app

The display name is Rafael's House in English and Casa do Rafael in Brazilian Portuguese. The GitHub repository and package name keep the `rafaels-home` slug, and the Vercel project is now `rafaels-house`. The old https://rafaels-home.vercel.app address redirects (308) to the new one via `vercel.json`. The `rafaels-home:*` localStorage keys keep the old slug so saved settings carry over.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` to check the project. Use `npm run preview` to serve the built site. For static hosting on Vercel, use the Vite preset with `npm run build` and output directory `dist`. Include the root `vercel.json` in manual deploys.

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

## v4 changes

The viewer starts in Dollhouse by default. Settings can switch the next startup to Walk. Drag the 1.70 m mannequin to set where Walk begins. The first-person camera sits 1.58 m above the floor. The eye button or **H** hides and restores the controls. The furniture tables below reflect the v4 placements, and the site uses the supplied favicon and app icons.

## v3 furniture, appliances and vehicles – assumptions (updated for v4)

The tables use implemented placements, including small offsets for fit. Centres are plan coordinates (x, y) in metres. Sizes are width × depth × height in metres, with depth along the facing direction. Facing gives the direction of the front (0° = +x, 90° = +y, 180° = −x, 270° = −y). Lift is measured from the local floor. The layout uses the existing floor elevations, including 0.47 m indoors, 0.28 m in the garage and 0.02 m above the yard on the pool deck.

### Semi-suite 1

The queen mattress measures 1.58 × 1.98 m. The headboard is on the south wall and the wardrobe is on the east wall.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Queen bed | (5.40, 4.437) | 1.70 × 2.12 × 1.05 | 270° | — |
| Nightstand | (4.25, 5.307)<br>(6.55, 5.307) | 0.45 × 0.38 × 0.50 | 270° | — |
| Wardrobe | (7.578, 2.95) | 1.60 × 0.60 × 2.40 | 180° | — |
| Desk | (4.165, 2.73) | 1.20 × 0.55 × 0.75 | 0° | — |
| Desk chair | (4.74, 2.73) | 0.46 × 0.50 × 0.82 | 180° | — |
| Rug | (5.40, 3.90) | 1.60 × 2.40 × 0.01 | 270° | — |

### Semi-suite 2

The queen mattress measures 1.58 × 1.98 m. The headboard is on the south wall and the wardrobe is on the west wall.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Queen bed | (11.90, 4.437) | 1.70 × 2.12 × 1.05 | 270° | — |
| Nightstand | (10.75, 5.307)<br>(13.05, 5.307) | 0.45 × 0.38 × 0.50 | 270° | — |
| Wardrobe | (10.422, 2.95) | 1.60 × 0.60 × 2.40 | 0° | — |
| Desk | (13.836, 2.73) | 1.20 × 0.55 × 0.75 | 180° | — |
| Desk chair | (13.26, 2.73) | 0.46 × 0.50 × 0.82 | 0° | — |
| Rug | (11.90, 3.90) | 1.60 × 2.40 × 0.01 | 270° | — |

### Shared bathroom

The shower has fixed west and south glass panels. The south panel ends at x = 9.57 m, leaving about 0.43 m to the east wall. The rain head and mixer are centred over the tray on the east tiled wall. The wall-hung oak vanity has a white quartz top, integrated sink and faucet.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Toilet | (8.50, 2.47) | 0.37 × 0.68 × 0.80 | 90° | — |
| Shower tray | (9.524, 2.761) | 1.28 × 0.95 × 0.05 | 180° | — |
| Shower glass | (9.05, 2.76) | 1.28 × 0.04 × 2.00 | 0° | — |
| Shower glass | (9.32, 3.40) | 0.50 × 0.04 × 2.00 | 270° | — |
| Shower head | (9.797, 2.76) | 0.24 × 0.36 × 0.08 | 180° | 2.10 |
| Shower mixer | (9.962, 2.76) | 0.16 × 0.07 × 0.12 | 180° | 1.05 |
| Vanity | (8.95, 5.257) | 1.00 × 0.48 × 0.85 | 270° | — |
| Mirror | (8.95, 5.48) | 0.90 × 0.03 × 0.80 | 270° | 1.05 |

### Master suite

The king mattress measures 1.93 × 2.03 m. The headboard is on the west wall and the bench sits at the foot.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| King bed | (15.328, 3.95) | 2.05 × 2.17 × 1.10 | 0° | — |
| Nightstand | (14.443, 2.60)<br>(14.443, 5.30) | 0.50 × 0.40 × 0.50 | 0° | — |
| Bench | (16.65, 3.95) | 1.40 × 0.42 × 0.45 | 0° | — |
| Rug | (15.70, 3.95) | 2.60 × 1.90 × 0.01 | 0° | — |
| Plant | (15.45, 6.317) | 0.60 × 0.60 × 1.34 | 270° | — |

### Closet

The built-in joinery wraps around three sides, with full-height wardrobes on the north and east walls and an open shelving return on the west.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Wardrobe | (18.458, 2.421) | 1.84 × 0.60 × 2.40 | 90° | — |
| Wardrobe | (19.078, 3.136) | 0.83 × 0.60 × 2.40 | 180° | — |
| Open shelving return | (17.715, 3.011) | 0.58 × 0.35 × 2.40 | 0° | — |

### Master bath

The vanity and rain head are on the west wall. Fixed glass screens the west part of the shower entrance.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Vanity | (17.913, 4.90) | 1.20 × 0.50 × 0.85 | 0° | — |
| Mirror | (17.68, 4.90) | 0.90 × 0.03 × 0.80 | 0° | 1.05 |
| Toilet | (19.038, 5.10) | 0.37 × 0.68 × 0.80 | 180° | — |
| Shower tray | (18.523, 6.182) | 1.72 × 0.87 × 0.05 | 270° | — |
| Shower glass | (18.183, 5.75) | 1.04 × 0.05 × 2.00 | 270° | — |
| Shower head | (17.85, 6.185) | 0.24 × 0.36 × 0.08 | 0° | 2.10 |

### Living and entry

The three-seat sofa faces the coffee table and wall-mounted 65-inch TV. The west entry console clears P01. The plan’s ESTANTE is a freestanding, double-sided oak divider with open shelves, 3.17 m along the plan y-axis and 2.40 m high.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Sofa | (5.90, 8.75) | 2.40 × 0.95 × 0.80 | 270° | — |
| Coffee table | (5.90, 7.60) | 1.10 × 0.60 × 0.38 | 270° | — |
| Media console | (5.70, 5.85) | 2.00 × 0.45 × 0.50 | 90° | — |
| TV | (5.60, 5.655) | 1.45 × 0.05 × 0.84 | 90° | 0.95 |
| Armchair | (4.65, 7.05) | 0.82 × 0.99 × 1.02 | 0° | — |
| Lounge chair | (7.507, 6.60) | 1.01 × 1.19 × 1.17 | 135° | — |
| Rug | (5.90, 7.60) | 2.80 × 2.00 × 0.01 | 270° | — |
| Floor lamp | (4.40, 8.95) | 0.35 × 0.35 × 1.60 | 0° | — |
| Plant | (4.40, 5.98) | 0.60 × 0.60 × 1.34 | 0° | — |
| Entry console | (4.185, 10.80) | 1.20 × 0.35 × 0.80 | 0° | — |
| ESTANTE divider | (6.20, 11.285) | 3.17 × 0.30 × 2.40 | 180° | — |

### Dining

The table seats eight, with three chairs on each long side and one at each end. The three kitchen bar stools sit on the dining side of the room boundary.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Dining table | (10.30, 7.60) | 2.20 × 1.00 × 0.75 | 90° | — |
| Dining chair | (9.55, 6.80)<br>(10.30, 6.80)<br>(11.05, 6.80) | 0.48 × 0.52 × 0.80 | 90° | — |
| Dining chair | (9.55, 8.40)<br>(10.30, 8.40)<br>(11.05, 8.40) | 0.48 × 0.52 × 0.80 | 270° | — |
| Dining chair | (8.88, 7.60) | 0.48 × 0.52 × 0.80 | 0° | — |
| Dining chair | (11.72, 7.60) | 0.48 × 0.52 × 0.80 | 180° | — |
| Sideboard | (10.00, 5.85) | 2.60 × 0.45 × 0.75 | 90° | — |
| Linear pendant | (10.30, 7.60) | 1.35 × 0.10 × 0.12 | 90° | 2.10 |
| Bar stool | (8.60, 9.55)<br>(9.25, 9.55)<br>(9.90, 9.55) | 0.42 × 0.42 × 0.75 | 90° | — |

### Kitchen

The south run has white-oak fronts, a white quartz top, an undermount sink and tall faucet at x = 7.73 m, and a 0.60 m integrated dishwasher centred at x = 7.15 m. The tall column has a black-glass oven from 0.85 to 1.45 m and a combi microwave above it. The stainless fridge is east of P11. The island has a 0.60 × 0.52 m black induction cooktop at x = 8.27 m and an oak breakfast bar to the north. The stainless hood is above the cooktop and its duct runs from 2.32 to 3.00 m above the floor. Two small black pendants hang above the bar.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Kitchen base | (7.40, 12.57) | 2.00 × 0.60 × 0.90 | 270° | — |
| Oven column | (8.70, 12.57) | 0.60 × 0.60 × 2.30 | 270° | — |
| Fridge | (10.805, 12.495) | 0.91 × 0.75 × 1.85 | 270° | — |
| Island | (9.11, 10.668) | 2.50 × 0.90 × 0.90 | 90° | — |
| Breakfast bar | (9.11, 10.043) | 2.71 × 0.35 × 1.05 | 270° | — |
| Hood | (8.27, 10.668) | 0.90 × 0.50 × 0.12 | 90° | 2.20 |
| Pendant | (9.30, 10.043)<br>(10.20, 10.043) | 0.16 × 0.16 × 0.20 | 90° | 2.10 |

### Laundry

The plan’s ARMÁRIO is a tall cabinet beside a white laundry basin on a cabinet with a tap. The dryer is stacked 0.85 m above the washer.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Laundry cabinet | (10.773, 13.575) | 0.95 × 0.45 × 2.20 | 180° | — |
| Laundry tank | (10.698, 14.575) | 0.65 × 0.60 × 0.90 | 180° | — |
| Washer | (10.688, 15.26) | 0.60 × 0.62 × 0.85 | 180° | — |
| Dryer | (10.688, 15.26) | 0.60 × 0.62 × 0.85 | 180° | 0.85 |

### Powder room

The wall-hung round basin has a faucet and round mirror.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Basin | (12.322, 14.55) | 0.45 × 0.40 × 0.85 | 180° | — |
| Round mirror | (12.50, 14.55) | 0.45 × 0.03 × 0.45 | 180° | 1.05 |
| Toilet | (12.182, 15.45) | 0.37 × 0.68 × 0.80 | 180° | — |

### Gourmet area

The west counter has a stone top, sink at y = 13.55 m, cooktop at y = 14.25 m and a 0.75 m stainless gas-grill insert with lid and knobs at y = 14.75 m. The masonry pizza oven sits just south of it, with a 0.90 m base, 0.80 m dome, front opening and small chimney. The outdoor teak table seats six.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Gourmet counter | (12.989, 14.10) | 2.30 × 0.65 × 0.92 | 0° | — |
| Pizza oven | (13.064, 15.68) | 0.86 × 0.80 × 1.75 | 0° | — |
| Outdoor table | (14.60, 13.95) | 1.60 × 0.90 × 0.75 | 0° | — |
| Outdoor chair | (14.00, 13.45)<br>(14.00, 14.45) | 0.48 × 0.52 × 0.80 | 0° | — |
| Outdoor chair | (15.20, 13.45)<br>(15.20, 14.45) | 0.48 × 0.52 × 0.80 | 180° | — |
| Outdoor chair | (14.60, 13.13) | 0.48 × 0.52 × 0.80 | 90° | — |
| Outdoor chair | (14.60, 15.00) | 0.48 × 0.52 × 0.80 | 270° | — |

### Veranda

The outdoor sofa and two armchairs face across the coffee table.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Outdoor sofa | (13.15, 9.50) | 2.20 × 0.90 × 0.75 | 0° | — |
| Coffee table | (14.25, 9.50) | 1.00 × 0.60 × 0.38 | 0° | — |
| Outdoor armchair | (14.25, 8.35) | 0.75 × 0.80 × 0.75 | 90° | — |
| Outdoor armchair | (14.25, 10.65) | 0.75 × 0.80 × 0.75 | 270° | — |

### Pool deck

Two teak loungers sit west of the pool with their feet toward the water. A third runs north–south along the east edge. The white-cushioned backrests reach 0.85 m.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| Sun lounger | (17.55, 14.55)<br>(17.55, 15.55) | 0.70 × 1.95 × 0.40 | 0° | — |
| Sun lounger | (25.55, 13.40) | 0.70 × 1.95 × 0.40 | 90° | — |

### Garage

The cars park nose-in toward +x. The motorcycle sits crosswise beyond the Golf’s nose. The cars’ placement widths include mirrors. The north walkway runs from the west opening to laundry door O20 along the X5 driver’s side. Fit uses the x = 3.08–8.88 m, y = 13.00–18.70 m parking envelope and a ceiling 3.00 m above the garage floor.

| Item | Centre(s) | Size | Facing | Lift |
| --- | --- | --- | --- | --- |
| BMW X5 stand-in | (5.79, 14.90) | 2.10 × 4.92 × 1.75 | 0° | — |
| VW Golf R stand-in | (5.475, 17.52) | 1.86 × 4.29 × 1.46 | 0° | — |
| Suzuki Hayabusa stand-in | (8.20, 17.40) | 0.74 × 2.18 × 1.17 | 270° | — |

Clearances computed by garageFit().

| Clearance | Metres |
| --- | ---: |
| North walkway | 0.85 |
| X5 to Golf side gap | 0.64 |
| Golf to south wall | 0.25 |
| X5 front to back wall | 0.63 |
| Golf front to motorcycle | 0.21 |
| Motorcycle to east wall | 0.31 |
| Rear bumpers to garage opening line | 0.25 |
| Roof clearance above the tallest vehicle | 1.25 |

### Rendering, collision and settings

- **Collision.** Furniture and vehicles use rotated rectangular footprints. Shower glass counts as a collider (0.04 m thick in the shared bath and 0.05 m in the master bath). The dining table adds 0.35 m per side, and the gourmet table adds 0.15 m per side. Dining and gourmet chairs, bar stools, rugs, shower trays and fittings, mirrors, the TV, the hood, pendants and the stacked dryer are visual only. The island and breakfast bar each have a footprint, and the washer provides the footprint for the stack.
- **Procedural and GLB models.** Beds, seating other than the two living-room chairs, cabinetry, tables, rugs, lighting fixtures, built-in kitchen and gourmet equipment, and bathroom fittings other than toilets are original procedural geometry. The fridge, washer, dryer, three toilets, living-room armchair and lounge chair, and two plants come from furniture.glb. The three vehicles come from vehicles.glb. Procedural pieces use merged geometry and instancing. GLB nodes with a lower-detail version switch to it at 7 m.
- **Vehicle stand-ins.** No licensed exact BMW X5, VW Golf R or Suzuki Hayabusa model was downloadable without a login, so generic CC0 and CC BY models were recoloured dark red, blue and black respectively and scaled to the real vehicles’ dimensions. The credits give the body dimensions, and the garage placement table uses mirror-inclusive car widths.
- **Settings.** “Furniture & appliances” (“Móveis e eletrodomésticos”) and “Vehicles” (“Veículos”) are separate toggles. Both default on, including for older saved settings. Each group’s render chunk and GLB load on demand after the house first renders, only when its toggle is on. The toggles control visibility and walk collision. Both groups appear in Walk and Dollhouse and allow floor taps and Measure to pass through.
- **White model.** Furniture, appliances and vehicles share one texture-free matte off-white material (#f4f3ee, roughness 0.9).
- **Performance.** Measured numbers are in the PR.

## Credits

| Model | Used as | Author | Source | Licence |
|---|---|---|---|---|
| SUV | BMW X5 stand-in (recoloured dark red, scaled to 4.92×2.00×1.75 m) | Quaternius | https://poly.pizza/m/xsMtZhBkxL | CC0 1.0 |
| Car | VW Golf R stand-in (recoloured blue, scaled to 4.29×1.79×1.46 m) | Quaternius | https://poly.pizza/m/unqqkULtRU | CC0 1.0 |
| Motorcycle | Suzuki Hayabusa stand-in (recoloured black, scaled to 2.18×0.74×1.17 m) | Poly by Google | https://poly.pizza/m/dse64pqMKAR | CC BY 3.0 |
| Kitchen Fridge | Fridge (recoloured stainless) | Quaternius | https://poly.pizza/m/8sjRm8fnHh | CC0 1.0 |
| Washing Machine | Washer | Quaternius | https://poly.pizza/m/UFxsKNSl8W | CC0 1.0 |
| Clothes dryer | Dryer | Poly by Google | https://poly.pizza/m/bTbe1CRWC1T | CC BY 3.0 |
| Toilet | Toilets (3) | Pat Siefring | https://poly.pizza/m/23BWsguAdkf | CC BY 3.0 |
| Modern Arm Chair 01 | Living-room armchair | Vibrant Nordic (Poly Haven) | https://polyhaven.com/a/modern_arm_chair_01 | CC0 1.0 |
| Mid Century Lounge Chair | Living-room lounge chair | Kuutti Siitonen (Poly Haven) | https://polyhaven.com/a/mid_century_lounge_chair | CC0 1.0 |
| Potted Plant 01 | Indoor plants (2) | Rico Cilliers (Poly Haven) | https://polyhaven.com/a/potted_plant_01 | CC0 1.0 |

See [CREDITS.md](CREDITS.md) for licence links and asset processing notes.
