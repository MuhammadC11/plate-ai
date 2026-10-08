import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getProfile, updateProfile } from '@/api/meals';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/lib/auth';
import { CONTENT_BOTTOM_INSET } from '@/lib/layout';
import { caloriesFromMacros } from '@/lib/nutrition';
import { colors, radius, spacing } from '@/lib/theme';

type GoalKey = 'calorie_goal' | 'protein_goal_g' | 'carbs_goal_g' | 'fat_goal_g';

const FIELDS: { key: GoalKey; label: string; unit: string; color: string }[] = [
  { key: 'calorie_goal', label: 'Daily calories', unit: 'kcal', color: colors.accent },
  { key: 'protein_goal_g', label: 'Protein', unit: 'g', color: colors.protein },
  { key: 'carbs_goal_g', label: 'Carbs', unit: 'g', color: colors.carbs },
  { key: 'fat_goal_g', label: 'Fat', unit: 'g', color: colors.fat },
];

export default function SettingsScreen() {
  const { userId, session, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState<Record<GoalKey, string>>({
    calorie_goal: '2000',
    protein_goal_g: '150',
    carbs_goal_g: '200',
    fat_goal_g: '65',
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      getProfile(userId)
        .then((profile) => {
          setValues({
            calorie_goal: String(profile.calorie_goal),
            protein_goal_g: String(profile.protein_goal_g),
            carbs_goal_g: String(profile.carbs_goal_g),
            fat_goal_g: String(profile.fat_goal_g),
          });
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load goals.'));
    }, [userId])
  );

  const numbers = {
    calorie_goal: Number(values.calorie_goal) || 0,
    protein_goal_g: Number(values.protein_goal_g) || 0,
    carbs_goal_g: Number(values.carbs_goal_g) || 0,
    fat_goal_g: Number(values.fat_goal_g) || 0,
  };

  const macroCalories = caloriesFromMacros(
    numbers.protein_goal_g,
    numbers.carbs_goal_g,
    numbers.fat_goal_g
  );
  // Macro targets that don't add up to the calorie target aren't wrong exactly,
  // but they're almost always a typo, so it's worth pointing out.
  const mismatch =
    numbers.calorie_goal > 0 &&
    Math.abs(macroCalories - numbers.calorie_goal) / numbers.calorie_goal > 0.1;

  async function save() {
    if (!userId) return;
    setError(null);
    setStatus(null);

    if (numbers.calorie_goal < 500 || numbers.calorie_goal > 10000) {
      setError('Daily calories must be between 500 and 10,000.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(userId, numbers);
      setStatus('Goals saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goals.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: CONTENT_BOTTOM_INSET },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Goals</Text>

        <View style={styles.card}>
          {FIELDS.map((field) => (
            <View key={field.key} style={styles.field}>
              <View style={styles.fieldLabel}>
                <View style={[styles.dot, { backgroundColor: field.color }]} />
                <Text style={styles.label}>{field.label}</Text>
              </View>
              <View style={styles.inputWrap}>
                <TextInput
                  value={values[field.key]}
                  onChangeText={(text) =>
                    setValues((prev) => ({ ...prev, [field.key]: text.replace(/[^0-9]/g, '') }))
                  }
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={5}
                  style={styles.input}
                  selectTextOnFocus
                />
                <Text style={styles.unit}>{field.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        {mismatch ? (
          <View style={styles.hint}>
            <Icon name="info" color={colors.textMuted} size={16} />
            <Text style={styles.hintText}>
              Your macro targets add up to {Math.round(macroCalories).toLocaleString()} kcal, which
              doesn&apos;t match your {numbers.calorie_goal.toLocaleString()} kcal target.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Button label="Save goals" onPress={save} loading={saving} />

        <View style={styles.accountSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.email}>{session?.user?.email ?? 'Not signed in'}</Text>
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        </View>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>How the numbers are produced</Text>
          <Text style={styles.aboutBody}>
            A vision model identifies the foods on your plate and estimates how many grams of each
            you have. Those foods are then looked up in the USDA FoodData Central database, and the
            real per-100g nutrition is scaled to your portion.
          </Text>
          <Text style={styles.aboutBody}>
            Items tagged <Text style={styles.code}>EST</Text> had no good database match, so their
            numbers are the model&apos;s own estimate. Treat those as rougher, and correct the
            portion when you know better.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  heading: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: colors.text, fontSize: 15 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 64,
    paddingVertical: spacing.sm,
  },
  unit: { color: colors.textFaint, fontSize: 13, width: 32 },
  hint: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  hintText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, flex: 1 },
  error: { color: colors.danger, fontSize: 14 },
  status: { color: colors.accent, fontSize: 14 },
  accountSection: { gap: spacing.md, marginTop: spacing.lg },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  email: { color: colors.text, fontSize: 15 },
  about: { gap: spacing.md, marginTop: spacing.lg },
  aboutTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  aboutBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  code: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
});
