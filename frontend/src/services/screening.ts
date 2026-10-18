import { AnalysisResult } from './analysis';

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
