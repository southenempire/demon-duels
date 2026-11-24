# SPDX-License-Identifier: CC0-1.0
"""Build the Ash Gate hunter: blender -b -t 1 --python web/tools/build-hunter.py."""

from math import acos, atan2, cos, pi, sin, sqrt, tau
from pathlib import Path

import bpy
from mathutils import Euler, Vector


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 30

rig = bpy.data.objects.new('Hunter rig', bpy.data.armatures.new('Hunter skeleton'))
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')


def bone(name, parent, center):
    joint = rig.data.edit_bones.new(name)
    joint.head = center
    joint.tail = Vector(center) + Vector((0, 0, .09))
    if parent:
        joint.parent = rig.data.edit_bones[parent]


bone('Root', None, (0, 0, 0))
bone('Hips', 'Root', (0, 0, .96))
bone('Chest', 'Hips', (0, 0, 1.075))
bone('Head', 'Chest', (0, 0, 1.52))
bone('Cape', 'Chest', (0, .11, 1.45))
bone('CapeHem', 'Cape', (0, .21, 1.00))
for side, s in [('L', -1), ('R', 1)]:
    for name, parent, center in [
        ('Arm', 'Chest', (.223 * s, 0, 1.449)),
        ('Elbow', 'Arm', (.223 * s, 0, 1.164)),
        ('Hand', 'Elbow', (.223 * s, 0, .912)),
        ('Thigh', 'Hips', (.108 * s, 0, .96)),
        ('Shin', 'Thigh', (.108 * s, 0, .535)),
        ('Foot', 'Shin', (.108 * s, 0, .11)),
        ('Coattail', 'Hips', (.119 * s, -.065, 1.009)),
    ]:
        bone(name + side, parent if parent in {'Hips', 'Chest'} else parent + side, center)
bone('Blade', 'ElbowL', (-.223, -.056, .922))
bpy.ops.object.mode_set(mode='OBJECT')

# One palette material keeps the whole skin in a single glTF primitive.
palette = {
    'ash':       ('827b73', .88, 0),
    'haze':      ('aca095', .90, 0),
    'soot':      ('403a3a', .94, 0),
    'canvas':    ('302d30', .94, 0),
    'fold':      ('50464a', .95, 0),
    'hollow':    ('1c181e', .98, 0),
    'face':      ('796059', .91, 0),
    'red':       ('91283a', .92, 0),
    'wine':      ('4e202a', .93, 0),
    'vermillion':('c14d54', .85, 0),
    'leather':   ('51362e', .84, 0),
    'hide':      ('2e2326', .86, 0),
    'stitch':    ('997460', .92, 0),
    'iron':      ('64565a', .56, .55),
    'bronze':    ('a67449', .48, .62),
    'gilt':      ('c99c71', .40, .55),
    'blade':     ('adacb9', .33, .76),
    'edge':      ('e6d8ca', .24, .70),
}

verts, weights, faces, swatches, smooth = [], [], [], [], []


def vertex(point, weight):
    verts.append(point)
    weights.append({weight: 1} if isinstance(weight, str) else weight)
    return len(verts) - 1


def face(indices, color, soft=True):
    faces.append(indices)
    swatches.append(color)
    smooth.append(soft)


def stitch_rings(rings, color, soft=True, closed=True):
    for j, (a, b) in enumerate(zip(rings, rings[1:])):
        for i in range(len(a) if closed else len(a) - 1):
            k = (i + 1) % len(a)
            face((a[i], a[k], b[k], b[i]), color(j, i) if callable(color) else color, soft)


def loft(layers, weight, color, n=12, fold=0, soft=True):
    rings = []
    for layer, (x, y, z, rx, ry) in enumerate(layers):
        ring = []
        for i in range(n):
            a = i * tau / n
            pleat = 1 + fold * cos(5 * a + .32 * layer)
            ring.append(vertex((x + rx * cos(a) * pleat, y + ry * sin(a) * pleat, z),
                               weight(layer) if callable(weight) else weight))
        rings.append(ring)
    stitch_rings(rings, color, soft)
    face(tuple(reversed(rings[0])), color(0, 0) if callable(color) else color, False)
    face(tuple(rings[-1]), color(len(rings) - 2, 0) if callable(color) else color, False)


def ellipsoid(x, y, z, rx, ry, rz, weight, color, n=12, rows=6):
    loft([(x, y, z + rz * sin(a), rx * cos(a), ry * cos(a))
          for a in [-pi / 2 + .045 + i * (pi - .09) / rows for i in range(rows + 1)]],
         weight, color, n)


def tube(points, radius, weight, color, sides=6):
    rings = []
    for j, point in enumerate(points):
        p = Vector(point)
        tangent = Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(0, j - 1)])
        tangent.normalize()
        cross = tangent.cross(Vector((0, 1, 0)))
        if cross.length < .01:
            cross = tangent.cross(Vector((1, 0, 0)))
        cross.normalize()
        up = tangent.cross(cross)
        rings.append([
            vertex(p + radius * (cross * cos(i * tau / sides) + up * sin(i * tau / sides)),
                   weight(j) if callable(weight) else weight)
            for i in range(sides)
        ])
    stitch_rings(rings, color)


