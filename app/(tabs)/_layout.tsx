import { Tabs, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { TAB_BAR_HEIGHT } from '@/lib/layout';
import { colors, radius } from '@/lib/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color }) => <Icon name="home" color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color }) => <Icon name="clock" color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Goals',
            tabBarIcon: ({ color }) => <Icon name="sliders" color={color} size={22} />,
          }}
        />
      </Tabs>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan a meal"
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/scan');
        }}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 },
          pressed && styles.fabPressed,
        ]}
      >
        <Icon name="camera" color={colors.bg} size={28} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
});
