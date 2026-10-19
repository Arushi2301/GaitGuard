import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { LayoutAnimation, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';
import { radius, space, ThemeColors } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SUPPORT_EMAIL = 'support@gaitguard.app';
const APP_VERSION = '1.0.0';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; bg: keyof ThemeColors; title: string; text: string }[] = [
  { icon: 'list', bg: 'pink', title: 'Choose a movement', text: 'Open the Analyze tab and pick the movement you want to screen.' },
  { icon: 'videocam', bg: 'mint', title: 'Record or upload', text: 'Record a short clip (up to 15 s) or upload one from your gallery.' },
  { icon: 'scan', bg: 'yellow', title: 'Analyze', text: 'GaitGuard tracks your body landmarks and measures your joint angles.' },
  { icon: 'stats-chart', bg: 'lavender', title: 'Review & track', text: 'See your result, then follow your progress in History and Progress.' },
];

const TIPS = [
  'Film from the side for squats and walking, and from the front for drop jumps.',
  'Keep your whole body in the frame — head to feet.',
  'Place the phone at hip height, 2–3 m away, and keep it still.',
  'Use good lighting and avoid bright windows behind you.',
  'Wear fitted clothes so your knees and hips are clearly visible.',
  'Perform 2–3 slow, controlled repetitions.',
];

const FAQS = [
  {
    q: 'Is GaitGuard a medical diagnosis?',
    a: 'No. GaitGuard is a screening tool that measures movement. It does not diagnose injuries or replace a qualified healthcare professional.',
  },
  {
    q: 'Why does it say “Cannot reach server”?',
    a: 'The phone and the laptop running the backend must be on the same network (a phone hotspot works best). Check the server address in Settings → Server and tap “Save & test connection”.',
  },
  {
    q: 'Why is one knee shown as “Not measured”?',
    a: 'In a side view, the leg farther from the camera is partly hidden. If it is never clearly visible, it is not measured rather than guessed.',
  },
  {
    q: 'What does a smaller knee angle mean?',
    a: 'A smaller angle means a deeper knee bend. Standing straight is about 180°.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Your account, profile and results are stored on this phone. Videos are sent to the backend only for analysis.',
  },
  {
    q: 'How do I switch to dark mode?',
    a: 'Go to Settings → Appearance → Theme and choose Dark.',
  },
];

function Card({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[s.sectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Faq({ q, a, last }: { q: string; a: string; last?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen(o => !o);
      }}
      style={[s.faq, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
    >
      <View style={s.faqRow}>
        <Text style={[s.faqQ, { color: colors.text }]}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </View>
      {open && <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20 }}>{a}</Text>}
    </Pressable>
  );
}

export default function Help() {
  const { colors } = useTheme();

  const email = (subject: string, body: string) =>
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    ).catch(() => {});

  const deviceInfo = `\n\n---\nApp version: ${APP_VERSION}\nPlatform: ${Platform.OS} ${Platform.Version}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Card title="HOW TO USE GAITGUARD">
        {STEPS.map((st, i) => (
          <View key={st.title} style={[s.step, i < STEPS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[s.stepIcon, { backgroundColor: colors[st.bg] }]}>
              <Ionicons name={st.icon} size={18} color={colors.onPastel} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{i + 1}. {st.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>{st.text}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card title="RECORDING TIPS">
        <View style={{ padding: space.md }}>
          {TIPS.map(t => (
            <View key={t} style={s.tip}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.text, marginLeft: 10, flex: 1, lineHeight: 20 }}>{t}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="FREQUENTLY ASKED QUESTIONS">
        {FAQS.map((f, i) => (
          <Faq key={f.q} q={f.q} a={f.a} last={i === FAQS.length - 1} />
        ))}
      </Card>

      <Card title="GET IN TOUCH">
        <Pressable
          onPress={() => email('GaitGuard – Support request', `Hi, I need help with:${deviceInfo}`)}
          style={[s.contact, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
        >
          <View style={[s.stepIcon, { backgroundColor: colors.mint }]}>
            <Ionicons name="mail-outline" size={18} color={colors.onPastel} />
          </View>
          <Text style={[s.contactText, { color: colors.text }]}>Contact support</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() =>
            email('GaitGuard – Problem report', `What happened:\n\nWhat I expected:\n\nSteps to reproduce:\n1.\n2.\n${deviceInfo}`)
          }
          style={s.contact}
        >
          <View style={[s.stepIcon, { backgroundColor: colors.pink }]}>
            <Ionicons name="bug-outline" size={18} color={colors.onPastel} />
          </View>
          <Text style={[s.contactText, { color: colors.text }]}>Report a problem</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Card>

      <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12 }}>
        GaitGuard v{APP_VERSION} · Screening tool only — not a medical diagnosis.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  card: { borderWidth: 1.5, borderRadius: radius.md, overflow: 'hidden' },
  step: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  stepIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', marginBottom: 10 },
  faq: { padding: space.md },
  faqRow: { flexDirection: 'row', alignItems: 'center' },
  faqQ: { flex: 1, fontSize: 15, fontWeight: '700', marginRight: 8 },
  contact: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  contactText: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: 12 },
});