def plate(outline, joint, color, rim='bronze', depth=.012):
    front = [vertex((x, y, z), joint) for x, y, z in outline]
    rear = [vertex((x, y + depth, z), joint) for x, y, z in outline]
    face(front, color, False)
    face(list(reversed(rear)), color, False)
    stitch_rings([front, rear], rim, False)


def belt(z, rx, ry, height, joint, color, slope=0):
    rings = []
    for ex, dz in [(0, -.5), (.006, -.32), (.006, .32), (0, .5)]:
        rings.append([
            vertex(((rx + ex) * cos(a), (ry + ex) * sin(a), z + dz * height + slope * cos(a)), joint)
            for a in [i * tau / 28 for i in range(28)]
        ])
    stitch_rings(rings, lambda row, _: color if row == 1 else 'leather')


loft([(0, .013, .96, .173, .115), (0, .008, 1.075, .168, .105),
      (0, .003, 1.15, .178, .107), (0, .004, 1.27, .206, .122),
      (0, .002, 1.393, .224, .109), (0, .011, 1.462, .181, .092),
      (0, .016, 1.497, .103, .073)],
     lambda j: ['Hips', {'Hips': .7, 'Chest': .3}, {'Hips': .2, 'Chest': .8}][j]
     if j < 3 else 'Chest', 'canvas', 24, .065)

# Crossed leather harness and raised vest stitching.
for s in (-1, 1):
    ribbon = [[vertex((s * x + d, y, z + s * d * .8), 'Chest') for d in (-.019, .019)]
              for x, y, z in [(-.143, -.094, 1.151), (-.071, -.121, 1.235),
                              (.011, -.128, 1.326), (.095, -.112, 1.410),
                              (.168, -.070, 1.465), (.151, .023, 1.479),
                              (.119, .092, 1.427), (.057, .119, 1.334),
                              (-.070, .112, 1.209)]]
    stitch_rings(ribbon, 'leather', closed=False)
    for edge in (0, 1):
        tube([Vector(verts[r[edge]]) + Vector((0, -.002, 0)) for r in ribbon[:5]],
             .0023, 'Chest', 'stitch', 4)
    for j in range(3):
        x = s * (.082 + .027 * j)
        tube([(x - .012, -.124 + .004 * j, 1.222 + j * .051),
              (x + .009, -.122 + .004 * j, 1.238 + j * .051)],
             .002, 'Chest', 'fold', 4)
plate([(-.034, -.139, 1.317), (0, -.147, 1.35), (.034, -.139, 1.317),
       (0, -.147, 1.286)], 'Chest', 'bronze')
plate([(-.019, -.151, 1.317), (0, -.155, 1.335), (.019, -.151, 1.317),
       (0, -.155, 1.298)], 'Chest', 'hide', 'gilt')

# Belt, layered sash and pouch.
belt(1.054, .181, .12, .095, 'Hips', 'wine', -.030)
belt(1.062, .185, .129, .048, 'Hips', 'hide', .018)
belt(1.099, .177, .115, .023, 'Hips', 'red', -.034)
for a in range(12):
    theta = a * tau / 12
    ellipsoid(.19 * cos(theta), .137 * sin(theta), 1.063 + .018 * cos(theta),
              .009, .007, .009, 'Hips', 'bronze', 6, 3)
clasp = [(sin(i * tau / 10) * .039, -.143, 1.064 + cos(i * tau / 10) * .034) for i in range(10)]
tube(clasp + clasp[:1], .0055, 'Hips', 'gilt')
plate([(-.018, -.149, 1.064), (0, -.156, 1.085), (.018, -.149, 1.064),
       (0, -.155, 1.043)], 'Hips', 'bronze')
ellipsoid(.158, .042, 1.00, .059, .043, .069, 'Hips', 'leather')
ellipsoid(.161, .017, 1.022, .057, .034, .027, 'Hips', 'hide')
ellipsoid(.170, -.019, 1.012, .008, .005, .008, 'Hips', 'bronze', 8, 3)

# Hood opening, rolled edge and hood shell.
opening = [(0, -.241, 1.796), (.050, -.176, 1.766), (.090, -.141, 1.738),
           (.102, -.120, 1.697), (.096, -.115, 1.646), (.071, -.118, 1.596),
           (.043, -.127, 1.565), (0, -.130, 1.558)]
opening += [(-x, y, z) for x, y, z in opening[-2:0:-1]]
hood = [[vertex((x * width, y * front + shift, 1.677 + (z - 1.677) * height + rise),
                'Head') for x, y, z in opening]
        for width, front, shift, height, rise in [
            (.89, .84, .019, .93, -.005), (1, 1, 0, 1, 0),
            (1.18, .60, -.021, 1.17, .012), (1.26, .25, .067, 1.21, .029),
            (1.03, .10, .119, 1.36, .01796), (.60, 0, .155, .92, .017),
            (.10, 0, .165, .42, .015),
        ]]
