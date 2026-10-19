"""API tests against the FastAPI app (no server needed; uses TestClient)."""
import os

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

import main
from conftest import SAMPLE_VIDEO, needs_sample

client = TestClient(main.app)

CONTRACT_KEYS = [
    "status", "movement", "metric", "unit",
    "left_knee_min_angle", "right_knee_min_angle",
    "frames_analyzed", "frames_with_pose",
    "left_knee_rep_min_angles", "right_knee_rep_min_angles",
    "left_knee_mean_rep_min_angle", "right_knee_mean_rep_min_angle",
    "rep_count", "rep_detection",
]


def _post(path, movement=None):
    data = {"movement": movement} if movement is not None else {}
    with open(path, "rb") as f:
        return client.post("/analyze", files={"file": (path.name, f, "video/mp4")}, data=data)


def _write_video(path, frames, fps=25, size=(640, 480)):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
    assert writer.isOpened(), "OpenCV could not open a video writer for the test fixture"
    for frame in frames:
        writer.write(frame)
    writer.release()


def _make_clip_from_sample(out_path, seconds, crop_top_fraction=None):
    """Copy the first `seconds` of sample.mp4 (downscaled), optionally keeping only the top part of each frame."""
    cap = cv2.VideoCapture(str(SAMPLE_VIDEO))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    writer = None
    for _ in range(int(seconds * fps)):
        ok, frame = cap.read()
        if not ok:
            break
        h, w = frame.shape[:2]
        scale = 960 / max(h, w)
        frame = cv2.resize(frame, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
        if crop_top_fraction:
            frame = frame[: int(frame.shape[0] * crop_top_fraction)]
        if writer is None:
            writer = cv2.VideoWriter(
                str(out_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (frame.shape[1], frame.shape[0])
            )
        writer.write(frame)
    cap.release()
    writer.release()


@pytest.fixture(scope="module")
def sample_response():
    """One real /analyze call on sample.mp4, shared by several tests (it takes ~15 s)."""
    return _post(SAMPLE_VIDEO)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@needs_sample
def test_valid_video_returns_full_contract(sample_response):
    assert sample_response.status_code == 200
    body = sample_response.json()
    assert body["status"] == "ok"
    assert set(body) == set(CONTRACT_KEYS)
    assert body["unit"] == "degrees"
    assert body["metric"] == "knee_flexion_angle"
    for key in ("left_knee_min_angle", "right_knee_min_angle"):
        assert body[key] is None or (isinstance(body[key], (int, float)) and 0 <= body[key] <= 180)
    assert 0 < body["frames_analyzed"]
    assert body["frames_with_pose"] <= body["frames_analyzed"]


@needs_sample
def test_valid_video_rep_fields(sample_response):
    body = sample_response.json()
    assert body["rep_detection"] in ("ok", "fallback_overall_min")
    assert isinstance(body["rep_count"], int) and body["rep_count"] >= 0
    for side in ("left", "right"):
        rep_mins = body[f"{side}_knee_rep_min_angles"]
        mean = body[f"{side}_knee_mean_rep_min_angle"]
        overall_min = body[f"{side}_knee_min_angle"]
        assert isinstance(rep_mins, list)
        if overall_min is None:
            assert rep_mins == [] and mean is None
        else:
            # The overall minimum keeps its old meaning: nothing can be deeper than it
            assert all(overall_min <= m <= 180 for m in rep_mins)
            assert overall_min <= mean <= 180


@needs_sample
def test_sample_video_has_two_squats(sample_response):
    # Two squats are visible in the first 15 s (bottoms at about 3 s and 10 s)
    body = sample_response.json()
    assert body["rep_count"] == 2
    assert body["rep_detection"] == "ok"
    assert len(body["right_knee_rep_min_angles"]) == 2


@needs_sample
def test_valid_video_keys_are_in_documented_order(sample_response):
    assert list(sample_response.json()) == CONTRACT_KEYS


@needs_sample
def test_movement_defaults_to_squat(sample_response):
    assert sample_response.json()["movement"] == "squat"


@needs_sample
def test_custom_movement_is_echoed(fixtures_dir):
    clip = fixtures_dir / "short_sample.mp4"
    _make_clip_from_sample(clip, seconds=2)
    body = _post(clip, movement="drop-jump").json()
    assert body["status"] == "ok"
    assert body["movement"] == "drop-jump"


def test_black_video_gives_no_pose_detected(fixtures_dir):
    path = fixtures_dir / "black.mp4"
    _write_video(path, [np.zeros((480, 640, 3), np.uint8)] * 50)
    response = _post(path)
    assert response.status_code == 200
    assert response.json() == {"status": "error", "reason": "no_pose_detected"}


@needs_sample
def test_upper_body_only_video_gives_legs_not_visible(fixtures_dir):
    path = fixtures_dir / "upper_body.mp4"
    _make_clip_from_sample(path, seconds=4, crop_top_fraction=0.45)
    response = _post(path)
    assert response.status_code == 200
    assert response.json() == {"status": "error", "reason": "legs_not_visible"}


def test_random_bytes_give_cannot_open_video(fixtures_dir):
    path = fixtures_dir / "random_bytes.mp4"
    path.write_bytes(np.random.default_rng(0).bytes(4096))
    response = _post(path)
    assert response.status_code == 200
    assert response.json() == {"status": "error", "reason": "cannot_open_video"}


def test_unexpected_exception_gives_processing_failed(monkeypatch, fixtures_dir):
    def boom(_path):
        raise RuntimeError("simulated failure")

    monkeypatch.setattr(main, "analyze_video", boom)
    path = fixtures_dir / "any.mp4"
    path.write_bytes(b"anything")
    response = _post(path)
    assert response.status_code == 200  # contract: errors are never a 500
    assert response.json() == {"status": "error", "reason": "processing_failed"}


def test_missing_file_field_returns_422():
    # Current behavior (documented, not changed): FastAPI's default validation error, not our error JSON
    response = client.post("/analyze", data={"movement": "squat"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "file"]


def test_temp_file_is_removed_after_request(monkeypatch, fixtures_dir):
    seen = []

    def spy(path):
        seen.append(path)
        return {"status": "error", "reason": "cannot_open_video"}

    monkeypatch.setattr(main, "analyze_video", spy)
    path = fixtures_dir / "any.mp4"
    path.write_bytes(b"anything")
    _post(path)
    assert seen and not os.path.exists(seen[0])
