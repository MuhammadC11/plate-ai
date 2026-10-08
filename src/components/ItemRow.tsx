import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, radius, spacing } from '@/lib/theme';
import type { AnalysisItem } from '@/lib/types';

type Props = {
  item: AnalysisItem;
  onChangeGrams: (grams: number) => void;
  onRemove: () => void;
};

/** Portion nudge size, so a 400g plate of rice adjusts faster than 8g of oil. */
function step(grams: number): number {
  if (grams >= 200) return 25;
  if (grams >= 50) return 10;
  return 5;
}

export function ItemRow({ item, onChangeGrams, onRemove }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const lowConfidence = item.confidence < 0.5;

  function commitDraft() {
    if (draft === null) return;
    const parsed = Number(draft);
    onChangeGrams(Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 3000) : item.grams);
    setDraft(null);
  }

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={styles.nameWrap}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.tags}>
            <View style={[styles.tag, item.source === 'usda' ? styles.tagUsda : styles.tagEstimate]}>
              <Text style={[styles.tagText, item.source === 'usda' && styles.tagTextUsda]}>
                {item.source === 'usda' ? 'USDA' : 'EST'}
              </Text>
            </View>
            {lowConfidence ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>LOW CONFIDENCE</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          onPress={onRemove}
          hitSlop={8}
          style={styles.remove}
        >
          <Icon name="trash" color={colors.textFaint} size={18} />
        </Pressable>
      </View>

      <View style={styles.portionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease portion"
          onPress={() => onChangeGrams(Math.max(1, item.grams - step(item.grams)))}
          style={styles.stepper}
        >
          <Icon name="minus" color={colors.text} size={16} />
        </Pressable>

        <View style={styles.gramsWrap}>
          <TextInput
            value={draft ?? String(Math.round(item.grams))}
            onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ''))}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={4}
            selectTextOnFocus
            style={styles.grams}
            accessibilityLabel={`Grams of ${item.name}`}
          />
          <Text style={styles.gramsUnit}>g</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase portion"
          onPress={() => onChangeGrams(item.grams + step(item.grams))}
          style={styles.stepper}
        >
          <Icon name="plus" color={colors.text} size={16} />
        </Pressable>

        <View style={styles.macros}>
          <Text style={styles.calories}>{Math.round(item.calories)} kcal</Text>
          <Text style={styles.macroDetail}>
            <Text style={{ color: colors.protein }}>{Math.round(item.protein_g)}p</Text>
            {'  '}
            <Text style={{ color: colors.carbs }}>{Math.round(item.carbs_g)}c</Text>
            {'  '}
            <Text style={{ color: colors.fat }}>{Math.round(item.fat_g)}f</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  nameWrap: { flex: 1, gap: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  tags: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tag: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagUsda: { borderColor: colors.accentDim, backgroundColor: colors.accentDim },
  tagEstimate: {},
  tagText: { color: colors.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  tagTextUsda: { color: colors.accent },
  remove: { padding: spacing.xs },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepper: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gramsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 62,
    justifyContent: 'center',
  },
  grams: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 38,
    paddingVertical: spacing.xs,
  },
  gramsUnit: { color: colors.textFaint, fontSize: 13 },
  macros: { flex: 1, alignItems: 'flex-end' },
  calories: { color: colors.text, fontSize: 15, fontWeight: '700' },
  macroDetail: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