stitch_rings(hood, lambda j, i: 'hollow' if j == 0 else (
    'haze' if j == 1 and i in {0, 1, 12, 13} else 'ash'))
face(hood[-1], 'ash')
tube(opening + opening[:1], .004, 'Head', 'haze')
tube([verts[r[0]] for r in hood[1:]], .0038, 'Head', 'haze', 5)
ellipsoid(0, -.018, 1.654, .103, .109, .129, 'Head', 'hollow', 16, 8)
ellipsoid(0, -.102, 1.663, .070, .035, .073, 'Head', 'face')
for s in (-1, 1):
    plate([(s * .009, -.139, 1.699), (s * .056, -.130, 1.704),
           (s * .047, -.138, 1.684), (s * .016, -.141, 1.684)], 'Head', 'hollow')
    tube([(s * .021, -.142, 1.693), (s * .037, -.140, 1.694)], .002, 'Head', 'gilt', 4)
loft([(0, .001, 1.487, .119, .105), (0, -.016, 1.517, .115, .113),
      (0, -.021, 1.551, .110, .112), (0, -.025, 1.577, .099, .111),
      (0, -.028, 1.602, .087, .118), (0, -.029, 1.628, .079, .114),
      (0, -.027, 1.649, .075, .110)],
     'Head', lambda row, _: ('wine', 'red', 'wine', 'red', 'wine', 'red')[row], 20, .08)
for h, c in [(1.531, 'vermillion'), (1.564, 'red'), (1.593, 'vermillion'), (1.627, 'red')]:
    tube([(.096 * cos(a), -.022 - .117 * sin(a), h + .014 * cos(a + .7))
          for a in [j * pi / 16 for j in range(17)]], .004, 'Head', c)

# The mantle follows the shoulder bones but the cape has its own two-bone drape.
mantle = []
for row in range(5):
    t = row / 4
    mantle.append([
        vertex(((.103 + t * .176) * sin(a), .02 + (.096 + t * .037) * cos(a),
                1.515 - .122 * t + .047 * t * sin(a) ** 2 + .008 * sin(9 * a) * t),
               {'Chest': 1 - .38 * t * abs(sin(a)), 'Arm' + ('R' if a >= 0 else 'L'): .38 * t * abs(sin(a))})
        for a in [(-1 + 2 * i / 30) * 2.49 for i in range(31)]
    ])
stitch_rings(mantle, lambda j, i: 'ash' if j < 2 else ['soot', 'ash', 'soot'][i % 3], closed=False)
tube([verts[i] for i in mantle[-1]], .004, lambda i: weights[mantle[-1][i]], 'bronze')

cape = []
cols, rows = 28, 13
for j in range(rows):
    v = j / (rows - 1)
    row = []
    for i in range(cols + 1):
        u = -1 + 2 * i / cols
        row.append(vertex((u * (.177 + .174 * v),
                           .105 + .175 * v + .035 * cos(u * 16 + v * 2) * v
                           - (.056 + .074 * v) * u ** 2,
                           1.445 - v * (.996 - .098 * u ** 2)
                           + v ** 6 * (.048 * sin(u * 15) + .026 * cos(u * 39))),
                          {'Cape': 1 - max(0, (v - .32) / .68), 'CapeHem': max(0, (v - .32) / .68)}))
    cape.append(row)
stitch_rings(cape, lambda j, i: 'wine' if (i < 3 or i > cols - 4) else (
    'fold' if (i + 2) % 7 in {0, 1} else 'soot'), closed=False)
for chain in ([r[0] for r in cape], [r[-1] for r in cape], cape[-1]):
    tube([verts[i] for i in chain], .004, lambda i, chain=chain: weights[chain[i]], 'red', 5)
for c in (4, 9, 18, 23):
    chain = [r[c] for r in cape[2:-1]]
    tube([Vector(verts[i]) + Vector((0, .002, 0)) for i in chain], .0026,
         lambda j, chain=chain: weights[chain[j]], 'ash', 4)

