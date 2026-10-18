import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { getMovement } from '../constants/movements';
import { ui } from '../constants/theme';
import { setVideoUri } from '../services/videoStore';

const MAX_SECONDS = 15;

export default function Capture() {
  const { movement } = useLocalSearchParams<{ movement: string }>();
  const m = getMovement(movement);

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (asset.duration && asset.duration / 1000 > MAX_SECONDS) {
      Alert.alert('Video too long', `Please choose a clip under ${MAX_SECONDS} seconds.`);
      return;
    }
    setVideoUri(asset.uri);
router.push({ pathname: '/preview', params: { movement } });
  };

  return (
    <View style={ui.screen}>
      <Text style={ui.title}>{m?.name}</Text>
      <View style={[ui.card, { marginTop: 16 }]}>
        <Text style={[ui.text, { fontWeight: '600' }]}>Filming guide ({m?.view})</Text>
        <Text style={[ui.muted, { marginTop: 6 }]}>{m?.instruction}</Text>
        <Text style={[ui.muted, { marginTop: 6 }]}>Good lighting, fitted clothes, max {MAX_SECONDS}s.</Text>
      </View>
      <Pressable style={ui.btn} onPress={() => router.push({ pathname: '/record', params: { movement } })}>
        <Text style={ui.btnText}>Record Video</Text>
      </Pressable>
      <Pressable style={ui.btnOutline} onPress={pickVideo}>
        <Text style={ui.btnText}>Upload from Gallery</Text>
      </Pressable>
    </View>
  );
}