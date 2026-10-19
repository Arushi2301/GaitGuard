import { Text } from 'react-native';
import TopBar, { TabScreen } from '../../components/TopBar';
import { useTheme } from '../../theme/ThemeContext';

export default function Progress() {
  const { colors } = useTheme();
  return (
    <TabScreen>
      <TopBar subtitle="Track how you improve" />
      <Text style={{ color: colors.muted }}>Progress coming next…</Text>
    </TabScreen>
  );
}