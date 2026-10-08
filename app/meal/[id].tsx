import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteMeal, getMeal } from '@/api/meals';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { formatTime, sumItems } from '@/lib/nutrition';
import { colors, radius, spacing } from '@/lib/theme';
import type { Meal } from '@/lib/types';

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMeal(id)
      .then(setMeal)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this meal.'))
      .finally(() => setLoading(false));
  }, [id]);

  function confirmDelete() {
    Alert.alert('Delete this meal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          setDeleting(true);
          try {
            await deleteMeal(id);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete this meal.');
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'That meal no longer exists.'}</Text>
      </View>
    );
  }

  const totals = sumItems(meal.items);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
    >
      {meal.photo_url ? <Image source={{ uri: meal.photo_url }} style={styles.photo} /> : null}

      <View>
        <Text style={styles.title}>{meal.title}</Text>
        <Text style={styles.time}>
          {new Date(meal.eaten_at).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}{' '}
          at {formatTime(meal.eaten_at)}
        </Text>
      </View>

      <View style={styles.totals}>
        <View>
          <Text style={styles.totalsValue}>{Math.round(totals.calories).toLocaleString()}</Text>
          <Text style={styles.totalsLabel}>kcal</Text>
        </View>
        <View style={styles.totalsMacros}>
          {(
            [
              ['Protein', totals.protein_g, colors.protein],
              ['Carbs', totals.carbs_g, colors.carbs],
              ['Fat', totals.fat_g, colors.fat],
            ] as const
          ).map(([label, value, color]) => (
            <View key={label} style={styles.totalsMacro}>
              <Text style={[styles.totalsMacroValue, { color }]}>{Math.round(value)}g</Text>
              <Text style={styles.totalsLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {meal.notes ? (
        <View style={styles.notice}>
          <Icon name="info" color={colors.textMuted} size={18} />
          <Text style={styles.noticeText}>{meal.notes}</Text>
        </View>
      ) : null}

      <View style={styles.items}>
        {meal.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.itemMain}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {Math.round(item.grams)}g
                {item.source === 'estimate' ? ' · estimated' : ''}
              </Text>
            </View>
            <View style={styles.itemMacros}>
              <Text style={styles.itemCalories}>{Math.round(item.calories)} kcal</Text>
              <Text style={styles.itemMacroDetail}>
                <Text style={{ color: colors.protein }}>{Math.round(item.protein_g)}p</Text>
                {'  '}
                <Text style={{ color: colors.carbs }}>{Math.round(item.carbs_g)}c</Text>
                {'  '}
                <Text style={{ color: colors.fat }}>{Math.round(item.fat_g)}f</Text>
              </Text>
            </View>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Delete meal" variant="danger" onPress={confirmDelete} loading={deleting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, gap: spacing.lg },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  time: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  totalsValue: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  totalsLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  totalsMacros: { flexDirection: 'row', gap: spacing.xl },
  totalsMacro: { alignItems: 'flex-end' },
  totalsMacroValue: { fontSize: 17, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  noticeText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, flex: 1 },
  items: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemMain: { flex: 1 },
  itemName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  itemMeta: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  itemMacros: { alignItems: 'flex-end' },
  itemCalories: { color: colors.text, fontSize: 15, fontWeight: '700' },
  itemMacroDetail: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  error: { color: colors.danger, fontSize: 14 },
});
