import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Session, Settings, Plan } from '@/types';
import { addDays, startOfDay, format } from 'date-fns'; // Добавлен format

const SESSIONS_STORAGE_KEY = 'poker-tracker-sessions';
const SETTINGS_STORAGE_KEY = 'poker-tracker-settings';

const defaultSettings: Settings = {
  theme: 'dark',
  splitPeriods: true,
  showNotes: true,
  showHandsPlayed: true,
  allowManualEditing: false,
  showLiveClock: true, // New setting
  showTodayStats: true, // New setting
  goals: {
    hours: 0,
    hands: 0,
    sessions: 0,
  },
  listViewOptions: {
    // Формат даты
    showMonth: true,
    showDayOfWeek: false,
    showYear: false,
    // Фильтр по датам
    dateRangeMode: 'month', // 'all', 'week', 'custom'
    customStartDate: null,
    customEndDate: null,
    // Сортировка
    sortOrder: 'desc', // 'asc', 'desc'
    // Столбцы
    showStartTime: true,
    showEndTime: true,
    showSessionCount: true,
    showDuration: true,
    showHandsPerHour: true,
    showDailyPlan: false,
    showDailyPlanRemaining: false,
    showTotalPlayTime: true,
    showTotalPlanRemaining: false,
    showDailyPlanHands: false, // New setting
    // Итоги
    showTotalsRow: false,
  },
  plans: {},
  offDays: {},
};

// Generic hook to manage a value in localStorage
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);


  return [storedValue, setStoredValue] as const;
}

export const useStorage = () => {
  const [sessions, setSessions] = useLocalStorage<Session[]>(SESSIONS_STORAGE_KEY, []);
  const [storedSettings, setStoredSettings] = useLocalStorage<Partial<Settings>>(SETTINGS_STORAGE_KEY, defaultSettings);

  const settings: Settings = useMemo(() => ({
    ...defaultSettings,
    ...storedSettings,
    goals: {
      ...defaultSettings.goals,
      ...(storedSettings.goals || {}),
    },
    listViewOptions: {
      ...defaultSettings.listViewOptions,
      ...(storedSettings.listViewOptions || {}),
    },
    plans: {
      ...defaultSettings.plans,
      ...(storedSettings.plans || {}),
    },
    offDays: {
      ...defaultSettings.offDays,
      ...(storedSettings.offDays || {}),
    },
  }), [storedSettings]);

  const addSession = useCallback((newSession: Omit<Session, 'id'>) => {
    console.log('Шаг 4: Функция addSession в хранилище вызвана с полными данными');
    const sessionWithId: Session = {
      ...newSession,
      id: newSession.overallStartTime, // Using start time as a unique ID
    };
    setSessions((prevSessions) => [...prevSessions, sessionWithId]);
    return sessionWithId;
  }, [setSessions]);

  const updateSession = useCallback((sessionId: string, updatedData: Partial<Session>) => {
    console.log('Шаг 4: Функция updateSession в хранилище вызвана');
    setSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === sessionId ? { ...session, ...updatedData } : session
      )
    );
  }, [setSessions]);

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setStoredSettings((prevSettings) => {
      // The initial spread handles replacing entire objects like `plans` and `offDays` correctly.
      const updated = { ...prevSettings, ...newSettings };

      // Deep merge is only needed for objects that receive partial updates, like `goals`.
      if (newSettings.goals) {
        updated.goals = {
          ...(prevSettings.goals || defaultSettings.goals),
          ...newSettings.goals,
        };
      }

      if (newSettings.listViewOptions) {
        updated.listViewOptions = {
          ...(prevSettings.listViewOptions || defaultSettings.listViewOptions),
          ...newSettings.listViewOptions,
        };
      }

      // The previous implementation had a bug here: it was re-merging `plans` and `offDays`
      // with the old state, which prevented deletions. By removing those blocks,
      // we trust that the calling function provides the complete new object for `plans` and `offDays`.
      return updated;
    });
  }, [setStoredSettings]);

  const importSessions = useCallback((newSessions: Session[]) => {
    setSessions(prevSessions => {
      const existingIds = new Set(prevSessions.map(s => s.id));
      const uniqueNewSessions = newSessions.filter(s => !existingIds.has(s.id));
      const combined = [...prevSessions, ...uniqueNewSessions];
      combined.sort((a, b) => new Date(a.overallStartTime).getTime() - new Date(b.overallStartTime).getTime());
      return combined;
    });
  }, [setSessions]);

  const resetAllData = useCallback(() => {
    setSessions([]);
    setStoredSettings(defaultSettings);
  }, [setSessions, setStoredSettings]);

  const getPlanForDate = useCallback((date: Date): Plan | undefined => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd'); // Использование startOfDay для согласованности
    return settings.plans?.[dateString];
  }, [settings.plans]);

  const setPlanForDate = useCallback((date: Date, planData: Plan) => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd'); // Использование startOfDay для согласованности
    const isPlanEmpty = !planData || (planData.hours <= 0 && planData.hands <= 0);
    
    const newPlans = { ...(settings.plans || {}) };

    if (isPlanEmpty) {
      delete newPlans[dateString];
    } else {
      newPlans[dateString] = planData;
    }

    updateSettings({ plans: newPlans });
  }, [settings.plans, updateSettings]);

  const isOffDay = useCallback((date: Date): boolean => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd'); // Использование startOfDay для согласованности
    return !!settings.offDays?.[dateString];
  }, [settings.offDays]);

  const setOffDay = useCallback((date: Date, isOff: boolean) => {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd'); // Использование startOfDay для согласованности
    const newOffDays = { ...(settings.offDays || {}) };

    if (isOff) {
      newOffDays[dateString] = true;
    } else {
      delete newOffDays[dateString];
    }

    updateSettings({ offDays: newOffDays });
  }, [settings.offDays, updateSettings]);

  type WeeklySchedule = {
    [day: number]: { // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      hours: number;
      hands: number;
      isOff: boolean;
    };
  };

  const applyWeeklySchedule = useCallback((startDate: Date, endDate: Date, weeklySchedule: WeeklySchedule) => {
    console.log('useStorage: applyWeeklySchedule запущена');
    let currentDate = startOfDay(startDate);
    const end = startOfDay(endDate);

    // Create mutable copies of plans and offDays to update in the loop
    const updatedPlans = { ...(settings.plans || {}) };
    const updatedOffDays = { ...(settings.offDays || {}) };

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
      const scheduleForDay = weeklySchedule[dayOfWeek];
      const dateString = format(startOfDay(currentDate), 'yyyy-MM-dd');

      console.log('useStorage: Обрабатывается дата:', currentDate, 'План:', scheduleForDay);

      if (scheduleForDay) {
        if (scheduleForDay.isOff) {
          updatedOffDays[dateString] = true;
          delete updatedPlans[dateString]; // Clear any existing plan if it's an off day
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

    // Update settings once after the loop
    updateSettings({ plans: updatedPlans, offDays: updatedOffDays });
  }, [settings.plans, settings.offDays, updateSettings]);

  return {
    sessions,
    addSession,
    updateSession,
    settings,
    updateSettings,
    getPlanForDate,
    setPlanForDate,
    isOffDay,
    setOffDay,
    applyWeeklySchedule,
    importSessions,
    resetAllData,
  };
};
