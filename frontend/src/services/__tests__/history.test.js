const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// 1. Build dist/services/history.js and dist/services/screening.js
const frontendRoot = path.resolve(__dirname, '../../..');
const distDir = path.join(frontendRoot, 'dist', 'services');
const distHistory = path.join(distDir, 'history.js');
const srcHistory = path.resolve(__dirname, '../history.ts');
const srcScreening = path.resolve(__dirname, '../screening.ts');

const tscCmd = process.platform === 'win32'
  ? path.join(frontendRoot, 'node_modules', '.bin', 'tsc.cmd')
  : path.join(frontendRoot, 'node_modules', '.bin', 'tsc');

execSync(`"${tscCmd}" src/services/history.ts --outDir ./dist --rootDir ./src --module commonjs --target es2020 --ignoreConfig`, {
  cwd: frontendRoot,
  stdio: 'ignore',
});

// 2. Set up isolated in-memory AsyncStorage mock in require.cache
const memoryStorage = new Map();
const mockAsyncStorage = {
  getItem: async (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
  setItem: async (key, value) => { memoryStorage.set(key, String(value)); },
  removeItem: async (key) => { memoryStorage.delete(key); },
  clear: async () => { memoryStorage.clear(); },
};

const asyncStoragePath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asyncStoragePath] = {
  id: asyncStoragePath,
  filename: asyncStoragePath,
  loaded: true,
  exports: {
    __esModule: true,
    default: mockAsyncStorage,
    ...mockAsyncStorage,
  },
};

// 3. Load the compiled history module
const {
  getHistory,
  addHistory,
  deleteHistory,
  clearUserHistory,
  normalizeHistoryEmail,
  bestAngle,
  formatHistoryDate,
  formatHistoryTime,
  computeTotalReps,
  computeBestFlexion,
  computeBilateralSymmetry,
  computeAvgRepSpread,
  computeTrackingFidelity,
} = require(distHistory);

