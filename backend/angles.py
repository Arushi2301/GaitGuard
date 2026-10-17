import numpy as np


def joint_angle(a, b, c):
    """Angle at point b (in degrees) formed by the segments b->a and b->c.

    a, b, c are (x, y) pixel points. Example: hip, knee, ankle -> knee angle.
    """
    ba = np.array(a, dtype=float) - np.array(b, dtype=float)
    bc = np.array(c, dtype=float) - np.array(b, dtype=float)

    norm = np.linalg.norm(ba) * np.linalg.norm(bc)
    if norm == 0:  # two points coincide: angle undefined, avoid dividing by zero
        return 0.0

    cos_angle = np.dot(ba, bc) / norm
    # Rounding can push the value slightly outside [-1, 1], which breaks arccos
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))
