import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { getSettings } from './settings';

export type NotificationType = 'analysis_complete' | 'analysis_failed' | 'progress' | 'announcement';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

const MAX_ITEMS = 50;
// Each account gets its own list
const keyFor = (email: string) => `gg.notifications:${email}`;

const welcome = (): AppNotification => ({
  id: 'welcome',
  type: 'announcement',
  title: 'Welcome to GaitGuard 👋',
  body: 'Record or upload a short movement video to get your first screening result.',
  createdAt: new Date().toISOString(),
  read: false,
});

type NotificationsContextValue = {
  items: AppNotification[];
  unreadCount: number;
  notify: (n: { type: NotificationType; title: string; body: string }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const email = user?.email ?? null;
  const welcomePending = !!user?.welcomePending;
  const emailRef = useRef<string | null>(email);
  const [items, setItems] = useState<AppNotification[]>([]);

  // Load the list of whoever is logged in (and clear it on logout)
  useEffect(() => {
    emailRef.current = email;
    if (!email) {
      setItems([]);
      return;
    }
    AsyncStorage.getItem(keyFor(email))
      .then(raw => {
        if (emailRef.current !== email) return; // user changed meanwhile
        const stored: AppNotification[] = raw ? JSON.parse(raw) : [];
        if (!welcomePending) {
          setItems(stored);
          return;
        }
        // Brand-new account: show the welcome once, then clear the flag
        const next = [welcome(), ...stored];
        setItems(next);
        AsyncStorage.setItem(keyFor(email), JSON.stringify(next))
          .then(() => updateProfile({ welcomePending: false }))
          .catch(() => {});
      })
      .catch(() => setItems([]));
  }, [email, welcomePending]);

  const persist = (next: AppNotification[]) => {
    if (emailRef.current) {
      AsyncStorage.setItem(keyFor(emailRef.current), JSON.stringify(next)).catch(() => {});
    }
  };

  const update = (fn: (prev: AppNotification[]) => AppNotification[]) =>
    setItems(prev => {
      const next = fn(prev);
      persist(next);
      return next;
    });

  const notify: NotificationsContextValue['notify'] = n => {
    if (!getSettings().notifications || !emailRef.current) return;
    const item: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    update(prev => [item, ...prev].slice(0, MAX_ITEMS));
  };

  const markRead = (id: string) => update(prev => prev.map(i => (i.id === id ? { ...i, read: true } : i)));
  const markAllRead = () => update(prev => prev.map(i => ({ ...i, read: true })));
  const remove = (id: string) => update(prev => prev.filter(i => i.id !== id));
  const clearAll = () => update(() => []);

  const unreadCount = items.filter(i => !i.read).length;

  return (
    <NotificationsContext.Provider value={{ items, unreadCount, notify, markRead, markAllRead, remove, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}