import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, ui } from '../constants/theme';
import { setVideoUri } from '../services/videoStore';

export default function Record() {
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const camRef = useRef<CameraView>(null);
  const timerRef = useRef<any>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  if (!perm) return <View style={ui.screen} />;
  if (!perm.granted) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <Text style={ui.text}>Camera permission is needed to record.</Text>
        <Pressable style={ui.btn} onPress={requestPerm}><Text style={ui.btnText}>Grant Permission</Text></Pressable>
      </View>
    );
  }

  const start = async () => {
    if (!camRef.current || !ready || recording) return;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    try {
      const video = await camRef.current.recordAsync({ maxDuration: 15 });
      if (video?.uri) {
  setVideoUri(video.uri);
  router.replace({ pathname: '/preview', params: { movement } });
}
    } catch (e: any) {
      Alert.alert('Recording failed', String(e?.message ?? e));
    } finally {
      clearInterval(timerRef.current);
      setRecording(false);
    }
  };

  const stop = () => {
    if (seconds < 2) return;
    camRef.current?.stopRecording();
  };

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
      <View pointerEvents="none" style={s.frame} />
      <Text style={s.hint}>
        {recording ? `● REC  ${seconds}s / 15s` : ready ? 'Tap the circle to start recording' : 'Starting camera…'}
      </Text>
      <View style={s.controls}>
        <Pressable onPress={() => router.back()} disabled={recording}>
          <Text style={[ui.btnText, recording && { opacity: 0.3 }]}>Cancel</Text>
        </Pressable>
        <Pressable style={[s.recBtn, recording && s.recActive]} onPress={recording ? stop : start} />
        <Text style={ui.btnText}>{recording ? (seconds < 2 ? 'wait…' : 'Tap to stop') : '        '}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  frame: { position: 'absolute', top: '12%', bottom: '20%', left: '20%', right: '20%', borderWidth: 2, borderColor: colors.primary, borderRadius: 12 },
  hint: { position: 'absolute', top: 50, alignSelf: 'center', color: '#fff', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  controls: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  recBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.2)' },
  recActive: { backgroundColor: '#ef4444', borderRadius: 16 },
});