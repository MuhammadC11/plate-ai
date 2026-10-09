import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  userId: string | null;
  /** True until the persisted session has been read from storage. */
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  userId: null,
  loading: true,
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // The provider owns the session so every screen can react to sign-in changes.
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Read a session saved by AsyncStorage when the app starts.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Then listen for sign-in, sign-out, and token-refresh events.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      // Ignore late async results and remove the auth listener on unmount.
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      // Screens usually only need the ID to query rows owned by this user.
      userId: session?.user?.id ?? null,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  // useContext keeps screen components independent from the provider's internals.
  return useContext(AuthContext);
}
