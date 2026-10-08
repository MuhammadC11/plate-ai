import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';
import type { Profile, Totals } from '@/lib/types';

type Props = {
  totals: Totals;
  goals: Pick<Profile, 'protein_goal_g' | 'carbs_goal_g' | 'fat_goal_g'>;
};

export function MacroBars({ totals, goals }: Props) {
  const rows = [
    { key: 'Protein', value: totals.protein_g, goal: goals.protein_goal_g, color: colors.protein },
    { key: 'Carbs', value: totals.carbs_g, goal: goals.carbs_goal_g, color: colors.carbs },
    { key: 'Fat', value: totals.fat_g, goal: goals.fat_goal_g, color: colors.fat },
  ];

  return (
    <View style={styles.container}>
      {rows.map((row) => {
        const progress = row.goal > 0 ? Math.min(row.value / row.goal, 1) : 0;
        return (
          <View key={row.key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{row.key}</Text>
              <Text style={styles.value}>
                {Math.round(row.value)}
                <Text style={styles.goal}> / {row.goal}g</Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${progress * 100}%`, backgroundColor: row.color },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  row: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  value: { color: colors.text, fontSize: 14, fontWeight: '600' },
  goal: { color: colors.textFaint, fontWeight: '400' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
