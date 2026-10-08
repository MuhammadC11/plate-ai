import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listRecentMeals } from '@/api/meals';
import { MealCard } from '@/components/MealCard';
import { CONTENT_BOTTOM_INSET } from '@/lib/layout';
import { formatDayLabel, localDayKey, sumMeals } from '@/lib/nutrition';
import { colors, radius, spacing } from '@/lib/theme';
import type { Meal } from '@/lib/types';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMeals(await listRecentMeals());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const days = useMemo(() => {
    const grouped = new Map<string, Meal[]>();
    for (const meal of meals) {
      const key = localDayKey(meal.eaten_at);
      grouped.set(key, [...(grouped.get(key) ?? []), meal]);
    }
    return [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [meals]);

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
      <Text style={styles.heading}>History</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {days.length === 0 && loaded ? (
        <Text style={styles.empty}>No meals logged yet.</Text>
      ) : null}

      {days.map(([key, dayMeals]) => {
        const totals = sumMeals(dayMeals);
        return (
          <View key={key} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{formatDayLabel(key)}</Text>
              <Text style={styles.dayTotal}>{Math.round(totals.calories).toLocaleString()} kcal</Text>
            </View>

            <View style={styles.dayMacros}>
              <Text style={[styles.dayMacro, { color: colors.protein }]}>
                {Math.round(totals.protein_g)}g protein
              </Text>
              <Text style={[styles.dayMacro, { color: colors.carbs }]}>
                {Math.round(totals.carbs_g)}g carbs
              </Text>
              <Text style={[styles.dayMacro, { color: colors.fat }]}>
                {Math.round(totals.fat_g)}g fat
              </Text>
            </View>

            <View style={styles.dayMeals}>
              {dayMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onPress={() => router.push(`/meal/${meal.id}`)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  heading: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  error: { color: colors.danger, fontSize: 14 },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: spacing.xl },
  day: { gap: spacing.md },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dayLabel: { color: colors.text, fontSize: 18, fontWeight: '700' },
  dayTotal: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  dayMacros: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayMacro: { fontSize: 12, fontWeight: '600' },
  dayMeals: { gap: spacing.md, borderRadius: radius.md },
});
