import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ui } from '../constants/theme';

export default function Home() {
  return (
    <View style={[ui.screen, { justifyContent: 'center' }]}>
      <Text style={ui.title}>GaitGuard</Text>
      <Text style={[ui.text, { marginTop: 8 }]}>Smartphone-based injury-risk screening for athletes.</Text>
      <Text style={[ui.muted, { marginTop: 16 }]}>Screening tool only — not a medical diagnosis.</Text>
      <Pressable style={[ui.btn, { marginTop: 32 }]} onPress={() => router.push('/select-movement')}>
        <Text style={ui.btnText}>Start Screening</Text>
      </Pressable>
    </View>
  );
}