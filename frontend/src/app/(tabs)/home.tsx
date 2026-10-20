import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TopBar, { TabScreen } from '../../components/TopBar';
import { AppButton } from '../../components/ui';
import { getMovement } from '../../constants/movements';
import { useAuth } from '../../services/auth';
import { bestAngle, getHistory, HistoryEntry } from '../../services/history';
import { radius, space } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

const TIPS = [
  'Film from the side for squats — the camera should be at hip height.',
  'Wear fitted clothes so your knees and hips are clearly visible.',
  'Do 2–3 slow, controlled reps instead of many fast ones.',
  'Good lighting from the front helps the app track your joints.',
  'Keep the phone still — lean it against something or use a stand.',
  'Screen at the same time of day to compare results fairly.',
  'Warm up for a few minutes before recording your squats.',
];

const fmt = (n: number) => n.toFixed(1);

function entryAngle(e: HistoryEntry): number | null {
  const vals = [bestAngle(e, 'left'), bestAngle(e, 'right')].filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getHistory(user.email).then(h => {
        setItems(h);
        setLoaded(true);
      });
    }, [user]),
  );

  const latest = items[0];
  const activeDays = new Set(items.map(i => new Date(i.createdAt).toDateString())).size;
  const totalReps = items.reduce((sum, i) => sum + (i.repCount ?? 0), 0);
  const latestAngle = latest ? entryAngle(latest) : null;
  const trend = items.slice(0, 7).reverse();
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  const goAnalyze = () => router.navigate('/(tabs)/analyze');
  const goHistory = () => router.navigate('/(tabs)/history');

  return (
    <TabScreen>
      <TopBar subtitle={today} />

      <View style={[s.hero, { backgroundColor: colors.lavender }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.heroTitle, { color: colors.onPastel }]}>Ready for today’s{'\n'}screening?</Text>
          <Text style={{ color: colors.onPastel, opacity: 0.75, marginTop: 6 }}>
            {latest ? `Last screening: ${timeAgo(latest.createdAt)}` : 'Record a short squat to get started.'}
          </Text>
          <Pressable onPress={goAnalyze} style={[s.heroBtn, { backgroundColor: colors.tabBar }]}>
            <Text style={{ color: colors.onTabBar, fontWeight: '800' }}>Start Analysis</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.onTabBar} style={{ marginLeft: 6 }} />
          </Pressable>
        </View>
        <View style={s.heroIcon}>
          <Ionicons name="walk" size={56} color={colors.onPastel} />
        </View>
      </View>

      {loaded && items.length === 0 ? (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.text }]}>Do your first screening</Text>
          {[
            ['list', 'Choose Squat in the Analyze tab'],
            ['videocam', 'Record 2–3 slow squats from the side'],
            ['stats-chart', 'See your knee angles and reps'],
          ].map(([icon, text], i) => (
            <View key={text} style={s.stepRow}>
              <View style={[s.stepNum, { backgroundColor: [colors.pink, colors.mint, colors.yellow][i] }]}>
                <Ionicons name={icon as IconName} size={16} color={colors.onPastel} />
              </View>
              <Text style={{ color: colors.text, marginLeft: 10, flex: 1 }}>{text}</Text>
            </View>
          ))}
          <AppButton title="Start your first analysis" onPress={goAnalyze} style={{ marginTop: space.md }} />
        </View>
      ) : (
        <>
          <View style={s.grid}>
            <Stat icon="analytics" label="Analyses" value={String(items.length)} bg={colors.pink} />
            <Stat icon="calendar" label="Active days" value={String(activeDays)} bg={colors.mint} />
            <Stat icon="repeat" label="Total reps" value={String(totalReps)} bg={colors.yellow} />
            <Stat icon="body" label="Latest angle" value={latestAngle !== null ? `${fmt(latestAngle)}°` : '—'} bg={colors.peach} />
          </View>

          {latest && (
            <>
              <SectionHeader title="Latest analysis" action="See all" onAction={goHistory} />
              <Pressable onPress={goHistory} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 0 }]}>
                <View style={s.latestTop}>
                  <View style={[s.mvIcon, { backgroundColor: colors[getMovement(latest.movement)?.color ?? 'mint'] }]}>
                    <Ionicons name={(getMovement(latest.movement)?.icon ?? 'body') as IconName} size={22} color={colors.onPastel} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
                      {getMovement(latest.movement)?.name ?? latest.movement}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      {shortDate(latest.createdAt)}{latest.repCount !== null ? ` · ${latest.repCount} reps` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </View>
                <View style={s.legRow}>
                  <Leg label="Left knee" value={bestAngle(latest, 'left')} />
                  <View style={{ width: 1, backgroundColor: colors.border }} />
                  <Leg label="Right knee" value={bestAngle(latest, 'right')} />
                </View>
              </Pressable>
            </>
          )}

          {trend.length >= 2 && (
            <>
              <SectionHeader title="Depth trend" />
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 0 }]}>
                <View style={s.chart}>
                  {trend.map(e => {
                    const a = entryAngle(e);
                    const bend = a !== null ? 180 - a : 0;
                    const h = Math.max(8, Math.min(1, bend / 140) * 110);
                    return (
                      <View key={e.id} style={s.barCol}>
                        <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 4 }}>{a !== null ? Math.round(a) : '—'}</Text>
                        <View style={[s.bar, { height: h, backgroundColor: a !== null ? colors.primary : colors.border }]} />
                        <Text style={{ color: colors.muted, fontSize: 10, marginTop: 6 }}>{shortDate(e.createdAt).split(' ')[0]}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
                  Knee angle per screening (°). Taller bar = deeper squat.
                </Text>
              </View>
            </>
          )}

          {items.length > 1 && (
            <>
              <SectionHeader title="Recent activity" />
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 0, paddingVertical: 4 }]}>
                {items.slice(0, 3).map((e, i) => {
                  const a = entryAngle(e);
                  return (
                    <View key={e.id} style={[s.activity, i < Math.min(items.length, 3) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{getMovement(e.movement)?.name ?? e.movement}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{timeAgo(e.createdAt)}</Text>
                      </View>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>{a !== null ? `${fmt(a)}°` : '—'}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      <View style={[s.tip, { backgroundColor: colors.yellow }]}>
        <Ionicons name="bulb" size={22} color={colors.onPastel} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.onPastel, fontWeight: '800' }}>Tip of the day</Text>
          <Text style={{ color: colors.onPastel, opacity: 0.85, marginTop: 2 }}>{tip}</Text>
        </View>
      </View>
    </TabScreen>
  );
}

function Stat({ icon, label, value, bg }: { icon: IconName; label: string; value: string; bg: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.stat, { backgroundColor: bg }]}>
      <View style={s.statIcon}>
        <Ionicons name={icon} size={18} color={colors.onPastel} />
      </View>
      <Text style={[s.statValue, { color: colors.onPastel }]}>{value}</Text>
      <Text style={{ color: colors.onPastel, opacity: 0.75, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Leg({ label, value }: { label: string; value: number | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 }}>
        {value !== null ? `${fmt(value)}°` : '—'}
      </Text>
      {value === null && <Text style={{ color: colors.muted, fontSize: 11 }}>Not measured</Text>}
    </View>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={s.sectionHeader}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
      {!!action && (
        <Pressable onPress={onAction}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.lg },
  heroTitle: { fontSize: 22, fontWeight: '900', lineHeight: 28 },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, marginTop: space.md,
  },
  heroIcon: {
    width: 88, height: 88, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center', marginLeft: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: space.md },
  stat: { width: '48.5%', borderRadius: radius.md, padding: space.md, marginBottom: 10 },
  statIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: 26, fontWeight: '900', marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, marginBottom: space.sm },
  card: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: space.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  stepNum: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  latestTop: { flexDirection: 'row', alignItems: 'center' },
  mvIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  legRow: { flexDirection: 'row', marginTop: space.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 150 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 18, borderRadius: 9 },
  activity: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  tip: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.md, marginTop: space.lg },
});