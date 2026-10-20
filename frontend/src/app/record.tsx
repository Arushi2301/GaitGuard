import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/ui';
import { setVideoUri } from '../services/videoStore';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const MIN_SECONDS = 2;

export default function Record() {
  const { colors } = useTheme();
  const { movement, seconds } = useLocalSearchParams<{ movement: string; seconds?: string }>();
  const limit = seconds === '10' ? 10 : 15;

  const camRef = useRef<CameraView>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [perm, requestPerm] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Sounds are loaded up front so the first tick has no delay
  const tickPlayer = useAudioPlayer(require('../../assets/sounds/tick.wav'));
  const endPlayer = useAudioPlayer(require('../../assets/sounds/end.wav'));

  const playSound = (player: typeof tickPlayer) => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // a missing sound must never block recording
    }
  };

  // Play cues even when the phone is on silent; the camera is muted, so no mic is used
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  }, []);

  // Clean up timers if the screen closes
  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (countRef.current) clearInterval(countRef.current);
    },
    [],
  );

  const startRecording = async () => {
    if (!camRef.current) return;
    setRecording(true);
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    try {
      const video = await camRef.current.recordAsync({ maxDuration: limit });
      playSound(endPlayer);
      if (video?.uri) {
        setVideoUri(video.uri);
        router.replace({ pathname: '/preview', params: { movement } });
      }
    } catch (e: any) {
      Alert.alert('Recording failed', String(e?.message ?? e));
    } finally {
      if (tickRef.current) clearInterval(tickRef.current);
      setRecording(false);
    }
  };

  const beginCountdown = () => {
    if (!ready || recording || countdown !== null) return;
    let n = 3;
    setCountdown(n);
    playSound(tickPlayer);
    countRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countRef.current) clearInterval(countRef.current);
        setCountdown(null);
        startRecording();
      } else {
        setCountdown(n);
        playSound(tickPlayer);
      }
    }, 1000);
  };

  const stop = () => {
    if (elapsed < MIN_SECONDS) return; // too short to analyze
    camRef.current?.stopRecording();
  };

  /* ---------- permission screens ---------- */
  if (!perm) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!perm.granted) {
    return (
      <View style={[s.permWrap, { backgroundColor: colors.bg }]}>
        <View style={[s.permIcon, { backgroundColor: colors.mint }]}>
          <Ionicons name="camera-outline" size={36} color={colors.onPastel} />
        </View>
        <Text style={[s.permTitle, { color: colors.text }]}>Camera access needed</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>
          GaitGuard uses the camera only to record your movement.
        </Text>
        <AppButton title="Allow Camera" onPress={requestPerm} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
        <AppButton title="Go Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const busy = recording || countdown !== null;
  const status = recording
    ? elapsed < MIN_SECONDS ? 'Keep going…' : 'Tap to stop'
    : countdown !== null ? 'Get into position'
    : ready ? 'Tap to start · 3 s countdown' : 'Starting camera…';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        mode="video"
        facing="back"
        videoQuality="1080p"
        mute
        onCameraReady={() => setReady(true)}
      />

      {/* Framing guide corners */}
      <View pointerEvents="none" style={s.frame}>
        {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
          <View key={c} style={[s.corner, s[c], { borderColor: colors.mint }]} />
        ))}
      </View>

      <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top bar */}
        <View style={s.top}>
          <Pressable onPress={() => router.back()} disabled={busy} style={[s.round, busy && { opacity: 0.3 }]}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <View style={s.pill}>
            <Ionicons name="camera-outline" size={14} color="#fff" />
            <Text style={s.pillText}>Back camera · {limit}s max</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <Text style={s.hint}>Keep your whole body inside the frame</Text>

        {/* Countdown */}
        {countdown !== null && (
          <View pointerEvents="none" style={s.countWrap}>
            <Text style={s.countText}>{countdown}</Text>
          </View>
        )}

        {/* Bottom controls */}
        <View style={s.bottom}>
          {recording && (
            <>
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.min(100, (elapsed / limit) * 100)}%`, backgroundColor: colors.danger }]} />
              </View>
              <Text style={s.timer}>● {elapsed}s / {limit}s</Text>
            </>
          )}

          <Pressable onPress={recording ? stop : beginCountdown} style={s.recOuter}>
            <View
              style={[
                s.recInner,
                { backgroundColor: recording ? colors.danger : colors.primary },
                recording && s.recInnerActive,
              ]}
            />
          </Pressable>
          <Text style={s.status}>{status}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CORNER = 34;

const s = StyleSheet.create({
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  permIcon: { width: 80, height: 80, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontSize: 22, fontWeight: '800', marginTop: space.md },

  frame: { position: 'absolute', top: '16%', bottom: '24%', left: '14%', right: '14%' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderWidth: 4 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingTop: space.sm },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
  },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 6 },
  hint: {
    alignSelf: 'center', marginTop: space.sm, color: '#fff', fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden',
  },

  countWrap: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 120, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: space.xl, alignItems: 'center', paddingHorizontal: space.lg },
  track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  timer: { color: '#fff', fontWeight: '800', marginTop: 8, marginBottom: 12 },
  recOuter: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  recInner: { width: 64, height: 64, borderRadius: 32 },
  recInnerActive: { width: 34, height: 34, borderRadius: 8 },
  status: {
    color: '#fff', fontWeight: '700', marginTop: 12, backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden',
  },
});