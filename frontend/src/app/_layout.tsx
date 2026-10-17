import { Stack } from 'expo-router';
import { colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'GaitGuard' }} />
      <Stack.Screen name="select-movement" options={{ title: 'Choose Movement' }} />
      <Stack.Screen name="capture" options={{ title: 'Record or Upload' }} />
      <Stack.Screen name="record" options={{ headerShown: false }} />
      <Stack.Screen name="preview" options={{ title: 'Preview' }} />
      <Stack.Screen name="result" options={{ title: 'Screening Result' }} />
    </Stack>
  );
}