import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { AppButton, Screen } from '../components/ui';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const SUPPORT_EMAIL = 'support@gaitguard.app';

export default function ForgotPassword() {
  const { colors } = useTheme();

  const contactSupport = () => {
    const subject = encodeURIComponent('GaitGuard – Password reset request');
    const body = encodeURIComponent('Hi, I forgot my GaitGuard password. My registered email / mobile is: ');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  return (
    <Screen>
      <View style={[s.iconWrap, { backgroundColor: colors.lavender }]}>
        <Ionicons name="key-outline" size={36} color={colors.onPastel} />
      </View>

      <Text style={[s.title, { color: colors.text }]}>Forgot your password?</Text>
      <Text style={[s.body, { color: colors.muted }]}>
        Your GaitGuard account is stored securely on this phone, so an automatic reset link isn’t available yet.
      </Text>

      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.cardTitle, { color: colors.text }]}>What you can do</Text>
        <Text style={[s.item, { color: colors.muted }]}>• Try logging in with your mobile number instead of email</Text>
        <Text style={[s.item, { color: colors.muted }]}>• If you used a generated password, check where you saved it</Text>
        <Text style={[s.item, { color: colors.muted }]}>• Contact support and we’ll help you recover access</Text>
      </View>

      <AppButton title="Contact Support" onPress={contactSupport} style={{ marginTop: space.lg }} />
      <AppButton title="Back to Log In" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  title: { fontSize: 26, fontWeight: '800', marginTop: space.lg },
  body: { fontSize: 15, lineHeight: 22, marginTop: space.sm },
  card: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md, marginTop: space.lg },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: space.sm },
  item: { fontSize: 14, lineHeight: 22 },
});