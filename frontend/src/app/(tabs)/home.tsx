import { Text } from 'react-native';
import TopBar, { TabScreen } from '../../components/TopBar';
import { useTheme } from '../../theme/ThemeContext';

export default function Home() {
  const { colors } = useTheme();
  return (
    <TabScreen>
      <TopBar subtitle="Ready to move today?" />
      <Text style={{ color: colors.muted }}>Dashboard coming next…</Text>
    </TabScreen>
  );
}