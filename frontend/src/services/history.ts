import AsyncStorage from '@react-native-async-storage/async-storage';
import { toClinicalFlexion } from './screening';

/* ---------- Extra per-rep data from the backend ---------- */
export type RepDetection = 'ok' | 'fallback_overall_min';

export type RepStats = {
  repCount: number | null;
  leftMeanRepMin: number | null;
  rightMeanRepMin: number | null;
  leftRepMins: number[];
  rightRepMins: number[];
  repDetection: RepDetection | null;
};

const validAngle = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 180 ? v : null;

const validAngles = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(validAngle).filter((a): a is number => a !== null) : [];

/** Reads the optional per-rep fields. Missing or invalid values become null / []. */
export function parseRepStats(raw: unknown): RepStats {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const count = r.rep_count;
  return {
    repCount: typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null,
    leftMeanRepMin: validAngle(r.left_knee_mean_rep_min_angle),
    rightMeanRepMin: validAngle(r.right_knee_mean_rep_min_angle),
    leftRepMins: validAngles(r.left_knee_rep_min_angles),
    rightRepMins: validAngles(r.right_knee_rep_min_angles),
    repDetection:
      r.rep_detection === 'ok' || r.rep_detection === 'fallback_overall_min' ? r.rep_detection : null,
  };
}

/* ---------- Saved analysis history ---------- */
export type HistoryEntry = {
  id: string;
  userEmail: string;
  createdAt: string;
  movement: string;
  leftKneeMinAngle: number | null;
  rightKneeMinAngle: number | null;
  framesAnalyzed?: number;
  framesWithPose?: number;
} & RepStats;

const KEY = 'gg.history';

