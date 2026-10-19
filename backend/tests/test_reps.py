"""Tests for rep detection on synthetic knee-angle series (no video needed)."""
import math

import numpy as np

import reps

SPS = 12.5      # samples per second: 25 fps analyzed every 2nd frame
STAND = 170.0
N = 26          # samples per squat (~2 s); even N puts the bottom exactly on a sample


def squat(bottom, n=N, stand=STAND):
    """One squat: stand -> bottom -> stand, as a cosine. The lowest sample equals `bottom`."""
    return [stand - (stand - bottom) * 0.5 * (1 - math.cos(2 * math.pi * k / n)) for k in range(n)]


def series(bottoms, pad=6):
    """Several squats separated by `pad` standing samples."""
    out = [STAND] * pad
    for b in bottoms:
        out += squat(b) + [STAND] * pad
    return out


# --- helpers -----------------------------------------------------------------------------------

def test_short_gap_is_filled_linearly():
    assert reps.fill_short_gaps([10, None, None, None, 50]) == [10, 20, 30, 40, 50]


def test_long_gap_is_left_as_a_break():
    assert reps.fill_short_gaps([10, None, None, None, None, 50]) == [10, None, None, None, None, 50]


def test_gaps_at_the_ends_are_not_filled():
    assert reps.fill_short_gaps([None, None, 10, 20, None]) == [None, None, 10, 20, None]


def test_smooth_is_a_centered_window_of_five():
    out = reps.smooth([0, 0, 10, 0, 0, 0, 0])
    assert out[2] == 2.0            # (0+0+10+0+0)/5
    assert out[3] == 2.0            # centered on index 3: (0+10+0+0+0)/5


def test_smooth_keeps_none():
    assert reps.smooth([1, None, 3])[1] is None


# --- rep detection -----------------------------------------------------------------------------

def test_three_clean_dips_give_three_reps_with_correct_minima_and_mean():
    summary = reps.summarize_leg(series([60.0, 65.0, 70.0]), SPS)
    assert summary["rep_mins"] == [60.0, 65.0, 70.0]
    assert summary["mean_rep_min"] == 65.0
    assert summary["overall_min"] == 60.0
    assert summary["used_fallback"] is False


def test_noisy_series_still_gives_three_reps():
    rng = np.random.default_rng(1)
    noisy = [v + rng.normal(0, 2.0) for v in series([60.0, 65.0, 70.0])]
    summary = reps.summarize_leg(noisy, SPS)
    assert len(summary["rep_mins"]) == 3
    for found, truth in zip(summary["rep_mins"], [60.0, 65.0, 70.0]):
        assert abs(found - truth) < 6.0
    assert abs(summary["mean_rep_min"] - 65.0) < 4.0


def test_rep_minimum_comes_from_raw_not_smoothed_values():
    data = series([60.0, 65.0, 70.0])
    bottom = 6 + N // 2                     # index of the first squat's lowest sample
    data[bottom] = 52.0                     # a sharp one-sample spike deeper than the smoothed curve
    smoothed_min = min(reps.smooth(data)[bottom - 2: bottom + 3])
    assert smoothed_min > 55.0              # smoothing would have hidden the spike
    assert reps.summarize_leg(data, SPS)["rep_mins"][0] == 52.0


def test_dips_less_than_a_second_apart_count_as_one_rep():
    close = [STAND] * 6 + squat(60.0, n=10) + squat(62.0, n=10) + [STAND] * 6   # ~0.8 s each
    assert len(reps.summarize_leg(close, SPS)["rep_mins"]) == 1


def test_shallow_wobble_below_prominence_is_not_a_rep():
    shallow = series([150.0, 150.0, 150.0])          # only 20 degrees deep
    summary = reps.summarize_leg(shallow, SPS)
    assert summary["rep_mins"] == []


def test_no_dips_falls_back_to_overall_minimum():
    flat = [STAND + (i % 3) for i in range(60)]
    summary = reps.summarize_leg(flat, SPS)
    assert summary["rep_mins"] == []
    assert summary["used_fallback"] is True
    assert summary["overall_min"] == 170.0
    assert summary["mean_rep_min"] == 170.0          # fallback: the mean is the overall minimum


def test_leg_that_is_never_visible_has_no_numbers():
    summary = reps.summarize_leg([None] * 30, SPS)
    assert summary == {"overall_min": None, "rep_mins": [], "mean_rep_min": None, "used_fallback": False}


# --- gaps --------------------------------------------------------------------------------------

def test_short_gaps_inside_a_dip_do_not_break_the_rep():
    data = series([60.0, 65.0, 70.0])
    for i in (6 + 11, 6 + 12, 6 + 13):               # 3 samples missing right at the first bottom
        data[i] = None
    summary = reps.summarize_leg(data, SPS)
    assert len(summary["rep_mins"]) == 3
    # The minimum is a real measurement, never an interpolated one, so it is a bit shallower than 60
    assert 60.0 < summary["rep_mins"][0] < 70.0


def test_long_gap_between_reps_keeps_both_reps():
    first, second = series([60.0]), series([65.0])
    summary = reps.summarize_leg(first + [None] * 8 + second, SPS)
    assert summary["rep_mins"] == [60.0, 65.0]


def test_dip_cut_off_at_a_gap_edge_is_not_counted():
    # The leg disappears exactly at the bottom of the second squat. Detection needs samples on
    # both sides of a dip, so that rep is missed (documented limitation).
    data = series([60.0])
    second = squat(65.0)[: N // 2 + 1]               # descent only, ends at the bottom
    summary = reps.summarize_leg(data + second + [None] * 10, SPS)
    assert summary["rep_mins"] == [60.0]
    assert summary["overall_min"] == 60.0


def test_all_values_are_rounded_to_one_decimal():
    summary = reps.summarize_leg(series([60.04, 65.06, 70.0]), SPS)
    for value in summary["rep_mins"] + [summary["mean_rep_min"], summary["overall_min"]]:
        assert value == round(value, 1)
