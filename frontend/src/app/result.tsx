import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/ui';
import { getMovement } from '../constants/movements';
import { analyzeVideo } from '../services/analysis';
import { useAuth } from '../services/auth';
import { addHistory, parseRepStats, RepStats } from '../services/history';
import { useNotifications } from '../services/notifications';
import { assessSquatMovement, processAnalysisResult, ScreeningOutcome } from '../services/screening';
import { getVideoUri } from '../services/videoStore';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const RETRY_TIPS: Record<string, string[]> = {
  no_pose_detected: ['Make sure your whole body is in the frame', 'Improve the lighting'],
  legs_not_visible: ['Keep hips, knees and ankles visible', 'Avoid loose clothing over the knees'],
  cannot_open_video: ['Record a new video in the app', 'Use a standard MP4 video'],
  network_error: ['Check that the backend is running', 'Phone and laptop must be on the same hotspot', 'Check Settings → Server'],
  timeout: ['Try a shorter clip', 'Check the network connection'],
};

const fmt = (n: number) => n.toFixed(1);

export default function Result() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const uri = getVideoUri() ?? '';

  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<ScreeningOutcome | null>(null);
  const [reps, setReps] = useState<RepStats | null>(null);
  const requestRef = useRef<{ key: string; promise: ReturnType<typeof analyzeVideo> } | null>(null);
  const savedRef = useRef(false);

  const movementDetails = getMovement(movement);
  const movementName =
    movementDetails?.name ?? (movement ? movement.charAt(0).toUpperCase() + movement.slice(1) : 'Movement Screening');

  const assessment =
    outcome?.success && outcome.measurement.movement === 'squat'
      ? assessSquatMovement(outcome.measurement, reps)
      : null;

  /* ---------- Member 3's analysis flow (unchanged logic) ---------- */
  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setOutcome({
        success: false,
        errorMessage: 'No video was found to analyze. Please record or choose a video first.',
        reason: 'missing_video_uri',
      });
      return;
    }

    let isMounted = true;
    const requestKey = `${uri}:${movement}`;

    // Prevent duplicate network calls in Strict Mode or re-renders
    if (!requestRef.current || requestRef.current.key !== requestKey) {
      requestRef.current = { key: requestKey, promise: analyzeVideo(uri, movement) };
    }

    requestRef.current.promise
      .then(res => {
        if (isMounted) {
          setOutcome(processAnalysisResult(res, movement));
          setReps(parseRepStats(res.ok ? res.data : null)); // extra per-rep fields
        }
      })
      .catch(() => {
        if (isMounted) {
          setOutcome({ success: false, errorMessage: 'Analysis failed. Please try again.', reason: 'unhandled_client_error' });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [uri, movement]);

  /* ---------- Save to history + notify (once) ---------- */
  useEffect(() => {
    if (!outcome || savedRef.current) return;
    savedRef.current = true;

    if (outcome.success) {
      const mm = outcome.measurement;
      const r = reps ?? parseRepStats(null);
      if (user) {
        addHistory({
          userEmail: user.email,
          movement: movement || mm.movement,
          leftKneeMinAngle: mm.leftKneeMinAngle,
          rightKneeMinAngle: mm.rightKneeMinAngle,
          framesAnalyzed: mm.framesAnalyzed,
          framesWithPose: mm.framesWithPose,
          ...r,
        }).catch(() => {});
      }
      const shown = r.rightMeanRepMin ?? mm.rightKneeMinAngle ?? r.leftMeanRepMin ?? mm.leftKneeMinAngle;
      notify({
        type: 'analysis_complete',
        title: `${movementName} analyzed`,
        body: `${r.repCount !== null ? `${r.repCount} reps · ` : ''}${shown !== null ? `knee angle ${fmt(shown)}°` : 'result ready'}`,
      });
    } else {
      notify({ type: 'analysis_failed', title: 'Analysis incomplete', body: outcome.errorMessage });
    }
  }, [outcome]);

  const goHome = () => {
    router.dismissAll();
    router.navigate('/(tabs)/home');
  };

  /* ---------- UI ---------- */
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.text }]}>{movementName}</Text>
        <Text style={{ color: colors.muted, marginBottom: space.md }}>
          {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>

        {loading && (
          <View style={[s.loading, { backgroundColor: colors.lavender }]}>
            <ActivityIndicator size="large" color={colors.onPastel} />
            <Text style={[s.loadingTitle, { color: colors.onPastel }]}>Analyzing video…</Text>
            <Text style={{ color: colors.onPastel, opacity: 0.75, textAlign: 'center', marginTop: 4 }}>
              Tracking body landmarks and calculating knee angles. This usually takes 10–30 seconds.
            </Text>
          </View>
        )}

        {!loading && outcome?.success && (
          <>
            {/* Status + reps */}
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: colors.mint }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.onPastel} />
                <Text style={[s.badgeText, { color: colors.onPastel }]}>Analysis complete</Text>
              </View>
              {reps?.repCount !== null && reps?.repCount !== undefined && (
                <View style={[s.badge, { backgroundColor: colors.yellow, marginLeft: 8 }]}>
                  <Ionicons name="repeat" size={18} color={colors.onPastel} />
                  <Text style={[s.badgeText, { color: colors.onPastel }]}>{reps.repCount} reps</Text>
                </View>
              )}
            </View>

            {/* Knee cards */}
            <View style={[s.row, { marginTop: space.md }]}>
              <KneeCard
                side="Left knee"
                bg={colors.pink}
                minAngle={outcome.measurement.leftKneeMinAngle}
                meanAngle={reps?.leftMeanRepMin ?? null}
                fallback={reps?.repDetection === 'fallback_overall_min'}
              />
              <View style={{ width: 12 }} />
              <KneeCard
                side="Right knee"
                bg={colors.peach}
                minAngle={outcome.measurement.rightKneeMinAngle}
                meanAngle={reps?.rightMeanRepMin ?? null}
                fallback={reps?.repDetection === 'fallback_overall_min'}
              />
            </View>

            {/* Per-rep values */}
            {!!reps && (reps.leftRepMins.length > 0 || reps.rightRepMins.length > 0) && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.cardTitle, { color: colors.text }]}>Depth per rep</Text>
                <RepRow label="Left" values={reps.leftRepMins} />
                <RepRow label="Right" values={reps.rightRepMins} />
              </View>
            )}

            {/* Screening Assessment (Squat only) */}
            {assessment && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="analytics-outline" size={18} color={colors.primary} />
                  <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0, marginLeft: 6 }]}>
                    Screening Assessment
                  </Text>
                </View>

                {assessment.primaryLeg && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 }}>
                      Observed Squat Depth
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                      {assessment.primaryLeg.description}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, opacity: 0.8, marginTop: 2 }}>
                      Squat biomechanics research considers thigh position as well as joint angles. Knee angle alone cannot establish whether the thighs are parallel for every person.
                    </Text>
                  </View>
                )}

                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 }}>
                    Left–Right Difference
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                    {assessment.asymmetry.description}
                  </Text>
                  {assessment.asymmetry.evaluated && (
                    <Text style={{ fontSize: 11, color: colors.muted, opacity: 0.8, marginTop: 2 }}>
                      Note: Single-camera measurements can be affected by perspective and occlusion; interpret small left–right differences cautiously.
                    </Text>
                  )}
                </View>

                {reps && (reps.leftRepMins.length > 0 || reps.rightRepMins.length > 0 || reps.repDetection === 'fallback_overall_min') && (
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 }}>
                      Repetition Variation
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                      {assessment.repetitionVariation.description}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Explanation */}
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>Understanding knee angle</Text>
              <Text style={{ color: colors.muted, lineHeight: 20 }}>
                180° is a straight leg. Smaller knee angles indicate deeper knee bending during the movement.
                “Knee bend” shows how far the knee bent from straight (180° − angle).
              </Text>
            </View>

            {/* Member 3's scientific notice */}
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0, marginLeft: 6 }]}>Scientific notice</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                Injury risk has not been assessed. GaitGuard provides descriptive kinematic measurements only. It does not provide a medical diagnosis, evaluate injury risk, or determine whether an exercise is safe or unsafe. Consult a qualified sports-medicine professional for clinical evaluation.
              </Text>
            </View>

            {outcome.measurement.framesAnalyzed !== undefined && outcome.measurement.framesWithPose !== undefined && (
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                Pose tracked in {outcome.measurement.framesWithPose} of {outcome.measurement.framesAnalyzed} analyzed frames.
              </Text>
            )}
          </>
        )}

        {!loading && outcome && !outcome.success && (
          <>
            <View style={[s.failCard, { backgroundColor: colors.pink }]}>
              <Ionicons name="alert-circle" size={40} color={colors.onPastel} />
              <Text style={[s.failTitle, { color: colors.onPastel }]}>Analysis incomplete</Text>
              <Text style={{ color: colors.onPastel, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                {outcome.errorMessage}
              </Text>
            </View>

            {!!outcome.reason && RETRY_TIPS[outcome.reason] && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.cardTitle, { color: colors.text }]}>Try this</Text>
                {RETRY_TIPS[outcome.reason].map(t => (
                  <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primary} />
                    <Text style={{ color: colors.muted, marginLeft: 8, flex: 1 }}>{t}</Text>
                  </View>
                ))}
              </View>
            )}

            <AppButton title="Record Again" onPress={() => router.back()} />
          </>
        )}
      </ScrollView>

      {!loading && (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          <AppButton title="Back to Home" variant={outcome?.success ? 'primary' : 'outline'} onPress={goHome} />
        </View>
      )}
    </View>
  );
}

