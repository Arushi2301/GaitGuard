import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/TopBar';
import { useAuth } from '../services/auth';
import { useSettings } from '../services/settings';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;
const APP_VERSION = '1.0.0';

/* ---------- small building blocks ---------- */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[s.sectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Row({ icon, iconBg, label, right, onPress, last }: {
  icon: IconName; iconBg: string; label: string; right?: ReactNode; onPress?: () => void; last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        s.row,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={colors.onPastel} />
      </View>
      <Text style={[s.rowLabel, { color: colors.text }]}>{label}</Text>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[s.segment, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[s.segBtn, active && { backgroundColor: colors.primary }]}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.onPrimary : colors.text }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- screen ---------- */
export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const { user, logout } = useAuth();
  const { settings, updateSettings } = useSettings();

  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [testing, setTesting] = useState(false);

  const toggle = (value: boolean, onChange: (v: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor="#FFFFFF"
    />
  );

  const saveAndTestServer = async () => {
    const url = apiUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+:\d+$/.test(url)) {
      Alert.alert('Check the address', 'Use the format http://<laptop-ip>:8000');
      return;
    }
    updateSettings({ apiUrl: url });
    setApiUrl(url);
    setTesting(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timer);
      Alert.alert(res.ok ? 'Connected ✅' : 'Server responded with an error', res.ok ? 'The backend is reachable.' : `Status ${res.status}`);
    } catch {
      Alert.alert('Cannot reach server', 'Check that the backend is running and the phone and laptop are on the same hotspot.');
    } finally {
      setTesting(false);
    }
  };

  const clearHistory = () => {
    Alert.alert('Clear history?', 'All saved analysis results on this phone will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('gg.history');
          Alert.alert('Done', 'Analysis history cleared.');
        },
      },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.dismissAll();
          router.replace('/welcome');
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      {/* Profile card */}
      <Pressable
        onPress={() => router.push('/profile')}
        style={[s.profile, { backgroundColor: colors.lavender }]}
      >
        <Avatar size={56} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[s.profileName, { color: colors.onPastel }]} numberOfLines={1}>{user?.name}</Text>
          <Text style={{ color: colors.onPastel, opacity: 0.7 }} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Text style={{ color: colors.onPastel, fontWeight: '700' }}>Edit</Text>
      </Pressable>

      <Section title="APPEARANCE">
        <Row icon="color-palette-outline" iconBg={colors.pink} label="Theme" last
          right={
            <Segmented
              options={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]}
              value={mode}
              onChange={setMode}
            />
          }
        />
      </Section>

      <Section title="SOUNDS & ALERTS">
        <Row icon="musical-notes-outline" iconBg={colors.yellow} label="Welcome sound"
          right={toggle(settings.welcomeSound, v => updateSettings({ welcomeSound: v }))} />
        <Row icon="notifications-outline" iconBg={colors.mint} label="Notifications" last
          right={toggle(settings.notifications, v => updateSettings({ notifications: v }))} />
      </Section>

      

      <Section title="SERVER">
        <View style={{ padding: space.md }}>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>Backend address</Text>
          <TextInput
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.x.x:8000"
            placeholderTextColor={colors.muted}
            style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />
          <Pressable onPress={saveAndTestServer} disabled={testing}
            style={[s.smallBtn, { backgroundColor: colors.primary, opacity: testing ? 0.6 : 1 }]}>
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
              {testing ? 'Testing…' : 'Save & test connection'}
            </Text>
          </Pressable>
        </View>
      </Section>

      <Section title="DATA">
        <Row icon="trash-outline" iconBg={colors.pink} label="Clear analysis history" onPress={clearHistory} last />
      </Section>

      <Section title="SUPPORT">
        <Row icon="help-circle-outline" iconBg={colors.mint} label="Help & Support" onPress={() => router.push('/help')} />
        <Row icon="information-circle-outline" iconBg={colors.yellow} label="About GaitGuard" last
          onPress={() =>
            Alert.alert(
              'GaitGuard',
              `Version ${APP_VERSION}\n\nSmartphone-based movement screening using pose estimation.\n\nGaitGuard is a screening tool only and does not provide a medical diagnosis.`,
            )
          }
        />
      </Section>

      <Pressable onPress={confirmLogout} style={[s.logout, { borderColor: colors.danger }]}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 16, marginLeft: 8 }}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.md, marginBottom: space.lg },
  profileName: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  card: { borderWidth: 1.5, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: 12, minHeight: 56 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  segment: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.pill, padding: 3 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  input: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  smallBtn: { marginTop: 10, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: radius.pill, paddingVertical: 14,
  },
});