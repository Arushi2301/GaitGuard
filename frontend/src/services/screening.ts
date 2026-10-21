export type AnalysisResult =
  | { ok: true; data: any }
  | { ok: false; reason: string };

export interface ValidatedMeasurement {
  movement: string;
  metric: string;
  unit: string;
  leftKneeMinAngle: number | null;
  rightKneeMinAngle: number | null;
  hasLeftAngle: boolean;
  hasRightAngle: boolean;
  framesAnalyzed?: number;
  framesWithPose?: number;
}

export type ScreeningOutcome =
  | { success: true; measurement: ValidatedMeasurement }
  | { success: false; errorMessage: string; reason?: string };

export const ERROR_MESSAGES: Record<string, string> = {
  cannot_open_video: 'Unable to read this video. Please select or record another video.',
  no_pose_detected: 'No person was detected. Please record again with your full body visible.',
  legs_not_visible: 'The legs could not be measured clearly. Please record again with your hips, knees and ankles visible.',
  processing_failed: 'Analysis failed. Please try again.',
};

export const FALLBACK_ERROR_MESSAGE = 'Analysis failed. Please try again.';
export const NETWORK_ERROR_MESSAGE = 'Cannot connect to the server. Please check your network connection and server settings.';
export const TIMEOUT_ERROR_MESSAGE = 'The analysis request timed out. Please try again.';
export const MALFORMED_ERROR_MESSAGE = 'Received an invalid or malformed response from the server. Please try again.';

export const SCIENTIFIC_ASSESSMENT_DISCLAIMER =
  'Injury risk has not been assessed. GaitGuard provides descriptive kinematic measurements only. It does not provide a medical diagnosis, evaluate injury risk, or determine whether an exercise is safe or unsafe. Consult a qualified sports-medicine professional for clinical evaluation.';

/* ---------- Assessment Types ---------- */

export type SquatDepthCategory = 'Deep' | 'Parallel' | 'Half' | 'Shallow' | 'Unmeasured';

export interface SquatAssessment {
  depthCategory: SquatDepthCategory;
  asymmetryDegrees: number | null;
  flags: string[];
  summary: string;
  sources: string[];
  evaluatedKneeAngle: number | null;
  clinicalFlexionDegrees: number | null;
  depthSource: 'mean_rep_min' | 'overall_min' | 'none';
  leftDepthAngle: number | null;
  rightDepthAngle: number | null;
  deeperSide: 'left' | 'right' | 'equal' | null;
  repetitionSpreadDegrees: number | null;
}

export const SQUAT_ASSESSMENT_SOURCES: string[] = [
  'Escamilla, R. F. (2001). Knee biomechanics of the dynamic squat exercise. Medicine & Science in Sports & Exercise, 33(1), 127–141.',
  'Schoenfeld, B. J. (2010). Squatting kinematics and kinetics and their application to exercise performance. Journal of Strength and Conditioning Research, 24(12), 3497–3506.',
  'Hartmann, H., Wirth, K., & Klusemann, M. (2013). Analysis of the load on the knee joint and vertebral column with changes in squatting depth and weight load. Sports Medicine, 43(10), 993–1008.',
  'Bishop, C., Turner, A., & Read, P. (2018). Effects of inter-limb asymmetries on physical and sports performance: a systematic review. Sports Medicine, 48(5), 1131–1145.',
];

export interface LegDepthAssessment {
  interiorAngle: number;
  clinicalFlexionAngle: number;
  description: string;
}

export interface AsymmetryAssessment {
  evaluated: boolean;
  absoluteDifference: number | null;
  deeperSide: 'left' | 'right' | 'equal' | null;
  description: string;
}

export interface RepetitionVariationAssessment {
  evaluated: boolean;
  repCount: number | null;
  spreadDegrees: number | null;
  minRepAngle: number | null;
  maxRepAngle: number | null;
  description: string;
}

export interface RepStatsInput {
  repCount?: number | null;
  leftMeanRepMin?: number | null;
  rightMeanRepMin?: number | null;
  leftRepMins?: number[];
  rightRepMins?: number[];
  repDetection?: string | null;
}

