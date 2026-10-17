import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { getMovement } from '../constants/movements';
import { ui } from '../constants/theme';
import { AnalysisResult, analyzeVideo } from '../services/analysis';
import { getVideoUri } from '../services/videoStore';

export default function Result() {
     const { movement } = useLocalSearchParams<{ movement: string }>();
   const uri = getVideoUri() ?? '';
  const [res, setRes] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    analyzeVideo(uri, movement).then(setRes);
  }, []);

  return (
    <View style={ui.screen}>
      <Text style={ui.title}>{getMovement(movement)?.name}</Text>

      {!res && (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" />
          <Text style={[ui.muted, { marginTop: 12 }]}>Analyzing video…</Text>
        </View>
      )}

      {res?.ok && (
        <ScrollView style={[ui.card, { marginTop: 20 }]}>
          <Text style={ui.text}>{JSON.stringify(res.data, null, 2)}</Text>
        </ScrollView>
      )}

      {res && !res.ok && (
        <Text style={[ui.text, { marginTop: 20 }]}>Analysis failed: {res.reason}</Text>
      )}

      <Pressable style={ui.btn} onPress={() => router.dismissAll()}>
        <Text style={ui.btnText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}