for side, s in [('L', -1), ('R', 1)]:
    x = .223 * s
    arm, elbow, hand = ('Arm' + side, 'Elbow' + side, 'Hand' + side)
    thigh, shin, foot, tail = (p + side for p in ('Thigh', 'Shin', 'Foot', 'Coattail'))
    loft([(x, 0, 1.145, .057, .054), (x, 0, 1.216, .068, .063),
          (x + .005 * s, 0, 1.328, .086, .079), (x + .009 * s, .002, 1.404, .098, .092),
          (x, .009, 1.475, .064, .065)], arm, 'canvas', 14, .06)
    ellipsoid(x, 0, 1.157, .055, .059, .067, {arm: .5, elbow: .5}, 'hide')
    for layer in range(3):
        shoulder = []
        for j in range(4):
            v = j / 3
            shoulder.append([
                vertex((x + s * (.019 + .062 * v + .012 * cos(a)),
                        .004 + (.086 - layer * .003 - .008 * v) * sin(a),
                        1.464 - .048 * layer - .039 * v + (.036 - .016 * v) * cos(a)), arm)
                for a in [-2.1 + i / 12 * 4.2 for i in range(13)]
            ])
        stitch_rings(shoulder, 'iron' if layer != 1 else 'soot', closed=False)
        tube([verts[i] for i in shoulder[-1]], .004, arm, 'bronze', 5)
    loft([(x, 0, .919, .044, .048), (x, .006, .966, .048, .055),
          (x, .005, 1.08, .065, .060), (x, 0, 1.145, .051, .051)],
         elbow, 'leather', 12)
    plate([(x - .036, -.045, .931), (x + .036, -.045, .931),
           (x + .049, -.053, 1.065), (x + .023, -.060, 1.112),
           (x - .026, -.060, 1.112), (x - .048, -.053, 1.065)],
          elbow, 'iron', 'bronze')
    tube([(x - .022, -.061, .951), (x, -.065, 1.047), (x + .022, -.061, .951)],
         .004, elbow, 'gilt')
    for z in (.942, .987, 1.086):
        loft([(x, .006, z, .053, .060), (x, .006, z + .010, .054, .062)], elbow, 'hide', 12)
    ellipsoid(x, -.005, .872, .043, .033, .064, hand, 'hide')
    for i in range(4):
        ellipsoid(x + (i - 1.5) * .018, -.006, .836 + abs(i - 1.5) * .003,
                  .011, .025, .030, hand, 'leather', 8, 4)
    ellipsoid(x - s * .033, -.022, .875, .016, .019, .035, hand, 'leather', 8, 4)

    tx = .108 * s
    loft([(tx, 0, .516, .062, .062), (tx, .006, .603, .069, .073),
          (tx, .005, .801, .097, .088), (tx, .007, .925, .102, .098),
          (tx, .005, 1.009, .089, .084)], thigh, 'canvas', 14, .09)
    ellipsoid(tx, 0, .535, .062, .066, .076, {thigh: .44, shin: .56}, 'hide')
    loft([(tx, .010, .094, .052, .055), (tx, .009, .184, .057, .058),
          (tx, .012, .342, .071, .073), (tx, .008, .454, .069, .066),
          (tx, .004, .489, .062, .055)], shin, 'hide')
    plate([(tx, -.083, .589), (tx + .060, -.070, .542), (tx + .051, -.078, .492),
           (tx, -.099, .464), (tx - .051, -.078, .492), (tx - .060, -.070, .542)],
          {thigh: .38, shin: .62}, 'iron')
    plate([(tx, -.108, .553), (tx + .025, -.097, .521), (tx, -.109, .494),
           (tx - .025, -.097, .521)], {thigh: .38, shin: .62}, 'bronze')
    for z, rx in [(.18, .061), (.26, .070), (.36, .078), (.43, .073)]:
        loft([(tx, .006, z - .008, rx, rx + .005), (tx, .006, z + .013, rx, rx + .005)],
             shin, 'leather')
        ellipsoid(tx + s * (rx - .012), -.030, z + .003, .009, .010, .009, shin, 'bronze', 8, 3)
    loft([(tx, -.046, 0, .063, .119), (tx, -.047, .020, .065, .122),
          (tx, -.044, .047, .060, .114), (tx, -.019, .074, .056, .086),
          (tx, .009, .114, .051, .059), (tx, .009, .141, .047, .051)],
         foot, lambda row, _: 'hollow' if row == 0 else 'leather', 16)
    tube([(tx + .054 * cos(a), -.047 - .103 * sin(a), .043)
          for a in [j * pi / 14 for j in range(15)]], .003, foot, 'stitch', 4)

    skirt = []
    for j in range(9):
        v = j / 8
        strip = []
        for i in range(15):
            a = (i / 14 * 2 - 1) * 1.29
            strip.append(vertex((tx + s * ((.098 + .037 * v) * sin(a) + .057 * v),
                                 .001 - (.133 + .045 * v + .010 * cos(a * 12 + v)) * cos(a),
                                 1.049 - (.451 - .106 * abs(sin(a))) * v
                                 + .031 * cos(a * 13) * v ** 5),
                                {'Hips': 1 - v, tail: v}))
        skirt.append(strip)
    stitch_rings(skirt, lambda j, i: 'wine' if i < 2 or i > 11 else (
        'ash' if i in {3, 9, 10} else 'soot'), closed=False)
    for chain in ([r[0] for r in skirt], [r[-1] for r in skirt], skirt[-1]):
        tube([Vector(verts[i]) + Vector((0, -.003, 0)) for i in chain], .003,
             lambda j, chain=chain: weights[chain[j]], 'bronze', 5)

