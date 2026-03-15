import React, { createContext, useContext, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// ── Types ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  display_name: string | null;
};

export type Household = {
  id: string;
  name: string;
  code: string;
  created_by: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  household: Household | null;
  loading: boolean;

  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;

  createHousehold: (name: string) => Promise<Household>;
  joinHousehold: (code: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  refreshHousehold: () => Promise<void>;
};

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  }

  async function fetchHousehold(userId: string) {
    const { data } = await supabase
      .from('household_members')
      .select('households(id, name, code, created_by)')
      .eq('user_id', userId)
      .limit(1)
      .single();
    const h = (data as any)?.households;
    setHousehold(h ?? null);
  }

  async function refreshHousehold() {
    if (user) await fetchHousehold(user.id);
  }

  // ── Session bootstrap ──────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        Promise.all([fetchProfile(s.user.id), fetchHousehold(s.user.id)]).finally(
          () => setLoading(false),
        );
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
        fetchHousehold(s.user.id);
      } else {
        setProfile(null);
        setHousehold(null);
      }
    });

    // Handle deep links for magic link + OAuth redirect
    const handleUrl = async ({ url }: { url: string }) => {
      if (url.includes('auth/callback') || url.includes('access_token') || url.includes('code=')) {
        const { data, error } = await supabase.auth.getSessionFromUrl({ url } as any);
        if (error) console.warn('Auth URL error:', error.message);
        else if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      }
    };

    const urlSub = Linking.addEventListener('url', handleUrl);
    // Handle case where app was opened cold via the link
    Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });

    return () => {
      listener.subscription.unsubscribe();
      urlSub.remove();
    };
  }, []);

  // ── Auth operations ────────────────────────────────────────────────────────

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithEmail(email: string, password: string, displayName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });
    if (error) throw error;
  }

  async function signInWithMagicLink(email: string) {
    const redirectTo = 'recipesapp://auth/callback';
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'recipesapp', path: 'auth/callback' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === 'success' && result.url) {
      const urlParams = new URL(result.url);
      const code = urlParams.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      }
    }
  }

  async function signInWithApple() {
    if (Platform.OS === 'ios') {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } else {
      // Android / web: OAuth redirect flow
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'recipesapp', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type === 'success' && result.url) {
        const urlParams = new URL(result.url);
        const code = urlParams.searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function updateDisplayName(name: string) {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('id', user.id);
    if (error) throw error;
    setProfile((p) => p ? { ...p, display_name: name } : null);
  }

  // ── Household operations ───────────────────────────────────────────────────

  async function createHousehold(name: string): Promise<Household> {
    if (!user) throw new Error('Not authenticated');

    const { data: code, error: codeError } = await supabase.rpc('generate_household_code');
    if (codeError) throw codeError;

    const { data: hh, error: hhError } = await supabase
      .from('households')
      .insert({ name, code, created_by: user.id })
      .select()
      .single();
    if (hhError) throw hhError;

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: hh.id, user_id: user.id });
    if (memberError) throw memberError;

    setHousehold(hh);
    return hh;
  }

  async function joinHousehold(code: string) {
    if (!user) throw new Error('Not authenticated');
    if (household) throw new Error('Leave your current household before joining another');

    const { data: hh, error: findError } = await supabase
      .from('households')
      .select()
      .ilike('code', code.trim())
      .single();
    if (findError || !hh) throw new Error('Código no válido. Compruébalo e inténtalo de nuevo.');

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: hh.id, user_id: user.id });
    if (memberError) throw memberError;

    setHousehold(hh);
  }

  async function leaveHousehold() {
    if (!user || !household) return;

    // Check if creator and if there are other members
    if (household.created_by === user.id) {
      const { data: members } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', household.id);
      if (members && members.length > 1) {
        throw new Error('Eres el creador del hogar. Expulsa a los demás miembros antes de salir.');
      }
      // Only member → delete household (cascades membership)
      await supabase.from('households').delete().eq('id', household.id);
    } else {
      await supabase
        .from('household_members')
        .delete()
        .eq('household_id', household.id)
        .eq('user_id', user.id);
    }

    setHousehold(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        household,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithMagicLink,
        signInWithGoogle,
        signInWithApple,
        signOut,
        updateDisplayName,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        refreshHousehold,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
