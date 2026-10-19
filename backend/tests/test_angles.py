import math

from angles import joint_angle


def test_right_angle():
    assert math.isclose(joint_angle((0, 1), (0, 0), (1, 0)), 90.0, abs_tol=1e-6)


def test_straight_line_is_180():
    # hip, knee, ankle in a straight line -> fully extended leg
    assert math.isclose(joint_angle((0, 0), (0, 1), (0, 2)), 180.0, abs_tol=1e-6)


def test_coincident_points_return_zero_without_crashing():
    assert joint_angle((1, 1), (1, 1), (3, 4)) == 0.0
    assert joint_angle((1, 1), (3, 4), (3, 4)) == 0.0
    assert joint_angle((2, 2), (2, 2), (2, 2)) == 0.0


def test_known_60_degree_angle():
    # b at the origin, one arm along +x, the other at 60 degrees from it
    a = (1, 0)
    c = (math.cos(math.radians(60)), math.sin(math.radians(60)))
    assert math.isclose(joint_angle(a, (0, 0), c), 60.0, abs_tol=1e-6)


def test_angle_is_independent_of_segment_length():
    assert math.isclose(joint_angle((0, 10), (0, 0), (0.5, 0)), 90.0, abs_tol=1e-6)
