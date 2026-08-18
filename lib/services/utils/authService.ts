/**
 * Local/mock auth service.
 *
 * No backend yet — accounts are persisted on-device with AsyncStorage.
 * Swap the internals of these functions for real API calls later
 * (the function signatures / return shapes are designed to stay stable).
 *
 * Requires: @react-native-async-storage/async-storage, expo-crypto, bcryptjs
 *   npx expo install @react-native-async-storage/async-storage expo-crypto
 *   npm install bcryptjs
 *   npm install --save-dev @types/bcryptjs
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import bcrypt from 'bcryptjs';
import type {
  AuthResult,
  LoginInput,
  RegisterInput,
  StoredUser,
  User,
} from '../../types/auth';
import {
  validateEmail,
  validateName,
  validatePassword,
} from './authValidation';

const USERS_KEY = 'syntra:users';
const SESSION_KEY = 'syntra:session';
const SALT_ROUNDS = 10;

// re-exported so screens can `import { validateEmail } from '../lib/services/authService'`
// if that's more convenient than reaching into utils/ directly
export { validateEmail, validateName, validatePassword };

// ---------- helpers ----------

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(password, storedHash);
}

async function getAllUsers(): Promise<StoredUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? (JSON.parse(raw) as StoredUser[]) : [];
}

async function saveAllUsers(users: StoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toPublicUser(u: StoredUser): User {
  const { passwordHash, ...publicUser } = u;
  return publicUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------- core API ----------

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email);

  const nameErr = validateName(input.name);
  const emailErr = validateEmail(email);
  const passErr = validatePassword(input.password);
  if (nameErr) return { success: false, error: nameErr };
  if (emailErr) return { success: false, error: emailErr };
  if (passErr) return { success: false, error: passErr };

  const users = await getAllUsers();
  if (users.some((u) => u.email === email)) {
    return { success: false, error: 'An account with this email already exists' };
  }

  const newUser: StoredUser = {
    id: Crypto.randomUUID(),
    name: input.name.trim(),
    email,
    createdAt: new Date().toISOString(),
    passwordHash: await hashPassword(input.password),
  };

  await saveAllUsers([...users, newUser]);
  await AsyncStorage.setItem(SESSION_KEY, newUser.id);

  return { success: true, user: toPublicUser(newUser) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) {
    return { success: false, error: 'Enter your email and password' };
  }

  const users = await getAllUsers();
  const found = users.find((u) => u.email === email);
  if (!found) {
    return { success: false, error: 'No account found with this email' };
  }

  const isValid = await verifyPassword(input.password, found.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Incorrect password' };
  }

  await AsyncStorage.setItem(SESSION_KEY, found.id);
  return { success: true, user: toPublicUser(found) };
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const sessionId = await AsyncStorage.getItem(SESSION_KEY);
  if (!sessionId) return null;

  const users = await getAllUsers();
  const found = users.find((u) => u.id === sessionId);
  return found ? toPublicUser(found) : null;
}