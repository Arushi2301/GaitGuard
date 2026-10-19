import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/ui';
import { getMovement } from '../constants/movements';
import { getVideoUri } from '../services/videoStore';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const CHECKS = ['Whole body visible, head to feet', 'Filmed from the correct angle', 'Recorded with the back camera'];

export default function Preview() {
  const { colors } = useTheme();
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const m = getMovement(movement);
  const uri = getVideoUri() ?? '';

  const player = useVideoPlayer({ uri }, p => {
    p.loop = true;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const failed = status === 'error';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg }}>
      <View style={[s.videoCard, { backgroundColor: colors.tabBar }]}>
        {failed ? (
          <View style={s.error}>
            <Ionicons name="alert-circle-outline" size={40} color="#fff" />
            <Text style={s.errorText}>This video can’t be played. Please record or choose another one.</Text>
          </View>
        ) : (
          <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" />
        )}
      </View>

      <View style={[s.checks, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.checksTitle, { color: colors.text }]}>
          Quick check{m ? ` · ${m.name}` : ''}
        </Text>
        {CHECKS.map(c => (
          <View key={c} style={s.checkRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={{ color: colors.muted, marginLeft: 8 }}>{c}</Text>
          </View>
        ))}
      </View>

      <AppButton
        title="Analyze"
        disabled={failed || !uri}
        onPress={() => router.replace({ pathname: '/result', params: { movement } })}
      />
      <AppButton title="Retake / Choose Another" variant="outline" onPress={() => router.back()} />
    </View>
  );
}

const s = StyleSheet.create({
  videoCard: { flex: 1, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space.md },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 10, fontWeight: '600' },
  checks: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  checksTitle: { fontWeight: '800', marginBottom: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});