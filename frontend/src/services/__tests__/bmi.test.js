const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Ensure dist/services/bmi.js is built from src/services/bmi.ts
const frontendRoot = path.resolve(__dirname, '../../..');
const distFile = path.join(frontendRoot, 'dist', 'services', 'bmi.js');
const srcFile = path.resolve(__dirname, '../bmi.ts');

if (!fs.existsSync(distFile) || fs.statSync(srcFile).mtimeMs >= fs.statSync(distFile).mtimeMs) {
  const tscCmd = process.platform === 'win32'
    ? path.join(frontendRoot, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(frontendRoot, 'node_modules', '.bin', 'tsc');

  execSync(`"${tscCmd}" src/services/bmi.ts --outDir ./dist --rootDir ./src --module commonjs --target es2020 --ignoreConfig`, {
    cwd: frontendRoot,
    stdio: 'ignore',
  });
}

const { getBmiCategory } = require(distFile);

describe('getBmiCategory', () => {
  it('classifies the WHO boundary values', () => {
    assert.strictEqual(getBmiCategory(18.49).key, 'underweight');
    assert.strictEqual(getBmiCategory(18.5).key, 'normal');
    assert.strictEqual(getBmiCategory(24.9).key, 'normal');
    assert.strictEqual(getBmiCategory(25).key, 'overweight');
    assert.strictEqual(getBmiCategory(29.9).key, 'overweight');
    assert.strictEqual(getBmiCategory(30).key, 'obese');
  });

  it('returns labels and ranges for display', () => {
    assert.deepStrictEqual(getBmiCategory(22), { key: 'normal', label: 'Normal weight', range: '18.5–24.9' });
  });

  it('returns null for invalid input instead of throwing', () => {
    for (const bad of [0, -5, NaN, Infinity, -Infinity, undefined, null, '22']) {
      assert.strictEqual(getBmiCategory(bad), null);
    }
  });
});
