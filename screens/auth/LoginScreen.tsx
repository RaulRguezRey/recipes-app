import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../context/AuthContext';
import { C, FONT, RADIUS, SHADOW } from '../../constants/theme';

type Mode = 'signin' | 'signup' | 'magic';

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink, signInWithGoogle, signInWithApple } =
    useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  function resetForm() {
    setError(null);
    setDisplayName('');
    setPassword('');
    setConfirmPassword('');
  }

  function switchMode(m: Mode) {
    setMode(m);
    resetForm();
    setMagicLinkSent(false);
  }

  async function handleSignIn() {
    if (!email || !password) { setError('Rellena el email y la contraseña.'); return; }
    setLoading(true); setError(null);
    try { await signInWithEmail(email, password); }
    catch (e: any) { setError(translateError(e.message)); }
    finally { setLoading(false); }
  }

  async function handleSignUp() {
    if (!displayName.trim()) { setError('Introduce tu nombre.'); return; }
    if (!email) { setError('Introduce tu email.'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true); setError(null);
    try { await signUpWithEmail(email, password, displayName.trim()); }
    catch (e: any) { setError(translateError(e.message)); }
    finally { setLoading(false); }
  }

  async function handleMagicLink() {
    if (!email) { setError('Introduce tu email.'); return; }
    setLoading(true); setError(null);
    try {
      await signInWithMagicLink(email);
      setMagicLinkSent(true);
    }
    catch (e: any) { setError(translateError(e.message)); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true); setError(null);
    try { await signInWithGoogle(); }
    catch (e: any) { setError(translateError(e.message)); }
    finally { setLoading(false); }
  }

  async function handleApple() {
    setLoading(true); setError(null);
    try { await signInWithApple(); }
    catch (e: any) {
      // ERR_CANCELED is the user dismissing the sheet — not an error to show
      if (e.code !== 'ERR_CANCELED') setError(translateError(e.message));
    }
    finally { setLoading(false); }
  }

  function translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
    if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese email.';
    if (msg.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
    if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
    return msg;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      testID="login-root"
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>Recipes</Text>
          <Text style={styles.tagline}>Tu cocina, tu recetario</Text>
        </View>

        {/* Card */}
        <View testID="login-card" style={styles.card}>
          {/* Mode tabs */}
          <View testID="login-tabs" style={styles.tabs}>
            <Pressable style={[styles.tab, mode === 'signin' && styles.tabActive]} onPress={() => switchMode('signin')}>
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>Entrar</Text>
            </Pressable>
            <Pressable style={[styles.tab, mode === 'signup' && styles.tabActive]} onPress={() => switchMode('signup')}>
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Crear cuenta</Text>
            </Pressable>
          </View>

          {/* Magic link sent confirmation */}
          {magicLinkSent ? (
            <View style={styles.magicSent}>
              <Text style={styles.magicSentTitle}>¡Revisa tu email!</Text>
              <Text style={styles.magicSentBody}>
                Te hemos enviado un enlace a {email}. Tócalo para entrar.
              </Text>
              <Pressable onPress={() => setMagicLinkSent(false)}>
                <Text style={styles.link}>Volver</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Display name (signup only) */}
              {mode === 'signup' && (
                <TextInput
                  testID="login-displayNameInput"
                  style={styles.input}
                  placeholder="Tu nombre"
                  placeholderTextColor={C.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              )}

              {/* Email */}
              <TextInput
                testID="login-emailInput"
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              {/* Password */}
              {mode !== 'magic' && (
                <TextInput
                  testID="login-passwordInput"
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor={C.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType={mode === 'signup' ? 'next' : 'done'}
                />
              )}

              {/* Confirm password (signup only) */}
              {mode === 'signup' && (
                <TextInput
                  testID="login-confirmPasswordInput"
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor={C.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  returnKeyType="done"
                />
              )}

              {/* Error */}
              {error && <Text style={styles.error}>{error}</Text>}

              {/* Primary action button */}
              <Pressable
                testID="login-submitBtn"
                style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={mode === 'signup' ? handleSignUp : handleSignIn}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>
                      {mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
                    </Text>
                }
              </Pressable>

              {/* Magic link option (sign-in mode only) */}
              {mode === 'signin' && (
                <Pressable onPress={handleMagicLink} disabled={loading} style={styles.magicLinkBtn}>
                  <Text style={styles.link}>Entrar sin contraseña (magic link)</Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* Divider + OAuth */}
        {!magicLinkSent && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o continúa con</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.oauthBox}>
              {/* Google */}
              <Pressable
                testID="login-googleBtn"
                style={[styles.btn, styles.btnOAuth, loading && styles.btnDisabled]}
                onPress={handleGoogle}
                disabled={loading}
              >
                <Text style={styles.btnOAuthText}>Continuar con Google</Text>
              </Pressable>

              {/* Apple (iOS only) */}
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={RADIUS.sm}
                  style={styles.appleBtn}
                  onPress={handleApple}
                />
              )}
            </View>
            <Text style={styles.oauthWip}>
              Esto sigue en desarrollo, siempre hay que dejar margen de mejora
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgPage,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appName: {
    fontFamily: FONT.serif,
    fontSize: 40,
    color: C.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: C.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: C.bgSurface,
    borderRadius: RADIUS.lg,
    padding: 24,
    ...SHADOW.md,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: RADIUS.sm,
    backgroundColor: C.bgPage,
    marginBottom: 20,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: C.bgSurface,
    ...SHADOW.sm,
  },
  tabText: {
    fontSize: 14,
    color: C.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: C.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: C.bgInput,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textPrimary,
    marginBottom: 12,
  },
  error: {
    color: C.danger,
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  btn: {
    borderRadius: RADIUS.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: C.primary,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  magicLinkBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  link: {
    color: C.primary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  magicSent: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  magicSentTitle: {
    fontFamily: FONT.serif,
    fontSize: 20,
    color: C.textPrimary,
  },
  magicSentBody: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    fontSize: 12,
    color: C.textMuted,
  },
  btnOAuth: {
    backgroundColor: C.bgSurface,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    ...SHADOW.sm,
  },
  btnOAuthText: {
    color: C.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  appleBtn: {
    height: 50,
    width: '100%',
  },
  oauthBox: {
    borderWidth: 2,
    borderColor: '#F97316',
    borderRadius: RADIUS.md,
    padding: 12,
  },
  oauthWip: {
    color: '#F97316',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