export interface SquatScreeningAssessment {
  movement: 'squat';
  leftLeg: LegDepthAssessment | null;
  rightLeg: LegDepthAssessment | null;
  primaryLeg: LegDepthAssessment | null;
  asymmetry: AsymmetryAssessment;
  repetitionVariation: RepetitionVariationAssessment;
  squatAssessment: SquatAssessment;
  disclaimer: string;
}

/* ---------- Basic Validation Helpers ---------- */

/**
 * Validates whether a value is either null or a finite number between 0 and 180 degrees.
 */
export function isValidKneeAngle(val: unknown): val is number | null {
  if (val === null) {
    return true;
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return false;
  }
  return val >= 0 && val <= 180;
}

/**
 * Validates whether a value is a valid non-negative integer.
 */
export function isValidFrameCount(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0;
}

/**
 * Validates a parsed JSON payload from the backend pose API.
 */
export function validateScreeningResponse(
  raw: unknown,
  fallbackMovement?: string
): ScreeningOutcome {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      success: false,
      errorMessage: MALFORMED_ERROR_MESSAGE,
      reason: 'malformed_response',
    };
  }

  const res = raw as Record<string, unknown>;

  // Check backend error response
  if (res.status === 'error') {
    const reason = typeof res.reason === 'string' ? res.reason : 'processing_failed';
    const errorMessage = ERROR_MESSAGES[reason] || FALLBACK_ERROR_MESSAGE;
    return {
      success: false,
      errorMessage,
      reason,
    };
  }

  // Must have status === 'ok'
  if (res.status !== 'ok') {
    return {
      success: false,
      errorMessage: MALFORMED_ERROR_MESSAGE,
      reason: 'invalid_status',
    };
  }

  // Validate unit ('degrees')
  if (res.unit !== 'degrees') {
    return {
      success: false,
      errorMessage: MALFORMED_ERROR_MESSAGE,
      reason: 'invalid_unit',
    };
  }

  // Validate metric ('knee_flexion_angle')
  if (res.metric !== 'knee_flexion_angle') {
    return {
      success: false,
      errorMessage: MALFORMED_ERROR_MESSAGE,
      reason: 'invalid_metric',
    };
  }

  // Validate left and right knee flexion angles (must be null or finite number 0..180)
  if (!isValidKneeAngle(res.left_knee_min_angle) || !isValidKneeAngle(res.right_knee_min_angle)) {
    return {
      success: false,
      errorMessage: MALFORMED_ERROR_MESSAGE,
      reason: 'invalid_angle_value',
    };
  }

  const leftAngle = res.left_knee_min_angle as number | null;
  const rightAngle = res.right_knee_min_angle as number | null;

  // If both knee angles are null, do not show a successful measurement result
  if (leftAngle === null && rightAngle === null) {
    return {
      success: false,
      errorMessage: ERROR_MESSAGES.legs_not_visible,
      reason: 'legs_not_visible',
    };
  }

  const movement = typeof res.movement === 'string' && res.movement.trim() !== ''
    ? res.movement
    : (fallbackMovement || 'squat');

  const framesAnalyzed = isValidFrameCount(res.frames_analyzed)
    ? res.frames_analyzed
    : undefined;

  const framesWithPose = isValidFrameCount(res.frames_with_pose)
    ? res.frames_with_pose
    : undefined;

  return {
    success: true,
    measurement: {
      movement,
      metric: 'knee_flexion_angle',
      unit: 'degrees',
      leftKneeMinAngle: leftAngle,
      rightKneeMinAngle: rightAngle,
      hasLeftAngle: leftAngle !== null,
      hasRightAngle: rightAngle !== null,
      framesAnalyzed,
      framesWithPose,
    },
  };
}

/**
 * Processes the outcome from the network analysis client, handling transport/network errors
 * before delegating to payload validation.
 */
export function processAnalysisResult(
  result: AnalysisResult,
  fallbackMovement?: string
): ScreeningOutcome {
  if (!result.ok) {
    const rawReason = result.reason || '';
    if (rawReason.includes('timed out')) {
      return {
        success: false,
        errorMessage: TIMEOUT_ERROR_MESSAGE,
        reason: 'timeout',
      };
    }
    if (rawReason.includes('Cannot reach server')) {
      return {
        success: false,
        errorMessage: NETWORK_ERROR_MESSAGE,
        reason: 'network_error',
      };
    }
    return {
      success: false,
      errorMessage: FALLBACK_ERROR_MESSAGE,
      reason: 'request_failed',
    };
  }

  return validateScreeningResponse(result.data, fallbackMovement);
}

