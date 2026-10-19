import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import AnimatedBackground from '../components/AnimatedBackground';
import GlassCard from '../components/GlassCard';
import { AppButton } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';

export default function Welcome() {
  const { colors } = useTheme();
  const slide = useRef(new Animated.Value(40)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AnimatedBackground />

      {/* Top: brand card */}
      <View style={s.top}>
        <GlassCard style={{ width: '86%' }}>
          <View style={s.row}>
            <View style={[s.logo, { backgroundColor: colors.mint }]}>
              <Ionicons name="walk" size={26} color={colors.onPastel} />
            </View>
            <Text style={[s.brand, { color: colors.text }]}>
              Gait<Text style={{ color: colors.primary }}>Guard</Text>
            </Text>
          </View>
          <Text style={[s.tagline, { color: colors.muted }]}>
            Smart movement screening, right from your phone.
          </Text>
        </GlassCard>
      </View>

      {/* Bottom: actions */}
      <Animated.View style={[s.bottom, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <GlassCard style={{ width: '100%' }}>
          <AppButton title="Log In" onPress={() => router.push('/login')} />
          <AppButton title="Create Account" variant="outline" onPress={() => router.push('/register')} />
          <Text style={[s.note, { color: colors.muted }]}>
            Screening tool only — not a medical diagnosis.
          </Text>
        </GlassCard>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', top: '9%', left: 0, right: 0, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  brand: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  bottom: { position: 'absolute', left: 20, right: 20, bottom: 32 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 12 },
});