import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getProfile, listMealsBetween } from '@/api/meals';
import { CalorieRing } from '@/components/CalorieRing';
import { Icon } from '@/components/Icon';
import { MacroBars } from '@/components/MacroBars';
import { MealCard } from '@/components/MealCard';
import { useAuth } from '@/lib/auth';
import { CONTENT_BOTTOM_INSET } from '@/lib/layout';
import { emptyTotals, endOfLocalDay, startOfLocalDay, sumMeals } from '@/lib/nutrition';
import { colors, radius, spacing } from '@/lib/theme';
import type { Meal, Profile } from '@/lib/types';

const FALLBACK_GOALS: Profile = {
  id: '',
  calorie_goal: 2000,
  protein_goal_g: 150,
  carbs_goal_g: 200,
  fat_goal_g: 65,
};

export default function TodayScreen() {
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [profile, setProfile] = useState<Profile>(FALLBACK_GOALS);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [dayMeals, userProfile] = await Promise.all([
        listMealsBetween(startOfLocalDay(), endOfLocalDay()),
        getProfile(userId),
      ]);
      setMeals(dayMeals);
      setProfile(userProfile);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load today.');
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  // Re-reads on every focus so a meal saved in the review modal shows up
  // immediately when that modal closes.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totals = loaded ? sumMeals(meals) : emptyTotals;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: CONTENT_BOTTOM_INSET },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.textMuted}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View>
        <Text style={styles.eyebrow}>{today}</Text>
        <Text style={styles.heading}>Today</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Icon name="alert" color={colors.danger} size={18} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.ringWrap}>
        <CalorieRing consumed={totals.calories} goal={profile.calorie_goal} />
      </View>

      <View style={styles.card}>
        <MacroBars totals={totals} goals={profile} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {meals.length > 0 ? `${meals.length} meal${meals.length === 1 ? '' : 's'} logged` : 'Meals'}
        </Text>

        {meals.length === 0 && loaded ? (
          <View style={styles.empty}>
            <Icon name="camera" color={colors.textFaint} size={30} />
            <Text style={styles.emptyTitle}>Nothing logged yet</Text>
            <Text style={styles.emptyBody}>
              Tap the camera button to photograph your plate. Fill the frame and shoot from a slight
              angle so depth is visible.
            </Text>
          </View>
        ) : (
          meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} onPress={() => router.push(`/meal/${meal.id}`)} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  eyebrow: { color: colors.textFaint, fontSize: 13, fontWeight: '500' },
  heading: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  ringWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: spacing.xs },
  emptyBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },
});