/* ---------- Assessment Functions ---------- */

/**
 * Converts a backend interior knee angle (180° = straight leg)
 * to clinical knee flexion angle (0° = straight leg).
 * Returns null if angle is null or outside [0, 180].
 */
export function toClinicalFlexion(interiorAngle: unknown): number | null {
  if (typeof interiorAngle !== 'number' || !Number.isFinite(interiorAngle) || interiorAngle < 0 || interiorAngle > 180) {
    return null;
  }
  return Math.round((180 - interiorAngle) * 10) / 10;
}

/**
 * Assesses a single leg's squat depth as continuous angular measurements.
 * Converts valid interior angles [0, 180] to clinical flexion.
 * Does not emit categorical depth labels (such as deep, parallel, half, or shallow).
 * Returns null for missing (null/undefined), non-finite, or out-of-range values.
 */
export function assessSquatDepth(interiorAngle: unknown): LegDepthAssessment | null {
  const clinicalFlexion = toClinicalFlexion(interiorAngle);
  if (clinicalFlexion === null || typeof interiorAngle !== 'number') {
    return null;
  }

  const roundedInterior = Math.round(interiorAngle * 10) / 10;

  return {
    interiorAngle: roundedInterior,
    clinicalFlexionAngle: clinicalFlexion,
    description: `Knee flexion reached approximately ${clinicalFlexion.toFixed(1)}° (interior angle ${roundedInterior.toFixed(1)}°).`,
  };
}

/**
 * Assesses bilateral knee angle disparity only when both legs have valid measurements.
 * Reports difference in degrees without a fixed normal/abnormal threshold.
 */
export function assessBilateralDifference(
  leftAngle: number | null,
  rightAngle: number | null
): AsymmetryAssessment {
  if (
    typeof leftAngle !== 'number' ||
    !Number.isFinite(leftAngle) ||
    leftAngle < 0 ||
    leftAngle > 180 ||
    typeof rightAngle !== 'number' ||
    !Number.isFinite(rightAngle) ||
    rightAngle < 0 ||
    rightAngle > 180
  ) {
    return {
      evaluated: false,
      absoluteDifference: null,
      deeperSide: null,
      description: 'Bilateral comparison unavailable: only one leg was clearly visible in the video.',
    };
  }

  const diff = Math.round(Math.abs(leftAngle - rightAngle) * 10) / 10;

  if (leftAngle === rightAngle) {
    return {
      evaluated: true,
      absoluteDifference: 0.0,
      deeperSide: 'equal',
      description: `Both knees reached identical measured depth (${leftAngle.toFixed(1)}°).`,
    };
  }

  // Note: smaller interior angle represents deeper flexion
  if (leftAngle < rightAngle) {
    return {
      evaluated: true,
      absoluteDifference: diff,
      deeperSide: 'left',
      description: diff === 0
        ? 'Observed left–right difference rounds to 0.0° at one-decimal precision; the left knee angle was smaller.'
        : `Observed left–right depth difference of ${diff.toFixed(1)}°. Left knee bent ${diff.toFixed(1)}° deeper than right.`,
    };
  }

  return {
    evaluated: true,
    absoluteDifference: diff,
    deeperSide: 'right',
    description: diff === 0
      ? 'Observed left–right difference rounds to 0.0° at one-decimal precision; the right knee angle was smaller.'
      : `Observed left–right depth difference of ${diff.toFixed(1)}°. Right knee bent ${diff.toFixed(1)}° deeper than left.`,
  };
}

/**
 * Assesses repetition depth variation from actual per-repetition minima of a leg.
 * Does not assume rep_count >= 2 guarantees valid minima.
 * Reports observed spread in degrees without a fixed consistency cutoff.
 */