for s in (-1, 1):
    ribbons = []
    for j in range(10):
        v = j / 9
        ribbons.append([
            vertex((s * (.022 + .115 * v) + d * (.039 - .030 * v),
                    -.140 - .047 * v + .009 * sin(v * 8 + d),
                    1.083 - (.448 + .11 * s) * v + .014 * d * v),
                   {'Coattail' + ('L' if s < 0 else 'R'): v, 'Hips': 1 - v})
            for d in [-1, -.5, 0, .5, 1]
        ])
    stitch_rings(ribbons, lambda _, i: ('wine', 'red', 'vermillion', 'red')[i], closed=False)

# The blade lives inside the left gauntlet until its joint extends in an attack.
blade_x = -.223
blade_layers = []
for y, z, width, thickness in [(-.047, .921, .010, .003), (-.050, .950, .025, .008),
                               (-.049, 1.075, .019, .006), (-.049, 1.112, .017, .005)]:
    blade_layers.append([vertex((blade_x + u * width, y + v * thickness, z), 'Blade')
                         for u, v in [(1, 0), (.42, 1), (-.42, 1), (-1, 0), (-.42, -1), (.42, -1)]])
stitch_rings(blade_layers, lambda _, i: 'blade' if i in {1, 4} else 'edge', False)
loft([(blade_x, -.050, .923, .018, .011), (blade_x, -.055, .934, .025, .019),
      (blade_x, -.055, 1.059, .022, .018), (blade_x, -.054, 1.088, .016, .012)],
     'ElbowL', 'iron', 10)
tube([(blade_x - .014, -.067, .944), (blade_x - .014, -.074, .979), (blade_x - .013, -.073, 1.058)],
     .003, 'ElbowL', 'gilt')

hood_peak = max(v[2] for v in verts)
verts = [(x, y, min(z, 1.70) + max(0, z - 1.70) * (.15 / (hood_peak - 1.70))) for x, y, z in verts]
mesh = bpy.data.meshes.new('Hunter mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
body = bpy.data.objects.new('Ash Gate Hunter', mesh)
scene.collection.objects.link(body)
body.parent = rig
skin = body.modifiers.new('Hunter skeleton', 'ARMATURE')
skin.object = rig
groups = {b.name: body.vertex_groups.new(name=b.name) for b in rig.data.bones}
for i, assignments in enumerate(weights):
    for joint, amount in assignments.items():
        if amount > 0:
            groups[joint].add([i], amount, 'REPLACE')

def atlas(name, colors, colorspace):
    image = bpy.data.images.new(name, width=8 * len(palette), height=8, alpha=False)
    image.colorspace_settings.name = colorspace
    row = [channel for c in colors for _ in range(8) for channel in (*c, 1)]
    image.pixels.foreach_set(row * 8)
    image.pack()
    return image


cloth = bpy.data.materials.new('Hunter · cloth, leather and metal')
cloth.use_nodes = True
cloth.use_backface_culling = False
nodes = cloth.node_tree.nodes
shader = nodes.get('Principled BSDF')
albedo = nodes.new('ShaderNodeTexImage')
albedo.image = atlas('Hunter albedo', [
    tuple(int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))
    for hex_color, _, _ in palette.values()
], 'sRGB')
albedo.interpolation = 'Closest'
cloth.node_tree.links.new(albedo.outputs['Color'], shader.inputs['Base Color'])
surface = nodes.new('ShaderNodeTexImage')
surface.image = atlas('Hunter metallic roughness', [(1, r, m) for _, r, m in palette.values()], 'Non-Color')
surface.interpolation = 'Closest'
channels = nodes.new('ShaderNodeSeparateColor')
cloth.node_tree.links.new(surface.outputs['Color'], channels.inputs[0])
cloth.node_tree.links.new(channels.outputs['Green'], shader.inputs['Roughness'])
cloth.node_tree.links.new(channels.outputs['Blue'], shader.inputs['Metallic'])
body.data.materials.append(cloth)
uv = mesh.uv_layers.new(name='Palette')
swatch_index = {name: i for i, name in enumerate(palette)}
for poly, color, soft in zip(mesh.polygons, swatches, smooth):
    poly.use_smooth = soft
    for loop in poly.loop_indices:
        uv.data[loop].uv = ((swatch_index[color] + .5) / len(palette), .5)

mesh.calc_loop_triangles()
assert len(mesh.loop_triangles) <= 15_000
assert min(v.co.z for v in mesh.vertices) == 0
assert abs(max(v.co.z for v in mesh.vertices) - 1.85) < .00001

axes = {b.name: b.matrix_local.to_3x3() for b in rig.data.bones}


def clamp(value, low=-1, high=1):
    return min(high, max(low, value))


def leg(pose, side, forward, lift, hip_height, pitch=0):
    down = .85 + hip_height - lift
    length = min(.85, sqrt(forward ** 2 + down ** 2))
    knee = 2 * acos(length / .85)
    thigh = -atan2(forward, down) - knee / 2
    pose['Thigh' + side] = (thigh, 0, 0)
    pose['Shin' + side] = (knee, 0, 0)
    pose['Foot' + side] = (pitch - thigh - knee, 0, 0)
    pose['Coattail' + side] = (.58 * thigh - .04, 0, 0)


