import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from 'react-native';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

/* ---------- Button ---------- */
type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function AppButton({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        {
          backgroundColor: isPrimary ? colors.primary : 'transparent',
          borderColor: isOutline ? colors.primary : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[s.btnText, { color: isPrimary ? colors.onPrimary : colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/* ---------- Text input with label + error ---------- */
type InputProps = TextInputProps & {
  label: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function AppInput({ label, error, icon, style, ...rest }: InputProps) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[s.label, { color: colors.muted }]}>{label}</Text>
      <View
        style={[
          s.inputWrap,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={colors.muted} style={{ marginRight: space.sm }} />}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[s.input, { color: colors.text }, style]}
          {...rest}
        />
      </View>
      {!!error && <Text style={[s.error, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

/* ---------- App logo (icon + name) ---------- */
export function Logo({ size = 72 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: colors.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="walk" size={size * 0.55} color={colors.onPastel} />
      </View>
    </View>
  );
}

/* ---------- Screen wrapper ---------- */
export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.bg, padding: space.lg }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  btn: {
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginTop: space.sm,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16 },
  error: { fontSize: 12, marginTop: 4 },
});