export function assessRepetitionVariation(
  repMins: unknown,
  repDetection: unknown
): RepetitionVariationAssessment {
  if (repDetection === 'fallback_overall_min') {
    return {
      evaluated: false,
      repCount: null,
      spreadDegrees: null,
      minRepAngle: null,
      maxRepAngle: null,
      description: 'Repetition depth variation could not be assessed: the backend reported single-motion fallback because clean repetition dips were not segmented.',
    };
  }

  if (!Array.isArray(repMins)) {
    return {
      evaluated: false,
      repCount: null,
      spreadDegrees: null,
      minRepAngle: null,
      maxRepAngle: null,
      description: 'Repetition depth variation could not be assessed: no repetition data available.',
    };
  }

  const validMins = repMins.filter(
    (a): a is number => typeof a === 'number' && Number.isFinite(a) && a >= 0 && a <= 180
  );

  if (validMins.length < 2) {
    return {
      evaluated: false,
      repCount: validMins.length,
      spreadDegrees: null,
      minRepAngle: validMins[0] !== undefined ? Math.round(validMins[0] * 10) / 10 : null,
      maxRepAngle: validMins[0] !== undefined ? Math.round(validMins[0] * 10) / 10 : null,
      description: 'Repetition depth variation could not be assessed: fewer than 2 valid repetition measurements were available on this leg.',
    };
  }

  const min = Math.min(...validMins);
  const max = Math.max(...validMins);
  const spread = Math.round((max - min) * 10) / 10;

  return {
    evaluated: true,
    repCount: validMins.length,
    spreadDegrees: spread,
    minRepAngle: Math.round(min * 10) / 10,
    maxRepAngle: Math.round(max * 10) / 10,
    description: `Observed repetition depth spread: ${spread.toFixed(1)}° across ${validMins.length} segmented reps (ranging from ${min.toFixed(1)}° to ${max.toFixed(1)}°).`,
  };
}

/**
 * Assesses squat screening kinematics based on published sports-science literature.
 *
 * Requirements:
 * - Determine depth from the mean of per-repetition minimum angles when available;
 *   otherwise, fall back to the overall minimum angle.
 * - Calculate absolute left–right difference only when both corresponding measurements are valid.
 * - If either leg is null or unavailable, skip asymmetry calculation and state that it could not be assessed.
 * - Return plain-language, non-diagnostic wording ("screening result", "consider a professional assessment").
 * - Include a reference list in the returned result.
 * - Do not claim that a result establishes injury, diagnoses a condition, or predicts injury risk.
 */
