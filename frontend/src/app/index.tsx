import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import AnimatedBackground from '../components/AnimatedBackground';
import GlassCard from '../components/GlassCard';
import { useAuth } from '../services/auth';
import { useSettings } from '../services/settings';
import { useTheme } from '../theme/ThemeContext';

const SPLASH_MS = 2600;

export default function Splash() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const { settings, loaded } = useSettings();
  const player = useAudioPlayer(require('../../assets/sounds/welcome.mp3'));

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  // Card pops in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  // Welcome sound (only if turned on in Settings)
  useEffect(() => {
    if (!loaded || !settings.welcomeSound) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // sound is optional; ignore errors
    }
  }, [loaded]);

  // Then go to Home (logged in) or Welcome (logged out)
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      router.replace(user ? '/(tabs)/home' : '/welcome');
    }, SPLASH_MS);
    return () => clearTimeout(timer);
  }, [loading, user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AnimatedBackground />

      <View style={s.center}>
        <Animated.View style={{ opacity: fade, transform: [{ scale }], width: '86%' }}>
          <GlassCard>
            <Text style={[s.welcome, { color: colors.text }]}>Welcome to</Text>
            <View style={s.row}>
              <View style={[s.logo, { backgroundColor: colors.mint }]}>
                <Ionicons name="walk" size={30} color={colors.onPastel} />
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <Text style={[s.brand, { color: colors.text }]}>
                Gait<Text style={{ color: colors.primary }}>Guard</Text>
              </Text>
            </View>
          </GlassCard>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
   center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  welcome: { fontFamily: 'DancingScript_600SemiBold', fontSize: 30, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  logo: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1.5, height: 36, marginHorizontal: 14 },
  brand: { fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
});