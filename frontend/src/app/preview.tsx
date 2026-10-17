import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, Text, View } from 'react-native';
import { ui } from '../constants/theme';
import { getVideoUri } from '../services/videoStore';

export default function Preview() {
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const uri = getVideoUri() ?? '';
  const player = useVideoPlayer({ uri }, p => { p.loop = true; p.play(); });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });

  return (
    <View style={ui.screen}>
      <VideoView player={player} style={{ width: '100%', flex: 1, borderRadius: 12 }} nativeControls contentFit="contain" />

      {/* Debug info — baad mein hata denge */}
      <Text style={[ui.muted, { marginTop: 8 }]}>Status: {status} {error ? `| Error: ${error.message}` : ''}</Text>

      <Pressable style={ui.btn} onPress={() => router.replace({ pathname: '/result', params: { movement } })}>
        <Text style={ui.btnText}>Analyze</Text>
      </Pressable>
      <Pressable style={ui.btnOutline} onPress={() => router.back()}>
        <Text style={ui.btnText}>Retake / Choose Another</Text>
      </Pressable>
    </View>
  );
}