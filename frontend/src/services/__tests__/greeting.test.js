const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Ensure dist/services/greeting.js is built from src/services/greeting.ts
const frontendRoot = path.resolve(__dirname, '../../..');
const distFile = path.join(frontendRoot, 'dist', 'services', 'greeting.js');
const srcFile = path.resolve(__dirname, '../greeting.ts');

if (!fs.existsSync(distFile) || fs.statSync(srcFile).mtimeMs >= fs.statSync(distFile).mtimeMs) {
  const tscCmd = process.platform === 'win32'
    ? path.join(frontendRoot, 'node_modules', '.bin', 'tsc.cmd')
    : path.join(frontendRoot, 'node_modules', '.bin', 'tsc');

  execSync(`"${tscCmd}" src/services/greeting.ts --outDir ./dist --rootDir ./src --module commonjs --target es2020 --ignoreConfig`, {
    cwd: frontendRoot,
    stdio: 'ignore',
  });
}

const { getGreeting } = require(distFile);

const at = (h, m = 0) => new Date(2026, 0, 15, h, m);

describe('getGreeting', () => {
  it('says good morning from 05:00 to 11:59', () => {
    assert.strictEqual(getGreeting(at(5, 0)), 'Good morning');
    assert.strictEqual(getGreeting(at(11, 59)), 'Good morning');
  });

  it('says good afternoon from 12:00 to 16:59', () => {
    assert.strictEqual(getGreeting(at(12, 0)), 'Good afternoon');
    assert.strictEqual(getGreeting(at(16, 59)), 'Good afternoon');
  });

  it('says good evening from 17:00 to 04:59', () => {
    assert.strictEqual(getGreeting(at(17, 0)), 'Good evening');
    assert.strictEqual(getGreeting(at(23, 59)), 'Good evening');
    assert.strictEqual(getGreeting(at(0, 0)), 'Good evening');
    assert.strictEqual(getGreeting(at(4, 59)), 'Good evening');
  });
});