describe('History & Progress Service — Account Isolation & Metrics Audit', () => {
  beforeEach(async () => {
    memoryStorage.clear();
  });

  describe('1. Account Isolation & Retrieval (getHistory)', () => {
    it('returns only records belonging to the requested user', async () => {
      await addHistory({
        userEmail: 'user_a@example.com',
        movement: 'squat',
        leftKneeMinAngle: 85,
        rightKneeMinAngle: 80,
        repCount: 3,
        leftMeanRepMin: 85,
        rightMeanRepMin: 80,
        leftRepMins: [85, 87, 86],
        rightRepMins: [80, 82, 81],
        repDetection: 'ok',
      });
      await addHistory({
        userEmail: 'user_b@example.com',
        movement: 'squat',
        leftKneeMinAngle: 95,
        rightKneeMinAngle: 92,
        repCount: 2,
        leftMeanRepMin: 95,
        rightMeanRepMin: 92,
        leftRepMins: [95, 96],
        rightRepMins: [92, 93],
        repDetection: 'ok',
      });

      const listA = await getHistory('user_a@example.com');
      const listB = await getHistory('user_b@example.com');

      assert.strictEqual(listA.length, 1);
      assert.strictEqual(listA[0].userEmail, 'user_a@example.com');
      assert.strictEqual(listB.length, 1);
      assert.strictEqual(listB[0].userEmail, 'user_b@example.com');
    });

    it('performs case-insensitive email matching with whitespace trimming', async () => {
      await addHistory({
        userEmail: 'Athlete@GaitGuard.com',
        movement: 'squat',
        leftKneeMinAngle: 90,
        rightKneeMinAngle: 90,
        repCount: 1,
        leftMeanRepMin: 90,
        rightMeanRepMin: 90,
        leftRepMins: [90],
        rightRepMins: [90],
        repDetection: 'ok',
      });

      const found = await getHistory('  athlete@gaitguard.COM  ');
      assert.strictEqual(found.length, 1);
      assert.strictEqual(found[0].userEmail, 'athlete@gaitguard.com');
    });

    it('returns empty array when user has no records', async () => {
      const found = await getHistory('nobody@example.com');
      assert.deepStrictEqual(found, []);
    });

    it('returns empty array and does not leak data for missing or invalid email', async () => {
      await addHistory({
        userEmail: 'user@example.com',
        movement: 'squat',
        leftKneeMinAngle: 90,
        rightKneeMinAngle: 90,
        repCount: 1,
        leftMeanRepMin: 90,
        rightMeanRepMin: 90,
        leftRepMins: [90],
        rightRepMins: [90],
        repDetection: 'ok',
      });

      assert.deepStrictEqual(await getHistory(''), []);
      assert.deepStrictEqual(await getHistory('   '), []);
      assert.deepStrictEqual(await getHistory(null), []);
      assert.deepStrictEqual(await getHistory(undefined), []);
      assert.deepStrictEqual(await getHistory(123), []);
    });

    it('sorts records newest first', async () => {
      const e1 = await addHistory({
        userEmail: 'chronological@example.com',
        movement: 'squat',
        leftKneeMinAngle: 100,
        rightKneeMinAngle: 100,
        repCount: null,
        leftMeanRepMin: null,
        rightMeanRepMin: null,
        leftRepMins: [],
        rightRepMins: [],
        repDetection: null,
      });

      // Small delay to ensure timestamp difference
      await new Promise(r => setTimeout(r, 10));

      const e2 = await addHistory({
        userEmail: 'chronological@example.com',
        movement: 'squat',
        leftKneeMinAngle: 80,
        rightKneeMinAngle: 80,
        repCount: null,
        leftMeanRepMin: null,
        rightMeanRepMin: null,
        leftRepMins: [],
        rightRepMins: [],
        repDetection: null,
      });

      const list = await getHistory('chronological@example.com');
      assert.strictEqual(list.length, 2);
      assert.strictEqual(list[0].id, e2.id);
      assert.strictEqual(list[1].id, e1.id);
    });
  });

  describe('2. Analysis Saving (addHistory)', () => {
    it('generates unique id, valid ISO timestamp, and normalizes email', async () => {
      const saved = await addHistory({
        userEmail: '  Runner@Exercise.Org  ',
        movement: 'squat',
        leftKneeMinAngle: 75.5,
        rightKneeMinAngle: 78.2,
        framesAnalyzed: 90,
        framesWithPose: 88,
        repCount: 5,
        leftMeanRepMin: 76.0,
        rightMeanRepMin: 79.0,
        leftRepMins: [75, 76, 77],
        rightRepMins: [78, 79, 80],
        repDetection: 'ok',
      });

      assert.ok(saved.id && typeof saved.id === 'string');
      assert.strictEqual(saved.userEmail, 'runner@exercise.org');
      assert.ok(!isNaN(new Date(saved.createdAt).getTime()));
      assert.strictEqual(saved.movement, 'squat');
      assert.strictEqual(saved.leftKneeMinAngle, 75.5);
      assert.strictEqual(saved.framesWithPose, 88);
    });

    it('rejects saving when user email is empty or missing', async () => {
      await assert.rejects(
        async () => {
          await addHistory({
            userEmail: '',
            movement: 'squat',
            leftKneeMinAngle: 90,
            rightKneeMinAngle: 90,
            repCount: null,
            leftMeanRepMin: null,
            rightMeanRepMin: null,
            leftRepMins: [],
            rightRepMins: [],
            repDetection: null,
          });
        },
        { message: /requires a valid user email/ }
      );
    });
  });

  describe('3. Record Deletion (deleteHistory)', () => {
    it('deletes only the target user record when id and email match', async () => {
      const entry = await addHistory({
        userEmail: 'alice@example.com',
        movement: 'squat',
        leftKneeMinAngle: 80,
        rightKneeMinAngle: 80,
        repCount: 1,
        leftMeanRepMin: 80,
        rightMeanRepMin: 80,
        leftRepMins: [80],
        rightRepMins: [80],
        repDetection: 'ok',
      });

      await deleteHistory(entry.id, 'alice@example.com');
      const aliceList = await getHistory('alice@example.com');
      assert.strictEqual(aliceList.length, 0);
    });

    it('refuses to delete a record belonging to another user', async () => {
      const entryAlice = await addHistory({
        userEmail: 'alice@example.com',
        movement: 'squat',
        leftKneeMinAngle: 80,
        rightKneeMinAngle: 80,
        repCount: 1,
        leftMeanRepMin: 80,
        rightMeanRepMin: 80,
        leftRepMins: [80],
        rightRepMins: [80],
        repDetection: 'ok',
      });

      // Bob attempts to delete Alice's record
      await deleteHistory(entryAlice.id, 'bob@example.com');

      const aliceList = await getHistory('alice@example.com');
      assert.strictEqual(aliceList.length, 1);
      assert.strictEqual(aliceList[0].id, entryAlice.id);
    });

    it('refuses to delete when user email is missing or empty', async () => {
      const entry = await addHistory({
        userEmail: 'alice@example.com',
        movement: 'squat',
        leftKneeMinAngle: 80,
        rightKneeMinAngle: 80,
        repCount: 1,
        leftMeanRepMin: 80,
        rightMeanRepMin: 80,
        leftRepMins: [80],
        rightRepMins: [80],
        repDetection: 'ok',
      });

      await deleteHistory(entry.id, '');
      await deleteHistory(entry.id, '   ');

      const list = await getHistory('alice@example.com');
      assert.strictEqual(list.length, 1);
    });
  });

  describe('4. Clearing History (clearUserHistory)', () => {
    it('clears only the specified user records and preserves others', async () => {
      await addHistory({
        userEmail: 'user1@test.com',
        movement: 'squat',
        leftKneeMinAngle: 85,
        rightKneeMinAngle: 85,
        repCount: 2,
        leftMeanRepMin: 85,
        rightMeanRepMin: 85,
        leftRepMins: [85, 86],
        rightRepMins: [85, 86],
        repDetection: 'ok',
      });
      await addHistory({
        userEmail: 'user2@test.com',
        movement: 'squat',
        leftKneeMinAngle: 90,
        rightKneeMinAngle: 90,
        repCount: 2,
        leftMeanRepMin: 90,
        rightMeanRepMin: 90,
        leftRepMins: [90, 91],
        rightRepMins: [90, 91],
        repDetection: 'ok',
      });

      await clearUserHistory('user1@test.com');

      const u1List = await getHistory('user1@test.com');
      const u2List = await getHistory('user2@test.com');

      assert.strictEqual(u1List.length, 0);
      assert.strictEqual(u2List.length, 1);
      assert.strictEqual(u2List[0].userEmail, 'user2@test.com');
    });

    it('does nothing when email is empty or invalid', async () => {
      await addHistory({
        userEmail: 'stay@test.com',
        movement: 'squat',
        leftKneeMinAngle: 85,
        rightKneeMinAngle: 85,
        repCount: 2,
        leftMeanRepMin: 85,
        rightMeanRepMin: 85,
        leftRepMins: [85],
        rightRepMins: [85],
        repDetection: 'ok',
      });

      await clearUserHistory('');
      await clearUserHistory('   ');

      const list = await getHistory('stay@test.com');
      assert.strictEqual(list.length, 1);
    });
  });

  describe('5. Date & Time Helpers', () => {
    it('formats valid ISO strings safely', () => {
      const iso = '2026-03-15T10:30:00.000Z';
      const d = formatHistoryDate(iso);
      const t = formatHistoryTime(iso);
      assert.ok(d.includes('2026') || d.includes('Mar') || d.includes('15'));
      assert.ok(t.length > 0);
    });

    it('returns graceful fallback for missing or invalid dates', () => {
      assert.strictEqual(formatHistoryDate(undefined), 'Unknown date');
      assert.strictEqual(formatHistoryDate('invalid-date'), 'Unknown date');
      assert.strictEqual(formatHistoryTime(undefined), '');
      assert.strictEqual(formatHistoryTime('invalid-date'), '');
    });
  });

  describe('6. Depth Angle Resolution (bestAngle)', () => {
    it('prefers mean rep minima when available', () => {
      const entry = {
        leftMeanRepMin: 82.5,
        leftKneeMinAngle: 75.0,
        rightMeanRepMin: 85.0,
        rightKneeMinAngle: 80.0,
      };
      assert.strictEqual(bestAngle(entry, 'left'), 82.5);
      assert.strictEqual(bestAngle(entry, 'right'), 85.0);
    });

    it('falls back to overall min angle when mean rep minima is null', () => {
      const entry = {
        leftMeanRepMin: null,
        leftKneeMinAngle: 75.0,
        rightMeanRepMin: null,
        rightKneeMinAngle: 80.0,
      };
      assert.strictEqual(bestAngle(entry, 'left'), 75.0);
      assert.strictEqual(bestAngle(entry, 'right'), 80.0);
    });

    it('returns null when both are unavailable', () => {
      const entry = {
        leftMeanRepMin: null,
        leftKneeMinAngle: null,
        rightMeanRepMin: null,
        rightKneeMinAngle: null,
      };
      assert.strictEqual(bestAngle(entry, 'left'), null);
      assert.strictEqual(bestAngle(entry, 'right'), null);
    });
  });

  describe('7. Progress Metric Calculations', () => {
    it('computeTotalReps correctly sums positive integer reps and counts sets', () => {
      const entries = [
        { repCount: 5 },
        { repCount: null }, // single motion or uncounted
        { repCount: 3 },
        { repCount: 0 },
        { repCount: -2 }, // invalid
      ];
      const res = computeTotalReps(entries);
      assert.strictEqual(res.totalReps, 8);
      assert.strictEqual(res.sessionsWithRepsCount, 2);
    });

    it('computeBestFlexion finds deepest clinical flexion (180 - interior)', () => {
      const entries = [
        // Session 1: left 80° (flexion 100°), right 85° (flexion 95°)
        { leftKneeMinAngle: 80, rightKneeMinAngle: 85, leftMeanRepMin: null, rightMeanRepMin: null },
        // Session 2: left 70° (flexion 110°), right 75° (flexion 105°)
        { leftKneeMinAngle: 70, rightKneeMinAngle: 75, leftMeanRepMin: null, rightMeanRepMin: null },
        // Session 3: null measurements
        { leftKneeMinAngle: null, rightKneeMinAngle: null, leftMeanRepMin: null, rightMeanRepMin: null },
      ];
      const best = computeBestFlexion(entries);
      assert.strictEqual(best, 110.0);
    });

    it('computeBestFlexion returns null when all angles are null or out of range', () => {
      const entries = [
        { leftKneeMinAngle: null, rightKneeMinAngle: null, leftMeanRepMin: null, rightMeanRepMin: null },
        { leftKneeMinAngle: 200, rightKneeMinAngle: -10, leftMeanRepMin: null, rightMeanRepMin: null },
      ];
      assert.strictEqual(computeBestFlexion(entries), null);
    });

    it('computeBilateralSymmetry uses bestAngle, rounds diff, and classifies deeper sides', () => {
      const entries = [
        // Session 1: Left 80°, Right 90° -> diff 10°, left deeper (80 < 90)
        { leftKneeMinAngle: 80, rightKneeMinAngle: 90, leftMeanRepMin: null, rightMeanRepMin: null },
        // Session 2: Left 85°, Right 80° -> diff 5°, right deeper (80 < 85)
        { leftKneeMinAngle: 85, rightKneeMinAngle: 80, leftMeanRepMin: null, rightMeanRepMin: null },
        // Session 3: Left 75°, Right 75° -> diff 0°, equal depth
        { leftKneeMinAngle: 75, rightKneeMinAngle: 75, leftMeanRepMin: null, rightMeanRepMin: null },
        // Session 4: Unilateral (right is null) -> skipped
        { leftKneeMinAngle: 75, rightKneeMinAngle: null, leftMeanRepMin: null, rightMeanRepMin: null },
      ];

      const res = computeBilateralSymmetry(entries);
      assert.strictEqual(res.bilateralCount, 3);
      // (10 + 5 + 0) / 3 = 5.0
      assert.strictEqual(res.avgAsymmetry, 5.0);
      assert.strictEqual(res.leftDeeperCount, 1);
      assert.strictEqual(res.rightDeeperCount, 1);
      assert.strictEqual(res.equalDepthCount, 1);
    });

    it('computeBilateralSymmetry returns null when no bilateral sessions exist', () => {
      const entries = [
        { leftKneeMinAngle: 80, rightKneeMinAngle: null, leftMeanRepMin: null, rightMeanRepMin: null },
      ];
      const res = computeBilateralSymmetry(entries);
      assert.strictEqual(res.bilateralCount, 0);
      assert.strictEqual(res.avgAsymmetry, null);
    });

    it('computeAvgRepSpread excludes fallback_overall_min and calculates observed spread', () => {
      const entries = [
        // Session 1: ok reps [80, 86] -> spread 6.0°
        {
          repDetection: 'ok',
          leftRepMins: [80, 86],
          rightRepMins: [],
        },
        // Session 2: fallback_overall_min -> MUST BE EXCLUDED
        {
          repDetection: 'fallback_overall_min',
          leftRepMins: [80, 90],
          rightRepMins: [],
        },
        // Session 3: ok reps [75, 79, 77] -> spread 4.0°
        {
          repDetection: 'ok',
          leftRepMins: [75, 79, 77],
          rightRepMins: [],
        },
        // Session 4: only 1 rep -> excluded (< 2 reps)
        {
          repDetection: 'ok',
          leftRepMins: [80],
          rightRepMins: [],
        },
      ];

      const res = computeAvgRepSpread(entries);
      assert.strictEqual(res.multiRepCount, 2);
      // Average of 6.0 and 4.0 = 5.0°
      assert.strictEqual(res.avgRepSpread, 5.0);
    });

    it('computeAvgRepSpread returns null when no multi-rep clean sessions exist', () => {
      const entries = [
        { repDetection: 'fallback_overall_min', leftRepMins: [80, 90], rightRepMins: [] },
        { repDetection: 'ok', leftRepMins: [80], rightRepMins: [] },
      ];
      const res = computeAvgRepSpread(entries);
      assert.strictEqual(res.multiRepCount, 0);
      assert.strictEqual(res.avgRepSpread, null);
    });

    it('computeTrackingFidelity correctly computes percentage and handles zero frames', () => {
      const entries = [
        { framesAnalyzed: 100, framesWithPose: 90 },
        { framesAnalyzed: 100, framesWithPose: 80 },
        { framesAnalyzed: null, framesWithPose: null },
      ];
      // 170 / 200 = 85.0%
      assert.strictEqual(computeTrackingFidelity(entries), 85.0);
      assert.strictEqual(computeTrackingFidelity([]), null);
    });
  });
});
