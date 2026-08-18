
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useUser } from '../lib/UserContext';
import {
  validateEmail,
  validateName,
  validatePassword,
} from '../lib/services/utils/authValidation';
 
export default function SignupScreen() {
  const { register } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
 
  const handleSignup = async () => {
    setError(null);
 
    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (nameErr) return setError(nameErr);
    if (emailErr) return setError(emailErr);
    if (passErr) return setError(passErr);
    if (password !== confirmPassword) return setError('Passwords do not match');
 
    setIsSubmitting(true);
    const result = await register({ name, email, password });
    setIsSubmitting(false);
 
    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Try again.');
      return;
    }
    router.replace('/(tabs)');
  };
 
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Start tracking your finances with Syntra
            </Text>
          </View>
 
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Jane Doe"
                placeholderTextColor="#6B7280"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>
 
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
 
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#6B7280"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.showBtn}
                >
                  <Text style={styles.showBtnText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                Use 8+ characters, one uppercase letter, and one number.
              </Text>
            </View>
 
            <View style={styles.field}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#6B7280"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
 
            {error && <Text style={styles.error}>{error}</Text>}
 
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#0B0F19" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
 
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Log in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
 
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0F19' },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#9CA3AF' },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, color: '#D1D5DB', fontWeight: '500' },
  input: {
    backgroundColor: '#151B2C',
    borderWidth: 1,
    borderColor: '#242C42',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  showBtn: { position: 'absolute', right: 14 },
  showBtnText: { color: '#7C8CF8', fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, color: '#6B7280' },
  error: { color: '#F87171', fontSize: 13 },
  primaryButton: {
    backgroundColor: '#7C8CF8',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#0B0F19', fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  footerText: { color: '#9CA3AF', fontSize: 14 },
  footerLink: { color: '#7C8CF8', fontSize: 14, fontWeight: '700' },
});
 
