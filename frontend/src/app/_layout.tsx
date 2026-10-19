import { DancingScript_600SemiBold, useFonts } from '@expo-google-fonts/dancing-script';
import { Stack } from 'expo-router';
import { StatusBar, View } from 'react-native';
import { AuthProvider } from '../services/auth';
import { SettingsProvider } from '../services/settings';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

function RootStack() {
  const { colors, mode } = useTheme();
  const [fontsLoaded] = useFonts({ DancingScript_600SemiBold });

  // Wait for the cursive font before showing anything
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {/* Start + auth */}
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="login" options={{ title: '' }} />
        <Stack.Screen name="register" options={{ title: '' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />

        {/* Main app (bottom tabs) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Analysis flow (existing screens) */}
        <Stack.Screen name="select-movement" options={{ title: 'Choose Movement' }} />
        <Stack.Screen name="capture" options={{ title: 'Record or Upload' }} />
        <Stack.Screen name="record" options={{ headerShown: false }} />
        <Stack.Screen name="preview" options={{ title: 'Preview' }} />
        <Stack.Screen name="result" options={{ title: 'Screening Result' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}