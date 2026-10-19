import * as Crypto from 'expo-crypto';

const LOWER = 'abcdefghijkmnpqrstuvwxyz';   // no l, o (look like 1, 0)
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I, O
const DIGITS = '23456789';                  // no 0, 1
const SYMBOLS = '!@#$%&*?';

// Secure random integer in [0, max)
function randomInt(max: number) {
  const bytes = Crypto.getRandomBytes(4);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return n % max;
}

const pick = (chars: string) => chars[randomInt(chars.length)];

/** Strong random password with at least one of each character type */
export function generatePassword(length = 14) {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));

  // Shuffle so the guaranteed characters are not always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export type Strength = { score: 0 | 1 | 2 | 3; label: 'Too short' | 'Weak' | 'Medium' | 'Strong' };

export function passwordStrength(pw: string): Strength {
  if (pw.length < 8) return { score: 0, label: 'Too short' };
  let points = 0;
  if (pw.length >= 12) points++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points++;
  if (/\d/.test(pw)) points++;
  if (/[^A-Za-z0-9]/.test(pw)) points++;
  if (points <= 1) return { score: 1, label: 'Weak' };
  if (points <= 2) return { score: 2, label: 'Medium' };
  return { score: 3, label: 'Strong' };
}

/** Minimum rule for custom passwords */
export function passwordError(pw: string): string | undefined {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Include at least one letter and one number.';
  return undefined;
}