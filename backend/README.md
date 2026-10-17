# GaitGuard backend (video input + pose estimation + knee angle)

A small Python HTTP API. It takes a phone video of an athlete, runs MediaPipe pose estimation, and returns the minimum (deepest) knee flexion angle for each leg.

## Setup (Windows / PowerShell)

> **Python version:** MediaPipe does not support Python 3.14. Use Python 3.11 via the `py` launcher.

```powershell
cd backend
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python download_model.py        # saves models/pose_landmarker_lite.task
```

If PowerShell blocks activation, skip it and call `.\venv\Scripts\python.exe` directly.

## Run the server

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

- `GET http://localhost:8000/health` -> `{"status":"ok"}`
- Interactive docs: `http://localhost:8000/docs`

## Test without the server

```powershell
python test_local.py sample.mp4
```

Recording tip for `sample.mp4`: side view, full body in frame, 2-3 m from the camera, 5-10 s of squats. (Videos are git-ignored.)

## Call /analyze

```bash
curl -X POST http://localhost:8000/analyze -F "file=@sample.mp4" -F "movement=squat"
```

`movement` is optional and defaults to `squat`.

## Test from a phone

1. Put the laptop and phone on the same network. Hostel Wi-Fi often blocks device-to-device traffic, so use a **phone hotspot** (connect the laptop to it).
2. Find the laptop's IP: run `ipconfig` and read the **IPv4 Address** of the Wi-Fi adapter (e.g. `192.168.43.10`).
3. Allow port 8000 through Windows Firewall (run PowerShell as Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "GaitGuard API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
   ```
4. Start the server with `--host 0.0.0.0` (as above).
5. On the phone's browser open `http://<laptop-ip>:8000/health`. If you see `{"status":"ok"}`, the app can use `http://<laptop-ip>:8000/analyze`.

## JSON contract (stable - teammates depend on it)

Success:

```json
{
  "status": "ok",
  "movement": "squat",
  "metric": "knee_flexion_angle",
  "unit": "degrees",
  "left_knee_min_angle": 92.4,
  "right_knee_min_angle": 95.1,
  "frames_analyzed": 120,
  "frames_with_pose": 112
}
```

Either `left_knee_min_angle` or `right_knee_min_angle` may be `null` if that leg was never clearly visible. A smaller angle means a deeper knee bend.

Failure (returned with HTTP 200, never a 500):

```json
{ "status": "error", "reason": "cannot_open_video" }
```

`reason` is one of:

| reason | meaning |
| --- | --- |
| `cannot_open_video` | the file isn't a readable video |
| `no_pose_detected` | no person was found in any analyzed frame |
| `legs_not_visible` | a person was found but hip/knee/ankle were never clearly visible on either side |

## How it works

1. OpenCV reads the video (every 2nd frame, first 15 s only).
2. Each frame is converted BGR -> RGB and given to MediaPipe PoseLandmarker (Tasks API, video mode).
3. For each leg, hip/knee/ankle landmarks are converted to pixels and `joint_angle()` computes the angle at the knee. Frames where any of the three points has visibility <= 0.5 are skipped for that leg.
4. The minimum angle per leg is returned.