async function readAll(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const writeAll = (entries: HistoryEntry[]) => AsyncStorage.setItem(KEY, JSON.stringify(entries));

export const normalizeHistoryEmail = (email?: unknown): string =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

/** Newest first, only for this user */
export async function getHistory(userEmail: string): Promise<HistoryEntry[]> {
  const cleanEmail = normalizeHistoryEmail(userEmail);
  if (!cleanEmail) return [];
  return (await readAll())
    .filter(e => normalizeHistoryEmail(e.userEmail) === cleanEmail)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<HistoryEntry> {
  const cleanEmail = normalizeHistoryEmail(entry.userEmail);
  if (!cleanEmail) {
    throw new Error('addHistory requires a valid user email');
  }
  const saved: HistoryEntry = {
    ...entry,
    userEmail: cleanEmail,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  await writeAll([saved, ...(await readAll())]);
  return saved;
}

export async function deleteHistory(id: string, userEmail: string): Promise<void> {
  const cleanEmail = normalizeHistoryEmail(userEmail);
  if (!id || !cleanEmail) return;
  const all = await readAll();
  await writeAll(all.filter(e => {
    if (e.id === id && normalizeHistoryEmail(e.userEmail) === cleanEmail) {
      return false;
    }
    return true;
  }));
}

export async function clearUserHistory(userEmail: string): Promise<void> {
  const cleanEmail = normalizeHistoryEmail(userEmail);
  if (!cleanEmail) return;
  const all = await readAll();
  await writeAll(all.filter(e => normalizeHistoryEmail(e.userEmail) !== cleanEmail));
}

/** Safe date formatting with fallback */
export function formatHistoryDate(isoString?: string): string {
  if (!isoString) return 'Unknown date';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Safe time formatting with fallback */
export function formatHistoryTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Best single depth number for a leg: mean of rep minima, else the overall minimum */
export function bestAngle(e: HistoryEntry, side: 'left' | 'right'): number | null {
  return side === 'left'
    ? e.leftMeanRepMin ?? e.leftKneeMinAngle
    : e.rightMeanRepMin ?? e.rightKneeMinAngle;
}

/** Total repetitions completed across all sessions, safely distinguishing null/unmeasured from 0 */
export function computeTotalReps(entries: HistoryEntry[]): { totalReps: number; sessionsWithRepsCount: number } {
  let totalReps = 0;
  let sessionsWithRepsCount = 0;
  for (const e of entries) {
    if (typeof e.repCount === 'number' && Number.isInteger(e.repCount) && e.repCount > 0) {
      totalReps += e.repCount;
      sessionsWithRepsCount++;
    }
  }
  return { totalReps, sessionsWithRepsCount };
}

/** Best knee flexion (deepest bend) in degrees across all entries */
export function computeBestFlexion(entries: HistoryEntry[]): number | null {
  let bestFlexion: number | null = null;
  for (const e of entries) {
    const lAngle = bestAngle(e, 'left');
    const rAngle = bestAngle(e, 'right');
    const lFlex = toClinicalFlexion(lAngle);
    const rFlex = toClinicalFlexion(rAngle);

    const candidates = [lFlex, rFlex].filter((v): v is number => v !== null);
    if (candidates.length > 0) {
      const maxInSession = Math.max(...candidates);
      if (bestFlexion === null || maxInSession > bestFlexion) {
        bestFlexion = maxInSession;
      }
    }
  }
  return bestFlexion;
}

/** Bilateral symmetry metrics across sessions where both legs are tracked */
export function computeBilateralSymmetry(entries: HistoryEntry[]): {
  bilateralCount: number;
  avgAsymmetry: number | null;
  leftDeeperCount: number;
  rightDeeperCount: number;
  equalDepthCount: number;
} {
  const bilateralSessions = entries.filter(e => {
    const l = bestAngle(e, 'left');
    const r = bestAngle(e, 'right');
    return (
      typeof l === 'number' &&
      Number.isFinite(l) &&
      l >= 0 &&
      l <= 180 &&
      typeof r === 'number' &&
      Number.isFinite(r) &&
      r >= 0 &&
      r <= 180
    );
  });

  if (bilateralSessions.length === 0) {
    return {
      bilateralCount: 0,
      avgAsymmetry: null,
      leftDeeperCount: 0,
      rightDeeperCount: 0,
      equalDepthCount: 0,
    };
  }

  let sumDiff = 0;
  let leftDeeperCount = 0;
  let rightDeeperCount = 0;
  let equalDepthCount = 0;

  for (const e of bilateralSessions) {
    const l = bestAngle(e, 'left') as number;
    const r = bestAngle(e, 'right') as number;
    const diff = Math.round(Math.abs(l - r) * 10) / 10;
    sumDiff += diff;
    if (l === r || diff === 0) {
      equalDepthCount++;
    } else if (l < r) {
      leftDeeperCount++; // smaller interior angle = deeper bend
    } else {
      rightDeeperCount++;
    }
  }

  const avgAsymmetry = Math.round((sumDiff / bilateralSessions.length) * 10) / 10;
  return {
    bilateralCount: bilateralSessions.length,
    avgAsymmetry,
    leftDeeperCount,
    rightDeeperCount,
    equalDepthCount,
  };
}

/** Repetition depth spread consistency across multi-repetition sessions */
export function computeAvgRepSpread(entries: HistoryEntry[]): {
  multiRepCount: number;
  avgRepSpread: number | null;
} {
  const multiRepSessions = entries.filter(
    e =>
      e.repDetection !== 'fallback_overall_min' &&
      ((Array.isArray(e.leftRepMins) && e.leftRepMins.length >= 2) ||
        (Array.isArray(e.rightRepMins) && e.rightRepMins.length >= 2))
  );

  if (multiRepSessions.length === 0) {
    return { multiRepCount: 0, avgRepSpread: null };
  }

  let sumSpread = 0;
  let counted = 0;

  for (const e of multiRepSessions) {
    const spreads: number[] = [];
    if (Array.isArray(e.leftRepMins) && e.leftRepMins.length >= 2) {
      const valid = e.leftRepMins.filter(
        (a): a is number => typeof a === 'number' && Number.isFinite(a) && a >= 0 && a <= 180
      );
      if (valid.length >= 2) {
        spreads.push(Math.max(...valid) - Math.min(...valid));
      }
    }
    if (Array.isArray(e.rightRepMins) && e.rightRepMins.length >= 2) {
      const valid = e.rightRepMins.filter(
        (a): a is number => typeof a === 'number' && Number.isFinite(a) && a >= 0 && a <= 180
      );
      if (valid.length >= 2) {
        spreads.push(Math.max(...valid) - Math.min(...valid));
      }
    }
    if (spreads.length > 0) {
      sumSpread += Math.round(Math.min(...spreads) * 10) / 10;
      counted++;
    }
  }

  if (counted === 0) {
    return { multiRepCount: 0, avgRepSpread: null };
  }

  return {
    multiRepCount: counted,
    avgRepSpread: Math.round((sumSpread / counted) * 10) / 10,
  };
}

/** Overall pose tracking fidelity percentage */
export function computeTrackingFidelity(entries: HistoryEntry[]): number | null {
  let totalAnalyzed = 0;
  let totalWithPose = 0;
  for (const e of entries) {
    if (
      typeof e.framesAnalyzed === 'number' &&
      Number.isFinite(e.framesAnalyzed) &&
      e.framesAnalyzed > 0 &&
      typeof e.framesWithPose === 'number' &&
      Number.isFinite(e.framesWithPose) &&
      e.framesWithPose >= 0
    ) {
      totalAnalyzed += e.framesAnalyzed;
      totalWithPose += Math.min(e.framesAnalyzed, e.framesWithPose);
    }
  }
  return totalAnalyzed > 0 ? (totalWithPose / totalAnalyzed) * 100 : null;
}