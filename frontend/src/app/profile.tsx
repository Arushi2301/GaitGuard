import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
import { Avatar } from '../components/TopBar';
import { AppButton, AppInput } from '../components/ui';
import { FitnessLevel, normalizePhone, useAuth } from '../services/auth';
import { BmiKey, getBmiCategory } from '../services/bmi';
import { radius, space } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';

const LEVELS: FitnessLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const BMI_COLOR: Record<BmiKey, 'lavender' | 'mint' | 'yellow' | 'peach'> = {
  underweight: 'lavender', normal: 'mint', overweight: 'yellow', obese: 'peach',
};

function bmiOf(heightCm?: string, weightKg?: string) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!h || !w) return undefined;
  return (w / (h * h)).toFixed(1);
}

export default function Profile() {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    age: user?.age ?? '',
    heightCm: user?.heightCm ?? '',
    weightKg: user?.weightKg ?? '',
    fitnessLevel: user?.fitnessLevel,
    sport: user?.sport ?? '',
    goals: user?.goals ?? '',
  });
  const set = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  if (!user) return null;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled) await updateProfile({ photoUri: res.assets[0].uri });
  };

  const removePhoto = () => updateProfile({ photoUri: undefined });

  const photoOptions = () => {
    Alert.alert('Profile photo', undefined, [
      { text: 'Choose from gallery', onPress: pickPhoto },
      ...(user.photoUri ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const inRange = (v: string, min: number, max: number) => !v || (Number(v) >= min && Number(v) <= max);
    if (form.name.trim().length < 2) e.name = 'Please enter your name.';
    if (form.phone && normalizePhone(form.phone).length !== 10) e.phone = 'Enter a valid 10-digit number.';
    if (!inRange(form.age, 5, 100)) e.age = 'Age should be 5–100.';
    if (!inRange(form.heightCm, 50, 250)) e.heightCm = 'Height should be 50–250 cm.';
    if (!inRange(form.weightKg, 20, 300)) e.weightKg = 'Weight should be 20–300 kg.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    await updateProfile({
      name: form.name.trim(),
      phone: form.phone ? normalizePhone(form.phone) : undefined,
      age: form.age,
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      fitnessLevel: form.fitnessLevel,
      sport: form.sport.trim(),
      goals: form.goals.trim(),
    });
    setSaving(false);
    setEditing(false);
  };

  const bmi = bmiOf(user.heightCm, user.weightKg);
  const bmiCategory = bmi ? getBmiCategory(Number(bmi)) : null;
  const createdOn = new Date(user.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: space.lg }}>
          <Pressable onPress={photoOptions}>
            <Avatar size={110} />
            <View style={[s.camera, { backgroundColor: colors.primary, borderColor: colors.bg }]}>
              <Ionicons name="camera" size={16} color={colors.onPrimary} />
            </View>
          </Pressable>
          <Text style={[s.name, { color: colors.text }]}>{user.name}</Text>
          <Text style={{ color: colors.muted }}>{user.email}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Account created on {createdOn}</Text>
        </View>

        {!editing ? (
          <>
            {/* Body stats */}
            <View style={s.tiles}>
              <Tile label="Age" value={user.age ? `${user.age}` : '—'} unit="yrs" bg={colors.pink} />
              <Tile label="Height" value={user.heightCm || '—'} unit="cm" bg={colors.mint} />
              <Tile label="Weight" value={user.weightKg || '—'} unit="kg" bg={colors.yellow} />
              <Tile
                label="BMI"
                value={bmi ?? '—'}
                bg={bmiCategory ? colors[BMI_COLOR[bmiCategory.key]] : colors.lavender}
                note={bmiCategory ? `${bmiCategory.label} (${bmiCategory.range})` : undefined}
              />
            </View>
            {!!bmiCategory && (
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: space.md }}>
                BMI is a general indicator and not a diagnosis.
              </Text>
            )}

            {/* Details */}
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Detail icon="call-outline" label="Mobile" value={user.phone || 'Not added'} />
              <Detail icon="barbell-outline" label="Fitness level" value={user.fitnessLevel || 'Not set'} />
              <Detail icon="football-outline" label="Preferred sport" value={user.sport || 'Not set'} />
              <Detail icon="flag-outline" label="Fitness goals" value={user.goals || 'Not set'} last />
            </View>

            <AppButton title="Edit Profile" onPress={() => setEditing(true)} style={{ marginTop: space.lg }} />
          </>
        ) : (
          <>
            <AppInput label="Full name" icon="person-outline" value={form.name} onChangeText={set('name')} error={errors.name} />
            <AppInput label="Email (cannot be changed)" icon="mail-outline" value={user.email} editable={false} />
            <AppInput label="Mobile number" icon="call-outline" value={form.phone} onChangeText={set('phone')}
              keyboardType="phone-pad" maxLength={13} error={errors.phone} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <AppInput label="Age" value={form.age} onChangeText={set('age')} keyboardType="number-pad" maxLength={3} error={errors.age} />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput label="Height (cm)" value={form.heightCm} onChangeText={set('heightCm')} keyboardType="numeric" maxLength={5} error={errors.heightCm} />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput label="Weight (kg)" value={form.weightKg} onChangeText={set('weightKg')} keyboardType="numeric" maxLength={5} error={errors.weightKg} />
              </View>
            </View>

            <Text style={[s.label, { color: colors.muted }]}>Fitness level</Text>
            <View style={[s.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {LEVELS.map(l => {
                const active = form.fitnessLevel === l;
                return (
                  <Pressable key={l} onPress={() => setForm(f => ({ ...f, fitnessLevel: l }))}
                    style={[s.segBtn, active && { backgroundColor: colors.primary }]}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: active ? colors.onPrimary : colors.text }}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>

            <AppInput label="Preferred sport" icon="football-outline" placeholder="e.g. Football, Running"
              value={form.sport} onChangeText={set('sport')} />
            <AppInput label="Fitness goals" icon="flag-outline" placeholder="e.g. Improve knee mobility"
              value={form.goals} onChangeText={set('goals')} multiline />

            <AppButton title="Save Changes" onPress={save} loading={saving} />
            <AppButton title="Cancel" variant="ghost" onPress={() => { setEditing(false); setErrors({}); }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tile({ label, value, unit, bg, note }: { label: string; value: string; unit?: string; bg: string; note?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.tile, { backgroundColor: bg }]}>
      <Text style={{ color: colors.onPastel, opacity: 0.7, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colors.onPastel, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
        {value}
        {!!unit && value !== '—' && <Text style={{ fontSize: 12, fontWeight: '600' }}> {unit}</Text>}
      </Text>
      {!!note && <Text style={{ color: colors.onPastel, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{note}</Text>}
    </View>
  );
}

function Detail({ icon, label, value, last }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[s.detail, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  camera: {
    position: 'absolute', right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3,
  },
  name: { fontSize: 24, fontWeight: '800', marginTop: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: space.md },
  tile: { width: '48.5%', borderRadius: radius.md, padding: space.md, marginBottom: 10 },
  card: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md },
  detail: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  segment: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.pill, padding: 4, marginBottom: space.md },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
});