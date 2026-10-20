import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../services/auth';
import { getGreeting } from '../services/greeting';
import { useNotifications } from '../services/notifications';
import { space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

/* ---------- Avatar (photo or first letter) ---------- */
export function Avatar({ size = 46 }: { size?: number }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const initial = (user?.name?.trim()[0] ?? '?').toUpperCase();

  if (user?.photoUri) {
    return <Image source={{ uri: user.photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: colors.peach,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color: colors.onPastel }}>{initial}</Text>
    </View>
  );
}

/* ---------- Round icon button with optional badge ---------- */
function IconButton({ icon, onPress, badge }: {
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void; badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[s.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={22} color={colors.text} />
      {!!badge && badge > 0 && (
        <View style={[s.badge, { backgroundColor: colors.danger }]}>
          <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------- Top bar ---------- */
export default function TopBar({ subtitle }: { subtitle?: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
    const { unreadCount } = useNotifications();

  return (
    <View style={s.row}>
      <Pressable onPress={() => router.push('/profile')} style={s.left}>
        <Avatar />
        <View style={{ marginLeft: 12, flexShrink: 1 }}>
          <Text numberOfLines={1} style={[s.hi, { color: colors.text }]}>
            {getGreeting(new Date())}, {firstName}
          </Text>
          {!!subtitle && <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>{subtitle}</Text>}
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row' }}>
                <IconButton icon="notifications-outline" badge={unreadCount} onPress={() => router.push('/notifications')} />
        <IconButton icon="settings-outline" onPress={() => router.push('/settings')} />
      </View>
    </View>
  );
}

/* ---------- Wrapper for every tab screen ---------- */
export function TabScreen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>{children}</ScrollView>
      ) : (
        <View style={[s.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: space.sm },
  hi: { fontSize: 18, fontWeight: '800' },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 130 },
});