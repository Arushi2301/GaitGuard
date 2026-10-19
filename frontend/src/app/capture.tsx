import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/ui';
import { getMovement } from '../constants/movements';
import { setVideoUri } from '../services/videoStore';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const ANALYZED_SECONDS = 15; // backend analyzes only the first 15 s
const DURATIONS = [10, 15] as const;

export default function Capture() {
  const { colors } = useTheme();
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const m = getMovement(movement);
  const [seconds, setSeconds] = useState<10 | 15>(15);

  const goPreview = (uri: string) => {
    setVideoUri(uri);
    router.push({ pathname: '/preview', params: { movement } });
  };

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const durationSec = asset.duration ? asset.duration / 1000 : 0;

    if (durationSec > 0 && durationSec < 2) {
      Alert.alert('Video too short', 'Please choose a clip that shows at least one full repetition.');
      return;
    }
    if (durationSec > ANALYZED_SECONDS) {
      Alert.alert(
        'Long video',
        `This video is ${Math.round(durationSec)} s long. Only the first ${ANALYZED_SECONDS} seconds will be analyzed.`,
        [
          { text: 'Choose another', style: 'cancel' },
          { text: 'Continue', onPress: () => goPreview(asset.uri) },
        ],
      );
      return;
    }
    goPreview(asset.uri);
  };

  if (!m) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>Movement not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      {/* Movement header */}
      <View style={[s.hero, { backgroundColor: colors[m.color] }]}>
        <View style={s.heroIcon}>
          <Ionicons name={m.icon} size={34} color={colors.onPastel} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[s.heroTitle, { color: colors.onPastel }]}>{m.name}</Text>
          <Text style={{ color: colors.onPastel, opacity: 0.75, marginTop: 2 }}>{m.view} · {m.reps}</Text>
        </View>
      </View>

      {/* Filming guide */}
      <Text style={[s.section, { color: colors.muted }]}>FILMING GUIDE</Text>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <GuideRow icon="person-outline" text={m.instruction} />
        <GuideRow icon="repeat-outline" text={`Perform ${m.reps}, slowly and with control.`} />
        <GuideRow icon="sunny-outline" text="Good lighting, fitted clothes, nothing blocking your legs." last />
      </View>

      {/* Back camera notice */}
      <View style={[s.notice, { backgroundColor: colors.yellow }]}>
        <Ionicons name="phone-portrait-outline" size={22} color={colors.onPastel} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.onPastel, fontWeight: '800' }}>Please use the back camera</Text>
          <Text style={{ color: colors.onPastel, opacity: 0.8, marginTop: 2, fontSize: 13 }}>
            Front-camera videos are mirrored, which swaps the left and right legs.
          </Text>
        </View>
      </View>

      {/* Recording length */}
      <Text style={[s.section, { color: colors.muted }]}>RECORDING LENGTH</Text>
      <View style={[s.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {DURATIONS.map(d => {
          const active = d === seconds;
          return (
            <Pressable key={d} onPress={() => setSeconds(d)} style={[s.segBtn, active && { backgroundColor: colors.primary }]}>
              <Text style={{ fontWeight: '800', color: active ? colors.onPrimary : colors.text }}>{d} seconds</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
        Pick 15 s for slower movements so every rep fits. Only the first {ANALYZED_SECONDS} s of any video is analyzed.
      </Text>

      {/* Actions */}
      <AppButton
        title="Record Video"
        onPress={() => router.push({ pathname: '/record', params: { movement, seconds: String(seconds) } })}
        style={{ marginTop: space.lg }}
      />
      <AppButton title="Upload from Gallery" variant="outline" onPress={pickVideo} />
    </ScrollView>
  );
}

function GuideRow({ icon, text, last }: { icon: keyof typeof Ionicons.glyphMap; text: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[s.guide, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.text, marginLeft: 10, flex: 1, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.lg },
  heroIcon: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800' },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: space.lg, marginBottom: 8, marginLeft: 4 },
  card: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md },
  guide: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.md, marginTop: space.lg },
  segment: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.pill, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
});