export function assessSquat(
  measurement?: unknown,
  repStats?: unknown
): SquatAssessment {
  const m = measurement && typeof measurement === 'object' ? (measurement as Record<string, unknown>) : {};
  const r = repStats && typeof repStats === 'object' ? (repStats as Record<string, unknown>) : {};

  // Safe angle extractor: finite number in [0, 180]
  const parseAngle = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 180) {
      return Math.round(v * 10) / 10;
    }
    return null;
  };

  // 1. Resolve Left Leg Angle: rep mean preferred, overall minimum fallback
  const leftMean = parseAngle(r.leftMeanRepMin ?? r.left_knee_mean_rep_min_angle);
  const leftOverall = parseAngle(m.leftKneeMinAngle ?? m.left_knee_min_angle);
  let leftDepthAngle: number | null = null;
  let leftSource: 'mean_rep_min' | 'overall_min' | 'none' = 'none';

  if (leftMean !== null) {
    leftDepthAngle = leftMean;
    leftSource = 'mean_rep_min';
  } else if (leftOverall !== null) {
    leftDepthAngle = leftOverall;
    leftSource = 'overall_min';
  }

  // 2. Resolve Right Leg Angle: rep mean preferred, overall minimum fallback
  const rightMean = parseAngle(r.rightMeanRepMin ?? r.right_knee_mean_rep_min_angle);
  const rightOverall = parseAngle(m.rightKneeMinAngle ?? m.right_knee_min_angle);
  let rightDepthAngle: number | null = null;
  let rightSource: 'mean_rep_min' | 'overall_min' | 'none' = 'none';

  if (rightMean !== null) {
    rightDepthAngle = rightMean;
    rightSource = 'mean_rep_min';
  } else if (rightOverall !== null) {
    rightDepthAngle = rightOverall;
    rightSource = 'overall_min';
  }

  // 3. Determine Evaluated Primary Depth Angle (smaller interior angle = deeper flexion)
  let evaluatedKneeAngle: number | null = null;
  let depthSource: 'mean_rep_min' | 'overall_min' | 'none' = 'none';

  if (leftDepthAngle !== null && rightDepthAngle !== null) {
    if (leftDepthAngle <= rightDepthAngle) {
      evaluatedKneeAngle = leftDepthAngle;
      depthSource = leftSource;
    } else {
      evaluatedKneeAngle = rightDepthAngle;
      depthSource = rightSource;
    }
  } else if (leftDepthAngle !== null) {
    evaluatedKneeAngle = leftDepthAngle;
    depthSource = leftSource;
  } else if (rightDepthAngle !== null) {
    evaluatedKneeAngle = rightDepthAngle;
    depthSource = rightSource;
  }

  // Clinical flexion = 180 - interior angle
  const clinicalFlexionDegrees = evaluatedKneeAngle !== null
    ? Math.round((180 - evaluatedKneeAngle) * 10) / 10
    : null;

  // 4. Determine Depth Category based on published literature (Escamilla 2001, Schoenfeld 2010)
  // Interior <= 70° (flexion >= 110°) -> Deep
  // Interior 70.1°..90.0° (flexion 90°..109.9°) -> Parallel
  // Interior 90.1°..120.0° (flexion 60°..89.9°) -> Half
  // Interior > 120.0° (flexion < 60°) -> Shallow
  let depthCategory: SquatDepthCategory = 'Unmeasured';
  if (evaluatedKneeAngle !== null) {
    if (evaluatedKneeAngle <= 70.0) {
      depthCategory = 'Deep';
    } else if (evaluatedKneeAngle <= 90.0) {
      depthCategory = 'Parallel';
    } else if (evaluatedKneeAngle <= 120.0) {
      depthCategory = 'Half';
    } else {
      depthCategory = 'Shallow';
    }
  }

  // 5. Bilateral Difference & Asymmetry
  let asymmetryDegrees: number | null = null;
  let deeperSide: 'left' | 'right' | 'equal' | null = null;

  if (leftDepthAngle !== null && rightDepthAngle !== null) {
    asymmetryDegrees = Math.round(Math.abs(leftDepthAngle - rightDepthAngle) * 10) / 10;
    if (leftDepthAngle < rightDepthAngle) {
      deeperSide = 'left';
    } else if (rightDepthAngle < leftDepthAngle) {
      deeperSide = 'right';
    } else {
      deeperSide = 'equal';
    }
  }

  // 6. Flags
  const flags: string[] = [];

  if (depthSource === 'mean_rep_min') {
    flags.push('rep_mean_depth_used');
  } else if (depthSource === 'overall_min') {
    flags.push('fallback_depth_used');
  } else {
    flags.push('depth_unmeasured');
  }

  if (leftDepthAngle !== null && rightDepthAngle !== null) {
    if (asymmetryDegrees !== null && asymmetryDegrees >= 10.0) {
      flags.push('asymmetry_noted');
    }
  } else if (leftDepthAngle !== null || rightDepthAngle !== null) {
    flags.push('single_leg_visible');
  }

  const repDetection = r.repDetection ?? r.rep_detection;
  if (repDetection === 'fallback_overall_min') {
    flags.push('rep_detection_fallback');
  }

  // Repetition spread calculation if arrays exist
  let repetitionSpreadDegrees: number | null = null;
  const leftArray = Array.isArray(r.leftRepMins)
    ? r.leftRepMins
    : Array.isArray(r.left_knee_rep_min_angles)
    ? r.left_knee_rep_min_angles
    : [];
  const rightArray = Array.isArray(r.rightRepMins)
    ? r.rightRepMins
    : Array.isArray(r.right_knee_rep_min_angles)
    ? r.right_knee_rep_min_angles
    : [];
  const repList = leftArray.length > 0 ? leftArray : rightArray;
  const validReps = (repList as unknown[]).map(parseAngle).filter((a): a is number => a !== null);
  if (validReps.length >= 2 && repDetection !== 'fallback_overall_min') {
    repetitionSpreadDegrees = Math.round((Math.max(...validReps) - Math.min(...validReps)) * 10) / 10;
  } else if (repDetection !== 'fallback_overall_min' && validReps.length < 2 && validReps.length > 0) {
    flags.push('insufficient_reps');
  }

  const movement = (m.movement ?? m.movement_name ?? '').toString().toLowerCase();
  if (movement && movement !== 'squat') {
    flags.push('unsupported_movement');
  }

  // 7. Plain-Language, Non-Diagnostic Summary
  let summary = '';
  if (depthCategory === 'Unmeasured') {
    summary = 'Screening result: Knee angle measurements could not be evaluated. Ensure full body and legs are clearly visible in the video frame.';
  } else {
    const depthDesc = depthSource === 'mean_rep_min'
      ? 'based on the mean of per-repetition minima'
      : 'based on the overall minimum angle';

    let asymDesc = '';
    if (asymmetryDegrees !== null) {
      if (deeperSide === 'equal') {
        asymDesc = ' Both knees reached identical measured depth.';
      } else {
        asymDesc = ` Observed left–right knee angle difference was ${asymmetryDegrees.toFixed(1)}° (${deeperSide} knee bending deeper).`;
        if (asymmetryDegrees >= 10.0) {
          asymDesc += ' In single-camera lateral video, 2D perspective and far-leg occlusion naturally contribute to observed asymmetry.';
        }
      }
    } else {
      asymDesc = ' Bilateral asymmetry could not be assessed because only one leg was clearly visible in the video.';
    }

    summary = `Screening result: Observed ${depthCategory} squat depth with knee flexion reaching approximately ${clinicalFlexionDegrees?.toFixed(1)}° (interior angle ${evaluatedKneeAngle?.toFixed(1)}°), ${depthDesc}.${asymDesc} This screening result is an observational estimate and not a clinical diagnosis; consider a professional assessment if experiencing discomfort or functional concerns.`;
  }

  return {
    depthCategory,
    asymmetryDegrees,
    flags,
    summary,
    sources: SQUAT_ASSESSMENT_SOURCES,
    evaluatedKneeAngle,
    clinicalFlexionDegrees,
    depthSource,
    leftDepthAngle,
    rightDepthAngle,
    deeperSide,
    repetitionSpreadDegrees,
  };
}

