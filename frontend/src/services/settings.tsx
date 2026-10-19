import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { API_URL } from '../constants/config';

export type AppSettings = {
  welcomeSound: boolean;
  notifications: boolean;
  apiUrl: string;
};

const STORAGE_KEY = 'gg.settings';

const DEFAULTS: AppSettings = {
  welcomeSound: true,
  notifications: true,
  apiUrl: API_URL,
};

// Readable outside React (e.g. by analysis.ts)
let current: AppSettings = DEFAULTS;
export const getSettings = () => current;

type SettingsContextValue = {
  settings: AppSettings;
  loaded: boolean;
  updateSettings: (changes: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  loaded: false,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          const merged = { ...DEFAULTS, ...JSON.parse(raw) };
          current = merged;
          setSettings(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const updateSettings = (changes: Partial<AppSettings>) => {
    const next = { ...settings, ...changes };
    current = next;
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  return (
    <SettingsContext.Provider value={{ settings, loaded, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);