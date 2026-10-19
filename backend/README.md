# GaitGuard backend (video input + pose estimation + knee angle)

A small Python HTTP API. It takes a phone video of an athlete, runs MediaPipe pose estimation, and returns the minimum (deepest) knee flexion angle for each leg.

## Backend Status
_Last updated: 2026-10-19_

### ✅ Done
- FastAPI server with `GET /health` and `POST /analyze` (CORS open, temp file always cleaned up)
- MediaPipe PoseLandmarker pose estimation and per-leg knee angle (`joint_angle()`), minimum angle per leg
- Stable error JSON: `cannot_open_video`, `no_pose_detected`, `legs_not_visible`, `processing_failed` (HTTP 200, never a 500)
- Video capture always released, so the temp file can be deleted on Windows
- Real-video test: `test_local.py` and `POST /analyze` agree on a 4K side-view squat (left ~59°, right ~66°)
- Frontend contract check: real `/analyze` responses (ok and `cannot_open_video`) accepted by the frontend's `screening.ts` validator
- Frame downscaling to max 960px: processing time ~36 s → ~14 s on the 4K sample, angles unchanged within 0.3°
- Per-rep results: rep detection (`reps.py`: gap fill, smoothing, dip detection, raw per-rep minima, mean) and 6 new JSON fields; sample video gives 2 reps, matching the 2 squats visible in the first 15 s
- Automated pytest suite in `tests/` (39 tests: angles, API contract, every error code, occlusion → null, rep detection on synthetic series); output in `evidence/pytest_results.txt`
- Left/right verification: annotated deepest-squat frame (`evidence/left_right_check.png`) and frame stats (`evidence/frame_stats.txt`), made by `scripts/left_right_check.py`
- [TESTING.md](TESTING.md): how to run the tests, test-case table, sample results, left/right check, frontend contract check, limitations
- README: setup, JSON contract, phone-testing steps, teammate notes

### 🚧 In progress
- Nothing active right now

### ⏳ Not done yet
- Live test from a phone through the app
- Database (only if the team picks the database route)

### ⚠️ Known limitations
- Only knee angle is measured; `movement` is echoed back but not used
- First 15 s of video only
- Single camera, no depth: angles come from 2D positions, so camera angle and distance affect them
- Far leg may be null in side view (occlusion); a rep cut off exactly at a visibility gap is missed on that leg (sample video: left leg 1 rep, right leg 2)
- Rep detection assumes a 30°+ dip and at least 1 s between reps; fast or shallow reps fall back to the overall minimum
- API URL depends on the laptop's LAN IP (hardcoded in `frontend/src/constants/config.ts`)
- Angle convention: interior angle (180° = straight); clinical knee flexion = 180 − angle

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

## Run the automated tests

```powershell
.\venv\Scripts\python.exe -m pytest -v
```

Details, the test-case table and the evidence are in [TESTING.md](TESTING.md).

## Test without the server

```powershell
python test_local.py sample.mp4
```

Recording tip for `sample.mp4`: side view, full body in frame, 2-3 m from the camera, 5-10 s of squats. (Videos are git-ignored.)

## Sample video

