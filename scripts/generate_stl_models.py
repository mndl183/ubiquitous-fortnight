#!/usr/bin/env python3
"""Generate sample STL models for the STL viewer page."""
import os
import math

OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "public", "models"))
os.makedirs(OUT_DIR, exist_ok=True)


def write_ascii_stl(path, triangles):
    with open(path, "w") as f:
        f.write("solid model\n")
        for (a, b, c) in triangles:
            f.write("  facet normal 0 0 0\n")
            f.write("    outer loop\n")
            for v in (a, b, c):
                f.write("      vertex %.4f %.4f %.4f\n" % v)
            f.write("    endloop\n")
            f.write("  endfacet\n")
        f.write("endsolid model\n")
    print("wrote %s (%d tris, %d bytes)" % (path, len(triangles), os.path.getsize(path)))


def cube(center, size):
    h = size / 2.0
    cx, cy, cz = center
    x0, x1 = cx - h, cx + h
    y0, y1 = cy - h, cy + h
    z0, z1 = cz - h, cz + h
    verts = [
        (x0, y0, z0), (x1, y0, z0), (x0, y1, z0), (x1, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x0, y1, z1), (x1, y1, z1),
    ]
    faces = [
        (0, 1, 3), (0, 3, 2),
        (4, 6, 7), (4, 7, 5),
        (0, 4, 5), (0, 5, 1),
        (1, 5, 7), (1, 7, 3),
        (3, 7, 6), (3, 6, 2),
        (2, 6, 4), (2, 4, 0),
    ]
    return [(verts[a], verts[b], verts[c]) for (a, b, c) in faces]


def gear(teeth=16, outer_r=24.0, inner_r=17.0, thickness=8.0, z_center=0.0):
    """Extruded spur gear profile, fan-triangulated around the centroid."""
    pts = []
    for i in range(teeth * 2):
        angle = math.pi * i / teeth
        r = outer_r if i % 2 == 0 else inner_r
        pts.append((r * math.cos(angle), r * math.sin(angle)))

    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)

    z0 = z_center - thickness / 2.0
    z1 = z_center + thickness / 2.0
    top = [(x, y, z1) for (x, y) in pts]
    bot = [(x, y, z0) for (x, y) in pts]
    bottom_center = (cx, cy, z0)
    top_center = (cx, cy, z1)

    tris = []
    n = len(pts)
    for i in range(n):
        ta = top[i]
        tb = top[(i + 1) % n]
        ba = bot[i]
        bb = bot[(i + 1) % n]

        # top face fan
        tris.append((top_center, tb, ta))
        # bottom face fan
        tris.append((bottom_center, ba, bb))
        # side walls
        tris.append((ta, tb, bb))
        tris.append((ta, bb, ba))
    return tris


def torus(major_r=16.0, minor_r=6.0, seg_major=28, seg_minor=14, z_center=0.0):
    """Torus (donut)."""
    tris = []
    for i in range(seg_major):
        u0 = 2 * math.pi * i / seg_major
        u1 = 2 * math.pi * (i + 1) / seg_major
        for j in range(seg_minor):
            v0 = 2 * math.pi * j / seg_minor
            v1 = 2 * math.pi * (j + 1) / seg_minor

            def pnt(u, v):
                x = (major_r + minor_r * math.cos(v)) * math.cos(u)
                y = (major_r + minor_r * math.cos(v)) * math.sin(u)
                z = minor_r * math.sin(v)
                return (x, y, z + z_center)

            a = pnt(u0, v0)
            b = pnt(u1, v0)
            c = pnt(u1, v1)
            d = pnt(u0, v1)
            tris.append((a, b, c))
            tris.append((a, c, d))
    return tris


write_ascii_stl(os.path.join(OUT_DIR, "cube.stl"), cube((0, 0, 8), 16))
write_ascii_stl(os.path.join(OUT_DIR, "gear.stl"), gear())
write_ascii_stl(os.path.join(OUT_DIR, "torus.stl"), torus())