from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

from angles import joint_angle

MODEL_PATH = Path(__file__).parent / "models" / "pose_landmarker_lite.task"

FRAME_STEP = 2          # analyze every 2nd frame
MAX_SECONDS = 15        # ignore anything after the first 15 s of video
MIN_VISIBILITY = 0.5    # landmark must be at least this "visible" to be trusted
MAX_SIDE = 960          # downscale frames so the longer side is at most this many pixels

# MediaPipe landmark indices: (hip, knee, ankle)
LEFT_LEG = (23, 25, 27)
RIGHT_LEG = (24, 26, 28)


def _knee_angle(landmarks, leg, width, height):
    """Knee angle for one leg in one frame, or None if the leg isn't clearly visible."""
    points = [landmarks[i] for i in leg]
    if any(p.visibility is None or p.visibility <= MIN_VISIBILITY for p in points):
        return None
    # Landmarks are normalized (0..1); convert to pixels so the angle isn't distorted
    hip, knee, ankle = [(p.x * width, p.y * height) for p in points]
    return joint_angle(hip, knee, ankle)


def _downscale(frame):
    """Shrink a frame so its longer side is at most MAX_SIDE, keeping the aspect ratio."""
    height, width = frame.shape[:2]
    longest = max(height, width)
    if longest <= MAX_SIDE:
        return frame
    scale = MAX_SIDE / longest
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)


def analyze_video(path):
    """Run pose estimation on a video and return the result dict (see README for the contract)."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return {"status": "error", "reason": "cannot_open_video"}

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0:
        fps = 30  # some phone videos don't report fps

    options = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=vision.RunningMode.VIDEO,
    )

    frames_analyzed = 0
    frames_with_pose = 0
    left_angles = []
    right_angles = []

    try:
        with vision.PoseLandmarker.create_from_options(options) as landmarker:
            frame_idx = 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if frame_idx / fps > MAX_SECONDS:
                    break

                if frame_idx % FRAME_STEP == 0:
                    frame = _downscale(frame)
                    height, width = frame.shape[:2]  # resized size, used for the angle maths
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # OpenCV gives BGR, MediaPipe wants RGB
                    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    timestamp_ms = int(frame_idx * 1000 / fps)  # must strictly increase
                    result = landmarker.detect_for_video(image, timestamp_ms)
                    frames_analyzed += 1

                    if result.pose_landmarks:
                        frames_with_pose += 1
                        landmarks = result.pose_landmarks[0]  # first (only) person
                        left = _knee_angle(landmarks, LEFT_LEG, width, height)
                        right = _knee_angle(landmarks, RIGHT_LEG, width, height)
                        if left is not None:
                            left_angles.append(left)
                        if right is not None:
                            right_angles.append(right)

                frame_idx += 1

    finally:
        cap.release()  # always free the file, even on error (Windows can't delete open files)

    if frames_with_pose == 0:
        return {"status": "error", "reason": "no_pose_detected"}
    if not left_angles and not right_angles:
        return {"status": "error", "reason": "legs_not_visible"}

    return {
        "status": "ok",
        "metric": "knee_flexion_angle",
        "unit": "degrees",
        # Smallest angle = deepest knee bend
        "left_knee_min_angle": round(min(left_angles), 1) if left_angles else None,
        "right_knee_min_angle": round(min(right_angles), 1) if right_angles else None,
        "frames_analyzed": frames_analyzed,
        "frames_with_pose": frames_with_pose,
    }
