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
    disclaimer: SCIENTIFIC_ASSESSMENT_DISCLAIMER,
  };
}
