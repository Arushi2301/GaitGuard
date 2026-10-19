"""Unit tests for pose.py using a fake landmarker, so no real person or model is needed."""
from types import SimpleNamespace

import cv2
import numpy as np

import pose


def _lm(x, y, visibility=0.99):
    return SimpleNamespace(x=x, y=y, visibility=visibility)


def _landmarks(right_visibility):
    """33 fake landmarks: left leg bent to 90 degrees, right leg with the requested visibility."""
    lms = [_lm(0.5, 0.5, 0.0) for _ in range(33)]
    lms[23], lms[25], lms[27] = _lm(0.5, 0.4), _lm(0.5, 0.6), _lm(0.7, 0.6)
    lms[24], lms[26], lms[28] = (
        _lm(0.4, 0.4, right_visibility),
        _lm(0.4, 0.6, right_visibility),
        _lm(0.6, 0.6, right_visibility),
    )
    return lms


def _run_with_fake_landmarker(monkeypatch, tmp_path, right_visibility):
    path = tmp_path / "blank.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 25, (640, 480))
    for _ in range(10):
        writer.write(np.zeros((480, 640, 3), np.uint8))
    writer.release()

    class FakeLandmarker:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def detect_for_video(self, image, timestamp_ms):
            return SimpleNamespace(pose_landmarks=[_landmarks(right_visibility)])

    monkeypatch.setattr(pose.vision.PoseLandmarker, "create_from_options", lambda options: FakeLandmarker())
    return pose.analyze_video(path)


def test_occluded_leg_is_null_not_zero(monkeypatch, tmp_path):
    result = _run_with_fake_landmarker(monkeypatch, tmp_path, right_visibility=0.1)
    assert result["status"] == "ok"
    assert result["right_knee_min_angle"] is None  # never 0
    assert abs(result["left_knee_min_angle"] - 90.0) < 0.5
    # A leg that was never visible has no rep data at all
    assert result["right_knee_rep_min_angles"] == []
    assert result["right_knee_mean_rep_min_angle"] is None


def test_constant_angle_falls_back_to_overall_minimum(monkeypatch, tmp_path):
    result = _run_with_fake_landmarker(monkeypatch, tmp_path, right_visibility=0.99)
    assert result["rep_count"] == 0
    assert result["rep_detection"] == "fallback_overall_min"
    assert result["left_knee_rep_min_angles"] == []
    assert result["left_knee_mean_rep_min_angle"] == result["left_knee_min_angle"]


def test_both_legs_visible_gives_two_angles(monkeypatch, tmp_path):
    result = _run_with_fake_landmarker(monkeypatch, tmp_path, right_visibility=0.99)
    assert result["status"] == "ok"
    assert abs(result["left_knee_min_angle"] - 90.0) < 0.5
    assert abs(result["right_knee_min_angle"] - 90.0) < 0.5


def test_downscale_keeps_aspect_ratio_and_caps_longer_side():
    out = pose._downscale(np.zeros((2160, 4096, 3), np.uint8))
    assert max(out.shape[:2]) == pose.MAX_SIDE
    assert abs(out.shape[1] / out.shape[0] - 4096 / 2160) < 0.01


def test_downscale_leaves_small_frames_alone():
    frame = np.zeros((480, 640, 3), np.uint8)
    assert pose._downscale(frame) is frame
