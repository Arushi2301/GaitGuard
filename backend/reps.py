"""Rep detection on a knee-angle series: per-rep minima, then their mean.

A series is a list with one entry per analyzed frame: the angle in degrees, or None when the
leg wasn't visible in that frame. Everything here is plain lists/numbers, so it can be tested
without a video or MediaPipe.
"""
import numpy as np
from scipy.signal import find_peaks

MAX_GAP = 3             # fill gaps of up to this many samples by linear interpolation
SMOOTH_WINDOW = 5       # centered moving average, in samples
MIN_PROMINENCE = 30.0   # a dip must be at least this many degrees below the surrounding standing level
MIN_REP_SECONDS = 1.0   # dips closer together than this count as the same rep


def fill_short_gaps(series, max_gap=MAX_GAP):
    """Linearly interpolate runs of None up to max_gap long. Longer runs, and runs at the very
    start or end (nothing to interpolate from), stay None."""
    filled = list(series)
    i = 0
    while i < len(filled):
        if filled[i] is not None:
            i += 1
            continue
        j = i
        while j < len(filled) and filled[j] is None:
            j += 1
        if i > 0 and j < len(filled) and j - i <= max_gap:
            before, after = filled[i - 1], filled[j]
            for k in range(i, j):
                filled[k] = before + (after - before) * (k - i + 1) / (j - i + 1)
        i = j
    return filled


def smooth(series, window=SMOOTH_WINDOW):
    """Centered moving average. None stays None; near gaps and the ends the average uses
    whatever neighbors exist."""
    half = window // 2
    smoothed = []
    for i, value in enumerate(series):
        if value is None:
            smoothed.append(None)
            continue
        neighbors = [v for v in series[max(0, i - half): i + half + 1] if v is not None]
        smoothed.append(sum(neighbors) / len(neighbors))
    return smoothed


def _runs(series):
    """(start, end) index pairs of the stretches without None. Gaps are breaks, never bridged."""
    runs, start = [], None
    for i, value in enumerate(series):
        if value is not None and start is None:
            start = i
        elif value is None and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(series)))
    return runs


def rep_minima(raw, samples_per_second):
    """Deepest raw angle of every detected rep, in time order (empty if no reps were found).

    Steps: fill short gaps -> smooth -> find dips (find_peaks on the negated signal) -> for each
    dip take the minimum of the RAW angles around it, so smoothing can't hide the real depth.
    A rep's window runs from halfway to the previous dip to halfway to the next one.
    """
    smoothed = smooth(fill_short_gaps(raw))
    min_distance = max(1, round(MIN_REP_SECONDS * samples_per_second))
    minima = []
    for start, end in _runs(smoothed):
        segment = np.array(smoothed[start:end])
        dips, _ = find_peaks(-segment, prominence=MIN_PROMINENCE, distance=min_distance)
        for n, dip in enumerate(dips):
            lo = start if n == 0 else start + (dips[n - 1] + dip) // 2
            hi = end if n == len(dips) - 1 else start + (dip + dips[n + 1]) // 2 + 1
            window = [v for v in raw[lo:hi] if v is not None]
            if window:
                minima.append(min(window))
    return minima


def summarize_leg(raw, samples_per_second):
    """Summary for one leg.

    Returns overall_min (None if the leg was never visible), rep_mins (rounded list),
    mean_rep_min, and used_fallback. When no reps are found the mean falls back to the overall
    minimum and used_fallback is True; a leg that was never visible has no mean at all.
    """
    visible = [v for v in raw if v is not None]
    if not visible:
        return {"overall_min": None, "rep_mins": [], "mean_rep_min": None, "used_fallback": False}

    overall_min = round(min(visible), 1)
    minima = [round(m, 1) for m in rep_minima(raw, samples_per_second)]
    if minima:
        return {
            "overall_min": overall_min,
            "rep_mins": minima,
            "mean_rep_min": round(sum(minima) / len(minima), 1),
            "used_fallback": False,
        }
    return {"overall_min": overall_min, "rep_mins": [], "mean_rep_min": overall_min, "used_fallback": True}
