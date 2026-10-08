import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime, sumItems } from '@/lib/nutrition';
import { colors, radius, spacing } from '@/lib/theme';
import type { Meal } from '@/lib/types';

type Props = {
  meal: Meal;
  onPress?: () => void;
};

export function MealCard({ meal, onPress }: Props) {
  const totals = sumItems(meal.items);
  const estimated = meal.items.some((item) => item.source === 'estimate');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      {meal.photo_url ? (
        <Image source={{ uri: meal.photo_url }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoPlaceholderText}>
            {meal.title.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {meal.title}
          </Text>
          <Text style={styles.time}>{formatTime(meal.eaten_at)}</Text>
        </View>

        <Text style={styles.items} numberOfLines={1}>
          {meal.items.map((item) => item.name).join(', ') || 'No items'}
        </Text>

        <View style={styles.macroRow}>
          <Text style={styles.calories}>{Math.round(totals.calories)} kcal</Text>
          <Text style={[styles.macro, { color: colors.protein }]}>
            P {Math.round(totals.protein_g)}
          </Text>
          <Text style={[styles.macro, { color: colors.carbs }]}>
            C {Math.round(totals.carbs_g)}
          </Text>
          <Text style={[styles.macro, { color: colors.fat }]}>F {Math.round(totals.fat_g)}</Text>
          {estimated ? <Text style={styles.estimateTag}>est</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.7 },
  photo: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { color: colors.textFaint, fontSize: 24, fontWeight: '700' },
  body: { flex: 1, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  time: { color: colors.textFaint, fontSize: 12 },
  items: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  calories: { color: colors.text, fontSize: 14, fontWeight: '700' },
  macro: { fontSize: 12, fontWeight: '600' },
  estimateTag: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