/**
 * Orchestrator: assesses squat screening results.
 * Strictly verifies movement === 'squat'. Returns null for non-squat movements.
 */
export function assessSquatMovement(
  measurement: ValidatedMeasurement,
  reps?: RepStatsInput | null
): SquatScreeningAssessment | null {
  if (measurement.movement !== 'squat') {
    return null;
  }

  const squatAssessment = assessSquat(measurement, reps);

  const leftDepth = assessSquatDepth(measurement.leftKneeMinAngle);
  const rightDepth = assessSquatDepth(measurement.rightKneeMinAngle);

  // Primary leg: choose the deeper measured leg (smaller interior angle), or the only measured leg
  let primaryLeg: LegDepthAssessment | null = null;
  if (leftDepth && rightDepth) {
    primaryLeg = leftDepth.interiorAngle <= rightDepth.interiorAngle ? leftDepth : rightDepth;
  } else {
    primaryLeg = leftDepth ?? rightDepth ?? null;
  }

  const asymmetry = assessBilateralDifference(
    measurement.leftKneeMinAngle,
    measurement.rightKneeMinAngle
  );

  // Evaluate repetition variation on the primary measured leg's reps, or whichever leg has valid reps
  const leftReps = Array.isArray(reps?.leftRepMins) ? reps.leftRepMins : [];
  const rightReps = Array.isArray(reps?.rightRepMins) ? reps.rightRepMins : [];

  let selectedReps = leftReps;
  if (primaryLeg === rightDepth && rightReps.length > 0) {
    selectedReps = rightReps;
  } else if (leftReps.length < 2 && rightReps.length >= 2) {
    selectedReps = rightReps;
  }

  const repVariation = assessRepetitionVariation(selectedReps, reps?.repDetection ?? null);

  return {
    movement: 'squat',
    leftLeg: leftDepth,
    rightLeg: rightDepth,
    primaryLeg,
    asymmetry,
    repetitionVariation: repVariation,
    squatAssessment,
    disclaimer: SCIENTIFIC_ASSESSMENT_DISCLAIMER,
  };
}
