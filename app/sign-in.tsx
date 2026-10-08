import { useState } from 'react';
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

import { Button } from '@/components/Button';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);

    if (!isSupabaseConfigured) {
      setError('Supabase keys are missing. Fill in .env, then restart with `npx expo start -c`.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (mode === 'sign-up' && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'sign-up') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;

        // With email confirmation enabled, signUp returns a user but no session.
        if (!data.session) {
          setMessage('Check your inbox for a confirmation link, then sign in.');
          setMode('sign-in');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Plate AI</Text>
          <Text style={styles.tagline}>
            Photograph your plate. Get calories and macros grounded in the USDA food database.
          </Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'sign-up' ? 'At least 8 characters' : '••••••••'}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              secureTextEntry
              style={styles.input}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Button
            label={mode === 'sign-up' ? 'Create account' : 'Sign in'}
            onPress={submit}
            loading={busy}
          />

          <Button
            label={
              mode === 'sign-up' ? 'I already have an account' : "I don't have an account yet"
            }
            variant="ghost"
            onPress={() => {
              setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up');
              setError(null);
              setMessage(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  header: { gap: spacing.md },
  logo: { color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1.5 },
  tagline: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
  form: { gap: spacing.lg },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm, fontWeight: '500' },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  message: { color: colors.accent, fontSize: 14, lineHeight: 20 },
});
