import { useSyncExternalStore, useCallback } from 'react';
import type { Session, Settings, Plan } from '@/types';
import { addDays, startOfDay, format } from 'date-fns';

const SESSIONS_STORAGE_KEY = 'poker-tracker-sessions';
const SETTINGS_STORAGE_KEY = 'poker-tracker-settings';

const defaultSettings: Settings = {
  theme: 'dark',
  splitPeriods: true,
  showNotes: true,
  showHandsPlayed: true,
  allowManualEditing: false,
  showLiveClock: true,
  showTodayStats: true,
  goals: { hours: 0, hands: 0, sessions: 0 },
  listViewOptions: {
    showMonth: true,
    showDayOfWeek: false,
    showYear: false,
    dateRangeMode: 'month',
    customStartDate: null,
    customEndDate: null,
    sortOrder: 'desc',
    showStartTime: true,
    showEndTime: true,
    showSessionCount: true,
    showDuration: true,
    showHandsPerHour: true,
    showDailyPlan: false,
    showDailyPlanRemaining: false,
    showTotalPlayTime: true,
    showTotalPlanRemaining: false,
    showDailyPlanHands: false,
    showTotalsRow: false,
  },
  plans: {},
  offDays: {},
};

// --- Vanilla JS Store for cross-component state synchronization ---

let store: {
  sessions: Session[];
  settings: Settings;
};

const listeners: Set<() => void> = new Set();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emitChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

const safelyParseJSON = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.error(`Error reading or parsing localStorage key “${key}”:`, error);
    return fallback;
  }
};

// Initial data load
const initialLoad = () => {
  const sessions = safelyParseJSON<Session[]>(SESSIONS_STORAGE_KEY, []);
  const storedSettings = safelyParseJSON<Partial<Settings>>(SETTINGS_STORAGE_KEY, {});
  const settings = {
    ...defaultSettings,
    ...storedSettings,
    goals: { ...defaultSettings.goals, ...(storedSettings.goals || {}) },
    listViewOptions: { ...defaultSettings.listViewOptions, ...(storedSettings.listViewOptions || {}) },
    plans: { ...defaultSettings.plans, ...(storedSettings.plans || {}) },
    offDays: { ...defaultSettings.offDays, ...(storedSettings.offDays || {}) },
  };
  store = { sessions, settings };
};
initialLoad();


const storageStore = {
  getSnapshot: () => store,

  addSession: (newSession: Omit<Session, 'id'>) => {
    const sessionWithId: Session = { ...newSession, id: crypto.randomUUID() };
    const newSessions = [...store.sessions, sessionWithId];
    store = { ...store, sessions: newSessions };
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(newSessions));
    emitChange();
    return sessionWithId;
  },

  updateSession: (sessionId: string, updatedData: Partial<Session>) => {
    const newSessions = store.sessions.map(session =>
      session.id === sessionId ? { ...session, ...updatedData } : session
    );
    store = { ...store, sessions: newSessions };
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(newSessions));
    emitChange();
  },

  updateSettings: (newSettings: Partial<Settings>) => {
    const currentSettings = store.settings;
    const updated = { ...currentSettings, ...newSettings };
    if (newSettings.goals) {
      updated.goals = { ...(currentSettings.goals), ...newSettings.goals };
    }
    if (newSettings.listViewOptions) {
      updated.listViewOptions = { ...(currentSettings.listViewOptions), ...newSettings.listViewOptions };
    }
    store = { ...store, settings: updated };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    emitChange();
  },

  importSessions: (newSessions: Session[]) => {
    const existingIds = new Set(store.sessions.map(s => s.id));
    const uniqueNewSessions = newSessions.filter(s => !existingIds.has(s.id));
    const combined = [...store.sessions, ...uniqueNewSessions];
    combined.sort((a, b) => new Date(a.overallStartTime).getTime() - new Date(b.overallStartTime).getTime());
    store = { ...store, sessions: combined };
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(combined));
    emitChange();
  },

  resetAllData: () => {
    store = { sessions: [], settings: defaultSettings };
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify([]));
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
    emitChange();
  },
};

type WeeklySchedule = {
  [day: number]: { hours: number; hands: number; isOff: boolean; };
};

export const useStorage = () => {
  const { sessions, settings } = useSyncExternalStore(subscribe, storageStore.getSnapshot);

  const getPlanForDate = useCallback((date: Date): Plan | undefined => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd');
    return settings.plans?.[dateString];
  }, [settings.plans]);

  const setPlanForDate = useCallback((date: Date, planData: Plan) => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd');
    const isPlanEmpty = !planData || (planData.hours <= 0 && planData.hands <= 0);
    const newPlans = { ...(settings.plans || {}) };
    if (isPlanEmpty) {
      delete newPlans[dateString];
    } else {
      newPlans[dateString] = planData;
    }
    storageStore.updateSettings({ plans: newPlans });
  }, [settings.plans]);

  const isOffDay = useCallback((date: Date): boolean => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd');
    return !!settings.offDays?.[dateString];
  }, [settings.offDays]);

  const setOffDay = useCallback((date: Date, isOff: boolean) => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd');
    const newOffDays = { ...(settings.offDays || {}) };
    if (isOff) {
      newOffDays[dateString] = true;
    } else {
      delete newOffDays[dateString];
    }
    storageStore.updateSettings({ offDays: newOffDays });
  }, [settings.offDays]);

  const applyWeeklySchedule = useCallback((startDate: Date, endDate: Date, weeklySchedule: WeeklySchedule) => {
    let currentDate = startOfDay(startDate);
    const end = startOfDay(endDate);
    const updatedPlans = { ...(settings.plans || {}) };
    const updatedOffDays = { ...(settings.offDays || {}) };

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      const scheduleForDay = weeklySchedule[dayOfWeek];
      const dateString = format(startOfDay(currentDate), 'yyyy-MM-dd');

      if (scheduleForDay) {
        if (scheduleForDay.isOff) {
          updatedOffDays[dateString] = true;
          delete updatedPlans[dateString];
        } else {
          delete updatedOffDays[dateString];
          updatedPlans[dateString] = {
            hours: scheduleForDay.hours,
            hands: scheduleForDay.hands,
          };
        }
      }
      currentDate = addDays(currentDate, 1);
    }
    storageStore.updateSettings({ plans: updatedPlans, offDays: updatedOffDays });
  }, [settings.plans, settings.offDays]);

  return {
    sessions,
    settings,
    addSession: storageStore.addSession,
    updateSession: storageStore.updateSession,
    updateSettings: storageStore.updateSettings,
    importSessions: storageStore.importSessions,
    resetAllData: storageStore.resetAllData,
    getPlanForDate,
    setPlanForDate,
    isOffDay,
    setOffDay,
    applyWeeklySchedule,
  };
};
