#!/usr/bin/env python3
"""Extract house geometry from the AutoCAD PDF blueprint into house.json.

Reproducible: `pip install -r requirements.txt && python extract_house.py`
Writes ../../src/data/house.json and plan_debug.png (top-down overlay for checking).

Coordinate system (metres): origin at the street-side/top lot corner of the
plan as displayed (page rotated 270°). +x runs along the 31.50 m side, away from
the street (Rua D is at x<0). +y runs along the 19.00 m side, downwards on the
displayed sheet. In three.js use (x, elevation, y).
"""
import json, math, itertools, os, sys
import pymupdf as fitz
from shapely.geometry import box, Point, Polygon, mapping
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, 'blueprint.pdf')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'house.json')

doc = fitz.open(PDF)
page = doc[0]
ROT = page.rotation_matrix  # unrotated PDF space -> displayed (rotated 270°) space

# ---------------------------------------------------------------- scale
# Plotted at 1:50: 1 pt = 25.4/72 mm on paper = 17.639 mm in reality.
# Verified against: lot 31.50 x 19.00 m (perimeter wall outer lines), and the
# dimension chain 372 / 16 / 400 cm across the top of the first bedroom.
M_PER_PT = 25.4 / 72 * 50 / 1000

drawings = page.get_drawings()

def disp(pt):
    q = fitz.Point(pt) * ROT
    return q.x, q.y

# Lot origin = outer corner of the perimeter wall (the long 0.48 pt lines).
def find_lot_frame():
    hs, vs = [], []
    for d in drawings:
        if d['type'] != 's' or abs((d.get('width') or 0) - 0.48) > 0.01:
            continue
        for it in d['items']:
            if it[0] != 'l':
                continue
            (x0, y0), (x1, y1) = disp(it[1]), disp(it[2])
            L = math.hypot(x1 - x0, y1 - y0)
            if L < 900:
                continue
            if abs(y0 - y1) < 0.5: hs.append((min(x0, x1), max(x0, x1), y0))
            if abs(x0 - x1) < 0.5: vs.append((min(y0, y1), max(y0, y1), x0))
    top = min(h[2] for h in hs); bottom = max(h[2] for h in hs)
    right = max(v[2] for v in vs)
    left = min(h[0] for h in hs)
    return left, top, right, bottom

LX, LY, RX, BY = find_lot_frame()
def M(pt):
    x, y = disp(pt)
    return ((x - LX) * M_PER_PT, (y - LY) * M_PER_PT)

LOT_W = (RX - LX) * M_PER_PT
LOT_D = (BY - LY) * M_PER_PT

def r3(v): return round(v, 3)
def poly_coords(g):
    g = g.simplify(0.005)
    return [[r3(x), r3(y)] for x, y in list(g.exterior.coords)[:-1]]
def hole_coords(g):
    g = g.simplify(0.005)
    return [[[r3(x), r3(y)] for x, y in list(h.coords)[:-1]] for h in g.interiors]

# ---------------------------------------------------------------- text
words = page.get_text('words')
def wcenter(w):
    a = M((w[0], w[1])); b = M((w[2], w[3]))
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
W = [(w[4], wcenter(w)) for w in words]

def num(s):
    try: return float(s.replace(',', '.'))
    except ValueError: return None

