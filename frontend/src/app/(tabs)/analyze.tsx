import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import TopBar, { TabScreen } from '../../components/TopBar';
import { Movement, MOVEMENTS } from '../../constants/movements';
import { radius, space } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

export default function Analyze() {
  const { colors } = useTheme();

  const open = (m: Movement) => {
    if (!m.available) {
      Alert.alert('Coming soon', `${m.name} screening will be available in a later version.`);
      return;
    }
    router.push({ pathname: '/capture', params: { movement: m.id } });
  };

  return (
    <TabScreen>
      <TopBar subtitle="Start a new screening" />

      <Text style={[s.heading, { color: colors.text }]}>Choose a movement</Text>
      <Text style={{ color: colors.muted, marginBottom: space.md }}>
        Pick what you want to screen. We’ll guide you through recording it.
      </Text>

      {MOVEMENTS.map(m => (
        <Pressable
          key={m.id}
          onPress={() => open(m)}
          style={({ pressed }) => [
            s.card,
            { backgroundColor: colors[m.color], opacity: m.available ? (pressed ? 0.85 : 1) : 0.55 },
          ]}
        >
          <View style={s.iconWrap}>
            <Ionicons name={m.icon} size={30} color={colors.onPastel} />
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[s.name, { color: colors.onPastel }]}>{m.name}</Text>
              {!m.available && (
                <View style={s.soon}>
                  <Text style={[s.soonText, { color: colors.onPastel }]}>Coming soon</Text>
                </View>
              )}
            </View>
            <View style={s.chips}>
              <Chip icon="videocam-outline" text={m.view} />
              <Chip icon="repeat-outline" text={m.reps} />
            </View>
          </View>

          {m.available && <Ionicons name="arrow-forward-circle" size={30} color={colors.onPastel} />}
        </Pressable>
      ))}

      <View style={[s.tip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
        <Text style={{ color: colors.muted, marginLeft: 10, flex: 1 }}>
          Use the <Text style={{ color: colors.text, fontWeight: '700' }}>back camera</Text> and keep your whole body in the frame.
        </Text>
      </View>
    </TabScreen>
  );
}

function Chip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.chip}>
      <Ionicons name={icon} size={12} color="#1B1B1F" />
      <Text style={s.chipText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.lg,
    marginBottom: 14,
    minHeight: 100,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 18, fontWeight: '800' },
  soon: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.6)' },
  soonText: { fontSize: 10, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
    marginTop: 4,
  },
  chipText: { fontSize: 11, fontWeight: '700', marginLeft: 4, color: '#1B1B1F' },
  tip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
});