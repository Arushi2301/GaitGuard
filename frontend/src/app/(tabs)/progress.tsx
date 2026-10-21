import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import TopBar, { TabScreen } from '../../components/TopBar';
import { AppButton } from '../../components/ui';
import { useAuth } from '../../services/auth';
import {
  bestAngle,
  computeAvgRepSpread,
  computeBestFlexion,
  computeBilateralSymmetry,
  computeTotalReps,
  computeTrackingFidelity,
  formatHistoryDate,
  getHistory,
  HistoryEntry,
} from '../../services/history';
import { assessSquat, toClinicalFlexion } from '../../services/screening';
import { radius, space } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

const fmt = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '—';

export default function Progress() {
  const { colors, mode } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

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

  /* ---------- Real Supported Metrics (No Invented Data) ---------- */

  // 1. Total sessions
  const totalSessions = entries.length;

  // 2. Total repetitions (safely distinguish null from 0)
  const { totalReps, sessionsWithRepsCount } = computeTotalReps(entries);

  // 3. Best knee flexion (deepest measured knee bend)
  const bestFlexion = computeBestFlexion(entries);

  // 4. Chronological progression data for trend chart (oldest to newest, up to 12 sessions)
  const chronological = [...entries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-12);

  const trendPoints: {
    id: string;
    dateLabel: string;
    flexion: number | null;
    interior: number | null;
    reps: number | null;
  }[] = chronological.map((e, idx) => {
    const lAngle = bestAngle(e, 'left');
    const rAngle = bestAngle(e, 'right');
    const validAngles = [lAngle, rAngle].filter((v): v is number => v !== null);
    const minInterior = validAngles.length > 0 ? Math.min(...validAngles) : null;
    const flex = toClinicalFlexion(minInterior);

    const d = new Date(e.createdAt);
    const dateLabel = isNaN(d.getTime())
      ? `S${idx + 1}`
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return {
      id: e.id,
      dateLabel,
      flexion: flex,
      interior: minInterior,
      reps: e.repCount,
    };
  });

  const validTrendPoints = trendPoints.filter(p => p.flexion !== null);

  // 5. Squat depth category distribution
  const squatEntries = entries.filter(e => e.movement === 'squat');
  const depthCounts: Record<string, number> = {
    Deep: 0,
    Parallel: 0,
    Half: 0,
    Shallow: 0,
    Unmeasured: 0,
  };

  for (const e of squatEntries) {
    const assessment = assessSquat(e, e);
    if (assessment.depthCategory in depthCounts) {
      depthCounts[assessment.depthCategory]++;
    } else {
      depthCounts.Unmeasured++;
    }
  }

  // 6. Bilateral symmetry analysis (aligned with bestAngle and assessSquat)
  const {
    bilateralCount,
    avgAsymmetry,
    leftDeeperCount,
    rightDeeperCount,
    equalDepthCount,
  } = computeBilateralSymmetry(entries);

  // 7. Repetition consistency (observed spread across sessions with >= 2 clean reps)
  const { multiRepCount, avgRepSpread } = computeAvgRepSpread(entries);

  // 8. Overall pose tracking fidelity
  const trackingPercent = computeTrackingFidelity(entries);

  /* ---------- SVG Chart Geometry ---------- */
  const chartWidth = Math.max(280, windowWidth - 2 * space.lg - 2 * space.md - 4);
  const chartHeight = 180;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 26;
  const padBottom = 28;

  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  // Y-axis range: sensible biomechanical flexion [40°, 130°]
  const flexValues = validTrendPoints.map(p => p.flexion as number);
  const minFlex = flexValues.length > 0 ? Math.min(50, Math.floor(Math.min(...flexValues) - 10)) : 50;
  const maxFlex = flexValues.length > 0 ? Math.max(120, Math.ceil(Math.max(...flexValues) + 10)) : 130;
  const flexSpan = Math.max(30, maxFlex - minFlex);

  const getX = (index: number) => {
    if (trendPoints.length <= 1) return padLeft + innerW / 2;
    return padLeft + (index / (trendPoints.length - 1)) * innerW;
  };

  const getY = (flex: number) => {
    const clamped = Math.max(minFlex, Math.min(maxFlex, flex));
    return padTop + innerH - ((clamped - minFlex) / flexSpan) * innerH;
  };

  // Build SVG path strings
  let linePathD = '';
  let areaPathD = '';

  if (validTrendPoints.length >= 2) {
    validTrendPoints.forEach((p, i) => {
      const originalIdx = trendPoints.findIndex(tp => tp.id === p.id);
      const x = getX(originalIdx);
      const y = getY(p.flexion as number);
      if (i === 0) {
        linePathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        linePathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    const firstX = getX(trendPoints.findIndex(tp => tp.id === validTrendPoints[0].id));
    const lastX = getX(trendPoints.findIndex(tp => tp.id === validTrendPoints[validTrendPoints.length - 1].id));
    const baselineY = padTop + innerH;
    areaPathD = `${linePathD} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  }

  // Active selected point
  const activePoint =
    selectedPointIndex !== null && trendPoints[selectedPointIndex]
      ? trendPoints[selectedPointIndex]
      : validTrendPoints.length > 0
      ? validTrendPoints[validTrendPoints.length - 1]
      : null;

  return (
    <TabScreen>
      <TopBar subtitle="Track your movement trends" />

      {/* Heading */}
      <View style={{ marginBottom: space.md }}>
        <Text style={[s.title, { color: colors.text }]}>Personal Progress</Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4, lineHeight: 20 }}>
          Objective kinematic trends and volume metrics from your saved movement screenings.
        </Text>
      </View>

      {/* Loading */}
      {loading && (
        <View style={[s.centeredBox, { paddingVertical: space.xl * 2 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12, fontSize: 14 }}>
            Aggregating your progress data…
          </Text>
        </View>
      )}

      {/* Not Logged In State */}
      {!loading && !authLoading && !user && (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', padding: space.xl }]}>
          <View style={[s.emptyIconCircle, { backgroundColor: colors.lavender }]}>
            <Ionicons name="person-outline" size={32} color={colors.onPastel} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>Sign in to view progress</Text>
          <Text style={[s.emptySub, { color: colors.muted }]}>
            Your progress dashboard aggregates your historical screenings and trends.
          </Text>
          <AppButton
            title="Go to Welcome"
            onPress={() => router.replace('/welcome')}
            style={{ width: '100%', marginTop: space.md }}
          />
        </View>
      )}

      {/* Empty State */}
      {!loading && user && totalSessions === 0 && (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', padding: space.xl }]}>
          <View style={[s.emptyIconCircle, { backgroundColor: colors.yellow }]}>
            <Ionicons name="stats-chart-outline" size={36} color={colors.onPastel} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No progress data yet</Text>
          <Text style={[s.emptySub, { color: colors.muted }]}>
            Complete your first movement screenings to view knee flexion progression, repetition volume, and depth consistency.
          </Text>
          <AppButton
            title="Start a Screening"
            onPress={() => router.navigate('/(tabs)/analyze')}
            style={{ width: '100%', marginTop: space.lg }}
          />
        </View>
      )}

      {/* Progress Content */}
      {!loading && user && totalSessions > 0 && (
        <>
          {/* 4 KPI Cards Grid */}
          <View style={s.kpiGrid}>
            {/* 1. Total Screenings */}
            <View style={[s.kpiCard, { backgroundColor: colors.mint }]}>
              <View style={s.kpiHeader}>
                <Ionicons name="calendar-outline" size={18} color={colors.onPastel} />
                <Text style={[s.kpiLabel, { color: colors.onPastel }]}>Sessions</Text>
              </View>
              <Text style={[s.kpiValue, { color: colors.onPastel }]}>{totalSessions}</Text>
              <Text style={[s.kpiFootnote, { color: colors.onPastel }]}>
                {entries[0] ? `Latest: ${formatHistoryDate(entries[0].createdAt)}` : 'Completed'}
              </Text>
            </View>

            {/* 2. Total Repetitions */}
            <View style={[s.kpiCard, { backgroundColor: colors.peach }]}>
              <View style={s.kpiHeader}>
                <Ionicons name="repeat-outline" size={18} color={colors.onPastel} />
                <Text style={[s.kpiLabel, { color: colors.onPastel }]}>Total Reps</Text>
              </View>
              <Text style={[s.kpiValue, { color: colors.onPastel }]}>{totalReps}</Text>
              <Text style={[s.kpiFootnote, { color: colors.onPastel }]}>
                {sessionsWithRepsCount > 0 ? `Across ${sessionsWithRepsCount} sets` : '1 motion / set'}
              </Text>
            </View>

            {/* 3. Best Knee Flexion */}
            <View style={[s.kpiCard, { backgroundColor: colors.yellow }]}>
              <View style={s.kpiHeader}>
                <Ionicons name="trending-up-outline" size={18} color={colors.onPastel} />
                <Text style={[s.kpiLabel, { color: colors.onPastel }]}>Best Bend</Text>
              </View>
              <Text style={[s.kpiValue, { color: colors.onPastel }]}>
                {bestFlexion !== null ? `${fmt(bestFlexion)}°` : '—'}
              </Text>
              <Text style={[s.kpiFootnote, { color: colors.onPastel }]}>
                {bestFlexion !== null ? `Interior ≈ ${fmt(180 - bestFlexion)}°` : 'No valid angles'}
              </Text>
            </View>

            {/* 4. Tracking Fidelity */}
            <View style={[s.kpiCard, { backgroundColor: colors.lavender }]}>
              <View style={s.kpiHeader}>
                <Ionicons name="scan-outline" size={18} color={colors.onPastel} />
                <Text style={[s.kpiLabel, { color: colors.onPastel }]}>Tracking</Text>
              </View>
              <Text style={[s.kpiValue, { color: colors.onPastel }]}>
                {trackingPercent !== null ? `${trackingPercent.toFixed(0)}%` : '—'}
              </Text>
              <Text style={[s.kpiFootnote, { color: colors.onPastel }]}>
                Frames with pose
              </Text>
            </View>
          </View>

          {/* Knee Flexion Progression Trend Chart Card */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="stats-chart" size={18} color={colors.primary} />
                <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0, marginLeft: 6 }]}>
                  Knee Flexion Trend
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '700' }}>
                Last {trendPoints.length} screenings
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.sm }}>
              Knee flexion (180° − interior angle). Higher degrees indicate deeper knee bending.
            </Text>

            {/* Active Point Callout */}
            {activePoint && activePoint.flexion !== null && (
              <View style={[s.activePointBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                    {activePoint.dateLabel}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
                    Flexion: {fmt(activePoint.flexion)}° (interior {fmt(activePoint.interior)}°)
                  </Text>
                </View>
              </View>
            )}

            {/* SVG Chart */}
            {validTrendPoints.length >= 2 ? (
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Svg width={chartWidth} height={chartHeight}>
                  {/* Grid Lines */}
                  {[60, 90, 120].map(level => {
                    if (level < minFlex || level > maxFlex) return null;
                    const y = getY(level);
                    const isParallel = level === 90;
                    return (
                      <G key={level}>
                        <Line
                          x1={padLeft}
                          y1={y}
                          x2={chartWidth - padRight}
                          y2={y}
                          stroke={isParallel ? colors.primary : colors.border}
                          strokeWidth={isParallel ? 1.2 : 0.8}
                          strokeDasharray={isParallel ? '4,4' : '2,2'}
                          strokeOpacity={isParallel ? 0.6 : 0.4}
                        />
                        <SvgText
                          x={padLeft - 6}
                          y={y + 3.5}
                          fill={colors.muted}
                          fontSize={10}
                          textAnchor="end"
                          fontWeight={isParallel ? '700' : '500'}
                        >
                          {level}°
                        </SvgText>
                      </G>
                    );
                  })}

                  {/* Area fill under curve */}
                  {areaPathD ? (
                    <Path d={areaPathD} fill={colors.primary} fillOpacity={0.12} />
                  ) : null}

                  {/* Trend Line */}
                  <Path
                    d={linePathD}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth={2.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data Points */}
                  {trendPoints.map((p, idx) => {
                    if (p.flexion === null) return null;
                    const x = getX(idx);
                    const y = getY(p.flexion);
                    const isSelected = selectedPointIndex === idx;

                    return (
                      <G key={p.id}>
                        {isSelected && (
                          <Circle
                            cx={x}
                            cy={y}
                            r={8}
                            fill={colors.primary}
                            fillOpacity={0.25}
                          />
                        )}
                        <Circle
                          cx={x}
                          cy={y}
                          r={isSelected ? 5.5 : 4}
                          fill={colors.surface}
                          stroke={colors.primary}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        {/* X-axis date label */}
                        <SvgText
                          x={x}
                          y={chartHeight - 8}
                          fill={isSelected ? colors.text : colors.muted}
                          fontSize={9}
                          fontWeight={isSelected ? '800' : '500'}
                          textAnchor="middle"
                        >
                          {p.dateLabel}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>

                {/* Point Selector Controls */}
                <View style={s.chartControlsRow}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Tap points to inspect exact knee angles:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                    {trendPoints.map((p, idx) => {
                      const active = selectedPointIndex === idx;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelectedPointIndex(idx)}
                          style={[
                            s.pointChip,
                            {
                              backgroundColor: active ? colors.primary : colors.bg,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: active ? colors.onPrimary : colors.text,
                            }}
                          >
                            {p.dateLabel}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : (
              <View style={[s.singleSessionBox, { backgroundColor: colors.bg }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 }}>
                  {validTrendPoints.length === 1
                    ? `1 valid screening recorded (${fmt(validTrendPoints[0].flexion)}° knee flexion). Complete at least 2 screenings to view your trend progression line.`
                    : 'Complete screenings with clear leg visibility to start charting your depth trends.'}
                </Text>
              </View>
            )}

            {/* Reference annotation */}
            <Text style={{ fontSize: 11, color: colors.muted, opacity: 0.8, marginTop: space.sm }}>
              Dashed 90° reference line reflects standard parallel squat depth context from published literature (Escamilla 2001, Schoenfeld 2010). Knee angle alone does not prove thighs are parallel.
            </Text>
          </View>

          {/* Depth Category Distribution Card */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
                <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0, marginLeft: 6 }]}>
                  Squat Depth Distribution
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '700' }}>
                {squatEntries.length} {squatEntries.length === 1 ? 'squat' : 'squats'}
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: space.md }}>
              Distribution of depth classifications across all completed squat screenings:
            </Text>

            {/* Multi-Segment Distribution Bar */}
            {squatEntries.length > 0 && (
              <View style={[s.distributionBar, { backgroundColor: colors.border }]}>
                {depthCounts.Deep > 0 && (
                  <View
                    style={{
                      flex: depthCounts.Deep,
                      backgroundColor: colors.mint,
                      height: '100%',
                    }}
                  />
                )}
                {depthCounts.Parallel > 0 && (
                  <View
                    style={{
                      flex: depthCounts.Parallel,
                      backgroundColor: colors.primary,
                      height: '100%',
                    }}
                  />
                )}
                {depthCounts.Half > 0 && (
                  <View
                    style={{
                      flex: depthCounts.Half,
                      backgroundColor: colors.yellow,
                      height: '100%',
                    }}
                  />
                )}
                {depthCounts.Shallow > 0 && (
                  <View
                    style={{
                      flex: depthCounts.Shallow,
                      backgroundColor: colors.peach,
                      height: '100%',
                    }}
                  />
                )}
                {depthCounts.Unmeasured > 0 && (
                  <View
                    style={{
                      flex: depthCounts.Unmeasured,
                      backgroundColor: colors.muted,
                      height: '100%',
                    }}
                  />
                )}
              </View>
            )}

            {/* Legend / Breakdown List */}
            <View style={{ marginTop: space.sm }}>
              {[
                { label: 'Deep', range: 'Flexion ≥ 110° (Interior ≤ 70°)', count: depthCounts.Deep, color: colors.mint },
                { label: 'Parallel', range: 'Flexion 90°–109.9° (Interior 70.1°–90°)', count: depthCounts.Parallel, color: colors.primary },
                { label: 'Half', range: 'Flexion 60°–89.9° (Interior 90.1°–120°)', count: depthCounts.Half, color: colors.yellow },
                { label: 'Shallow', range: 'Flexion < 60° (Interior > 120°)', count: depthCounts.Shallow, color: colors.peach },
                { label: 'Unmeasured', range: 'Angles not visible or out of range', count: depthCounts.Unmeasured, color: colors.muted },
              ].map(cat => {
                if (squatEntries.length === 0 && cat.count === 0) return null;
                const pct =
                  squatEntries.length > 0
                    ? ((cat.count / squatEntries.length) * 100).toFixed(0)
                    : '0';

                return (
                  <View key={cat.label} style={s.categoryRow}>
                    <View style={[s.categoryDot, { backgroundColor: cat.color }]} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[s.categoryName, { color: colors.text }]}>{cat.label}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>{cat.range}</Text>
                    </View>
                    <Text style={[s.categoryCount, { color: colors.text }]}>
                      {cat.count} <Text style={{ fontSize: 11, color: colors.muted }}>({pct}%)</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Bilateral Symmetry Analysis Card */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
              <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0, marginLeft: 6 }]}>
                Bilateral Symmetry Analysis
              </Text>
            </View>

            {avgAsymmetry !== null ? (
              <>
                <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>
                  Based on <Text style={{ fontWeight: '700', color: colors.text }}>{bilateralCount}</Text> screenings with both legs visible:
                </Text>

                <View style={[s.summaryBoxRow, { backgroundColor: colors.bg, marginVertical: space.sm }]}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Avg. Difference</Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                      {fmt(avgAsymmetry)}°
                    </Text>
                  </View>
                  <View style={[s.verticalDivider, { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Left Deeper</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {leftDeeperCount} sets
                    </Text>
                  </View>
                  <View style={[s.verticalDivider, { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Right Deeper</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {rightDeeperCount} sets
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 11, color: colors.muted, opacity: 0.8, lineHeight: 16 }}>
                  Perspective Caveat: In 2D single-camera lateral video, camera angle and far-leg occlusion naturally introduce apparent asymmetry (Bishop et al., 2018). Differences are descriptive and should be interpreted cautiously.
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                Bilateral comparison requires both left and right legs to be tracked in the video. In side-on recordings, the far leg is frequently occluded.
              </Text>
            )}
          </View>

          {/* Repetition Consistency Card */}
          {avgRepSpread !== null && (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="repeat" size={18} color={colors.primary} />
                <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0, marginLeft: 6 }]}>
                  Repetition Depth Consistency
                </Text>
              </View>

              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>
                Evaluated across <Text style={{ fontWeight: '700', color: colors.text }}>{multiRepCount}</Text> multi-repetition sessions:
              </Text>

              <View style={[s.summaryBoxRow, { backgroundColor: colors.bg, marginVertical: space.sm }]}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Average Depth Spread</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                    {fmt(avgRepSpread)}°
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 11, color: colors.muted, opacity: 0.8, lineHeight: 16 }}>
                Repetition spread represents the difference between your deepest and shallowest repetition within a set (deepest − shallowest). A smaller spread indicates more consistent repetition depth.
              </Text>
            </View>
          )}

          {/* Non-Diagnostic Scientific Notice */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={[s.cardTitle, { color: colors.text, marginBottom: 0, marginLeft: 6 }]}>
                Scientific Notice
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              Injury risk has not been assessed. GaitGuard provides descriptive kinematic measurements only. It does not provide a medical diagnosis, evaluate injury risk, or determine whether an exercise is safe or unsafe. Consult a qualified sports-medicine professional for clinical evaluation.
            </Text>
          </View>
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
    marginBottom: space.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  kpiCard: {
    width: '48%',
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm + 2,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '900',
    marginVertical: 2,
  },
  kpiFootnote: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  activePointBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: space.xs,
  },
  chartControlsRow: {
    marginTop: space.sm,
    width: '100%',
  },
  pointChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
  },
  singleSessionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.sm,
    marginTop: space.xs,
  },
  distributionBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    width: '100%',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.sm,
  },
  verticalDivider: {
    width: 1,
    height: 32,
  },
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