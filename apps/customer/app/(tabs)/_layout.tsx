import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '@/constants/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const map: Record<string, string> = {
    Home: '⌂',
    Restock: '↻',
    Categories: '▦',
    Orders: '▣',
  };
  return (
    <Text
      style={{
        fontSize: 18,
        fontWeight: '700',
        color: focused ? theme.colors.primary : theme.colors.textMuted,
      }}
    >
      {map[label] ?? '•'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{
          title: 'Categories',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Categories" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="restock"
        options={{
          title: 'Restock',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Restock" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Orders" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
