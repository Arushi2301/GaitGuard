"""Run the analysis on a video file without the server.

Usage:  python test_local.py path\\to\\video.mp4
"""
import json
import sys

from pose import analyze_video

if len(sys.argv) != 2:
    print("Usage: python test_local.py <video_path>")
    sys.exit(1)

print(json.dumps(analyze_video(sys.argv[1]), indent=2))
