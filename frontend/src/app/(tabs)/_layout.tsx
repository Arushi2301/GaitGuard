import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'home', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'analyze', title: 'Analyze', icon: 'scan-outline', iconActive: 'scan' },
  { name: 'history', title: 'History', icon: 'time-outline', iconActive: 'time' },
  { name: 'progress', title: 'Progress', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
];

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onTabBar,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarStyle: {
          position: 'absolute',
          marginHorizontal: 20,
          bottom: 20,
          height: 70,
          paddingTop: 10,
          paddingBottom: 10,
          borderRadius: 35,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => (
              <View
                style={{
                  width: 40,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? colors.primary : 'transparent',
                }}
              >
                <Ionicons name={focused ? t.iconActive : t.icon} size={20} color={color} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}