def arms(pose, side, reach, flex, spread=.13, twist=0, palm=0):
    s = -1 if side == 'L' else 1
    pose['Arm' + side] = (reach, -s * spread, twist)
    pose['Elbow' + side] = (flex, 0, 0)
    pose['Hand' + side] = (palm, 0, .05 * s)


def explore(name, t):
    a = tau * t
    breath = cos(a)
    crouch = name in {'Crouch', 'CrouchWalk'}
    moving = name in {'Walk', 'Run', 'CrouchWalk'}
    running = name == 'Run'
    hip = (-.238 if crouch else -.034 if moving else -.010) + .007 * breath
    lean = .53 if crouch else .30 if running else .075 if moving else .025
    if moving:
        stride = .205 if crouch else .40 if running else .275
        hip += -.086 if running else -.040 if not crouch else 0
        hip += (.073 if running else .026) * sin(a) ** 2
    sway = (.021 if moving else .006) * sin(a)
    twist = (.12 if running else .085 if moving else .024) * sin(a)
    pose = {
        'Chest': (lean + .015 * breath, .020 * sin(a), twist),
        'Head': (-lean * .69, -.014 * sin(a), -twist * .55),
        'Cape': (-.19 if running else -.045 if moving else -.063 if crouch else -.02,
                 .033 * sin(a), .03 * cos(a)),
        'CapeHem': (-.16 if running else -.08 if moving else -.025,
                    .055 * sin(a - .55), .075 * sin(a - .75)),
    }
    for side, offset in [('L', 0), ('R', .5)]:
        cycle = (t + offset) % 1
        if moving:
            stance = .44 if running else .57
            if cycle < stance:
                u = cycle / stance
                forward = stride * (.5 - u) * 2
                roll = -.13 * max(0, 1 - u * 4) + .26 * max(0, u * 4 - 3)
                lift = .051 * abs(roll) * 2
            else:
                u = (cycle - stance) / (1 - stance)
                forward = -stride * cos(pi * u)
                lift = (.225 if running else .103 if crouch else .124) * sin(pi * u)
                roll = .26 * cos(pi * u)
            leg(pose, side, forward, lift, hip, roll)
            arms(pose, side, (.86 if running else .42 if crouch else .55) * forward / stride
                 - (.24 if crouch else .10), -.97 if running else -.76 if crouch else -.23,
                 .17 if running else .17 if crouch else .13, palm=.045)
        else:
            leg(pose, side, .052 if side == 'L' else -.042, 0, hip)
            arms(pose, side, -.25 if crouch else .01, -.81 if crouch else -.19,
                 .20 if crouch else .12, palm=.08 if crouch else 0)
    return pose, {'Hips': (sway, .025 if crouch else 0, hip)}


def climb(t):
    a = tau * t
    hip = -.148 + .047 * cos(a * 2)
    pose = {'Chest': (.26, .085 * sin(a), .082 * sin(a)),
            'Head': (-.48, 0, -.08 * sin(a)), 'Cape': (-.11, .06 * sin(a), 0),
            'CapeHem': (-.12, .10 * sin(a - .6), 0)}
    for side, phase in [('L', a), ('R', a + pi)]:
        reach = (1 + sin(phase)) / 2
        arms(pose, side, -1.55 - 1.20 * reach, -.32 - .42 * (1 - reach), .18,
             palm=.27)
        leg(pose, side, .12 + .11 * (1 - reach), .05 + .27 * (1 - reach), hip, -.26)
    return pose, {'Hips': (.022 * sin(a), -.036, hip)}


def combat(hip=-.095, shift=0, push=0, lean=.14, turn=-.22, tilt=0,
           left=(-.53, -1.05, .31, .13, -.03), right=(-.44, -1.22, .32, -.18, -.08),
           front=(.18, 0, 0), back=(-.16, 0, 0), blade=0, cloth=-.14,
           stagger=0, step=0, head=0):
    pose = {'Chest': (lean, tilt, turn), 'Head': (-.54 * lean + head, -.5 * tilt, -.67 * turn),
            'Cape': (cloth, tilt * -.4, -.32 * turn),
            'CapeHem': (.48 * cloth, -.55 * tilt, -.55 * turn)}
    for side, foot, arm_pose in [('L', front, left), ('R', back, right)]:
        leg(pose, side, foot[0], foot[1], hip, foot[2])
        arms(pose, side, *arm_pose)
    pose['ThighL'] = (pose['ThighL'][0], .14 - stagger + step, .03)
    pose['ThighR'] = (pose['ThighR'][0], -.14 - stagger, -.03)
    return pose, {'Hips': (shift, -push, hip), 'Blade': (0, 0, -blade)}


