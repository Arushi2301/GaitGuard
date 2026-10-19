import { Text } from 'react-native';
import TopBar, { TabScreen } from '../../components/TopBar';
import { useTheme } from '../../theme/ThemeContext';

export default function History() {
  const { colors } = useTheme();
  return (
    <TabScreen>
      <TopBar subtitle="Your past screenings" />
      <Text style={{ color: colors.muted }}>History coming next…</Text>
    </TabScreen>
  );
}