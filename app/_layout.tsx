import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

function RootNavigator() {
  // Navigation decisions depend on the shared auth session and current route.
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait for persisted auth to load before redirecting, avoiding a flash of the wrong screen.
    if (loading) return;

    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) {
      router.replace('/sign-in');
    } else if (session && onSignIn) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    // Keep the first frame simple while Supabase restores the session.
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen
        name="scan"
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="review"
        options={{ title: 'Review meal', presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen name="meal/[id]" options={{ title: 'Meal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  // Providers wrap the entire route tree so every screen gets safe areas and auth state.
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
