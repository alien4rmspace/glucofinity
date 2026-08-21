import { Tabs } from 'expo-router';
import { ChartNoAxesCombined, ClipboardList, House, Lightbulb, Settings } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { palette } from '@/constants/design';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.blue,
        tabBarInactiveTintColor: palette.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.item,
        tabBarStyle: styles.bar,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarAccessibilityLabel: 'Dashboard tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={House} label="Dashboard" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Logs',
          tabBarAccessibilityLabel: 'Logs tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={ClipboardList} label="Logs" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarAccessibilityLabel: 'Trends tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={ChartNoAxesCombined} label="Trends" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarAccessibilityLabel: 'Insights tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Lightbulb} label="Insights" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Settings} label="Settings" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  icon: Icon,
  label,
  color,
  focused,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabIcon}>
      <Icon size={20} strokeWidth={focused ? 2.5 : 2} color={color} />
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: palette.surface,
    borderTopColor: palette.border,
    height: Platform.OS === 'ios' ? 82 : 66,
    paddingTop: 7,
    paddingBottom: Platform.OS === 'ios' ? 20 : 7,
  },
  label: {
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '600',
  },
  tabIcon: {
    width: 60,
    height: 34,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    paddingVertical: 0,
  },
});
