import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton, AppInput } from '../components/ui';
import { useAuth } from '../services/auth';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

export default function Login() {
  const { colors } = useTheme();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Enter your email or mobile number.';
    if (!password) e.password = 'Enter your password.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    const res = await login(identifier, password);
    setSubmitting(false);
    if (!res.ok) {
      setErrors({ password: res.error });
      return;
    }
    router.dismissAll();
    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={[s.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[s.sub, { color: colors.muted }]}>Log in to continue your screening.</Text>

        <AppInput label="Email or mobile number" icon="person-outline" placeholder="you@example.com or 98XXXXXXXX"
          value={identifier} onChangeText={setIdentifier} autoCapitalize="none" error={errors.identifier} />
        <AppInput label="Password" icon="lock-closed-outline" placeholder="Your password"
          value={password} onChangeText={setPassword} secureTextEntry={!showPw}
          autoCapitalize="none" error={errors.password} />

        <View style={s.row}>
          <Pressable onPress={() => setShowPw(v => !v)} style={s.inline}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
            <Text style={[s.link, { color: colors.primary }]}>{showPw ? 'Hide' : 'Show'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/forgot-password')}>
            <Text style={[s.link, { color: colors.primary }]}>Forgot password?</Text>
          </Pressable>
        </View>

        <AppButton title="Log In" onPress={onSubmit} loading={submitting} style={{ marginTop: space.lg }} />

        <View style={s.orRow}>
          <View style={[s.line, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.muted, marginHorizontal: 10 }}>or</Text>
          <View style={[s.line, { backgroundColor: colors.border }]} />
        </View>
        <Pressable
          onPress={() => Alert.alert('Coming soon', 'Google sign-in will be available in a later version.')}
          style={[s.google, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 10 }}>Continue with Google</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/register')} style={{ marginTop: space.lg, alignItems: 'center' }}>
          <Text style={{ color: colors.muted }}>
            New to GaitGuard? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '800' },
  sub: { fontSize: 15, marginTop: 6, marginBottom: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center' },
  link: { fontWeight: '600', marginLeft: 6 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: space.lg },
  line: { flex: 1, height: 1 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 14,
  },
});