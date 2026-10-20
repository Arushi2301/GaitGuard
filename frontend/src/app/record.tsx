import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/ui';
import { getMovement } from '../constants/movements';
import { getMovementGuide } from '../constants/movementGuides';
import { setVideoUri } from '../services/videoStore';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const RECORD_SECONDS = 15;
const EARLY_END_SECONDS = RECORD_SECONDS - 1; // anything shorter is treated as an interrupted recording

export default function Record() {
  const { colors } = useTheme();
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const movementName = getMovement(movement)?.name ?? 'Movement';
  const tip = getMovementGuide(movement).recordTips[0];

  const camRef = useRef<CameraView>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);

  const [perm, requestPerm] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
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

  // Backgrounding the app ends the recording early; it is then rejected below
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && recordingRef.current) camRef.current?.stopRecording();
    });
    return () => sub.remove();
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
    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    recordingRef.current = true;
    setRecording(true);
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed(s => Math.min(RECORD_SECONDS, s + 1)), 1000);
    try {
      const video = await camRef.current.recordAsync({ maxDuration: RECORD_SECONDS });
      if (cancelledRef.current) {
        router.back(); // recording discarded
        return;
      }
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      if (!video?.uri || seconds < EARLY_END_SECONDS) {
        Alert.alert('Recording stopped early', `The recording must run for the full ${RECORD_SECONDS} seconds. Please record again.`);
        return;
      }
      playSound(endPlayer);
      setVideoUri(video.uri);
      router.replace({ pathname: '/preview', params: { movement } });
    } catch (e: any) {
      Alert.alert('Recording failed', String(e?.message ?? e));
    } finally {
      if (tickRef.current) clearInterval(tickRef.current);
      recordingRef.current = false;
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

  const cancel = () => {
    cancelledRef.current = true;
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
    ? 'Recording… stay in frame'
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
          {recording ? (
            <Pressable onPress={cancel} style={s.cancel}>
              <Text style={s.pillText}>Cancel</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.back()} disabled={busy} style={[s.round, busy && { opacity: 0.3 }]}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          )}
          <View style={s.pill}>
            <Ionicons name="camera-outline" size={14} color="#fff" />
            <Text style={s.pillText}>{movementName} · {RECORD_SECONDS}s</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <Text style={s.hint}>Keep your whole body inside the frame</Text>
        {!!tip && <Text style={[s.hint, { marginTop: 6 }]}>{tip}</Text>}
        <Text style={s.hint}>The video will be recorded for {RECORD_SECONDS} seconds.</Text>

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
                <View style={[s.fill, { width: `${Math.min(100, (elapsed / RECORD_SECONDS) * 100)}%`, backgroundColor: colors.danger }]} />
              </View>
              <Text style={s.timer}>● {elapsed}s / {RECORD_SECONDS}s</Text>
            </>
          )}

          {!recording && (
            <Pressable onPress={beginCountdown} disabled={busy} style={[s.recOuter, busy && { opacity: 0.4 }]}>
              <View style={[s.recInner, { backgroundColor: colors.primary }]} />
            </Pressable>
          )}
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
  cancel: {
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 16, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
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
  status: {
    color: '#fff', fontWeight: '700', marginTop: 12, backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden',
  },
});