def combat_stages(name):
    guard = dict()
    wind = dict(hip=-.15, shift=.028, push=-.04, lean=.065, turn=-.57,
                left=(.18, -1.34, .27, .30, -.22), right=(-.78, -1.27, .29, -.18, .04),
                front=(.21, .01, -.10), back=(-.18, 0, 0), cloth=-.22)
    impact = dict(hip=-.14, shift=-.026, push=.105, lean=.41, turn=.31,
                  left=(-1.83, -.10, .105, .28, .10), right=(.13, -.85, .43, -.32, -.02),
                  front=(.33, 0, -.03), back=(-.33, .016, .36), blade=.172, cloth=-.37)
    return {
        'Strike': [(0, guard), (.22, wind), (.39, impact), (.50, impact),
                   (.68, dict(impact, blade=0, lean=.26, left=(-.84, -.72, .33, -.08, .02))), (1, guard)],
        'CounterKill': [(0, guard),
                        (.19, dict(wind, hip=-.21, turn=-.72, left=(-.47, -1.48, .60, .42, -.04))),
                        (.34, dict(impact, lean=.14, turn=.12, left=(-1.87, -.40, .18, -.08, .22),
                                   right=(-1.03, -.78, .32, -.16, 0), front=(.28, .06, -.06))),
                        (.49, dict(impact, hip=-.234, push=.17, lean=.74, turn=.55, cloth=-.47,
                                   left=(-1.51, -.13, .07, .18, .25), front=(.36, 0, 0),
                                   back=(-.33, .05, .30))),
                        (.63, dict(impact, hip=-.24, push=.13, lean=.57)),
                        (.82, dict(wind, left=(-.45, -.62, .28, .09, .10))), (1, guard)],
        'Block': [(0, guard),
                  (.23, dict(hip=-.13, turn=.04, lean=.07,
                             left=(-1.34, -1.06, -.075, .31, .22), right=(-1.21, -1.18, -.07, -.28, .21))),
                  (.50, dict(hip=-.168, push=-.05, turn=.11, lean=-.05,
                             left=(-1.40, -1.00, -.025, .39, .23), right=(-1.28, -1.11, -.03, -.36, .21))),
                  (.70, dict(hip=-.14, turn=.08, lean=.04,
                             left=(-1.24, -1.16, -.03, .27, .19), right=(-1.17, -1.10, -.06, -.22, .21))),
                  (1, guard)],
        'Parry': [(0, guard), (.25, dict(hip=-.16, turn=-.13, left=(-.89, -1.30, -.08, -.28, .10))),
                  (.46, dict(hip=-.13, shift=-.08, push=.057, lean=.25, turn=.54, tilt=.09,
                             left=(-1.49, -.43, .61, .13, .19), right=(-.82, -1.06, .26, -.39, .10),
                             front=(.28, 0, 0), cloth=-.22, stagger=.08)),
                  (.64, dict(hip=-.14, shift=-.04, turn=.34, left=(-1.41, -.66, .55, .12, .16))),
                  (1, guard)],
        'Dodge': [(0, guard), (.17, dict(hip=-.22, shift=.048, turn=-.32, tilt=-.16)),
                  (.43, dict(hip=-.18, shift=-.23, turn=.11, tilt=-.30, stagger=.42, step=.74,
                             left=(-.46, -.88, .40, -.21, -.04), right=(-.58, -.81, .64, .32, -.12),
                             front=(.06, .12, -.12), back=(-.17, .014, .25), cloth=-.30)),
                  (.69, dict(hip=-.22, shift=-.32, turn=.08, tilt=-.12, stagger=.10, step=.20,
                             front=(.18, .015, .05), back=(-.24, .07, .12), cloth=-.24)),
                  (.85, dict(hip=-.12, shift=-.16, tilt=-.06, stagger=-.22)), (1, guard)],
        'HitReact': [(0, guard),
                     (.18, dict(hip=-.15, shift=.049, push=-.085, lean=-.31, turn=-.48, tilt=-.19,
                                left=(-.29, -.75, .41, .18, -.28), right=(.31, -.48, .61, -.24, -.12),
                                front=(.32, .065, -.34), back=(-.12, 0, .13), cloth=-.22, head=-.21)),
                     (.45, dict(hip=-.19, shift=.025, push=-.05, lean=.31, turn=.10,
                                left=(-.54, -1.12, .13, -.10, -.16), right=(-.20, -.52, .31, -.25, -.09),
                                front=(.22, 0, -.02), back=(-.19, 0, .09), head=.18)),
                     (1, guard)],
        'Death': [(0, guard),
                  (.20, dict(hip=-.15, push=-.09, lean=-.24, turn=-.36, tilt=-.06, head=-.18,
                             left=(-.66, -.23, .30, .05, -.27), right=(-.12, -.64, .45, -.16, -.13),
                             front=(.33, .04, -.12), back=(-.16, 0, .08))),
                  (.49, dict(hip=-.409, push=.044, lean=.40, turn=.19,
                             left=(-.41, -.19, .22, -.09, .07), right=(-.68, -.16, .25, .07, .08),
                             front=(.31, 0, 0), back=(-.48, .03, .57), cloth=-.11, head=.22)),
                  (.78, dict(hip=-.461, shift=.027, push=.075, lean=.68, turn=.25, tilt=-.09,
                             left=(-.14, -.15, .15, -.08, .10), right=(-.56, -.12, .23, .07, .12),
                             front=(.29, 0, -.02), back=(-.49, .047, .76), cloth=-.15, head=.46)),
                  (1, dict(hip=-.469, shift=.031, push=.077, lean=.75, turn=.27, tilt=-.12, head=.52,
                           left=(-.11, -.13, .12, -.08, .12), right=(-.48, -.11, .22, .07, .08),
                           front=(.29, 0, -.02), back=(-.49, .051, .76), cloth=-.16))],
        'Victory': [(0, guard),
                    (.30, dict(hip=-.053, lean=.13, turn=.15,
                               left=(-.66, -1.17, .11, .08, -.1), right=(-.19, -.22, .20, -.13, 0))),
                    (.56, dict(hip=-.02, lean=-.08, turn=-.035, head=-.16, cloth=-.12,
                               left=(-.14, -.29, .21, .15, .06), right=(-2.22, -.48, .48, -.21, .12),
                               front=(.14, 0, 0), back=(-.09, 0, 0))),
                    (.70, dict(hip=-.03, lean=-.05, turn=-.04, head=-.19, cloth=-.12,
                               left=(-.11, -.25, .22, .15, .07), right=(-2.13, -.58, .48, -.21, .14),
                               front=(.16, 0, 0), back=(-.09, 0, 0))),
                    (1, dict(hip=-.018, lean=.01, turn=.08, head=-.08, cloth=-.06,
                             left=(-.055, -.20, .14, .07, 0), right=(.013, -.18, .16, -.04, .02),
                             front=(.09, 0, 0), back=(-.08, 0, 0)))],
    }[name]


