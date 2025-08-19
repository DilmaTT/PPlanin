import { useState, useRef, useContext, ReactNode, createContext } from 'react';
import { useStorage } from '@/hooks/useStorage';
import type { Session, SessionPeriod } from '@/types';

type ActiveSession = Omit<Session, 'id' | 'overallEndTime' | 'overallDuration' | 'overallProfit' | 'overallHandsPlayed' | 'notes' | 'handsPlayed'>;

// Define a type for the data stored in localStorage
interface StoredActiveSession {
  id: string; // Client-side generated UUID for persistence
  overallStartTime: string;
  periods: SessionPeriod[];
}

interface SessionContextType {
  activeSession: ActiveSession | null;
  elapsedTime: number;
  currentPeriodType: 'play' | 'break' | 'select';
  startSession: () => void;
  stopSession: () => void;
  togglePeriod: (newType: 'play' | 'break' | 'select') => void;
  completedSession: Omit<Session, 'id' | 'notes' | 'handsPlayed'> | null; // Изменено: теперь содержит данные без ID, заметок и рук
  clearCompletedSession: () => void;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const { addSession } = useStorage(); // addSession все еще нужен для модального окна
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentPeriodType, setCurrentPeriodType] = useState<'play' | 'break' | 'select'>('play');
  const [completedSession, setCompletedSession] = useState<Omit<Session, 'id' | 'notes' | 'handsPlayed'> | null>(null); // Изменено: теперь содержит данные без ID, заметок и рук

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    intervalRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  };

  // Effect to load session from localStorage on mount
  // Using a simple useState initializer for initial load, not for continuous updates
  useState(() => {
    const storedSessionString = localStorage.getItem('activeSession');
    if (storedSessionString) {
      try {
        const storedSession: StoredActiveSession = JSON.parse(storedSessionString);
        
        // Restore activeSession state
        setActiveSession({
          overallStartTime: storedSession.overallStartTime,
          periods: storedSession.periods || [], // Ensure periods is an array
        });

        // Calculate elapsed time from stored start time to now
        const sessionStartTime = new Date(storedSession.overallStartTime).getTime();
        const currentTimestamp = Date.now();
        const calculatedElapsedTime = Math.floor((currentTimestamp - sessionStartTime) / 1000);
        setElapsedTime(calculatedElapsedTime);

        // Set current period type based on the last period in the stored session
        const lastPeriod = storedSession.periods && storedSession.periods.length > 0
          ? storedSession.periods[storedSession.periods.length - 1]
          : null;
        if (lastPeriod) {
          setCurrentPeriodType(lastPeriod.type);
        } else {
          setCurrentPeriodType('play'); // Default if periods array is empty (shouldn't happen)
        }

        // Restart the timer
        startTimer();
        console.log('Active session restored from localStorage.');
      } catch (error) {
        console.error('Failed to parse active session from localStorage:', error);
        localStorage.removeItem('activeSession'); // Clear corrupted data
      }
    }

    return () => stopTimer(); // Cleanup on unmount
  }); // Empty dependency array ensures this runs only once on mount

  const startSession = () => {
    const now = new Date().toISOString();
    const initialPeriods: SessionPeriod[] = [{ type: 'play', startTime: now, endTime: '' }];

    setActiveSession({
      overallStartTime: now,
      periods: initialPeriods,
    });
    setCurrentPeriodType('play');
    setElapsedTime(0);
    setCompletedSession(null); // Clear any previous completed session
    startTimer();

    // Save active session data to localStorage
    const tempId = crypto.randomUUID(); // Generate a client-side UUID for persistence
    const sessionToStore: StoredActiveSession = {
      id: tempId,
      overallStartTime: now,
      periods: initialPeriods,
    };
    localStorage.setItem('activeSession', JSON.stringify(sessionToStore));
    console.log('Active session started and saved to localStorage.');
  };

  const stopSession = () => {
    console.log('Шаг 2: Функция stopSession в контексте вызвана');
    stopTimer();
    if (!activeSession) return;

    const now = new Date().toISOString();
    const finalizedPeriods = activeSession.periods
      ? activeSession.periods.map((p, index) =>
          index === (activeSession.periods?.length ?? 0) - 1 ? { ...p, endTime: now } : p
        )
      : [];

    const overallStartTimeDate = new Date(activeSession.overallStartTime);
    const overallEndTimeDate = new Date(now);
    const overallDuration = Math.floor((overallEndTimeDate.getTime() - overallStartTimeDate.getTime()) / 1000);

    const sessionData: Omit<Session, 'id' | 'notes' | 'handsPlayed'> = {
      ...activeSession,
      overallEndTime: now,
      overallDuration: overallDuration,
      overallProfit: 0,
      overallHandsPlayed: 0,
      periods: finalizedPeriods,
    };

    // Убеждаемся, что здесь нет вызовов addSession или updateSession
    setCompletedSession(sessionData); // Устанавливаем данные сессии без ID, заметок и рук
    setActiveSession(null); // Reset active session state

    // Remove active session data from localStorage
    localStorage.removeItem('activeSession');
    console.log('Active session stopped and removed from localStorage.');
  };

  const togglePeriod = (newType: 'play' | 'break' | 'select') => {
    if (!activeSession || currentPeriodType === newType) return;

    const now = new Date().toISOString();
    const updatedPeriods = activeSession.periods
      ? activeSession.periods.map((p, index) =>
          index === (activeSession.periods?.length ?? 0) - 1 ? { ...p, endTime: now } : p
        )
      : [];

    const newPeriod: SessionPeriod = { type: newType, startTime: now, endTime: '' };

    const newActiveSession = {
      ...activeSession,
      periods: [...updatedPeriods, newPeriod],
    };
    setActiveSession(newActiveSession);
    setCurrentPeriodType(newType);

    // Update localStorage with the new periods
    const storedSessionString = localStorage.getItem('activeSession');
    if (storedSessionString) {
      try {
        const storedSession: StoredActiveSession = JSON.parse(storedSessionString);
        localStorage.setItem('activeSession', JSON.stringify({
          ...storedSession,
          periods: newActiveSession.periods || [], // Ensure periods is an array
        }));
      } catch (error) {
        console.error('Failed to update active session periods in localStorage:', error);
      }
    }
  };

  const clearCompletedSession = () => {
    setCompletedSession(null);
  };

  const contextValue = {
    activeSession,
    elapsedTime,
    currentPeriodType,
    startSession,
    stopSession,
    togglePeriod,
    completedSession,
    clearCompletedSession,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
