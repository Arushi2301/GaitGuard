import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))  # so tests can `import main`, `import pose`, ...

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
SAMPLE_VIDEO = BACKEND_DIR / "sample.mp4"

needs_sample = pytest.mark.skipif(not SAMPLE_VIDEO.exists(), reason="backend/sample.mp4 is missing")


@pytest.fixture(scope="session")
def fixtures_dir():
    FIXTURES_DIR.mkdir(exist_ok=True)
    return FIXTURES_DIR
