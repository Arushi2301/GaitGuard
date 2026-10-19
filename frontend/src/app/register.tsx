import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { AppButton, AppInput } from '../components/ui';
import { normalizePhone, useAuth } from '../services/auth';
import { generatePassword, passwordError, passwordStrength } from '../services/password';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

type PwMode = 'custom' | 'generate';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { colors } = useTheme();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pwMode, setPwMode] = useState<PwMode>('custom');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [generated, setGenerated] = useState(() => generatePassword());
  const [savedIt, setSavedIt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const strength = passwordStrength(password);
  const strengthColor = [colors.danger, colors.danger, '#E8A33D', colors.primary][strength.score];

  const regenerate = () => {
    setGenerated(generatePassword());
    setCopied(false);
    setSavedIt(false);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(generated);
    setCopied(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (phone.trim() && normalizePhone(phone).length !== 10) e.phone = 'Enter a valid 10-digit mobile number.';
    if (pwMode === 'custom') {
      const pe = passwordError(password);
      if (pe) e.password = pe;
      else if (confirm !== password) e.confirm = 'Passwords do not match.';
    } else if (!savedIt) {
      e.saved = 'Please confirm you have saved this password.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const res = await register({
      name,
      email,
      phone: phone.trim() || undefined,
      password: pwMode === 'custom' ? password : generated,
    });
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert('Could not create account', res.error);
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
        <Text style={[s.title, { color: colors.text }]}>Create account</Text>
        <Text style={[s.sub, { color: colors.muted }]}>Start screening your movement in minutes.</Text>

        <AppInput label="Full name" icon="person-outline" placeholder="Your name"
          value={name} onChangeText={setName} autoCapitalize="words" error={errors.name} />
        <AppInput label="Email" icon="mail-outline" placeholder="you@example.com"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <AppInput label="Mobile number (optional)" icon="call-outline" placeholder="10-digit number"
          value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} error={errors.phone} />

        {/* Password mode toggle */}
        <Text style={[s.label, { color: colors.muted }]}>Password</Text>
        <View style={[s.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['custom', 'generate'] as PwMode[]).map(m => (
            <Pressable
              key={m}
              onPress={() => { setPwMode(m); setErrors({}); }}
              style={[s.segBtn, pwMode === m && { backgroundColor: colors.primary }]}
            >
              <Text style={{ fontWeight: '700', color: pwMode === m ? colors.onPrimary : colors.text }}>
                {m === 'custom' ? 'Create my own' : 'Generate for me'}
              </Text>
            </Pressable>
          ))}
        </View>

        {pwMode === 'custom' ? (
          <>
            <AppInput label="Password" icon="lock-closed-outline" placeholder="At least 8 characters"
              value={password} onChangeText={setPassword} secureTextEntry={!showPw}
              autoCapitalize="none" error={errors.password} />

            {password.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={[s.strengthBar, { backgroundColor: strength.score >= i ? strengthColor : colors.border }]} />
                ))}
                <Text style={[s.strengthText, { color: strengthColor }]}>{strength.label}</Text>
              </View>
            )}

            <AppInput label="Confirm password" icon="lock-closed-outline" placeholder="Re-enter password"
              value={confirm} onChangeText={setConfirm} secureTextEntry={!showPw}
              autoCapitalize="none" error={errors.confirm} />

            <Pressable onPress={() => setShowPw(v => !v)} style={s.inline}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
              <Text style={[s.link, { color: colors.primary }]}>{showPw ? 'Hide' : 'Show'} password</Text>
            </Pressable>
          </>
        ) : (
          <View style={[s.genCard, { backgroundColor: colors.mint }]}>
            <Text style={[s.genLabel, { color: colors.onPastel }]}>Your strong password</Text>
            <Text selectable style={[s.genPw, { color: colors.onPastel }]}>{generated}</Text>

            <View style={s.genActions}>
              <Pressable onPress={regenerate} style={s.chip}>
                <Ionicons name="refresh" size={16} color={colors.onPastel} />
                <Text style={[s.chipText, { color: colors.onPastel }]}>Regenerate</Text>
              </Pressable>
              <Pressable onPress={copy} style={s.chip}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.onPastel} />
                <Text style={[s.chipText, { color: colors.onPastel }]}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setSavedIt(v => !v)} style={[s.inline, { marginTop: 14 }]}>
              <Ionicons name={savedIt ? 'checkbox' : 'square-outline'} size={20} color={colors.onPastel} />
              <Text style={{ color: colors.onPastel, marginLeft: 8, flex: 1 }}>
                I have saved this password somewhere safe
              </Text>
            </Pressable>
            {!!errors.saved && <Text style={[s.err, { color: colors.danger }]}>{errors.saved}</Text>}
          </View>
        )}

        <AppButton title="Create Account" onPress={onSubmit} loading={submitting} style={{ marginTop: space.lg }} />

        {/* Google (coming soon) */}
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

        <Pressable onPress={() => router.replace('/login')} style={{ marginTop: space.lg, alignItems: 'center' }}>
          <Text style={{ color: colors.muted }}>
            Already have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '800' },
  sub: { fontSize: 15, marginTop: 6, marginBottom: space.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  segment: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.pill, padding: 4, marginBottom: space.md },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: -8, marginBottom: space.md },
  strengthBar: { flex: 1, height: 6, borderRadius: 3, marginRight: 4 },
  strengthText: { fontSize: 12, fontWeight: '700', marginLeft: 6, width: 70 },
  inline: { flexDirection: 'row', alignItems: 'center' },
  link: { fontWeight: '600', marginLeft: 6 },
  genCard: { borderRadius: radius.md, padding: space.md },
  genLabel: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  genPw: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  genActions: { flexDirection: 'row', marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginRight: 8,
  },
  chipText: { fontWeight: '700', marginLeft: 6 },
  err: { fontSize: 12, marginTop: 4 },
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