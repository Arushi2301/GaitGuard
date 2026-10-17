import { StyleSheet } from 'react-native';

export const colors = { bg: '#0f172a', card: '#1e293b', primary: '#22c55e', text: '#f8fafc', muted: '#94a3b8' };

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  text: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  btnOutline: { borderWidth: 1, borderColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: colors.card, padding: 16, borderRadius: 12, marginBottom: 12 },
});