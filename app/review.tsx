import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyzeMeal, prepareImage } from '@/api/analyze';
import { createMeal, uploadMealPhoto } from '@/api/meals';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ItemRow } from '@/components/ItemRow';
import { useAuth } from '@/lib/auth';
import { rescaleToGrams, sumItems } from '@/lib/nutrition';
import { colors, radius, spacing } from '@/lib/theme';
import type { AnalysisItem } from '@/lib/types';

type Phase = 'preparing' | 'analyzing' | 'ready' | 'failed';

export default function ReviewScreen() {
  // The camera and library picker pass the selected local URI through the route.
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  // Phase controls which loading, error, or results view is rendered.
  const [phase, setPhase] = useState<Phase>('preparing');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [title, setTitle] = useState('Meal');
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [notFood, setNotFood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [hintOpen, setHintOpen] = useState(false);
  const [hint, setHint] = useState('');

  // Holds the compressed base64 so a re-analysis with a hint doesn't have to
  // read and recompress the photo again.
  const base64Ref = useRef<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard"
          onPress={() => router.replace('/')}
          hitSlop={10}
        >
          <Icon name="close" color={colors.text} size={22} />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  const run = useCallback(
    async (withHint?: string) => {
      // This same function handles the first analysis and later hint-based retries.
      if (!uri) {
        setError('No photo was passed to this screen.');
        setPhase('failed');
        return;
      }

      setError(null);

      try {
        if (!base64Ref.current) {
          // Prepare only once; retries reuse the compressed image.
          setPhase('preparing');
          const prepared = await prepareImage(uri);
          base64Ref.current = prepared.base64;
          setPreviewUri(prepared.uri);
        }

        // The server identifies foods first, then enriches them with nutrition data.
        setPhase('analyzing');
        const result = await analyzeMeal(base64Ref.current, withHint);

        setTitle(result.title || 'Meal');
        setItems(result.items ?? []);
        setNotes(result.notes);
        setNotFood(Boolean(result.not_food));
        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed.');
        setPhase('failed');
      }
    },
    [uri]
  );

  useEffect(() => {
    // Start analysis automatically after the route receives the image URI.
    run();
  }, [run]);

  // Keep the summary derived from items so edits immediately update the totals.
  const totals = sumItems(items);

  async function save() {
    // An empty analysis cannot be logged, and unauthenticated users cannot own a meal.
    if (!userId || items.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      // Photo upload is optional; createMeal still saves nutrition if it fails.
      const photoUrl = previewUri ? await uploadMealPhoto(userId, previewUri) : null;
      await createMeal(userId, {
        title: title.trim() || 'Meal',
        notes,
        photoUrl,
        eatenAt: new Date(),
        items,
      });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this meal.');
      setSaving(false);
    }
  }

  // Both async preparation phases share the same loading layout.
  if (phase === 'preparing' || phase === 'analyzing') {
    return (
      <View style={styles.centered}>
        {previewUri ? <Image source={{ uri: previewUri }} style={styles.loadingPhoto} /> : null}
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingTitle}>
          {phase === 'preparing' ? 'Preparing photo' : 'Reading your plate'}
        </Text>
        <Text style={styles.loadingBody}>
          {phase === 'preparing'
            ? 'Resizing so the upload is quick.'
            : 'Identifying each food, estimating portions, then looking up real nutrition data.'}
        </Text>
      </View>
    );
  }

  // A failed request keeps the original photo and offers a retry.
  if (phase === 'failed') {
    return (
      <View style={styles.centered}>
        <Icon name="alert" color={colors.danger} size={36} />
        <Text style={styles.loadingTitle}>Couldn&apos;t analyze that</Text>
        <Text style={styles.loadingBody}>{error}</Text>
        <View style={styles.failedActions}>
          <Button label="Try again" onPress={() => run(hint || undefined)} />
          <Button label="Back to today" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        keyboardShouldPersistTaps="handled"
      >
        {previewUri ? <Image source={{ uri: previewUri }} style={styles.photo} /> : null}

        {notFood ? (
          <View style={styles.notice}>
            <Icon name="alert" color={colors.danger} size={18} />
            <Text style={styles.noticeText}>
              That doesn&apos;t look like food. Retake the photo, or describe what&apos;s in it
              below and analyze again.
            </Text>
          </View>
        ) : null}

        <View>
          <Text style={styles.label}>Meal name</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
            placeholder="Meal"
            placeholderTextColor={colors.textFaint}
            maxLength={60}
          />
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

        {notes ? (
          <View style={styles.notice}>
            <Icon name="info" color={colors.textMuted} size={18} />
            <Text style={styles.noticeTextMuted}>{notes}</Text>
          </View>
        ) : null}

        <View style={styles.items}>
          {items.map((item, index) => (
            <ItemRow
              key={`${item.name}-${index}`}
              item={item}
              onChangeGrams={(grams) =>
                setItems((prev) =>
                  prev.map((current, i) => (i === index ? rescaleToGrams(current, grams) : current))
                )
              }
              onRemove={() => setItems((prev) => prev.filter((_, i) => i !== index))}
            />
          ))}

          {items.length === 0 ? (
            <Text style={styles.emptyItems}>
              No items. Describe the meal below and analyze again.
            </Text>
          ) : null}
        </View>

        {hintOpen ? (
          <View style={styles.hintBox}>
            <Text style={styles.label}>What did the AI get wrong?</Text>
            <TextInput
              value={hint}
              onChangeText={setHint}
              placeholder="e.g. that's basmati rice with ghee, and the curry has coconut milk"
              placeholderTextColor={colors.textFaint}
              style={styles.hintInput}
              multiline
              maxLength={300}
            />
            <Button
              label="Analyze again with this"
              variant="secondary"
              onPress={() => run(hint.trim() || undefined)}
              disabled={!hint.trim()}
            />
          </View>
        ) : (
          <Pressable onPress={() => setHintOpen(true)} style={styles.hintToggle}>
            <Icon name="refresh" color={colors.textMuted} size={16} />
            <Text style={styles.hintToggleText}>Something wrong? Describe it and re-analyze</Text>
          </Pressable>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={saving ? 'Saving' : 'Log this meal'}
          onPress={save}
          loading={saving}
          disabled={items.length === 0}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingPhoto: {
    width: 140,
    height: 140,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    opacity: 0.5,
  },
  loadingTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginTop: spacing.sm },
  loadingBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  failedActions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.lg },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '500', marginBottom: spacing.sm },
  titleInput: {
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
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
  noticeText: { color: colors.danger, fontSize: 13, lineHeight: 19, flex: 1 },
  noticeTextMuted: { color: colors.textMuted, fontSize: 13, lineHeight: 19, flex: 1 },
  items: { gap: spacing.md },
  emptyItems: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
  hintToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  hintToggleText: { color: colors.textMuted, fontSize: 14 },
  hintBox: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  hintInput: {
    minHeight: 84,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  error: { color: colors.danger, fontSize: 14 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
