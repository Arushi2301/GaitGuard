import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import TopBar, { TabScreen } from '../../components/TopBar';
import { AppButton } from '../../components/ui';
import { getMovement } from '../../constants/movements';
import { useAuth } from '../../services/auth';
import {
  bestAngle,
  deleteHistory,
  formatHistoryDate,
  formatHistoryTime,
  getHistory,
  HistoryEntry,
} from '../../services/history';
import { assessSquat, toClinicalFlexion } from '../../services/screening';
import { radius, space } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

const fmt = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '—';

export default function History() {
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMovement, setFilterMovement] = useState<'all' | 'squat'>('all');

  const loadData = useCallback(async () => {
    if (!user?.email) {
      setEntries([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getHistory(user.email);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const confirmDelete = (entry: HistoryEntry) => {
    const formattedDate = formatHistoryDate(entry.createdAt);
    Alert.alert(
      'Delete Screening?',
      `Are you sure you want to delete this ${entry.movement} screening from ${formattedDate}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.email) return;
            await deleteHistory(entry.id, user.email);
            setEntries(prev => prev.filter(e => e.id !== entry.id));
          },
        },
      ]
    );
  };

  const filtered = entries.filter(e => {
    if (filterMovement === 'all') return true;
    return e.movement === filterMovement;
  });

  const squatCount = entries.filter(e => e.movement === 'squat').length;

  return (
    <TabScreen>
      <TopBar subtitle="Your past screenings" />

      {/* Header */}
      <View style={{ marginBottom: space.md }}>
        <Text style={[s.title, { color: colors.text }]}>Screening History</Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4, lineHeight: 20 }}>
          Review your past movement assessments, tracked joint angles, and session details.
        </Text>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={[s.centeredBox, { paddingVertical: space.xl * 2 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12, fontSize: 14 }}>
            Loading your history…
          </Text>
        </View>
      )}

      {/* Not Logged In State */}
      {!loading && !authLoading && !user && (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', padding: space.xl }]}>
          <View style={[s.emptyIconCircle, { backgroundColor: colors.lavender }]}>
            <Ionicons name="person-outline" size={32} color={colors.onPastel} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>Sign in to view history</Text>
          <Text style={[s.emptySub, { color: colors.muted }]}>
            Your movement screenings are safely stored with your account.
          </Text>
          <AppButton
            title="Go to Welcome"
            onPress={() => router.replace('/welcome')}
            style={{ width: '100%', marginTop: space.md }}
          />
        </View>
      )}

      {/* Empty State */}
      {!loading && user && entries.length === 0 && (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', padding: space.xl }]}>
          <View style={[s.emptyIconCircle, { backgroundColor: colors.mint }]}>
            <Ionicons name="time-outline" size={36} color={colors.onPastel} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No screenings yet</Text>
          <Text style={[s.emptySub, { color: colors.muted }]}>
            When you complete a movement screening, your knee angles, repetition stats, and observational summary will be saved here.
          </Text>
          <AppButton
            title="Start a Screening"
            onPress={() => router.navigate('/(tabs)/analyze')}
            style={{ width: '100%', marginTop: space.lg }}
          />
        </View>
      )}

      {/* History Content */}
      {!loading && user && entries.length > 0 && (
        <>
          {/* Summary & Filters Bar */}
          <View style={s.summaryBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.countBadge, { backgroundColor: colors.mint }]}>
                <Ionicons name="document-text-outline" size={14} color={colors.onPastel} />
                <Text style={[s.countText, { color: colors.onPastel }]}>
                  {entries.length} {entries.length === 1 ? 'screening' : 'screenings'}
                </Text>
              </View>
            </View>

            {/* Filter buttons */}
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                onPress={() => setFilterMovement('all')}
                style={[
                  s.filterBtn,
                  {
                    backgroundColor: filterMovement === 'all' ? colors.primary : colors.surface,
                    borderColor: filterMovement === 'all' ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.filterBtnText,
                    { color: filterMovement === 'all' ? colors.onPrimary : colors.text },
                  ]}
                >
                  All ({entries.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterMovement('squat')}
                style={[
                  s.filterBtn,
                  {
                    backgroundColor: filterMovement === 'squat' ? colors.primary : colors.surface,
                    borderColor: filterMovement === 'squat' ? colors.primary : colors.border,
                    marginLeft: 6,
                  },
                ]}
              >
                <Text
                  style={[
                    s.filterBtnText,
                    { color: filterMovement === 'squat' ? colors.onPrimary : colors.text },
                  ]}
                >
                  Squats ({squatCount})
                </Text>
              </Pressable>
            </View>
          </View>

          {/* List of Entries */}
          {filtered.length === 0 ? (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', padding: space.lg }]}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                No screenings matching this filter.
              </Text>
            </View>
          ) : (
            filtered.map(entry => {
              const isExpanded = expandedId === entry.id;
              const movementDef = getMovement(entry.movement);
              const movementName = movementDef?.name ?? (entry.movement ? entry.movement.charAt(0).toUpperCase() + entry.movement.slice(1) : 'Movement');
              const isSquat = entry.movement === 'squat';

              // Recompute Member 3's SquatAssessment safely from historical fields
              const assessment = isSquat ? assessSquat(entry, entry) : null;
              const depthCategory = assessment?.depthCategory;

              // Badging color based on depth category
              const badgeColor =
                depthCategory === 'Deep'
                  ? colors.mint
                  : depthCategory === 'Parallel'
                  ? colors.mint
                  : depthCategory === 'Half'
                  ? colors.yellow
                  : depthCategory === 'Shallow'
                  ? colors.peach
                  : colors.surface;

              const leftAngle = bestAngle(entry, 'left');
              const rightAngle = bestAngle(entry, 'right');
              const leftFlexion = toClinicalFlexion(leftAngle);
              const rightFlexion = toClinicalFlexion(rightAngle);

              return (
                <View
                  key={entry.id}
                  style={[
                    s.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isExpanded ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {/* Card Header */}
                  <Pressable
                    onPress={() => toggleExpand(entry.id)}
                    style={s.cardHeader}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={[s.movementIcon, { backgroundColor: movementDef ? colors[movementDef.color] : colors.lavender }]}>
                        <Ionicons
                          name={movementDef?.icon ?? 'body'}
                          size={20}
                          color={colors.onPastel}
                        />
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={[s.cardMovementName, { color: colors.text }]} numberOfLines={1}>
                          {movementName}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {formatHistoryDate(entry.createdAt)} · {formatHistoryTime(entry.createdAt)}
                        </Text>
                      </View>
                    </View>

                    {/* Category Badge & Expand Icon */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {depthCategory && depthCategory !== 'Unmeasured' && (
                        <View style={[s.depthBadge, { backgroundColor: badgeColor }]}>
                          <Text style={[s.depthBadgeText, { color: colors.onPastel }]}>
                            {depthCategory}
                          </Text>
                        </View>
                      )}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.muted}
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  </Pressable>

                  {/* Summary Metrics Row */}
                  <View style={s.metricsRow}>
                    {/* Left Knee */}
                    <View style={s.metricColumn}>
                      <Text style={[s.metricLabel, { color: colors.muted }]}>Left Knee</Text>
                      <Text style={[s.metricValue, { color: colors.text }]}>
                        {leftAngle !== null ? `${fmt(leftAngle)}°` : 'Not measured'}
                      </Text>
                      {leftFlexion !== null && (
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                          Bend ≈ {fmt(leftFlexion)}°
                        </Text>
                      )}
                    </View>

                    {/* Divider */}
                    <View style={[s.verticalDivider, { backgroundColor: colors.border }]} />

                    {/* Right Knee */}
                    <View style={s.metricColumn}>
                      <Text style={[s.metricLabel, { color: colors.muted }]}>Right Knee</Text>
                      <Text style={[s.metricValue, { color: colors.text }]}>
                        {rightAngle !== null ? `${fmt(rightAngle)}°` : 'Not measured'}
                      </Text>
                      {rightFlexion !== null && (
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                          Bend ≈ {fmt(rightFlexion)}°
                        </Text>
                      )}
                    </View>

                    {/* Divider */}
                    <View style={[s.verticalDivider, { backgroundColor: colors.border }]} />

                    {/* Reps or Asymmetry */}
                    <View style={s.metricColumn}>
                      <Text style={[s.metricLabel, { color: colors.muted }]}>Completed</Text>
                      <Text style={[s.metricValue, { color: colors.text }]}>
                        {entry.repCount !== null ? `${entry.repCount} reps` : '1 motion'}
                      </Text>
                      {assessment?.asymmetryDegrees !== null && assessment?.asymmetryDegrees !== undefined ? (
                        <Text style={{ fontSize: 11, color: colors.muted }}>
                          Diff: {fmt(assessment.asymmetryDegrees)}°
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 11, color: colors.muted }}>
                          {entry.repDetection === 'fallback_overall_min' ? 'Single motion' : 'Clean reps'}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Expandable Details Drawer */}
                  {isExpanded && (
                    <View style={[s.drawerContainer, { borderTopColor: colors.border }]}>
                      {/* Non-Diagnostic Summary Box */}
                      {assessment?.summary ? (
                        <View style={[s.summaryBox, { backgroundColor: colors.bg }]}>
                          <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                            {assessment.summary}
                          </Text>
                        </View>
                      ) : null}

                      {/* Repetition Depths Breakdown */}
                      {(entry.leftRepMins.length > 0 || entry.rightRepMins.length > 0) && (
                        <View style={{ marginBottom: space.sm }}>
                          <Text style={[s.drawerSubheading, { color: colors.text }]}>
                            Depth Per Repetition
                          </Text>
                          {entry.leftRepMins.length > 0 && (
                            <View style={s.repRow}>
                              <Text style={[s.repSideLabel, { color: colors.muted }]}>Left:</Text>
                              <View style={s.repChipsWrap}>
                                {entry.leftRepMins.map((val, idx) => (
                                  <View key={idx} style={[s.repChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
                                      R{idx + 1}: {fmt(val)}°
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                          {entry.rightRepMins.length > 0 && (
                            <View style={s.repRow}>
                              <Text style={[s.repSideLabel, { color: colors.muted }]}>Right:</Text>
                              <View style={s.repChipsWrap}>
                                {entry.rightRepMins.map((val, idx) => (
                                  <View key={idx} style={[s.repChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
                                      R{idx + 1}: {fmt(val)}°
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Left-Right Difference Detail */}
                      {assessment?.asymmetryDegrees !== null && assessment?.asymmetryDegrees !== undefined && (
                        <View style={{ marginBottom: space.sm }}>
                          <Text style={[s.drawerSubheading, { color: colors.text }]}>
                            Bilateral Difference
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                            Observed left–right angle difference: {fmt(assessment.asymmetryDegrees)}°
                            {assessment.deeperSide === 'equal'
                              ? ' (both knees bent equally)'
                              : ` (${assessment.deeperSide} knee bending deeper)`}.
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.muted, opacity: 0.8, marginTop: 2 }}>
                            Note: Single-camera lateral video naturally contributes to observed difference through 2D perspective and far-leg occlusion.
                          </Text>
                        </View>
                      )}

                      {/* Tracking Frames Summary */}
                      {entry.framesAnalyzed !== undefined && entry.framesWithPose !== undefined && (
                        <View style={{ marginBottom: space.sm }}>
                          <Text style={{ fontSize: 11, color: colors.muted }}>
                            Pose landmarks tracked in {entry.framesWithPose} of {entry.framesAnalyzed} analyzed video frames (
                            {((entry.framesWithPose / Math.max(1, entry.framesAnalyzed)) * 100).toFixed(0)}%).
                          </Text>
                        </View>
                      )}

                      {/* Bottom Action Row: Delete & Toggle */}
                      <View style={s.drawerActions}>
                        <Pressable
                          onPress={() => confirmDelete(entry)}
                          style={[s.deleteBtn, { borderColor: colors.danger }]}
                        >
                          <Ionicons name="trash-outline" size={15} color={colors.danger} />
                          <Text style={[s.deleteBtnText, { color: colors.danger }]}>Delete Session</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => toggleExpand(entry.id)}
                          style={{ paddingVertical: 6, paddingHorizontal: 10 }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>Close</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}
    </TabScreen>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  centeredBox: { alignItems: 'center', justifyContent: 'center' },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    marginTop: space.xs,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  countText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  filterBtn: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterBtnText: { fontSize: 12, fontWeight: '700' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  movementIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMovementName: { fontSize: 16, fontWeight: '800' },
  depthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  depthBadgeText: { fontSize: 11, fontWeight: '800' },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.sm + 2,
    paddingTop: space.sm,
  },
  metricColumn: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  metricValue: { fontSize: 15, fontWeight: '800', marginBottom: 1 },
  verticalDivider: { width: 1, height: 32 },
  drawerContainer: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
  },
  summaryBox: {
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: space.sm,
  },
  drawerSubheading: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  repRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  repSideLabel: { width: 44, fontSize: 12, fontWeight: '700' },
  repChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  repChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  drawerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    paddingTop: space.xs,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteBtnText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: space.xs },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 6, maxWidth: 280 },
});