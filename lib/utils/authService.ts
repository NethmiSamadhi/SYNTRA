/**
 * Device lock service — PIN + biometric unlock.
 *
 * Separate from lib/services/authService.ts (email/password account auth).
 * This handles the on-device app-lock screen (lock.tsx / AppLockGate.tsx).
 *
 * Requires: expo-secure-store, expo-local-authentication, expo-crypto
 *   npx expo install expo-secure-store expo-local-authentication expo-crypto
 */
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

// SecureStore keys may only contain letters, numbers, ".", "-", and "_" —
// no colons. (AsyncStorage-based keys elsewhere, e.g. 'syntra:users', don't
// have this restriction, which is why only this key was throwing.)
const PIN_KEY = 'syntra_pin_hash';

// ---------- helpers ----------

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

// ---------- PIN ----------

export async function hasPinSetup(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return stored !== null;
}

export async function setupPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_KEY, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;
  const hash = await hashPin(pin);
  return hash === stored;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

// ---------- biometrics ----------

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Syntra',
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
  });
  return result.success;
}