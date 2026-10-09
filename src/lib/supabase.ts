import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// EXPO_PUBLIC_* values are embedded into the app bundle by Expo at startup.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// ANON_KEY is the documented name; KEY remains supported for older .env files.
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY;

// The UI uses this flag to show a useful setup message before making requests.
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Copy .env.example to .env and fill in ' +
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with `npx expo start -c`.'
  );
}

// Fallback values keep module initialization from crashing before .env is fixed.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: {
    // AsyncStorage persists the login session between app launches.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL bar for Supabase to parse a session out of.
    detectSessionInUrl: false,
  },
});
