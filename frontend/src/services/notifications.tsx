import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
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

const STORAGE_KEY = 'gg.notifications';
const MAX_ITEMS = 50;

const WELCOME: AppNotification = {
  id: 'welcome',
  type: 'announcement',
  title: 'Welcome to GaitGuard 👋',
  body: 'Record or upload a short movement video to get your first screening result.',
  createdAt: new Date().toISOString(),
  read: false,
};

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
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => setItems(raw ? JSON.parse(raw) : [WELCOME]))
      .catch(() => setItems([WELCOME]));
  }, []);

  const save = (next: AppNotification[]) => {
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const notify: NotificationsContextValue['notify'] = n => {
    if (!getSettings().notifications) return; // user turned notifications off
    const item: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setItems(prev => {
      const next = [item, ...prev].slice(0, MAX_ITEMS);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const markRead = (id: string) => save(items.map(i => (i.id === id ? { ...i, read: true } : i)));
  const markAllRead = () => save(items.map(i => ({ ...i, read: true })));
  const remove = (id: string) => save(items.filter(i => i.id !== id));
  const clearAll = () => save([]);

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