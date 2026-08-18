// app/lock.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Lock, Fingerprint } from 'lucide-react-native';
import {
  hasPinSetup,
  setupPin,
  verifyPin,
  isBiometricAvailable,
  authenticateWithBiometrics,
} from '@/lib/utils/authService';

export default function LockScreen() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [mode, setMode] = useState<'loading' | 'setup' | 'confirm' | 'unlock'>('loading');
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
      setMode('unlock');
      if (bioAvailable) {
        tryBiometric();
      }
    } else {
      setMode('setup');
    }
  };

  const tryBiometric = async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      router.replace('/(tabs)');
    }
  };

  const handleSetupSubmit = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setError('');
    setMode('confirm');
  };

  const handleConfirmSubmit = async () => {
    if (confirmPin !== pin) {
      setError('PINs do not match');
      setConfirmPin('');
      return;
    }
    await setupPin(pin);
    router.replace('/(tabs)');
  };

  const handleUnlockSubmit = async () => {
    const valid = await verifyPin(pin);
    if (valid) {
      router.replace('/(tabs)');
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  if (mode === 'loading') {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Lock size={32} color="#10b981" />
        </View>

        <Text style={styles.title}>
          {mode === 'setup' && 'Create your PIN'}
          {mode === 'confirm' && 'Confirm your PIN'}
          {mode === 'unlock' && 'Enter your PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'setup' && 'Choose a 4-6 digit PIN to secure your financial data'}
          {mode === 'confirm' && 'Re-enter your PIN to confirm'}
          {mode === 'unlock' && 'Your financial data is protected'}
        </Text>

        <TextInput
          style={styles.pinInput}
          value={mode === 'confirm' ? confirmPin : pin}
          onChangeText={mode === 'confirm' ? setConfirmPin : setPin}
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
            mode === 'setup'
              ? handleSetupSubmit
              : mode === 'confirm'
              ? handleConfirmSubmit
              : handleUnlockSubmit
          }
        >
          <Text style={styles.buttonText}>
            {mode === 'setup' ? 'Continue' : mode === 'confirm' ? 'Confirm' : 'Unlock'}
          </Text>
        </TouchableOpacity>

        {mode === 'unlock' && biometricAvailable && (
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