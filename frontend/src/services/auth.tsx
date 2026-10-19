import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export type FitnessLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type UserProfile = {
  name: string;
  email: string;
  phone?: string;
  photoUri?: string;
  age?: string;
  heightCm?: string;
  weightKg?: string;
  fitnessLevel?: FitnessLevel;
  sport?: string;
  goals?: string;
  createdAt: string;
};

type StoredUser = UserProfile & { passwordHash: string };
type Result = { ok: true } | { ok: false; error: string };

const USERS_KEY = 'gg.users';
const SESSION_KEY = 'gg.session';

const hashPassword = (password: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
// Keep only digits, last 10 (drops +91 / leading 0)
export const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10);

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users: StoredUser[]) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toProfile(user: StoredUser): UserProfile {
  const { passwordHash, ...profile } = user;
  return profile;
}

// Finds a user by email OR phone number
function findUser(users: StoredUser[], identifier: string) {
  const id = identifier.trim();
  if (id.includes('@')) return users.find(u => u.email === normalizeEmail(id));
  const phone = normalizePhone(id);
  return phone ? users.find(u => u.phone === phone) : undefined;
}

type RegisterInput = { name: string; email: string; phone?: string; password: string };

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  register: (input: RegisterInput) => Promise<Result>;
  login: (identifier: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  updateProfile: (changes: Partial<Omit<UserProfile, 'email' | 'createdAt'>>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const email = await AsyncStorage.getItem(SESSION_KEY);
        if (email) {
          const found = (await readUsers()).find(u => u.email === email);
          if (found) setUser(toProfile(found));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const register = async ({ name, email, phone, password }: RegisterInput): Promise<Result> => {
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = phone ? normalizePhone(phone) : '';
    const users = await readUsers();

    if (users.some(u => u.email === cleanEmail)) {
      return { ok: false, error: 'An account with this email already exists.' };
    }
    if (cleanPhone && users.some(u => u.phone === cleanPhone)) {
      return { ok: false, error: 'An account with this mobile number already exists.' };
    }

    const newUser: StoredUser = {
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone || undefined,
      createdAt: new Date().toISOString(),
      passwordHash: await hashPassword(password),
    };
    await writeUsers([...users, newUser]);
    await AsyncStorage.setItem(SESSION_KEY, cleanEmail);
    setUser(toProfile(newUser));
    return { ok: true };
  };

  const login = async (identifier: string, password: string): Promise<Result> => {
    const found = findUser(await readUsers(), identifier);
    if (!found || found.passwordHash !== (await hashPassword(password))) {
      return { ok: false, error: 'Incorrect email/mobile number or password.' };
    }
    await AsyncStorage.setItem(SESSION_KEY, found.email);
    setUser(toProfile(found));
    return { ok: true };
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const updateProfile = async (changes: Partial<Omit<UserProfile, 'email' | 'createdAt'>>) => {
    if (!user) return;
    const users = await readUsers();
    const updated = users.map(u => (u.email === user.email ? { ...u, ...changes } : u));
    await writeUsers(updated);
    setUser({ ...user, ...changes });
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}