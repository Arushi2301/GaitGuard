import AsyncStorage from '@react-native-async-storage/async-storage';

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

/** Newest first, only for this user */
export async function getHistory(userEmail: string): Promise<HistoryEntry[]> {
  return (await readAll())
    .filter(e => e.userEmail === userEmail)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<HistoryEntry> {
  const saved: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  await writeAll([saved, ...(await readAll())]);
  return saved;
}

export async function deleteHistory(id: string) {
  await writeAll((await readAll()).filter(e => e.id !== id));
}

/** Best single depth number for a leg: mean of rep minima, else the overall minimum */
export function bestAngle(e: HistoryEntry, side: 'left' | 'right'): number | null {
  return side === 'left'
    ? e.leftMeanRepMin ?? e.leftKneeMinAngle
    : e.rightMeanRepMin ?? e.rightKneeMinAngle;
}