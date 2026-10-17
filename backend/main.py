import logging
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from pose import analyze_video

logger = logging.getLogger("uvicorn.error")  # shows up in the uvicorn console

app = FastAPI(title="GaitGuard pose API")

# Open CORS so any frontend (web or mobile dev server) can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Plain `def` (not async): FastAPI runs it in a worker thread, so the slow
# video processing doesn't block the server.
@app.post("/analyze")
def analyze(file: UploadFile = File(...), movement: str = Form("squat")):
    # OpenCV needs a real file on disk, so save the upload to a temp file first
    suffix = Path(file.filename or "").suffix or ".mp4"
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
        result = analyze_video(temp_path)
    except Exception:
        # Anything unexpected: print the full traceback for us, give the client a stable error
        logger.exception("analyze failed")
        result = {"status": "error", "reason": "processing_failed"}
    finally:
        os.remove(temp_path)  # always clean up

    if result["status"] == "ok":
        # Build in the documented key order: status, movement, then the rest
        result = {"status": "ok", "movement": movement, **{k: v for k, v in result.items() if k != "status"}}
    return result