/* ---------- pieces ---------- */
function KneeCard({ side, bg, minAngle, meanAngle, fallback }: {
  side: string; bg: string; minAngle: number | null; meanAngle: number | null; fallback: boolean;
}) {
  const { colors } = useTheme();
  const main = meanAngle ?? minAngle; // prefer the mean of rep minima
  const label = meanAngle !== null && !fallback ? 'Avg. depth' : 'Deepest point';

  return (
    <View style={[s.knee, { backgroundColor: bg }]}>
      <Text style={[s.kneeSide, { color: colors.onPastel }]}>{side}</Text>
      {main === null ? (
        <>
          <Text style={[s.kneeNA, { color: colors.onPastel }]}>Not measured</Text>
          <Text style={{ color: colors.onPastel, opacity: 0.7, fontSize: 12, marginTop: 4 }}>
            Leg was not clearly visible in the video
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: colors.onPastel, opacity: 0.7, fontSize: 12, marginTop: 6 }}>{label}</Text>
          <Text style={[s.kneeValue, { color: colors.onPastel }]}>
            {fmt(main)}
            <Text style={{ fontSize: 18 }}>°</Text>
          </Text>
          <Text style={{ color: colors.onPastel, fontSize: 12, fontWeight: '700' }}>Knee bend ≈ {fmt(180 - main)}°</Text>
          {minAngle !== null && meanAngle !== null && !fallback && (
            <Text style={{ color: colors.onPastel, opacity: 0.7, fontSize: 12, marginTop: 4 }}>Deepest: {fmt(minAngle)}°</Text>
          )}
        </>
      )}
    </View>
  );
}

function RepRow({ label, values }: { label: string; values: number[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
      <Text style={{ color: colors.muted, width: 48, fontWeight: '700' }}>{label}</Text>
      {values.length === 0 ? (
        <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Not detected</Text>
      ) : (
        values.map((v, i) => (
          <View key={i} style={[s.repChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
              Rep {i + 1}: {fmt(v)}°
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  loading: { alignItems: 'center', padding: space.xl, borderRadius: radius.lg, marginTop: space.md },
  loadingTitle: { fontSize: 18, fontWeight: '800', marginTop: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  badgeText: { fontWeight: '800', marginLeft: 6 },
  knee: { flex: 1, borderRadius: radius.lg, padding: space.md, minHeight: 150 },
  kneeSide: { fontWeight: '800', fontSize: 14 },
  kneeValue: { fontSize: 38, fontWeight: '900', marginVertical: 2 },
  kneeNA: { fontSize: 20, fontWeight: '800', marginTop: 14 },
  card: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  repChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginTop: 4 },
  failCard: { alignItems: 'center', padding: space.lg, borderRadius: radius.lg },
  failTitle: { fontSize: 20, fontWeight: '800', marginTop: 8 },
});