Test video: ["A Woman Doing Squats" by MART PRODUCTION on Pexels](https://www.pexels.com/video/a-woman-doing-squats-8837118/) (free license).

1. Download it and save it as `backend/sample.mp4` (it is git-ignored, so it is not in the repo).
2. Run:
   ```powershell
   .\venv\Scripts\python.exe test_local.py sample.mp4
   ```
3. Expected result: `status: "ok"`, with left/right minimum knee angles of roughly 59 and 65 degrees (a deep squat). Only the first 15 s are analyzed.

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
  "frames_with_pose": 112,
  "left_knee_rep_min_angles": [92.4, 94.0],
  "right_knee_rep_min_angles": [95.1, 96.3],
  "left_knee_mean_rep_min_angle": 93.2,
  "right_knee_mean_rep_min_angle": 95.7,
  "rep_count": 2,
  "rep_detection": "ok"
}
```

Either `left_knee_min_angle` or `right_knee_min_angle` may be `null` if that leg was never clearly visible. A smaller angle means a deeper knee bend.

The first eight fields are the original contract and keep their meaning (`*_knee_min_angle` is still the overall minimum over the whole video). The last six were added for per-rep results; existing clients can ignore them (the frontend's `screening.ts` reads only named fields, so extra fields do not make it reject the response).

| field | meaning |
| --- | --- |
| `left_knee_rep_min_angles`, `right_knee_rep_min_angles` | deepest angle of each detected rep, in time order, rounded to 1 decimal; `[]` if no reps were found or the leg was never visible |
| `left_knee_mean_rep_min_angle`, `right_knee_mean_rep_min_angle` | mean of that leg's per-rep minima; if no reps were found it falls back to the overall minimum; `null` if the leg was never visible |
| `rep_count` | number of reps detected on the leg that was visible in more frames (ties go to the left) |
| `rep_detection` | `"ok"`, or `"fallback_overall_min"` if any leg that was measured had no reps detected (check its `*_rep_min_angles` for which one) |

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
| `processing_failed` | unexpected server-side error (the traceback is printed in the server console) |

## Tested on real video

The pipeline was verified end to end on a real side-view squat video (4K, 25 fps, ~30 s): both `test_local.py` and `POST /analyze` returned the same result (`status: ok`, left min ~59 deg, right min ~66 deg, pose found in every analyzed frame).

Things to expect:
- Only the first 15 s of a video are analyzed, so longer clips are truncated.
- In a side view the far leg is partly hidden, so its knee may be usable in fewer frames. Those frames are skipped, and the angle is `null` only if the leg is never visible.
- A very deep squat can give angles below 70 deg; that is a real reading, not an error.

## How it works

1. OpenCV reads the video (every 2nd frame, first 15 s only).
2. Each frame is shrunk so its longer side is at most 960 px (aspect ratio kept), converted BGR -> RGB and given to MediaPipe PoseLandmarker (Tasks API, video mode).
3. For each leg, hip/knee/ankle landmarks are converted to pixels and `joint_angle()` computes the angle at the knee. Frames where any of the three points has visibility <= 0.5 are skipped for that leg.
4. The overall minimum angle per leg is returned (`left_knee_min_angle`, `right_knee_min_angle`).
5. Reps are found per leg in `reps.py`, from the series of per-frame angles (`None` where the leg wasn't visible):
   1. Gaps of up to 3 samples are filled by linear interpolation; longer gaps stay as breaks.
   2. The series is smoothed with a centered moving average (5 samples).
   3. Dips are found with `scipy.signal.find_peaks` on the negated signal: each dip must be at least 30° below the surrounding standing level (prominence) and dips must be at least 1 s apart. Each unbroken stretch of the series is searched on its own.
   4. For each dip, the minimum of the **raw** (unsmoothed) angles around it is taken, so smoothing can't hide the real depth. A rep's window runs from halfway to the previous dip to halfway to the next.
   5. The mean of those per-rep minima is reported. If no reps are found, the overall minimum is used instead and `rep_detection` says `"fallback_overall_min"`.
   - A dip that sits exactly at the edge of a visibility gap (the leg disappears at the bottom of the squat) can't be detected, because a dip needs samples on both sides. That rep is missed on that leg; the overall minimum still includes it.

## Notes for teammates

### For the frontend (Member 1)

- POST the video to `http://<laptop-ip>:8000/analyze` as multipart form data: field `file` (the video) and optional `movement` (default `"squat"`).
- Don't set the `Content-Type` header manually; let the HTTP client add it, because it needs the multipart boundary.
- Phone and laptop must be on the same network (use a phone hotspot).
- Record at 1080p, side view, full body visible.

### For the screening logic (Member 3)

- Use `left_knee_min_angle` and `right_knee_min_angle` (degrees). A smaller angle means a deeper knee bend.
- Either angle can be `null` if that leg wasn't visible. Handle that case.
- If `status` is `"error"`:
  - `cannot_open_video`, `no_pose_detected` or `legs_not_visible`: ask the user to re-record.
  - `processing_failed`: show "Analysis failed, please try again".