def staged_pose(stages, t):
    for (start, a), (end, b) in zip(stages, stages[1:]):
        if t <= end:
            u = clamp((t - start) / (end - start), 0, 1)
            u = u * u * (3 - 2 * u)
            out = []
            for x, y in zip(combat(**a), combat(**b)):
                out.append({k: Vector(x[k]).lerp(Vector(y[k]), u) for k in x})
            return out
    return combat(**stages[-1][1])


def guard_pose(t):
    a = tau * t
    return combat(hip=-.097 + .009 * cos(a), lean=.13 + .018 * cos(a), shift=.014 * sin(a),
                  head=.012 * sin(a), turn=-.22 + .033 * sin(a),
                  left=(-.53 + .037 * cos(a), -1.05, .31, .13, -.03))


def make_action(name, frames, sampler):
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in range(0, frames + 1):
        angles, moves = sampler(frame / frames)
        for pb in rig.pose.bones:
            basis = axes[pb.name]
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (
                basis.inverted() @ Euler(angles.get(pb.name, (0, 0, 0))).to_matrix() @ basis
            ).to_quaternion()
            pb.location = basis.inverted() @ Vector(moves.get(pb.name, (0, 0, 0)))
            if pb.name not in {'Root', 'Blade', 'Hips'}:
                pb.keyframe_insert('rotation_quaternion', frame=frame, group=pb.name)
            if pb.name == 'Hips' or (pb.name == 'Blade' and name in {'Strike', 'CounterKill'}):
                pb.keyframe_insert('location', frame=frame, group=pb.name)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    track.mute = True
    rig.animation_data.action = None


rig.animation_data_create()
for name, frames in [('Idle', 90), ('Walk', 31), ('Run', 23), ('Crouch', 72), ('CrouchWalk', 38)]:
    make_action(name, frames, lambda t: explore(name, t))
make_action('Climb', 40, climb)
make_action('Guard', 66, guard_pose)
for name, frames in [('Strike', 25), ('Block', 22), ('Parry', 21), ('CounterKill', 46),
                     ('Dodge', 26), ('HitReact', 26), ('Death', 48), ('Victory', 64)]:
    stages = combat_stages(name)
    make_action(name, frames, lambda t: staged_pose(stages, t))

for track in rig.animation_data.nla_tracks:
    track.mute = False
for pb in rig.pose.bones:
    pb.matrix_basis.identity()
scene.frame_set(0)

target = Path(__file__).resolve().parents[1] / 'public/models/hunter.glb'
bpy.ops.export_scene.gltf(
    filepath=str(target), export_format='GLB', export_animation_mode='NLA_TRACKS',
    export_rest_position_armature=True, export_yup=True, export_draco_mesh_compression_enable=False,
    export_lights=False, export_cameras=False,
)
assert target.stat().st_size <= 3_000_000
print(f'{target.name}: {len(mesh.loop_triangles)} triangles, {target.stat().st_size} bytes')
