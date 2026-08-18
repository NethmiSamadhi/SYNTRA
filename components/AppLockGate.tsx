// components/AppLockGate.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Fingerprint } from 'lucide-react-native';
import {
  hasPinSetup,
  setupPin,
  verifyPin,
  isBiometricAvailable,
  authenticateWithBiometrics,
} from '@/lib/utils/authService';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'setup' | 'confirm' | 'locked' | 'unlocked'>('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const exists = await hasPinSetup();
    const bioAvailable = await isBiometricAvailable();
    setBiometricAvailable(bioAvailable);

    if (exists) {
      setStatus('locked');
      if (bioAvailable) tryBiometric();
    } else {
      setStatus('setup');
    }
  };

  const tryBiometric = async () => {
    const success = await authenticateWithBiometrics();
    if (success) setStatus('unlocked');
  };

  const handleSetupSubmit = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setError('');
    setPendingPin(pin);
    setPin('');
    setStatus('confirm');
  };

  const handleConfirmSubmit = async () => {
    if (confirmPin !== pendingPin) {
      setError('PINs do not match, try again');
      setConfirmPin('');
      return;
    }
    await setupPin(pendingPin);
    setStatus('unlocked');
  };

  const handleUnlockSubmit = async () => {
    const valid = await verifyPin(pin);
    if (valid) {
      setStatus('unlocked');
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  if (status === 'unlocked') {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Lock size={32} color="#10b981" />
        </View>

        <Text style={styles.title}>
          {status === 'setup' && 'Create your PIN'}
          {status === 'confirm' && 'Confirm your PIN'}
          {status === 'locked' && 'Enter your PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {status === 'setup' && 'Choose a 4-6 digit PIN to secure your financial data'}
          {status === 'confirm' && 'Re-enter your PIN to confirm'}
          {status === 'locked' && 'Your financial data is protected'}
        </Text>

        <TextInput
          style={styles.pinInput}
          value={status === 'confirm' ? confirmPin : pin}
          onChangeText={status === 'confirm' ? setConfirmPin : setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          autoFocus
          placeholder="••••"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.button}
          onPress={
            status === 'setup'
              ? handleSetupSubmit
              : status === 'confirm'
              ? handleConfirmSubmit
              : handleUnlockSubmit
          }
        >
          <Text style={styles.buttonText}>
            {status === 'setup' ? 'Continue' : status === 'confirm' ? 'Confirm' : 'Unlock'}
          </Text>
        </TouchableOpacity>

        {status === 'locked' && biometricAvailable && (
          <TouchableOpacity style={styles.biometricButton} onPress={tryBiometric}>
            <Fingerprint size={20} color="#10b981" />
            <Text style={styles.biometricText}>Use biometric unlock</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10b98115',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 },
  pinInput: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: 16,
    width: 200,
    marginBottom: 16,
  },
  error: { color: '#ef4444', marginBottom: 16, fontSize: 13 },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 20,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  biometricButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  biometricText: { color: '#10b981', fontWeight: '600', fontSize: 14 },
});