# ---------------------------------------------------------------- walls
# Walls are drawn as grey-filled (0.596) polygons ("poché"), all axis aligned.
wall_boxes = []
for d in drawings:
    f = d.get('fill')
    if not f or abs(f[0] - 0.596) > 0.01:
        continue
    pts = []
    for it in d['items']:
        if it[0] == 'l': pts += [M(it[1]), M(it[2])]
        elif it[0] == 're': pts += [M(it[1].tl), M(it[1].br)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    b = box(min(xs), min(ys), max(xs), max(ys))
    if b.area > 1e-4:
        wall_boxes.append(b)
WALLS = unary_union([b.buffer(0.004, join_style=2) for b in wall_boxes]).buffer(-0.002, join_style=2)
WALL_POLYS = list(WALLS.geoms) if hasattr(WALLS, 'geoms') else [WALLS]

# ---------------------------------------------------------------- openings
# A gap between two collinear wall pieces (same thickness band, 0.4–6.6 m long,
# nothing in between) is an opening. It is named after the nearest P##/J## tag.
B = [b.bounds for b in wall_boxes]
gaps = {}
for i, j in itertools.permutations(range(len(B)), 2):
    a, b = B[i], B[j]
    for ax in (0, 1):
        c = 1 - ax
        lo, hi = max(a[c], b[c]), min(a[c + 2], b[c + 2])
        L = b[ax] - a[ax + 2]
        if not (0.08 < hi - lo <= 0.25 and 0.4 < L < 6.6):
            continue
        def along(bb):
            return (bb[ax + 2] - bb[ax]) > (bb[c + 2] - bb[c]) and abs(bb[c] - lo) < 0.03 and abs(bb[c + 2] - hi) < 0.03
        if not (along(a) or along(b)):
            continue
        g = [0, 0, 0, 0]; g[ax] = a[ax + 2]; g[ax + 2] = b[ax]; g[c] = lo; g[c + 2] = hi
        if box(g[0] + .01, g[1] + .01, g[2] - .01, g[3] - .01).intersects(WALLS):
            continue
        k = (ax, round(g[ax], 2), round(g[ax + 2], 2), round((lo + hi) / 2, 1))
        if k in gaps:
            p = gaps[k]; g = [min(p[0], g[0]), min(p[1], g[1]), max(p[2], g[2]), max(p[3], g[3])]
        gaps[k] = g

tags = [(t, c) for t, c in W if len(t) == 3 and t[0] in 'PJ' and t[1:].isdigit()]

# Opening data that is not in the drawing (no door/window schedule on the sheet):
# heights and sills are typical Brazilian residential values (guesses).
SPEC = {
    'P01': dict(kind='door', op='swing', desc='front door'),
    'P02': dict(kind='door', op='swing'), 'P03': dict(kind='door', op='sliding'),
    'P04': dict(kind='door', op='sliding'), 'P05': dict(kind='door', op='swing'),
    'P06': dict(kind='door', op='swing'), 'P07': dict(kind='door', op='sliding'),
    'P08': dict(kind='door', op='sliding', desc='glass slider + brise soleil'),
    'P09': dict(kind='door', op='sliding'), 'P10': dict(kind='door', op='sliding', desc='glass sliding wall to veranda'),
    'P11': dict(kind='door', op='sliding'), 'P12': dict(kind='door', op='swing'),
    'J01': dict(kind='window', sill=0.0, height=2.4, desc='full-height glazing + brise soleil'),
    'J02': dict(kind='window', sill=1.0, height=1.2), 'J03': dict(kind='window', sill=1.6, height=0.6),
    'J04': dict(kind='window', sill=1.6, height=0.6), 'J05': dict(kind='window', sill=1.6, height=0.6),
}
DOOR_H = 2.10

openings = []
used = set()
def add_opening(tag, g, note=None):
    x0, y0, x1, y1 = g
    axis = 'x' if (x1 - x0) >= (y1 - y0) else 'y'
    width = (x1 - x0) if axis == 'x' else (y1 - y0)
    spec = SPEC.get(tag, dict(kind='passage'))
    o = dict(id=tag or f'O{len(openings)+1:02d}', tag=tag, kind=spec['kind'], axis=axis,
             center=[r3((x0 + x1) / 2), r3((y0 + y1) / 2)], width=r3(width),
             thickness=r3((y1 - y0) if axis == 'x' else (x1 - x0)), rect=[r3(x0), r3(y0), r3(x1), r3(y1)])
    if spec['kind'] == 'door':
        o.update(operation=spec['op'], sill=0.0, height=DOOR_H)
    elif spec['kind'] == 'window':
        o.update(sill=spec['sill'], height=spec['height'])
    else:
        o.update(sill=0.0, height=DOOR_H)
    if spec.get('desc'): o['description'] = spec['desc']
    if note: o['note'] = note
    openings.append(o)

best = {}
for k, g in sorted(gaps.items()):
    cx, cy = (g[0] + g[2]) / 2, (g[1] + g[3]) / 2
    i = min(range(len(tags)), key=lambda i: math.dist(tags[i][1], (cx, cy)))
    dist = math.dist(tags[i][1], (cx, cy))
    # each printed tag instance names exactly one opening: keep the closest gap
    if dist <= 0.4 and (i not in best or dist < best[i][0]):
        best[i] = (dist, g)
for i, (dist, g) in sorted(best.items(), key=lambda kv: tags[kv[0]][0]):
    add_opening(tags[i][0], g)

# P01 (front door): the leaf hangs between two thin jamb lines at x≈4.38/4.50
# that are not grey wall pieces, so the gap finder misses it; take it from the
# jamb lines next to the tag.
def jamb_door(tag):
    t, c = next(tc for tc in tags if tc[0] == tag)
    xs = []
    for d in drawings:
        if d['type'] != 's': continue
        for it in d['items']:
            if it[0] != 'l': continue
            a, b = M(it[1]), M(it[2])
            if abs(a[0] - b[0]) < 0.01 and 0.9 < abs(a[1] - b[1]) < 1.1 and math.dist(((a[0]+b[0])/2, (a[1]+b[1])/2), c) < 0.6:
                xs.append((a[0], min(a[1], b[1]), max(a[1], b[1])))
    xs.sort()
    return [xs[0][0], xs[0][1], xs[-1][0], xs[0][2]]
add_opening('P01', jamb_door('P01'))
# Unlabelled passages seen as gaps between walls (garage -> service area,
# service area -> rear yard): kept open.
for g in [gaps.get(k) for k in gaps if k[0] == 1 and abs(k[1] - 13.0) < 0.05 and abs(k[3] - 8.9) < 0.1] + \
         [gaps.get(k) for k in gaps if k[0] == 0 and abs(k[1] - 9.0) < 0.05 and abs(k[2] - 11.0) < 0.05]:
    if g: add_opening(None, g, note='unlabelled opening in the drawing; modelled as an open passage')

found_tags = sorted({o['tag'] for o in openings if o['tag']})

# ---------------------------------------------------------------- rooms
CEIL = {}
def label_block(name_words, near=None, pick=0):
    """Find a room label (sequence of words) and the ÁREA / PÉ-DIRETO values printed under it."""
    first = name_words[0]
    cands = [c for t, c in W if t == first]
    if near: cands.sort(key=lambda c: math.dist(c, near))
    c = cands[pick] if near or pick < len(cands) else cands[0]
    def value_after(key, maxd, lo, hi):
        ks = [cc for t, cc in W if t == key and math.dist(cc, c) < maxd]
        if not ks: return None
        k = min(ks, key=lambda cc: math.dist(cc, c))
        vals = [(math.dist(cc, k), num(t)) for t, cc in W if num(t) is not None and lo <= num(t) <= hi and 0 < math.dist(cc, k) < 0.45]
        return min(vals)[1] if vals else None
    area = value_after('ÁREA:', 0.6, 1.0, 999)
    ceil = value_after('PÉ-DIRETO:', 0.8, 2.5, 3.1)
    return c, area, ceil

ROOMS_DEF = [
    # key, pt name, label words, near point (to pick among duplicate labels)
    ('semi_suite_1', 'Semi-suíte 1', ['SEMI-SUÍTE'], (5.9, 3.5)),
    ('bathroom', 'Sanitário', ['SANITÁRIO'], (9.0, 3.5)),
    ('semi_suite_2', 'Semi-suíte 2', ['SEMI-SUÍTE'], (12.1, 3.5)),
    ('master_suite', 'Suíte Master', ['SUÍTE', 'MASTER'], (15.9, 4.0)),
    ('closet', 'Closet', ['CLOSET'], (18.4, 3.0)),
    ('master_bath', 'Sanitário (Suíte)', ['SANITÁRIO'], (18.4, 5.0)),
    ('hallway', 'Circulação', ['CIRCULAÇÃO'], (13.3, 6.0)),
    ('living', 'Sala de Estar', ['SALA'], (5.9, 7.7)),
    ('dining', 'Sala de Jantar', ['SALA'], (10.0, 7.7)),
    ('kitchen', 'Cozinha', ['COZINHA'], None),
    ('service', 'Serviço', ['SERVIÇO'], None),
    ('powder_room', 'Lavabo', ['LAVABO'], None),
    ('hall', 'Hall', ['HALL'], None),
]

# Close every opening so each enclosed room becomes its own free-space polygon.
closed = unary_union(WALL_POLYS + [box(*o['rect']).buffer(0.003, join_style=2) for o in openings])
free = box(0, 0, LOT_W, LOT_D).difference(closed.buffer(0.002, join_style=2))
cells = [g for g in free.geoms if g.area < 150]

def cell_at(pt):
    return next(g for g in cells if g.contains(Point(pt)))

# Open-plan splits (no wall in the drawing; documented guesses):
# * the kitchen is bounded on the street side by the ESTANTE (shelf) line x≈6.35
#   and on the garden side by the dining room at y≈9.88 (top of the shelf);
#   this gives 18.6 m² vs 18.57 m² labelled.
# * living / dining split on the vertical line that matches the labelled areas.
# * hallway (Circulação) = the 1.0 m deep strip east of the x≈12.60 wall end.
# * hall = the strip south of the kitchen wall line y≈12.94 next to the powder room.
estante = [ (min(a[0],b[0]),min(a[1],b[1]),max(a[0],b[0]),max(a[1],b[1]))
            for d in drawings if d['type']=='s' for it in d['items'] if it[0]=='l'
            for a,b in [(M(it[1]),M(it[2]))] if abs(a[0]-b[0])<0.01 and 2.9<abs(a[1]-b[1])<3.1 and 5.9<a[0]<6.5 ]
EST_X = max(e[0] for e in estante); EST_TOP = min(e[1] for e in estante)
big = cell_at((5.9, 7.7))
hallway_poly = big.intersection(box(12.6, 0, 20, 6.7))
hall_poly = big.intersection(box(11.5, 12.94, 12.6, 20))
rest = big.difference(hallway_poly).difference(hall_poly)
kitchen_poly = rest.intersection(box(EST_X, EST_TOP, 12.6, 12.94))
lr = rest.difference(kitchen_poly)
# choose the living/dining split so the areas keep the labelled 24.50 : 18.20 ratio
lo, hi = 6.0, 12.0
for _ in range(60):
    mid = (lo + hi) / 2
    a = lr.intersection(box(0, 0, mid, 20)).area
    if a / lr.area < 24.50 / (24.50 + 18.20): lo = mid
    else: hi = mid
SPLIT_X = (lo + hi) / 2
living_poly = lr.intersection(box(0, 0, SPLIT_X, 20))
dining_poly = lr.difference(living_poly)

suite_cell = cell_at((15.9, 4.0))
closet_poly = suite_cell.intersection(box(17.54, 0, 20, 4.06))
master_poly = suite_cell.difference(closet_poly)

def largest(g):
    if hasattr(g, 'geoms'): return max(g.geoms, key=lambda x: x.area)
    return g

POLY = {
    'semi_suite_1': cell_at((5.9, 3.5)), 'bathroom': cell_at((9.0, 3.0)),
    'semi_suite_2': cell_at((12.1, 3.5)), 'master_suite': master_poly, 'closet': closet_poly,
    'master_bath': cell_at((18.4, 5.0)), 'hallway': hallway_poly, 'living': living_poly,
    'dining': dining_poly, 'kitchen': kitchen_poly,
    # service area is open to the garage (passage) and to the rear yard: bounded by its walls
    'service': free.intersection(box(9.0, 13.0, 11.0, 16.0)),
    'powder_room': cell_at((11.8, 14.5)), 'hall': hall_poly,
}

INTERIOR_FLOOR = 0.47  # level mark "0,47" inside the house (relative to street 0,00)
rooms = []
for key, pt, words_, near in ROOMS_DEF:
    c, area, ceil = label_block(words_, near)
    g = largest(POLY[key])
    rooms.append(dict(id=key, key=key, namePt=pt, polygon=poly_coords(g), areaComputed=r3(g.area),
                      areaLabeled=area, ceiling=ceil or 2.8, floor=INTERIOR_FLOOR,
                      label=[r3(c[0]), r3(c[1])], indoor=True,
                      ceilingSource='label' if ceil else 'assumed'))
# The hall has no area / ceiling label: assume the kitchen's 3.00 m? It sits under the
# 2.70 m service/powder-room zone; use 2.70.
for r in rooms:
    if r['id'] == 'hall': r['ceiling'] = 2.7; r['ceilingSource'] = 'assumed'

# ---------------------------------------------------------------- outdoor zones
def line_segments(width=None):
    out = []
    for d in drawings:
        if d['type'] != 's': continue
        col = d.get('color') or (0, 0, 0)
        if col[0] > 0.5 or col[1] > 0.5: continue
        if width and abs((d.get('width') or 0) - width) > 0.01: continue
        for it in d['items']:
            if it[0] == 'l': out.append((M(it[1]), M(it[2])))
    return out
# pool = the only closed quad near the PISCINA label
pool = None
for d in drawings:
    for it in d['items']:
        if it[0] == 'qu':
            q = it[1]
            pts = [M(q.ul), M(q.ur), M(q.lr), M(q.ll)]
            P = Polygon(pts)
            pc = next(c for t, c in W if t == 'PISCINA')
            if P.contains(Point(pc)) and P.area < 100: pool = P
c, pool_area, _ = label_block(['PISCINA'])

def z(key, pt, poly, floor, kind, label=None, **kw):
    g = largest(poly)
    lab = label or [g.representative_point().x, g.representative_point().y]
    d = dict(id=key, key=key, namePt=pt, polygon=poly_coords(g), areaComputed=r3(g.area), floor=floor,
             kind=kind, label=[r3(lab[0]), r3(lab[1])], indoor=False)
    if g.interiors: d['holes'] = hole_coords(g)
    d.update(kw); return d

def lab(t, near):
    return min((c for tt, c in W if tt == t), key=lambda c: math.dist(c, near))

house_fp = unary_union([box(3.72, 2.0, 19.5, 6.74), box(3.88, 6.74, 12.66, 12.94), box(9.0, 12.94, 12.66, 16.12)])
lot_inner = box(0.6, 0.15, LOT_W - 0.15, LOT_D - 0.15)
c_v, a_v, h_v = label_block(['VARANDA'])
c_g, a_g, h_g = label_block(['GARAGEM'])
outdoor = [
    z('veranda', 'Varanda', box(12.66, 6.74, 15.66, 12.88), INTERIOR_FLOOR, 'covered', c_v, areaLabeled=a_v, ceiling=h_v),
    z('gourmet', 'Espaço Gourmet', box(12.66, 12.88, 15.66, 16.12), INTERIOR_FLOOR, 'covered', lab('GOURMET', (13.5, 14.3)), ceiling=h_v,
      note='part of the 28.15 m² veranda in the drawing; split at the powder-room wall line'),
    z('terrace', 'Terraço', box(15.66, 6.74, 20.5, 9.74), INTERIOR_FLOOR, 'terrace', lab('TERRAÇO', (17.9, 8.6))),
    z('garage', 'Garagem', box(3.08, 13.0, 8.88, 18.85).difference(WALLS), 0.28, 'covered', c_g, areaLabeled=a_g, ceiling=h_g),
    z('entry', 'Hall de Entrada', box(3.08, 11.6, 4.38, 13.0).difference(WALLS), 0.45, 'covered', lab('ENTRADA', (3.7, 12.1))),
    z('front_walk', 'Passeio', box(1.88, 0.75, 3.72, 11.6), 0.28, 'paving', lab('PASSEIO', (2.0, 11.2))),
    z('driveway', 'Rampa da Garagem', box(0.0, 13.0, 3.08, 19.0), 0.0, 'paving', lab('SOBE', (1.3, 15.7)),
      slope=dict(axis='x', from_=0.0, to=0.28, note='SOBE 9,00% ramp from the street up to the garage')),
    z('entry_walk', 'Acesso', box(0.0, 11.6, 3.08, 13.0), 0.0, 'paving', slope=dict(axis='x', from_=0.0, to=0.45)),
    z('side_path', 'Circulação (lateral)', box(1.88, 0.75, 20.5, 2.0).union(box(19.5, 0.75, 20.5, 6.74)).difference(house_fp), 0.28, 'paving', lab('CIRCULAÇÃO', (12.5, 1.4))),
    z('rear_path', 'Circulação (fundos)', box(9.0, 16.12, 16.46, 18.12).union(box(9.0, 18.0, 12.18, 18.85)), 0.28, 'paving', lab('CIRCULAÇÃO', (13.5, 17.2))),
    z('pool', 'Piscina', pool, 0.28, 'pool', c, areaLabeled=pool_area, depth=1.4),
    z('garden_front', 'Jardim (frente)', box(0.6, 0.15, 1.88, 11.6), 0.28, 'garden', lab('JARDIM', (1.2, 5.8))),
    z('garden_side', 'Jardim (lateral)', box(1.88, 0.15, 20.5, 0.75), 0.28, 'garden', lab('JARDIM', (9.7, 0.45))),
    z('garden_rear', 'Jardim (fundos)', box(12.18, 18.12, 16.46, 18.85), 0.28, 'garden', lab('JARDIM', (14.2, 18.5))),
]
taken = unary_union([Polygon(o['polygon']) for o in outdoor] + [house_fp])
garden_main = lot_inner.difference(taken).difference(box(0, 11.6, 3.08, 19))
outdoor.append(z('garden', 'Jardim', garden_main, 0.28, 'garden', lab('JARDIM', (27.3, 9.3))))

# ---------------------------------------------------------------- perimeter walls
perimeter = [
    dict(id='wall_north', polygon=poly_coords(box(0, 0, LOT_W, 0.15)), height=2.2),
    dict(id='wall_east', polygon=poly_coords(box(LOT_W - 0.15, 0, LOT_W, LOT_D)), height=2.2),
    dict(id='wall_south', polygon=poly_coords(box(9.0, LOT_D - 0.15, LOT_W, LOT_D)), height=2.2),
    dict(id='wall_front', polygon=poly_coords(box(0, 0.15, 0.6, 11.6)), height=2.2,
         note='0.60 m double line along the street up to the entrance; drawn like the 2.20 m wall, could be a planter'),
]

# ---------------------------------------------------------------- roof / eaves
# "PROJEÇÃO DO BEIRAL" is drawn as dashed 0.24 pt lines (dash ≈0.37 m, gap ≈0.19 m).
# Collect them by grouping short collinear segments.
from collections import defaultdict
_dash = defaultdict(list)
for d in drawings:
    if d['type'] != 's' or abs((d.get('width') or 0) - 0.24) > 0.01: continue
    col = d.get('color') or (0, 0, 0)
    if col[0] > 0.5 or col[1] > 0.5: continue
    for it in d['items']:
        if it[0] != 'l': continue
        a, b = M(it[1]), M(it[2]); L = math.dist(a, b)
        if not (0.2 < L < 0.47): continue
        if abs(a[1] - b[1]) < 0.005: _dash[('y', round(a[1], 2))].append((min(a[0], b[0]), max(a[0], b[0])))
        elif abs(a[0] - b[0]) < 0.005: _dash[('x', round(a[0], 2))].append((min(a[1], b[1]), max(a[1], b[1])))
eave_lines = []
for (ax, v), segs in sorted(_dash.items()):
    if len(segs) < 5: continue
    lo = min(s[0] for s in segs); hi = max(s[1] for s in segs)
    eave_lines.append(dict(axis=ax, at=r3(v), start=r3(lo), end=r3(hi), dashes=len(segs)))
def _line(ax, near):
    return min((l for l in eave_lines if l['axis'] == ax), key=lambda l: abs(l['at'] - near))['at']
# Solid thin line at x≈19.85 closes the east eave (no dashes on the sheet there).
EAST = 19.85
FRONT = _line('x', 3.08); NORTH = _line('y', 1.2); SEMI_E = _line('x', 7.88)
SOUTH_TERR = _line('y', 7.54); VER_E = _line('x', 16.46)
HOUSE_N = min(g.bounds[1] for g in WALL_POLYS)
eave_poly = Polygon([(FRONT, NORTH), (SEMI_E, NORTH), (SEMI_E, HOUSE_N), (EAST, HOUSE_N), (EAST, SOUTH_TERR),
                     (VER_E, SOUTH_TERR), (VER_E, 16.12), (9.0, 16.12), (9.0, LOT_D - 0.15), (FRONT, LOT_D - 0.15)])
roof = dict(eave=poly_coords(eave_poly), area=r3(eave_poly.area), top=r3(INTERIOR_FLOOR + 3.0 + 0.35),
            slabThickness=0.25, fasciaHeight=0.30, dashedLines=eave_lines,
            note='single flat roof level following the dashed eave lines; internal dashed lines (roof breaks) recorded but not modelled as separate levels')

# ---------------------------------------------------------------- walls output
def wall_height(g):
    near = [r['ceiling'] for r in rooms if Polygon(r['polygon']).distance(g) < 0.3]
    near += [o['ceiling'] for o in outdoor if o.get('ceiling') and Polygon(o['polygon']).distance(g) < 0.3]
    return max(near) if near else 3.0
walls = []
for i, g in enumerate(sorted(WALL_POLYS, key=lambda g: (g.bounds[1], g.bounds[0]))):
    w = dict(id=f'w{i+1:02d}', polygon=poly_coords(g), base=0.0, height=r3(INTERIOR_FLOOR + wall_height(g)))
    if g.area < 0.3 and (g.bounds[2] - g.bounds[0]) < 1 and (g.bounds[3] - g.bounds[1]) < 1:
        w['kind'] = 'pillar'
    else:
        w['kind'] = 'wall'
    if g.interiors: w['holes'] = [[[r3(x), r3(y)] for x, y in list(h.coords)[:-1]] for h in g.interiors]
    walls.append(w)

# ---------------------------------------------------------------- dimensions check
dims = []
for t, cc in W:
    if t in ('372', '16', '400', '554'): dims.append(dict(text=t, at=[r3(cc[0]), r3(cc[1])]))

house = dict(
    meta=dict(name="Rafael's House", source='blueprint.pdf (AutoCAD 2022, A0, page rotated 270°)', scale='1:50',
              metersPerPt=M_PER_PT, units='m', storeys=1,
              coordinateSystem='x along the 31.50 m side (street at x=0), y along the 19.00 m side; three.js (x, elevation, y)',
              levels=dict(street=0.0, garage=0.28, entry=0.45, interior=INTERIOR_FLOOR, yard=0.28),
              frontSetbackLabeled=3.80, frontSetbackMeasured=r3(min(g.bounds[0] for g in WALL_POLYS if g.bounds[1] < 3)),
              eyeHeight=1.6, extractedBy='tools/extract/extract_house.py'),
    lot=dict(width=r3(LOT_W), depth=r3(LOT_D), polygon=[[0, 0], [r3(LOT_W), 0], [r3(LOT_W), r3(LOT_D)], [0, r3(LOT_D)]]),
    walls=walls, openings=openings, rooms=rooms, outdoor=outdoor, perimeterWalls=perimeter, roof=roof,
    dimensionsFound=dims,
    checks=dict(openingTags=found_tags, splitLivingDiningX=r3(SPLIT_X)),
)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    json.dump(house, f, indent=1, ensure_ascii=False)

# ---------------------------------------------------------------- report + debug image
print(f'lot {LOT_W:.3f} x {LOT_D:.3f} m (expected 31.50 x 19.00)')
print(f"roof eave area {roof['area']} m², dashed eave lines {[(l['axis'], l['at']) for l in eave_lines]}")
print(f'walls {len(walls)}  openings {len(openings)}  tags {found_tags}')
for r in rooms:
    print(f"  {r['id']:14s} computed {r['areaComputed']:6.2f}  labelled {r['areaLabeled']}  ceiling {r['ceiling']}")
for o in outdoor:
    print(f"  {o['id']:14s} computed {o['areaComputed']:6.2f}  labelled {o.get('areaLabeled')}")
try:
    from PIL import Image, ImageDraw
    S = 40
    img = Image.new('RGB', (int(LOT_W * S) + 20, int(LOT_D * S) + 20), 'white')
    dr = ImageDraw.Draw(img)
    T = lambda pts: [(10 + x * S, 10 + y * S) for x, y in pts]
    colors = dict(garden=(200, 235, 200), pool=(150, 200, 240), paving=(225, 225, 225), covered=(240, 225, 200), terrace=(235, 215, 190))
    for o in sorted(outdoor, key=lambda o: o['kind'] == 'pool'): dr.polygon(T(o['polygon']), fill=colors.get(o['kind'], (230, 230, 230)), outline=(150, 150, 150))
    for r in rooms: dr.polygon(T(r['polygon']), fill=(255, 250, 235), outline=(200, 120, 0))
    for w in perimeter + walls: dr.polygon(T(w['polygon']), fill=(60, 60, 60))
    dr.line(T(roof['eave'] + [roof['eave'][0]]), fill=(160, 0, 160), width=2)
    for o in openings:
        x0, y0, x1, y1 = o['rect']
        dr.rectangle(T([(x0, y0), (x1, y1)]), fill=(220, 0, 0) if o['kind'] == 'door' else (0, 120, 255) if o['kind'] == 'window' else (0, 180, 0))
        dr.text(T([o['center']])[0], o['id'], fill=(0, 0, 0))
    for r in rooms + outdoor: dr.text(T([r['label']])[0], r['id'], fill=(0, 0, 120))
    img.save(os.path.join(HERE, 'plan_debug.png'))
except ImportError:
    pass
