import { router } from 'expo-router';
import { Text } from 'react-native';
import TopBar, { TabScreen } from '../../components/TopBar';
import { AppButton } from '../../components/ui';
import { useTheme } from '../../theme/ThemeContext';

export default function Analyze() {
  const { colors } = useTheme();
  return (
    <TabScreen>
      <TopBar subtitle="Start a new screening" />
      <Text style={{ color: colors.muted }}>New Analyze screen coming next…</Text>
      <AppButton title="Start Analysis (old flow)" onPress={() => router.push('/select-movement')} />
    </TabScreen>
  );
}