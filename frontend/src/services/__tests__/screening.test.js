const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Ensure dist/services/screening.js is built from src/services/screening.ts
const frontendRoot = path.resolve(__dirname, '../../..');
const distFile = path.join(frontendRoot, 'dist', 'services', 'screening.js');
const srcFile = path.resolve(__dirname, '../screening.ts');

if (!fs.existsSync(distFile) || fs.statSync(srcFile).mtimeMs > fs.statSync(distFile).mtimeMs) {
  const tscCmd = process.platform === 'win32'
    ? path.join(frontendRoot, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(frontendRoot, 'node_modules', '.bin', 'tsc');

  execSync(`"${tscCmd}" src/services/screening.ts --outDir ./dist --module commonjs --target es2020 --ignoreConfig`, {
    cwd: frontendRoot,
    stdio: 'ignore',
  });
}

const {
  validateScreeningResponse,
  processAnalysisResult,
  isValidKneeAngle,
  isValidFrameCount,
  ERROR_MESSAGES,
  FALLBACK_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  MALFORMED_ERROR_MESSAGE,
} = require(distFile);

describe('Member 3 — Screening Logic & Measurement Validation', () => {

  describe('1. Both knee angles are valid', () => {
    it('returns successful outcome with valid measurements for both legs', () => {
      const mockBackendSuccess = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 92.4,
        right_knee_min_angle: 95.1,
        frames_analyzed: 120,
        frames_with_pose: 112,
      };

      const outcome = validateScreeningResponse(mockBackendSuccess);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.leftKneeMinAngle, 92.4);
      assert.strictEqual(outcome.measurement.rightKneeMinAngle, 95.1);
      assert.strictEqual(outcome.measurement.hasLeftAngle, true);
      assert.strictEqual(outcome.measurement.hasRightAngle, true);
      assert.strictEqual(outcome.measurement.movement, 'squat');
      assert.strictEqual(outcome.measurement.unit, 'degrees');
      assert.strictEqual(outcome.measurement.metric, 'knee_flexion_angle');
      assert.strictEqual(outcome.measurement.framesAnalyzed, 120);
      assert.strictEqual(outcome.measurement.framesWithPose, 112);
    });

    it('falls back to provided movement parameter if backend response omits it', () => {
      const mockResponseWithoutMovement = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 75.0,
        right_knee_min_angle: 78.5,
      };

      const outcome = validateScreeningResponse(mockResponseWithoutMovement, 'drop-jump');
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.movement, 'drop-jump');
    });
  });

  describe('2. The left angle is null', () => {
    it('returns successful outcome with right leg measured and left leg marked as unmeasured', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: null,
        right_knee_min_angle: 95.1,
        frames_analyzed: 100,
        frames_with_pose: 80,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.leftKneeMinAngle, null);
      assert.strictEqual(outcome.measurement.rightKneeMinAngle, 95.1);
      assert.strictEqual(outcome.measurement.hasLeftAngle, false);
      assert.strictEqual(outcome.measurement.hasRightAngle, true);
    });
  });

  describe('3. The right angle is null', () => {
    it('returns successful outcome with left leg measured and right leg marked as unmeasured', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 88.0,
        right_knee_min_angle: null,
        frames_analyzed: 100,
        frames_with_pose: 90,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.leftKneeMinAngle, 88.0);
      assert.strictEqual(outcome.measurement.rightKneeMinAngle, null);
      assert.strictEqual(outcome.measurement.hasLeftAngle, true);
      assert.strictEqual(outcome.measurement.hasRightAngle, false);
    });
  });

  describe('4. Both angles are null', () => {
    it('does not show a successful measurement and returns user-friendly legs_not_visible message', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: null,
        right_knee_min_angle: null,
        frames_analyzed: 100,
        frames_with_pose: 50,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'legs_not_visible');
      assert.strictEqual(outcome.errorMessage, ERROR_MESSAGES.legs_not_visible);
      assert.strictEqual(
        outcome.errorMessage,
        'The legs could not be measured clearly. Please record again with your hips, knees and ankles visible.'
      );
    });
  });

  describe('5. The backend returns each documented error reason', () => {
    it('maps cannot_open_video to the required user-facing copy', () => {
      const mockError = { status: 'error', reason: 'cannot_open_video' };
      const outcome = validateScreeningResponse(mockError);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'cannot_open_video');
      assert.strictEqual(
        outcome.errorMessage,
        'Unable to read this video. Please select or record another video.'
      );
    });

    it('maps no_pose_detected to the required user-facing copy', () => {
      const mockError = { status: 'error', reason: 'no_pose_detected' };
      const outcome = validateScreeningResponse(mockError);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'no_pose_detected');
      assert.strictEqual(
        outcome.errorMessage,
        'No person was detected. Please record again with your full body visible.'
      );
    });

    it('maps legs_not_visible to the required user-facing copy', () => {
      const mockError = { status: 'error', reason: 'legs_not_visible' };
      const outcome = validateScreeningResponse(mockError);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'legs_not_visible');
      assert.strictEqual(
        outcome.errorMessage,
        'The legs could not be measured clearly. Please record again with your hips, knees and ankles visible.'
      );
    });

    it('maps processing_failed to the required user-facing copy', () => {
      const mockError = { status: 'error', reason: 'processing_failed' };
      const outcome = validateScreeningResponse(mockError);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'processing_failed');
      assert.strictEqual(
        outcome.errorMessage,
        'Analysis failed. Please try again.'
      );
    });

    it('handles unexpected or unknown error reason safely with fallback message', () => {
      const mockError = { status: 'error', reason: 'unexpected_internal_crash' };
      const outcome = validateScreeningResponse(mockError);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'unexpected_internal_crash');
      assert.strictEqual(outcome.errorMessage, FALLBACK_ERROR_MESSAGE);
      assert.strictEqual(outcome.errorMessage, 'Analysis failed. Please try again.');
    });
  });

  describe('6. Response is malformed or missing fields', () => {
    it('rejects non-object inputs (null, undefined, primitives, arrays)', () => {
      assert.strictEqual(validateScreeningResponse(null).success, false);
      assert.strictEqual(validateScreeningResponse(undefined).success, false);
      assert.strictEqual(validateScreeningResponse('status: ok').success, false);
      assert.strictEqual(validateScreeningResponse(12345).success, false);
      assert.strictEqual(validateScreeningResponse([]).success, false);
    });

    it('rejects unknown status values', () => {
      const outcome = validateScreeningResponse({ status: 'pending' });
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'invalid_status');
      assert.strictEqual(outcome.errorMessage, MALFORMED_ERROR_MESSAGE);
    });

    it('rejects invalid or missing unit', () => {
      const badUnit1 = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        unit: 'radians',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
      };
      assert.strictEqual(validateScreeningResponse(badUnit1).success, false);

      const badUnit2 = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
      };
      assert.strictEqual(validateScreeningResponse(badUnit2).success, false);
    });

    it('rejects invalid metric', () => {
      const badMetric = {
        status: 'ok',
        metric: 'elbow_angle',
        unit: 'degrees',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
      };
      assert.strictEqual(validateScreeningResponse(badMetric).success, false);
    });

    it('rejects knee angles outside the mathematically possible range [0, 180]', () => {
      const negativeAngle = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: -5.0,
        right_knee_min_angle: 90.0,
      };
      assert.strictEqual(validateScreeningResponse(negativeAngle).success, false);

      const excessAngle = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 185.0,
      };
      assert.strictEqual(validateScreeningResponse(excessAngle).success, false);
    });

    it('rejects non-numeric knee angle types (strings, booleans, objects)', () => {
      const stringAngle = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: '92.4',
        right_knee_min_angle: 90.0,
      };
      assert.strictEqual(validateScreeningResponse(stringAngle).success, false);
    });

    it('rejects NaN and Infinity angles', () => {
      const nanAngle = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: NaN,
        right_knee_min_angle: 90.0,
      };
      assert.strictEqual(validateScreeningResponse(nanAngle).success, false);

      const infAngle = {
        status: 'ok',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: Infinity,
        right_knee_min_angle: 90.0,
      };
      assert.strictEqual(validateScreeningResponse(infAngle).success, false);
    });
  });

  describe('7. Network failure or unavailable backend', () => {
    it('handles server unreachable errors gracefully with user-facing message', () => {
      const clientResult = {
        ok: false,
        reason: 'Cannot reach server at http://192.168.1.5:8000',
      };
      const outcome = processAnalysisResult(clientResult);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'network_error');
      assert.strictEqual(outcome.errorMessage, NETWORK_ERROR_MESSAGE);
      assert.strictEqual(
        outcome.errorMessage,
        'Cannot connect to the server. Please check your network connection and server settings.'
      );
    });

    it('handles request timeout gracefully with user-facing message', () => {
      const clientResult = {
        ok: false,
        reason: 'Request timed out',
      };
      const outcome = processAnalysisResult(clientResult);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'timeout');
      assert.strictEqual(outcome.errorMessage, TIMEOUT_ERROR_MESSAGE);
      assert.strictEqual(
        outcome.errorMessage,
        'The analysis request timed out. Please try again.'
      );
    });

    it('handles server 500 error gracefully without leaking raw stack trace', () => {
      const clientResult = {
        ok: false,
        reason: 'Server error 500: Traceback (most recent call last):\n  File "main.py", line 42...',
      };
      const outcome = processAnalysisResult(clientResult);
      assert.strictEqual(outcome.success, false);
      assert.strictEqual(outcome.reason, 'request_failed');
      assert.strictEqual(outcome.errorMessage, FALLBACK_ERROR_MESSAGE);
      assert.ok(!outcome.errorMessage.includes('Traceback'));
      assert.ok(!outcome.errorMessage.includes('500'));
    });
  });

  describe('8. Valid results are displayed with the correct units and no invented values', () => {
    it('preserves measured values exactly without inventing or defaulting to 0', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 59.2,
        right_knee_min_angle: null,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.leftKneeMinAngle, 59.2);
      // Right knee must stay null, NOT 0.0 or a sample guess
      assert.strictEqual(outcome.measurement.rightKneeMinAngle, null);
      assert.strictEqual(outcome.measurement.unit, 'degrees');
    });

    it('does not generate injury risk predictions or clinical classifications', () => {
      const mockDeepSquat = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 55.0,
        right_knee_min_angle: 58.0,
      };

      const outcome = validateScreeningResponse(mockDeepSquat);
      assert.strictEqual(outcome.success, true);
      // Ensure no risk classifications or diagnosis fields are generated
      const keys = Object.keys(outcome.measurement);
      assert.ok(!keys.includes('risk'));
      assert.ok(!keys.includes('riskLevel'));
      assert.ok(!keys.includes('clinicalDiagnosis'));
      assert.ok(!keys.includes('normalRange'));
    });
  });

  describe('9. Optional frame statistics validation', () => {
    it('retains valid non-negative integer frame statistics', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
        frames_analyzed: 120,
        frames_with_pose: 112,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.framesAnalyzed, 120);
      assert.strictEqual(outcome.measurement.framesWithPose, 112);
    });

    it('treats negative frame counts as unavailable (undefined) without failing measurement', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
        frames_analyzed: -10,
        frames_with_pose: -5,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.framesAnalyzed, undefined);
      assert.strictEqual(outcome.measurement.framesWithPose, undefined);
    });

    it('treats fractional frame counts as unavailable (undefined) without failing measurement', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
        frames_analyzed: 120.5,
        frames_with_pose: 99.8,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.framesAnalyzed, undefined);
      assert.strictEqual(outcome.measurement.framesWithPose, undefined);
    });

    it('treats non-finite frame counts (NaN, Infinity, -Infinity) as unavailable', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
        frames_analyzed: Infinity,
        frames_with_pose: NaN,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.framesAnalyzed, undefined);
      assert.strictEqual(outcome.measurement.framesWithPose, undefined);
    });

    it('treats non-numeric frame counts (strings, null, booleans) as unavailable', () => {
      const mockResponse = {
        status: 'ok',
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        left_knee_min_angle: 90.0,
        right_knee_min_angle: 90.0,
        frames_analyzed: '120',
        frames_with_pose: null,
      };

      const outcome = validateScreeningResponse(mockResponse);
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.measurement.framesAnalyzed, undefined);
      assert.strictEqual(outcome.measurement.framesWithPose, undefined);
    });
  });

  describe('Helper: isValidKneeAngle', () => {
    it('accepts null and finite numbers in [0, 180]', () => {
      assert.strictEqual(isValidKneeAngle(null), true);
      assert.strictEqual(isValidKneeAngle(0), true);
      assert.strictEqual(isValidKneeAngle(90.5), true);
      assert.strictEqual(isValidKneeAngle(180), true);
    });

    it('rejects invalid inputs', () => {
      assert.strictEqual(isValidKneeAngle(undefined), false);
      assert.strictEqual(isValidKneeAngle(-0.1), false);
      assert.strictEqual(isValidKneeAngle(180.1), false);
      assert.strictEqual(isValidKneeAngle('90'), false);
      assert.strictEqual(isValidKneeAngle(NaN), false);
      assert.strictEqual(isValidKneeAngle(Infinity), false);
      assert.strictEqual(isValidKneeAngle({}), false);
    });
  });

  describe('Helper: isValidFrameCount', () => {
    it('accepts valid non-negative integers', () => {
      assert.strictEqual(isValidFrameCount(0), true);
      assert.strictEqual(isValidFrameCount(1), true);
      assert.strictEqual(isValidFrameCount(120), true);
    });

    it('rejects negative numbers', () => {
      assert.strictEqual(isValidFrameCount(-1), false);
      assert.strictEqual(isValidFrameCount(-120), false);
    });

    it('rejects fractional numbers', () => {
      assert.strictEqual(isValidFrameCount(0.5), false);
      assert.strictEqual(isValidFrameCount(120.7), false);
    });

    it('rejects non-finite values', () => {
      assert.strictEqual(isValidFrameCount(NaN), false);
      assert.strictEqual(isValidFrameCount(Infinity), false);
      assert.strictEqual(isValidFrameCount(-Infinity), false);
    });

    it('rejects non-numeric values', () => {
      assert.strictEqual(isValidFrameCount('120'), false);
      assert.strictEqual(isValidFrameCount(null), false);
      assert.strictEqual(isValidFrameCount(undefined), false);
      assert.strictEqual(isValidFrameCount({}), false);
      assert.strictEqual(isValidFrameCount([]), false);
      assert.strictEqual(isValidFrameCount(true), false);
    });
  });
});
