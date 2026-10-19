"""Evidence script: annotate the deepest-squat frame of sample.mp4 and print frame statistics.

Usage:  python scripts/left_right_check.py [video] [output.png]
Defaults: sample.mp4 -> evidence/left_right_check.png
"""
import sys
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pose  # noqa: E402

video = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND_DIR / "sample.mp4"
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else BACKEND_DIR / "evidence" / "left_right_check.png"

LEFT_COLOR = (0, 200, 0)     # BGR green
RIGHT_COLOR = (0, 0, 255)    # BGR red

cap = cv2.VideoCapture(str(video))
fps = cap.get(cv2.CAP_PROP_FPS) or 30
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = total_frames / fps
print(f"video: {video.name}  size={int(cap.get(3))}x{int(cap.get(4))}  fps={fps}  frames={total_frames}  duration={duration:.2f}s")

options = vision.PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=str(pose.MODEL_PATH)),
    running_mode=vision.RunningMode.VIDEO,
)

best = None  # (score, frame, landmarks, left_angle, right_angle, frame_idx)
analyzed = 0
with_pose = 0
vis_sum = {"left": 0.0, "right": 0.0}
vis_n = 0
null_left = null_right = 0

with vision.PoseLandmarker.create_from_options(options) as landmarker:
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok or idx / fps > pose.MAX_SECONDS:
            break
        if idx % pose.FRAME_STEP == 0:
            frame = pose._downscale(frame)
            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = landmarker.detect_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(idx * 1000 / fps)
            )
            analyzed += 1
            if result.pose_landmarks:
                with_pose += 1
                lms = result.pose_landmarks[0]
                left = pose._knee_angle(lms, pose.LEFT_LEG, w, h)
                right = pose._knee_angle(lms, pose.RIGHT_LEG, w, h)
                null_left += left is None
                null_right += right is None
                vis_sum["left"] += sum(lms[i].visibility for i in pose.LEFT_LEG) / 3
                vis_sum["right"] += sum(lms[i].visibility for i in pose.RIGHT_LEG) / 3
                vis_n += 1
                angles = [a for a in (left, right) if a is not None]
                if angles:
                    score = min(angles)  # deepest bend of either leg
                    if best is None or score < best[0]:
                        best = (score, frame.copy(), lms, left, right, idx)
        idx += 1
cap.release()

expected = min(duration, pose.MAX_SECONDS) * fps / pose.FRAME_STEP
print(f"frames_analyzed={analyzed}  frames_with_pose={with_pose}")
print(f"expected ~ min(duration, {pose.MAX_SECONDS}s) x fps / {pose.FRAME_STEP} = {expected:.1f}")
print(f"mean visibility (hip/knee/ankle) left={vis_sum['left'] / vis_n:.2f} right={vis_sum['right'] / vis_n:.2f}")
print(f"frames with null angle: left={null_left} right={null_right} (of {with_pose} frames with pose)")

score, frame, lms, left, right, frame_idx = best
h, w = frame.shape[:2]
nose_x, hip_x = lms[0].x, (lms[23].x + lms[24].x) / 2
print(f"deepest frame idx={frame_idx} (t={frame_idx / fps:.2f}s)  left={left}  right={right}")
print(f"nose x={nose_x:.2f} vs mid-hip x={hip_x:.2f} -> person faces image-{'right' if nose_x > hip_x else 'left'}")


def draw_leg(leg, color, label, angle):
    pts = [(int(lms[i].x * w), int(lms[i].y * h)) for i in leg]
    cv2.line(frame, pts[0], pts[1], color, 4)
    cv2.line(frame, pts[1], pts[2], color, 4)
    for p in pts:
        cv2.circle(frame, p, 8, color, -1)
    text = f"{label}: {angle:.1f} deg" if angle is not None else f"{label}: null"
    # Label next to the knee, offset so L and R do not overlap
    x, y = pts[1]
    offset = -230 if label == "L" else 20
    cv2.putText(frame, text, (max(5, x + offset), y), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 5)
    cv2.putText(frame, text, (max(5, x + offset), y), cv2.FONT_HERSHEY_SIMPLEX, 1.1, color, 2)


draw_leg(pose.LEFT_LEG, LEFT_COLOR, "L", left)
draw_leg(pose.RIGHT_LEG, RIGHT_COLOR, "R", right)
cv2.putText(frame, "L = MediaPipe landmarks 23/25/27 (green)   R = 24/26/28 (red)", (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
out_path.parent.mkdir(exist_ok=True)
cv2.imwrite(str(out_path), frame)
print(f"saved {out_path}")
