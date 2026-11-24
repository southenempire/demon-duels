"""Generate the original CC0 Frost Herald with Blender 4.5.

blender -b --python scripts/build-frost-herald.py
"""

from math import cos, pi, radians, sin
from pathlib import Path
from random import Random

import bpy
from mathutils import Euler, Vector


bpy.ops.wm.read_factory_settings(use_empty=True)
rng = Random(416)


def point(p):
    x, d, h = p
    return Vector((x, -d, h))


def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def rgb(code):
    return tuple(linear(int(code[i:i + 2], 16) / 255) for i in (0, 2, 4))


materials = []


def material(name, color, metal=0, roughness=.75, glow=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb(color), 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Emission Color"].default_value = (*rgb(color), 1)
    bsdf.inputs["Emission Strength"].default_value = glow
    materials.append(m)
    return len(materials) - 1


hide = material("Deep indigo hide", "243855")
shadow = material("Blue-black leather", "141e32")
mouth = material("Maw", "160e22")
steel = [material("Tempered cobalt " + str(i), c, .37, .39)
         for i, c in enumerate(("273e66", "344d75", "405d8c", "526e97"))]
rim = material("Frosted silver", "a8c9e1", .44, .33)
dark_rim = material("Blacked silver", "526a87", .5, .4)
fur = [material("Hoarfrost pelt " + str(i), c)
       for i, c in enumerate(("576482", "7e91b1", "b1c5df", "e0e9f5"))]
ice = [material("Glacial ice " + str(i), c, .16, .36, emission)
       for i, (c, emission) in enumerate((("17508a", .16), ("2586b7", .22),
                                          ("5ccce7", .28), ("bcf4ff", .38)))]
light = material("Winterfire", "72e9ff", 0, .33, 2.2)
ivory = material("Ice-worn ivory", "d5dee8")


vertices, polygons, face_materials, smoothing, weights = [], [], [], [], {}


def mesh(bone, coords, faces, palette, smooth=False):
    start = len(vertices)
    vertices.extend(coords)
    weights.setdefault(bone, []).extend(range(start, len(vertices)))
    for i, f in enumerate(faces):
        polygons.append(tuple(start + j for j in f))
        face_materials.append(palette(i) if callable(palette) else palette)
        smoothing.append(smooth)


def ellipsoid(bone, center, scale, palette, n=16, bands=10, axis=None, uneven=0, smooth=True):
    c = point(center)
    r = (Vector((0, 0, 1)).rotation_difference(point(axis).normalized()) if axis else None)
    coords = []
    for k in range(1, bands):
        p = pi * k / bands
        for j in range(n):
            t = 2 * pi * j / n
            variation = 1 + rng.uniform(-uneven, uneven) if uneven else 1
            v = Vector((scale[0] * sin(p) * cos(t), scale[1] * sin(p) * sin(t), scale[2] * cos(p))) * variation
            coords.append(c + (r @ v if r else v))
    for h in (scale[2], -scale[2]):
        v = Vector((0, 0, h))
        coords.append(c + (r @ v if r else v))
    faces = []
    top, bottom = len(coords) - 2, len(coords) - 1
    for j in range(n):
        k = (j + 1) % n
        faces.append((top, j, k))
        for l in range(bands - 2):
            a, b = l * n, (l + 1) * n
            faces.append((a + j, b + j, b + k, a + k))
        faces.append((bottom, (bands - 2) * n + k, (bands - 2) * n + j))
    mesh(bone, coords, faces, palette, smooth)


def taper(bone, path, radii, palette, n=7, flatten=1, phase=0, faceted=False):
    coords, faces = [], []
    points = list(map(point, path))
    for k, (p, radius) in enumerate(zip(points, radii)):
        t = (points[min(k + 1, len(points) - 1)] - points[max(0, k - 1)]).normalized()
        u = t.cross(Vector((0, 1, 0)))
        if u.length < .01:
            u = t.cross(Vector((1, 0, 0)))
        u.normalize()
        v = t.cross(u)
        for j in range(n):
            a = 2 * pi * j / n + phase
            coords.append(p + radius * (cos(a) * u + sin(a) * v * flatten))
    faces.append(tuple(reversed(range(n))))
    for k in range(len(path) - 1):
        for j in range(n):
            a, b = k * n, (k + 1) * n
            l = (j + 1) % n
            if faceted:
                faces.extend(((a + j, a + l, b + j), (a + l, b + l, b + j)))
            else:
                faces.append((a + j, a + l, b + l, b + j))
    faces.append(tuple(range(len(coords) - n, len(coords))))
    mesh(bone, coords, faces, palette)


def frost(bone, a, b, width, tint=ice):
    p, q = Vector(a), Vector(b)
    d = q - p
    taper(bone, (p, p + .31 * d, p + .67 * d, q), (width * .65, width, width * .59, .001),
          lambda i: tint[(i + (i // 6) + rng.randrange(3)) % len(tint)], n=6, phase=.26, faceted=True)


def wire(bone, path, mat=rim, width=.018):
    taper(bone, path, [width] * len(path), mat, n=6)


def plate(bone, perimeter, peak, frame=rim, plate_palette=steel):
    size = len(perimeter)
    centroid = sum(map(Vector, perimeter), Vector((0, 0, 0))) / size
    inner = [Vector(p).lerp(centroid, .14) for p in perimeter]
    for p in inner:
        p.y += .013
    back = [(x, d - .038, h) for x, d, h in perimeter]
    coords = list(map(point, [*perimeter, *inner, *back, peak]))
    faces, colors = [], []
    for i in range(size):
        k = (i + 1) % size
        faces.extend(((i, k, k + size, i + size), (i + size, k + size, size * 3),
                      (k, i, i + 2 * size, k + 2 * size)))
        colors.extend((frame, rng.choice(plate_palette), dark_rim))
    faces.append(tuple(reversed(range(2 * size, 3 * size))))
    colors.append(shadow)
    # The perimeter is authored from the front; reorient closed plates reliably.
    normal = (coords[1] - coords[0]).cross(coords[2] - coords[0])
    if normal.dot(Vector((0, -1, 0))) < 0:
        faces = [tuple(reversed(f)) for f in faces]
    mesh(bone, coords, faces, colors.__getitem__)


def pelt(bone, a, b, width, color):
    p, q = Vector(a), Vector(b)
    d = q - p
    c = p + d * .4
    c.y += .028
    taper(bone, (p, c, p + d * .76, q), (width * .68, width, width * .47, .001),
          lambda i: fur[max(0, min(3, color + (i % 3 == 1) - (i % 7 == 0)))],
          n=5, flatten=.58, phase=.29)


def torso():
    ellipsoid("Torso", (0, 0, 1.83), (.59, .31, .52), hide, uneven=.035)
    ellipsoid("Motion", (0, 0, 1.26), (.43, .27, .24), shadow)
    for s in (-1, 1):
        for row in range(4):
            h = 2.07 - .145 * row
            w = .51 - .044 * row
            plate("Torso", [(s * .018, .29, h - .1), (s * w, .16, h - .03),
                            (s * (w + .025), .15, h + .101), (s * .20, .30, h + .13),
                            (s * .045, .302, h + .084)],
                  (s * w * .52, .35 - .009 * row, h + .056), dark_rim)
    ellipsoid("Motion", (0, 0, 1.35), (.46, .32, .08), shadow, n=24, bands=6)
    for h in (1.30, 1.39):
        wire("Motion", [(.455 * cos(i * pi / 12), .320 * sin(i * pi / 12), h)
                        for i in range(25)], dark_rim, .017)
    for s in (-1, 1):
        for i in range(4):
            ellipsoid("Motion", (s * (.16 + .075 * i), .312 - .012 * i, 1.347),
                      (.019, .016, .02), rim, n=8, bands=5)
    perimeter = [(.12 * cos(pi * i / 4), .345, 1.36 + .13 * sin(pi * i / 4)) for i in range(8)]
    plate("Motion", perimeter, (0, .414, 1.36), rim, ice)
    frost("Motion", (0, .42, 1.29), (0, .442, 1.43), .05)
    plate("Motion", [(-.18, .299, 1.23), (0, .302, .66), (.18, .299, 1.23), (0, .323, 1.17)],
          (0, .354, 1.07), rim, steel)
    wire("Motion", [(0, .356, .78), (0, .365, 1.08), (0, .352, 1.18)], ice[2], .013)
    for s in (-1, 1):
        for i in range(3):
            x = .18 + i * .103
            plate("Thigh" + ("R" if s > 0 else "L"),
                  [(s * (x - .05), .19, 1.27), (s * (x + .20), .14, .97 - .025 * i),
                   (s * (x + .07), .192, .76 + .07 * i), (s * (x - .10), .268, 1.04)],
                  (s * (x + .022), .28, 1.035), dark_rim)


def mantle():
    ellipsoid("Mantle", (0, -.21, 2.1), (.73, .28, .31), fur[0], n=22, bands=13)
    for j in range(9):
        x = (j - 4) * .139
        l = abs(x)
        for k in range(4):
            h = 2.21 - k * .28 - l * .12
            d = -.43 + l * .18 + k * .009
            pelt("Mantle", (x, d, h + .12), (x * (1.43 + k * .08) + rng.uniform(-.035, .035), d + .04,
                                             h - rng.uniform(.30, .46)), .117, 0 if k > 1 else 1)
    for j in range(5):
        for i in range(-3, 4):
            x = i * .18 + rng.uniform(-.049, .049)
            h = 2.40 - abs(x) * .32 - .131 * j + rng.uniform(-.044, .044)
            d = -.31 - .037 * j
            frost("Mantle", (x, d, h), (x * 1.42 + rng.uniform(-.051, .051), d - .21 - .033 * j,
                                        h + rng.uniform(.16, .44) - .025 * j), rng.uniform(.048, .082))
    for s in (-1, 1):
        for j in range(6):
            for k in range(4):
                x = .26 + k * .136 + rng.uniform(-.035, .035)
                angle = -.98 + j * .42 + rng.uniform(-.1, .1)
                d = sin(angle) * .32
                h = 2.35 + cos(angle) * .031 - k * .04
                pelt("Torso", (s * x, d, h), (s * (x + rng.uniform(.15, .27)), d + .06, h - .16),
                     rng.uniform(.056, .085), 2 if j < 2 else 3)


def head():
    ellipsoid("Skull", (0, .025, 2.4), (.259, .241, .286), hide, n=20, bands=12, uneven=.052)
    ellipsoid("Skull", (0, .201, 2.412), (.199, .145, .153), hide, uneven=.04)
    ellipsoid("Skull", (0, .278, 2.345), (.151, .085, .087), mouth, n=18, bands=10)
    ellipsoid("Jaw", (0, .269, 2.295), (.152, .097, .074), hide, n=18)
    ellipsoid("Jaw", (0, .321, 2.326), (.125, .043, .025), mouth, n=16, bands=6)
    ellipsoid("Skull", (0, .329, 2.419), (.077, .061, .045), steel[0], n=13, bands=7)
    for s in (-1, 1):
        ellipsoid("Skull", (s * .117, .25, 2.50), (.108, .089, .062), shadow, axis=(s * .68, 0, -.9))
        ellipsoid("Skull", (s * .116, .346, 2.497), (.065, .027, .024), light, n=12, bands=6,
                  axis=(s * .37, 0, -.94))
        taper("Skull", [(s * .035, .32, 2.502), (s * .107, .329, 2.55), (s * .199, .266, 2.566),
                        (s * .268, .19, 2.56)], [.025, .051, .061, .029], steel[2], n=8)
        taper("Skull", [(s * .177, .088, 2.543), (s * .282, .082, 2.60), (s * .373, .085, 2.725),
                        (s * .400, .092, 2.877), (s * .355, .119, 2.988), (s * .321, .136, 3.0)],
              [.101, .095, .071, .052, .026, .001],
              lambda i: (steel[0], steel[1], ice[0], ice[1], ice[2], rim)[min(5, i // 16 + i % 3)],
              n=8, phase=.2, faceted=True)
        for j in range(3):
            x, h = .134 + j * .066, 2.599 - j * .027
            frost("Skull", (s * x, .016, h), (s * (x + .079), -.037, h + .26 - .034 * j), .048)
        for j in range(5):
            x = s * (.033 + j * .027)
            d = .366 - j * .010
            taper("Skull", [(x, d, 2.386), (x, d + .012, 2.36),
                            (x * .94, d + .013, 2.323 if j == 3 else 2.35)],
                  [.015, .012, .001], ivory, n=6)
            taper("Jaw", [(x, d - .007, 2.316), (x, d, 2.339 + .012 * (j == 4))], [.011, .001], ivory, n=6)
        for j in range(5):
            for k in range(4):
                x = .206 - .013 * j + k * .014 + rng.uniform(-.012, .012)
                d = .12 + k * .047
                h = 2.454 - .054 * j
                pelt("Skull", (s * x, d, h), (s * (x + .05 + .012 * k), d - .015,
                                             h - rng.uniform(.12, .21)), .044, 2)
    frost("Skull", (0, .281, 2.525), (0, .265, 2.784), .062)
    for j in range(4):
        for k in range(7 - j):
            x = (k - (6 - j) / 2) * .041
            h = 2.30 - j * .104 - .11 * abs(x)
            d = .353 + .038 * j - .17 * abs(x)
            pelt("Jaw", (x, d, h), (x * (1.43 - .20 * j) + rng.uniform(-.017, .017), d + .068,
                                     h - rng.uniform(.14, .238) + .21 * abs(x)), rng.uniform(.028, .051), 3 - (k + j) % 3 // 2)


def limbs():
    for s, side in ((-1, "L"), (1, "R")):
        arm, fore, hand = ("Arm" + side, "Forearm" + side, "Hand" + side)
        thigh, shin, foot = ("Thigh" + side, "Shin" + side, "Foot" + side)
        ellipsoid(arm, (s * .656, .015, 1.897), (.226, .223, .357), hide, n=13, bands=8,
                  axis=(s * .29, .12, -.8), uneven=.033)
        for i in range(3):
            h = 2.19 - i * .135
            x = .64 + i * .022
            outline = [(s * (x - .192), .135, h + .041), (s * (x - .072), .213, h - .103),
                       (s * (x + .087), .219, h - .049), (s * (x + .278 - .02 * i), .087, h - .094),
                       (s * (x + .245 - .02 * i), -.038, h + .034),
                       (s * (x + .112), .066, h + .108), (s * (x - .094), .121, h + .125)]
            plate(arm, outline, (s * (x + .049), .271 - .009 * i, h + .039))
            if i < 2:
                frost(arm, (s * (x + .12), .063, h + .05), (s * (x + .30), .014, h + .25), .06)
        ellipsoid(fore, (s * .718, .152 if s > 0 else .132, 1.493), (.153, .152, .236),
                  hide, n=12, bands=8, axis=(s * -.08, .42, -.84), uneven=.037)
        for j in range(3):
            h = 1.63 - .138 * j
            d = .23 + .042 * j
            plate(fore, [(s * .553, d, h + .018), (s * .613, d + .044, h - .067),
                         (s * .766, d + .038, h - .09), (s * .871, d - .068, h + .005),
                         (s * .805, d - .067, h + .10), (s * .654, d + .019, h + .058)],
                  (s * .704, d + .10, h + .04))
            frost(fore, (s * .804, d, h), (s * (.971 - j * .037), d + .04, h + .125), .051)
        d = .32 if s > 0 else .25
        ellipsoid(hand, (s * .689, d, 1.20), (.122, .101, .125), steel[0], n=13, bands=8)
        for j in range(4):
            x = s * (.606 + .052 * j)
            taper(hand, [(x, d + .077, 1.251), (x, d + .10, 1.185), (x, d + .074, 1.147)],
                  [.029, .031, .021], steel[1 + j % 2])
            frost(hand, (x, d + .075, 1.162), (x, d + .039, 1.138), .018, [dark_rim, rim])
        ellipsoid(hand, (s * .590, d + .03, 1.244), (.043, .045, .067), steel[1], n=10, bands=6)
        ellipsoid(thigh, (s * .319, .012, .986), (.246, .251, .393), hide, n=13, bands=8, uneven=.041)
        ellipsoid(shin, (s * .354, -.003, .432), (.185, .176, .344), hide, n=13, bands=8, uneven=.042)
        for i in range(4):
            h = .807 - i * .158
            w = .178 - i * .012
            plate(shin, [(s * (.348 - w), .127, h + .025), (s * .351, .237, h - .117),
                         (s * (.350 + w), .128, h + .008), (s * (.48 - i * .01), .18, h + .088),
                         (s * .342, .207, h + .047), (s * (.225 + i * .01), .184, h + .085)],
                  (s * .359, .286 - i * .023, h + .005), rim if i == 0 else dark_rim)
            if i < 2:
                frost(shin, (s * (.47 - .021 * i), .203, h - .014),
                      (s * (.63 - .038 * i), .22, h + .16), .066 - i * .015)
        frost(shin, (s * .355, .276, .721), (s * .371, .301, .964), .071)
        ellipsoid(foot, (s * .386, .089, .129), (.187, .265, .129), shadow, n=18, bands=10)
        ellipsoid(foot, (s * .382, .153, .146), (.179, .224, .112), steel[0], n=16, bands=9)
        for i in range(4):
            x = s * (.266 + .079 * i)
            h = .116 - .005 * abs(i - 1)
            taper(foot, [(x, .255, h), (x + s * .01, .347, h), (x + s * .015, .426 - .023 * abs(i - 1), .029)],
                  [.039, .035, .001], lambda j: rim if j % 4 else ivory, n=7)


def halberd():
    grip = Vector((.687, .32, 1.207))
    along = Vector((.61, .006, .792)).normalized()
    across = Vector((along.z, 0, -along.x))

    def axe(a, b=0, d=0):
        return grip + a * along + b * across + Vector((0, d, 0))

    bone = "Rimeaxe"
    taper(bone, [axe(-.88), axe(-.80), axe(.98), axe(1.11)], [.033, .046, .041, .03], shadow, n=12)
    for i in range(19):
        a = -.824 + i * .093
        c = dark_rim if i % 5 else rim
        taper(bone, [axe(a), axe(a + .013), axe(a + .025)], [.046, .050, .044], c, n=8, phase=i * .17)
    for a in (-.746, -.357, .166, .69, .88):
        taper(bone, [axe(a - .03), axe(a - .018), axe(a + .027), axe(a + .034)],
              [.043, .056, .056, .043], rim, n=12)
    frost(bone, axe(-.84), axe(-1.01), .058)
    outline = [(1.105, -.105), (1.255, -.001), (1.198, .228), (1.085, .394),
               (.939, .519), (.760, .590), (.542, .600), (.322, .521),
               (.508, .430), (.633, .328), (.717, .215), (.756, .102), (.737, -.014),
               (.666, -.137), (.731, -.222), (.912, -.198), (1.053, -.297), (1.171, -.311)]
    outline = [Vector(p) for p in outline]
    center = Vector((.942, .081))
    n = len(outline)
    blade = []
    for side in (1, -1):
        blade.extend(point(axe(*p, .006 * side)) for p in outline)
        blade.extend(point(axe(*p.lerp(center, .21), rng.uniform(.042, .071) * side)) for p in outline)
        blade.extend(point(axe(*p.lerp(center, .62), rng.uniform(.059, .101) * side)) for p in outline)
        blade.append(point(axe(*center, .112 * side)))
    faces, colors = [], []
    for s in (0, 1):
        offset = s * (3 * n + 1)
        for k in range(n):
            j = (k + 1) % n
            for layer in (0, 1):
                a, b = offset + n * layer, offset + n * (layer + 1)
                tri = [(a + k, b + k, a + j), (a + j, b + k, b + j)]
                faces.extend(tri if s else [f[::-1] for f in tri])
                colors.extend((ice[2 + j % 2], ice[1 + k % 3]) if layer == 0
                              else (ice[j % 3], ice[k % 3]))
            f = (offset + 2 * n + k, offset + 3 * n, offset + 2 * n + j)
            faces.append(f if s else f[::-1])
            colors.append(ice[0 if k % 3 else 2])
    for k in range(n):
        j = (k + 1) % n
        faces.append((k, j, 3 * n + 1 + j, 3 * n + 1 + k))
        colors.append(rim)
    mesh(bone, blade, faces, colors.__getitem__)
    for sign in (-1, 1):
        wire(bone, [axe(.725, -.069, sign * .06), axe(.921, .087, sign * .12),
                    axe(1.119, -.019, sign * .059)], dark_rim, .025)
        frost(bone, axe(.849, .02, sign * .124), axe(1.064, .082, sign * .093), .044)
    frost(bone, axe(.965, -.11), axe(1.018, -.355), .074)


torso()
mantle()
head()
limbs()
halberd()

rig_data = bpy.data.armatures.new("Frost Herald Skeleton")
rig = bpy.data.objects.new("Frost Herald Rig", rig_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")


def joint(name, origin, parent=None):
    b = rig_data.edit_bones.new(name)
    b.head = point(origin)
    b.tail = b.head + Vector((0, 0, .16))
    if parent:
        b.parent = rig_data.edit_bones[parent]


joint("Motion", (0, 0, 1.242))
joint("Torso", (0, 0, 1.46), "Motion")
joint("Mantle", (0, -.26, 2.13), "Torso")
joint("Skull", (0, .035, 2.32), "Torso")
joint("Jaw", (0, .164, 2.325), "Skull")
for s, side in ((-1, "L"), (1, "R")):
    joint("Arm" + side, (s * .562, -.004, 2.046), "Torso")
    joint("Forearm" + side, (s * .736, .026, 1.651), "Arm" + side)
    joint("Hand" + side, (s * .682, .276 if s > 0 else .211, 1.303), "Forearm" + side)
    joint("Thigh" + side, (s * .257, 0, 1.255), "Motion")
    joint("Shin" + side, (s * .349, .061, .716), "Thigh" + side)
    joint("Foot" + side, (s * .383, -.006, .173), "Shin" + side)
joint("Rimeaxe", (.687, .32, 1.207), "HandR")
bpy.ops.object.mode_set(mode="OBJECT")

mesh_data = bpy.data.meshes.new("Frost Herald Geometry")
mesh_data.from_pydata(vertices, [], polygons)
mesh_data.update()
boss = bpy.data.objects.new("Frost Herald", mesh_data)
bpy.context.collection.objects.link(boss)
for mat in materials:
    mesh_data.materials.append(mat)
for poly, mat, smooth in zip(mesh_data.polygons, face_materials, smoothing):
    poly.material_index = mat
    poly.use_smooth = smooth
for bone, indices in weights.items():
    boss.vertex_groups.new(name=bone).add(indices, 1, "REPLACE")
boss.parent = rig
boss.modifiers.new("Frost Herald Skin", "ARMATURE").object = rig
bpy.context.view_layer.objects.active = boss
bpy.ops.object.select_all(action="DESELECT")
boss.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")


guard = dict(Torso=(7, -2, -5), Skull=(-7, 2, 5), ArmL=(-14, 14, -4), ForearmL=(-29, 13, -6),
             ArmR=(-6, -9, 1), ForearmR=(-12, 7, -5), HandR=(4, -10, 0),
             ThighL=(-8, 1, 0), ThighR=(5, -2, 0), ShinL=(8, 0, 0), ShinR=(3, 0, 0),
             FootR=(-8, 0, 0), Motion=(0, 0, 0, 0, 0, -.018))


def pose(frame, **joints):
    for b in rig.pose.bones:
        x, y, z, *offset = joints.get(b.name, guard.get(b.name, (0, 0, 0)))
        basis = b.bone.matrix_local.to_quaternion()
        q = basis.inverted() @ Euler(tuple(map(radians, (x, y, z))), "XYZ").to_quaternion() @ basis
        if q.dot(b.rotation_quaternion) < 0:
            q.negate()
        b.rotation_quaternion = q
        b.location = basis.inverted() @ point(offset) if offset else (0, 0, 0)
        b.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=b.name)
        if b.name == "Motion":
            b.keyframe_insert(data_path="location", frame=frame, group=b.name)


def stride(direction, airborne):
    j = dict(Motion=(0, -direction * 3, 0, direction * .042, 0, -.048 if airborne else -.024),
             Torso=(9, direction * 4, direction * -10), Skull=(-8, direction * -4, direction * 10),
             Mantle=(3, 0, direction * 8), ArmL=(direction * 16, 13, -7), ForearmL=(-25, 8, 1),
             ArmR=(-10 - direction * 10, -7, 2), ForearmR=(-12, 7, -5),
             HandR=(8, direction * 7, -direction * 11))
    for s, side in ((-1, "L"), (1, "R")):
        swing = s * direction
        j["Thigh" + side] = ((-13 if swing == 1 else 7) if airborne else -26 * swing, 0, 0)
        j["Shin" + side] = ((42 if swing == 1 else 11) if airborne else (10 if swing == 1 else 28), 0, 0)
        j["Foot" + side] = ((-8 if swing == 1 else -18) if airborne else 16 * swing - 7, 0, 0)
    return j


clips = {
    "Idle": [
        (0, {}),
        (25, dict(Motion=(0, 0, 0, .014, 0, .006), Torso=(4, 1, -6), Skull=(-10, 0, 8),
                  Mantle=(-3, 0, 2), ForearmR=(-17, 9, -7), Jaw=(5, 0, 0))),
        (54, dict(Motion=(0, 0, 0, -.014, 0, -.025), Torso=(9, -2, -4), Skull=(-4, 2, -1),
                  Mantle=(1, 2, -3), ForearmL=(-35, 10, -5), HandR=(8, 0, -3))),
        (105, {}),
    ],
    "Walk": [(0, stride(1, False)), (12, stride(-1, True)), (24, stride(-1, False)),
             (37, stride(1, True)), (49, stride(1, False))],
    "Alert": [
        (0, {}),
        (14, dict(Torso=(18, 1, -13), Skull=(9, -5, -13), ForearmL=(-42, 15, 11),
                  ForearmR=(-28, 17, 1), Motion=(0, 0, 0, 0, .035, -.125))),
        (30, dict(Torso=(-10, 0, 1), Skull=(-21, 2, -3), Jaw=(33, 0, 0),
                  ArmL=(4, 37, -6), ForearmL=(-26, 10, 11), ArmR=(-22, -28, -7),
                  ForearmR=(-19, 15, -7), Mantle=(8, 0, 0))),
        (48, dict(Torso=(-3, 0, -6), Skull=(-12, 0, 12), Jaw=(21, 0, 0),
                  ArmL=(1, 31, -4), ArmR=(-16, -22, -7), Mantle=(2, 0, 2))),
        (69, {}),
    ],
    "Strike": [
        (0, {}),
        (10, dict(Torso=(4, 4, 36), Skull=(-7, -5, -27), ArmR=(29, -34, 20),
                  ForearmR=(-34, 4, 13), HandR=(1, -32, -4), ArmL=(-24, 25, 6))),
        (16, dict(Motion=(0, 0, 0, -.07, .19, -.12), Torso=(16, -9, -32), Skull=(-6, 8, 21),
                  ArmR=(-64, 32, -23), ForearmR=(-21, 22, 6), HandR=(9, -56, -23),
                  ArmL=(23, 26, 4), ForearmL=(-15, 17, 3),
                  ThighL=(-27, 3, -2), ShinL=(39, 0, 0), ThighR=(21, -5, 0), ShinR=(12, 0, 0))),
        (23, dict(Motion=(0, 0, 0, -.05, .13, -.09), Torso=(17, -12, -44),
                  ArmR=(-46, 19, -39), ForearmR=(-10, 27, 6), HandR=(4, -39, -21), Mantle=(-2, 0, 22))),
        (38, {}),
    ],
    "Heavy": [
        (0, {}),
        (11, dict(Torso=(-5, 9, 24), ArmR=(-73, -27, 9), ForearmR=(-35, -12, 11),
                  HandR=(16, -59, -7), ArmL=(-31, 17, -2), Skull=(-12, 1, -18))),
        (28, dict(Motion=(0, 0, 0, .038, -.12, -.077), Torso=(-18, 8, 30), Skull=(11, -7, -22),
                  ArmR=(-138, -15, 13), ForearmR=(-26, 6, -2), HandR=(3, -67, -5), Jaw=(19, 0, 0),
                  ArmL=(-38, 24, -5), ForearmL=(-53, 4, -9), ThighL=(-17, 6, 1), ShinL=(26, 0, 0))),
        (37, dict(Motion=(0, 0, 0, -.05, .27, -.181), Torso=(34, -7, -19), Skull=(-16, 4, 12),
                  ArmR=(-54, 9, -2), ForearmR=(-5, 9, -6), HandR=(47, -70, 7),
                  ArmL=(16, 20, -1), Mantle=(-13, 0, 6), ThighL=(-38, 2, 0), ShinL=(44, 0, 0),
                  ThighR=(21, -6, -5), ShinR=(22, 0, 0), FootL=(-6, 0, 0))),
        (47, dict(Motion=(0, 0, 0, -.019, .17, -.15), Torso=(27, -4, -11), Skull=(-15, 5, 8),
                  ArmR=(-34, 8, 1), ForearmR=(-7, 16, -6), HandR=(28, -38, 9), ArmL=(8, 15, -7))),
        (64, {}),
    ],
    "Block": [
        (0, {}),
        (9, dict(Motion=(0, 0, 0, -.035, -.085, -.106), Torso=(5, -3, 18), Skull=(-1, 4, -18),
                 ArmL=(-36, 14, -12), ForearmL=(-84, -37, -4), HandL=(3, 9, 8),
                 ArmR=(-39, -7, 1), ForearmR=(-15, 9, 4), HandR=(18, 34, -5),
                 ThighR=(-16, -4, 0), ShinR=(29, 0, 0), ThighL=(-12, 4, 0), ShinL=(28, 0, 0))),
        (18, dict(Motion=(0, 0, 0, -.041, -.118, -.116), Torso=(2, -2, 13), Skull=(-5, 1, -12),
                  ArmL=(-32, 12, -12), ForearmL=(-79, -38, -4), HandL=(4, 9, 8),
                  ArmR=(-33, -7, 1), ForearmR=(-23, 9, 4), HandR=(17, 32, -5),
                  ThighR=(-16, -4, 0), ShinR=(29, 0, 0), ThighL=(-12, 4, 0), ShinL=(28, 0, 0))),
        (37, {}),
    ],
    "Parry": [
        (0, {}),
        (6, dict(Torso=(3, 4, 19), Skull=(-4, 2, -16), ArmL=(-29, 5, 6), ForearmL=(-75, -43, 2),
                 ArmR=(-22, -11, -6), ForearmR=(-22, 5, -12))),
        (13, dict(Motion=(0, 0, 0, -.065, .105, -.078), Torso=(8, -7, -22), Skull=(-5, 5, 19),
                  ArmL=(-42, 46, -18), ForearmL=(-36, 21, 12), HandL=(12, -3, -11),
                  ArmR=(13, -12, 7), ForearmR=(-20, 9, -5), HandR=(6, 21, 7))),
        (20, dict(Torso=(9, -2, -12), ArmL=(-17, 29, -13), ForearmL=(-28, 13, 7), ArmR=(2, -8, 4))),
        (30, {}),
    ],
    "Dodge": [
        (0, {}),
        (7, dict(Motion=(0, -5, 0, -.10, -.03, -.11), Torso=(14, 9, 6), ArmR=(-16, -7, -9),
                 ThighL=(-24, 9, 0), ShinL=(29, 0, 0), ThighR=(-10, -5, 0), ShinR=(20, 0, 0))),
        (16, dict(Motion=(-3, -18, 1, -.28, -.09, -.23), Torso=(21, 7, 16), Skull=(-11, 3, -13),
                  ArmR=(10, -22, 5), ForearmR=(-16, 19, -7), HandR=(13, 21, 3),
                  ArmL=(-37, 29, 3), ForearmL=(-47, -5, -8), ThighL=(-31, 19, -7), ShinL=(51, 0, 0),
                  ThighR=(-22, -16, 7), ShinR=(43, 0, 0), FootR=(-6, 10, 0), Mantle=(-7, 8, -7))),
        (24, dict(Motion=(0, -8, 0, -.18, -.035, -.09), Torso=(11, 5, 7),
                  ThighL=(-16, 13, 0), ShinL=(19, 0, 0), ShinR=(15, 0, 0))),
        (35, {}),
    ],
    "HitReact": [
        (0, {}),
        (6, dict(Motion=(-9, 4, -3, .065, -.12, -.075), Torso=(-13, 10, 13), Skull=(-26, -4, -16),
                 Jaw=(24, 0, 0), ArmL=(17, 28, 5), ForearmL=(-10, 19, 6), ArmR=(15, -26, -13),
                 HandR=(-5, -27, 18), Mantle=(13, 0, -11), ThighR=(-7, -11, 0), ShinR=(23, 0, 0))),
        (16, dict(Motion=(-3, 2, 0, .05, -.06, -.045), Torso=(9, 5, 5), Skull=(13, -3, 3),
                  Jaw=(12, 0, 0), ArmL=(-23, 18, 5), ForearmL=(-41, 16, 6), Mantle=(-10, 0, 6))),
        (35, {}),
    ],
    "Death": [
        (0, {}),
        (12, dict(Motion=(-14, 4, 1, .06, -.16, -.09), Torso=(-9, 7, 15), Skull=(-23, 1, -12), Jaw=(23, 0, 0),
                  ArmL=(7, 21, -8), ArmR=(4, -31, 9), HandR=(4, 23, 17), ThighR=(-12, -5, 3))),
        (29, dict(Motion=(5, -9, 4, -.09, -.20, -.46), Torso=(24, 5, 13), Skull=(13, 8, -13), Jaw=(16, 0, 0),
                  ArmL=(-35, 18, 4), ForearmL=(-19, 9, -11), ArmR=(17, -39, 17), HandR=(4, 34, 6),
                  ThighL=(-43, 0, 0), ShinL=(69, 0, 0), ThighR=(-27, -4, 3), ShinR=(64, 0, 0))),
        (47, dict(Motion=(-52, -17, -9, -.09, -.42, -.75), Torso=(3, -1, 9), Skull=(-16, -9, -11), Jaw=(13, 0, 0),
                  ArmL=(2, 31, -8), ForearmL=(-45, 15, -3), ArmR=(6, -49, 19), HandR=(13, 26, -6),
                  ThighL=(-38, 3, 3), ShinL=(50, 0, 0), ThighR=(-21, -9, 5), ShinR=(48, 0, 0))),
        (64, dict(Motion=(-83, -1, -10, -.07, -.53, -.916), Torso=(0, 0, 5), Skull=(11, -8, -13), Jaw=(10, 0, 0),
                  ArmL=(0, 45, -8), ForearmL=(-22, 17, -3), ArmR=(1, -50, 17), ForearmR=(4, 3, 6),
                  HandR=(0, 45, 4), ThighL=(-8, 8, 3), ShinL=(16, 0, 0), ThighR=(-7, -10, 2), ShinR=(10, 0, 0))),
        (89, dict(Motion=(-85, -1, -10, -.07, -.53, -.918), Torso=(1, 0, 5), Skull=(12, -8, -13), Jaw=(9, 0, 0),
                  ArmL=(0, 45, -8), ForearmL=(-22, 17, -3), ArmR=(1, -50, 17), ForearmR=(4, 3, 6),
                  HandR=(0, 45, 4), ThighL=(-8, 8, 3), ShinL=(16, 0, 0), ThighR=(-7, -10, 2), ShinR=(10, 0, 0))),
    ],
    "Victory": [
        (0, {}),
        (15, dict(Torso=(11, 4, -9), Skull=(11, -5, 4), ArmR=(-26, -11, 4),
                  ForearmR=(-32, 7, 5), HandR=(10, 15, -9), ArmL=(-33, 22, -9))),
        (37, dict(Motion=(0, 0, 0, .013, .025, .012), Torso=(-14, 3, -9), Skull=(-27, -3, 9), Jaw=(29, 0, 0),
                  ArmR=(-80, -46, -8), ForearmR=(-13, -6, 5), HandR=(43, -40, 9),
                  ArmL=(1, 38, -2), ForearmL=(-10, 15, 8), Mantle=(13, 0, 6))),
        (57, dict(Torso=(-9, 5, -6), Skull=(-14, -3, 6), Jaw=(18, 0, 0),
                  ArmR=(-77, -43, -8), ForearmR=(-12, -5, 6), HandR=(38, -40, 9),
                  ArmL=(3, 30, -3), ForearmL=(-10, 13, 5), Mantle=(6, 0, 3))),
        (75, dict(Torso=(-6, 6, -6), Skull=(-8, -3, 6), Jaw=(5, 0, 0),
                  ArmR=(-71, -39, -7), ForearmR=(-11, -4, 7), HandR=(37, -39, 8),
                  ArmL=(4, 27, -3), ForearmL=(-13, 13, 5), Mantle=(4, 0, 3))),
    ],
}

scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 0, 105
anim = rig.animation_data_create()
for name, keys in clips.items():
    anim.action = bpy.data.actions.new(name)
    for b in rig.pose.bones:
        b.rotation_quaternion = (1, 0, 0, 0)
    for frame, joints in keys:
        pose(frame, **joints)
    track = anim.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, anim.action)
    anim.action = None
    track.mute = True

for b in rig.pose.bones:
    b.matrix_basis.identity()
scene.frame_set(0)
for track in anim.nla_tracks:
    track.mute = False
target = Path(__file__).resolve().parents[1] / "web/public/models/frost-herald.glb"
bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", export_animation_mode="NLA_TRACKS",
                          export_frame_range=False, export_optimize_animation_size=True)
mesh_data.calc_loop_triangles()
print(f"Frost Herald: {len(mesh_data.loop_triangles):,} triangles; {target.stat().st_size:,} bytes")
