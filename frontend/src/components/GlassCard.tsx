import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { radius } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

export default function GlassCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const isIOS = Platform.OS === 'ios';

  // Android can't blur reliably, so use a more solid frosted tint there
  const tint = dark
    ? `rgba(28,30,37,${isIOS ? 0.55 : 0.85})`
    : `rgba(255,255,255,${isIOS ? 0.55 : 0.82})`;

  return (
    <View style={[s.wrap, style]}>
      {isIOS && <BlurView intensity={40} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          s.border,
          { borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.95)' },
        ]}
      />
      <View style={s.content}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg + 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  border: { borderRadius: radius.lg + 8, borderWidth: 1.5 },
  content: { paddingVertical: 22, paddingHorizontal: 28 },
});