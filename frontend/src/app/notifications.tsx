import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppNotification, NotificationType, useNotifications } from '../services/notifications';
import { useSettings } from '../services/settings';
import { radius, space, ThemeColors } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const STYLE: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; bg: keyof ThemeColors }> = {
  analysis_complete: { icon: 'checkmark-circle', bg: 'mint' },
  analysis_failed: { icon: 'alert-circle', bg: 'pink' },
  progress: { icon: 'trending-up', bg: 'yellow' },
  announcement: { icon: 'megaphone', bg: 'lavender' },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Notifications() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { items, unreadCount, markRead, markAllRead, remove, clearAll } = useNotifications();

  const confirmClear = () =>
    Alert.alert('Clear all notifications?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearAll },
    ]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const st = STYLE[item.type];
    return (
      <Pressable
        onPress={() => markRead(item.id)}
        onLongPress={() =>
          Alert.alert('Delete notification?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) },
          ])
        }
        style={[s.item, { backgroundColor: colors.surface, borderColor: item.read ? colors.border : colors.primary }]}
      >
        <View style={[s.icon, { backgroundColor: colors[st.bg] }]}>
          <Ionicons name={st.icon} size={22} color={colors.onPastel} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={s.titleRow}>
            <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            {!item.read && <View style={[s.dot, { backgroundColor: colors.primary }]} />}
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>{item.body}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{timeAgo(item.createdAt)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!settings.notifications && (
        <View style={[s.banner, { backgroundColor: colors.yellow }]}>
          <Ionicons name="notifications-off-outline" size={18} color={colors.onPastel} />
          <Text style={{ color: colors.onPastel, marginLeft: 8, flex: 1 }}>
            Notifications are turned off in Settings. New alerts won’t appear.
          </Text>
        </View>
      )}

      {items.length > 0 && (
        <View style={s.actions}>
          <Text style={{ color: colors.muted }}>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</Text>
          <View style={{ flexDirection: 'row' }}>
            {unreadCount > 0 && (
              <Pressable onPress={markAllRead}>
                <Text style={[s.action, { color: colors.primary }]}>Mark all read</Text>
              </Pressable>
            )}
            <Pressable onPress={confirmClear} style={{ marginLeft: 16 }}>
              <Text style={[s.action, { color: colors.danger }]}>Clear all</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: colors.lavender }]}>
              <Ionicons name="notifications-outline" size={36} color={colors.onPastel} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text }]}>No notifications</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>
              You’ll see analysis results and updates here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', margin: space.lg, marginBottom: 0, padding: 12, borderRadius: radius.sm },
  actions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: space.lg, paddingTop: space.md,
  },
  action: { fontWeight: '700' },
  item: { flexDirection: 'row', padding: space.md, borderRadius: radius.md, borderWidth: 1.5, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { width: 80, height: 80, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: space.md },
});