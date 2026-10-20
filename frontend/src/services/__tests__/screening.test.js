const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Ensure dist/services/screening.js is built from src/services/screening.ts
const frontendRoot = path.resolve(__dirname, '../../..');
const distFile = path.join(frontendRoot, 'dist', 'services', 'screening.js');
const srcFile = path.resolve(__dirname, '../screening.ts');

if (!fs.existsSync(distFile) || fs.statSync(srcFile).mtimeMs >= fs.statSync(distFile).mtimeMs) {
  const tscCmd = process.platform === 'win32'
    ? path.join(frontendRoot, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(frontendRoot, 'node_modules', '.bin', 'tsc');

  execSync(`"${tscCmd}" src/services/screening.ts --outDir ./dist --rootDir ./src --module commonjs --target es2020 --ignoreConfig`, {
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
  SCIENTIFIC_ASSESSMENT_DISCLAIMER,
  toClinicalFlexion,
  assessSquatDepth,
  assessBilateralDifference,
  assessRepetitionVariation,
  assessSquatMovement,
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

  describe('Helper: toClinicalFlexion', () => {
    it('correctly converts valid interior angles to clinical flexion angles', () => {
      assert.strictEqual(toClinicalFlexion(180), 0);
      assert.strictEqual(toClinicalFlexion(90), 90);
      assert.strictEqual(toClinicalFlexion(70), 110);
      assert.strictEqual(toClinicalFlexion(0), 180);
      assert.strictEqual(toClinicalFlexion(65.8), 114.2);
      assert.strictEqual(toClinicalFlexion(59.2), 120.8);
    });

    it('returns null for missing, non-finite, or out-of-range angles', () => {
      assert.strictEqual(toClinicalFlexion(null), null);
      assert.strictEqual(toClinicalFlexion(undefined), null);
      assert.strictEqual(toClinicalFlexion(-0.1), null);
      assert.strictEqual(toClinicalFlexion(180.1), null);
      assert.strictEqual(toClinicalFlexion(NaN), null);
      assert.strictEqual(toClinicalFlexion(Infinity), null);
      assert.strictEqual(toClinicalFlexion('90'), null);
    });
  });

  describe('10. Continuous squat depth assessment (assessSquatDepth)', () => {
    it('calculates continuous interior and clinical flexion angles without categorical labels', () => {
      // 0.0 interior -> 180.0 flexion
      const zero = assessSquatDepth(0.0);
      assert.strictEqual(zero.interiorAngle, 0.0);
      assert.strictEqual(zero.clinicalFlexionAngle, 180.0);
      assert.strictEqual(zero.category, undefined);
      assert.strictEqual(zero.categoryLabel, undefined);
      assert.ok(zero.description.includes('180.0° (interior angle 0.0°)'));

      // 65.8 interior -> 114.2 flexion
      const angle1 = assessSquatDepth(65.8);
      assert.strictEqual(angle1.interiorAngle, 65.8);
      assert.strictEqual(angle1.clinicalFlexionAngle, 114.2);
      assert.strictEqual(angle1.category, undefined);
      assert.strictEqual(angle1.categoryLabel, undefined);
      assert.ok(angle1.description.includes('114.2° (interior angle 65.8°)'));

      // 70.0 interior -> 110.0 flexion
      const angle2 = assessSquatDepth(70.0);
      assert.strictEqual(angle2.interiorAngle, 70.0);
      assert.strictEqual(angle2.clinicalFlexionAngle, 110.0);
      assert.strictEqual(angle2.category, undefined);

      // 90.0 interior -> 90.0 flexion
      const angle3 = assessSquatDepth(90.0);
      assert.strictEqual(angle3.interiorAngle, 90.0);
      assert.strictEqual(angle3.clinicalFlexionAngle, 90.0);
      assert.strictEqual(angle3.category, undefined);

      // 120.0 interior -> 60.0 flexion
      const angle4 = assessSquatDepth(120.0);
      assert.strictEqual(angle4.interiorAngle, 120.0);
      assert.strictEqual(angle4.clinicalFlexionAngle, 60.0);
      assert.strictEqual(angle4.category, undefined);

      // 180.0 interior -> 0.0 flexion
      const angle5 = assessSquatDepth(180.0);
      assert.strictEqual(angle5.interiorAngle, 180.0);
      assert.strictEqual(angle5.clinicalFlexionAngle, 0.0);
      assert.strictEqual(angle5.category, undefined);

      // Ensure no evaluative/categorical words in descriptions
      [zero, angle1, angle2, angle3, angle4, angle5].forEach(res => {
        const desc = res.description.toLowerCase();
        assert.ok(!desc.includes('deep'));
        assert.ok(!desc.includes('parallel'));
        assert.ok(!desc.includes('half'));
        assert.ok(!desc.includes('shallow'));
        assert.ok(!desc.includes('good'));
        assert.ok(!desc.includes('bad'));
        assert.ok(!desc.includes('risk'));
      });
    });

    it('returns null for missing or invalid angles without defaulting to 0', () => {
      assert.strictEqual(assessSquatDepth(null), null);
      assert.strictEqual(assessSquatDepth(undefined), null);
      assert.strictEqual(assessSquatDepth(-5), null);
      assert.strictEqual(assessSquatDepth(185), null);
      assert.strictEqual(assessSquatDepth(NaN), null);
      assert.strictEqual(assessSquatDepth('70'), null);
    });
  });

  describe('11. Bilateral knee angle difference (assessBilateralDifference)', () => {
    it('assesses identical depths with deeperSide equal and 0.0 degree difference', () => {
      const res = assessBilateralDifference(85.0, 85.0);
      assert.strictEqual(res.evaluated, true);
      assert.strictEqual(res.absoluteDifference, 0.0);
      assert.strictEqual(res.deeperSide, 'equal');
      assert.ok(res.description.includes('identical'));
    });
    it('does not call rounded near-equal measurements identical', () => {
      const res = assessBilateralDifference(85.0, 85.01);
      assert.strictEqual(res.evaluated, true);
      assert.strictEqual(res.absoluteDifference, 0.0);
      assert.strictEqual(res.deeperSide, 'left');
      assert.ok(!res.description.includes('identical'));
      assert.ok(res.description.includes('rounds to 0.0°'));
    });

    it('correctly identifies left leg deeper when left angle is smaller', () => {
      const res = assessBilateralDifference(65.0, 75.0);
      assert.strictEqual(res.evaluated, true);
      assert.strictEqual(res.absoluteDifference, 10.0);
      assert.strictEqual(res.deeperSide, 'left');
      assert.ok(res.description.includes('Left knee bent 10.0° deeper'));
    });

    it('correctly identifies right leg deeper when right angle is smaller', () => {
      const res = assessBilateralDifference(85.0, 77.5);
      assert.strictEqual(res.evaluated, true);
      assert.strictEqual(res.absoluteDifference, 7.5);
      assert.strictEqual(res.deeperSide, 'right');
      assert.ok(res.description.includes('Right knee bent 7.5° deeper'));
    });

    it('marks comparison unavailable when either leg is null or invalid', () => {
      const nullLeft = assessBilateralDifference(null, 80.0);
      assert.strictEqual(nullLeft.evaluated, false);
      assert.strictEqual(nullLeft.absoluteDifference, null);
      assert.strictEqual(nullLeft.deeperSide, null);

      const nullRight = assessBilateralDifference(80.0, null);
      assert.strictEqual(nullRight.evaluated, false);
      assert.strictEqual(nullRight.absoluteDifference, null);

      const bothNull = assessBilateralDifference(null, null);
      assert.strictEqual(bothNull.evaluated, false);

      const invalid = assessBilateralDifference(80.0, -10);
      assert.strictEqual(invalid.evaluated, false);
    });

    it('does not contain clinical labels like normal, abnormal, balanced, or unbalanced', () => {
      const diff1 = assessBilateralDifference(65.0, 85.0);
      const text = diff1.description.toLowerCase();
      assert.ok(!text.includes('abnormal'));
      assert.ok(!text.includes('normal'));
      assert.ok(!text.includes('unbalanced'));
      assert.ok(!text.includes('balanced'));
      assert.ok(!text.includes('risk'));
    });
  });

  describe('12. Repetition depth variation (assessRepetitionVariation)', () => {
    it('calculates observed spread across valid repetitions', () => {
      const res = assessRepetitionVariation([65.0, 70.0, 68.5], 'ok');
      assert.strictEqual(res.evaluated, true);
      assert.strictEqual(res.repCount, 3);
      assert.strictEqual(res.spreadDegrees, 5.0);
      assert.strictEqual(res.minRepAngle, 65.0);
      assert.strictEqual(res.maxRepAngle, 70.0);
      assert.ok(res.description.includes('5.0° across 3 segmented reps'));
    });

    it('handles identical repetition angles with 0.0 degree spread', () => {
      const res = assessRepetitionVariation([80.0, 80.0], 'ok');
      assert.strictEqual(res.evaluated, true);
      assert.strictEqual(res.repCount, 2);
      assert.strictEqual(res.spreadDegrees, 0.0);
    });

    it('marks consistency unassessed when fewer than 2 repetitions are available', () => {
      const single = assessRepetitionVariation([75.0], 'ok');
      assert.strictEqual(single.evaluated, false);
      assert.strictEqual(single.spreadDegrees, null);
      assert.strictEqual(single.repCount, 1);
      assert.ok(single.description.includes('fewer than 2'));

      const empty = assessRepetitionVariation([], 'ok');
      assert.strictEqual(empty.evaluated, false);
      assert.strictEqual(empty.spreadDegrees, null);
    });

    it('marks consistency unassessed when fallback_overall_min is reported', () => {
      const fallback = assessRepetitionVariation([65.0, 70.0], 'fallback_overall_min');
      assert.strictEqual(fallback.evaluated, false);
      assert.strictEqual(fallback.spreadDegrees, null);
      assert.ok(fallback.description.includes('fallback'));
    });

    it('does not emit arbitrary consistency labels like consistent or inconsistent', () => {
      const res = assessRepetitionVariation([60.0, 75.0], 'ok');
      const text = res.description.toLowerCase();
      assert.ok(!text.includes('consistent'));
      assert.ok(!text.includes('inconsistent'));
      assert.ok(!text.includes('good'));
      assert.ok(!text.includes('bad'));
    });
  });

  describe('13. Orchestration & movement scoping (assessSquatMovement)', () => {
    it('assesses squat movement completely with primary leg selection and asymmetry', () => {
      const measurement = {
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        leftKneeMinAngle: 59.2,
        rightKneeMinAngle: 65.8,
        hasLeftAngle: true,
        hasRightAngle: true,
      };
      const reps = {
        leftRepMins: [59.2],
        rightRepMins: [67.6, 65.8],
        repDetection: 'ok',
      };

      const assessment = assessSquatMovement(measurement, reps);
      assert.ok(assessment !== null);
      assert.strictEqual(assessment.movement, 'squat');
      assert.strictEqual(assessment.leftLeg.interiorAngle, 59.2);
      assert.strictEqual(assessment.leftLeg.clinicalFlexionAngle, 120.8);
      assert.strictEqual(assessment.leftLeg.category, undefined);
      assert.strictEqual(assessment.rightLeg.interiorAngle, 65.8);
      assert.strictEqual(assessment.rightLeg.clinicalFlexionAngle, 114.2);
      assert.strictEqual(assessment.rightLeg.category, undefined);
      // Left leg is deeper (59.2 < 65.8), so it is selected as primary
      assert.strictEqual(assessment.primaryLeg.interiorAngle, 59.2);
      assert.strictEqual(assessment.asymmetry.evaluated, true);
      assert.strictEqual(assessment.asymmetry.absoluteDifference, 6.6);
      assert.strictEqual(assessment.asymmetry.deeperSide, 'left');
      assert.ok(assessment.disclaimer.includes(SCIENTIFIC_ASSESSMENT_DISCLAIMER));
    });

    it('handles single visible leg safely without evaluating asymmetry', () => {
      const measurement = {
        movement: 'squat',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        leftKneeMinAngle: null,
        rightKneeMinAngle: 85.0,
        hasLeftAngle: false,
        hasRightAngle: true,
      };

      const assessment = assessSquatMovement(measurement);
      assert.ok(assessment !== null);
      assert.strictEqual(assessment.leftLeg, null);
      assert.strictEqual(assessment.rightLeg.interiorAngle, 85.0);
      assert.strictEqual(assessment.rightLeg.clinicalFlexionAngle, 95.0);
      assert.strictEqual(assessment.rightLeg.category, undefined);
      assert.strictEqual(assessment.primaryLeg.interiorAngle, 85.0);
      assert.strictEqual(assessment.asymmetry.evaluated, false);
      assert.strictEqual(assessment.asymmetry.absoluteDifference, null);
    });

    it('strictly returns null for non-squat movements', () => {
      const walkMeasurement = {
        movement: 'walk',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        leftKneeMinAngle: 90.0,
        rightKneeMinAngle: 90.0,
        hasLeftAngle: true,
        hasRightAngle: true,
      };
      assert.strictEqual(assessSquatMovement(walkMeasurement), null);

      const jumpMeasurement = {
        movement: 'drop-jump',
        metric: 'knee_flexion_angle',
        unit: 'degrees',
        leftKneeMinAngle: 80.0,
        rightKneeMinAngle: 80.0,
        hasLeftAngle: true,
        hasRightAngle: true,
      };
      assert.strictEqual(assessSquatMovement(jumpMeasurement), null);
    });
  });
});
