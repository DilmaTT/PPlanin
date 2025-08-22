import { useState, useRef, useContext, ReactNode, createContext } from 'react';
    import { useStorage } from '@/hooks/useStorage';
    import type { Session, SessionPeriod } from '@/types';

    let invoke: (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | undefined;

    if (window.__TAURI__) {
      // Use string concatenation to prevent Vite's static import analysis
      // from resolving "@tauri-apps/api/tauri" when not in a Tauri environment.
      const tauriApiBase = '@tauri-apps/api';
      const tauriModule = tauriApiBase + '/tauri';
      
      import(/* @vite-ignore */ tauriModule).then((module) => {
        invoke = module.invoke;
      }).catch((error) => {
        console.error('Failed to load Tauri API module:', error);
        // Fallback or handle error if Tauri API is expected but not found
      });
    }

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
      startSession: () => Promise<void>;
      stopSession: () => Promise<void>;
      togglePeriod: (newType: 'play' | 'break' | 'select') => Promise<void>;
      completedSession: Omit<Session, 'id' | 'notes' | 'handsPlayed'> | null;
      clearCompletedSession: () => void;
    }

    export const SessionContext = createContext<SessionContextType | undefined>(undefined);

    interface SessionProviderProps {
      children: ReactNode;
    }

    // Helper to get current time from Tauri or browser
    const getCurrentTime = async (): Promise<string> => {
      if (invoke) {
        try {
          const time = await invoke<string>('get_current_time_iso');
          return time;
        } catch (error) {
          console.error('Failed to get time from Tauri, falling back to browser time:', error);
          return new Date().toISOString();
        }
      }
      return new Date().toISOString();
    };

    export const SessionProvider = ({ children }: SessionProviderProps) => {
      useStorage();
      const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
      const [elapsedTime, setElapsedTime] = useState(0);
      const [currentPeriodType, setCurrentPeriodType] = useState<'play' | 'break' | 'select'>('play');
      const [completedSession, setCompletedSession] = useState<Omit<Session, 'id' | 'notes' | 'handsPlayed'> | null>(null);

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

      useState(() => {
        const storedSessionString = localStorage.getItem('activeSession');
        if (storedSessionString) {
          try {
            const storedSession: StoredActiveSession = JSON.parse(storedSessionString);
            
            setActiveSession({
              overallStartTime: storedSession.overallStartTime,
              periods: storedSession.periods || [],
            });

            const sessionStartTime = new Date(storedSession.overallStartTime).getTime();
            const currentTimestamp = Date.now();
            const calculatedElapsedTime = Math.floor((currentTimestamp - sessionStartTime) / 1000);
            setElapsedTime(calculatedElapsedTime);

            const lastPeriod = storedSession.periods && storedSession.periods.length > 0
              ? storedSession.periods[storedSession.periods.length - 1]
              : null;
            if (lastPeriod) {
              setCurrentPeriodType(lastPeriod.type);
            } else {
              setCurrentPeriodType('play');
            }

            startTimer();
            console.log('Active session restored from localStorage.');
          } catch (error) {
            console.error('Failed to parse active session from localStorage:', error);
            localStorage.removeItem('activeSession');
          }
        }

        return () => stopTimer();
      });

      const startSession = async () => {
        const now = await getCurrentTime();
        const initialPeriods: SessionPeriod[] = [{ type: 'play', startTime: now, endTime: '' }];

        setActiveSession({
          overallStartTime: now,
          periods: initialPeriods,
        });
        setCurrentPeriodType('play');
        setElapsedTime(0);
        setCompletedSession(null);
        startTimer();

        const tempId = crypto.randomUUID();
        const sessionToStore: StoredActiveSession = {
          id: tempId,
          overallStartTime: now,
          periods: initialPeriods,
        };
        localStorage.setItem('activeSession', JSON.stringify(sessionToStore));
        console.log('Active session started and saved to localStorage.');
      };

      const stopSession = async () => {
        console.log('Шаг 2: Функция stopSession в контексте вызвана');
        stopTimer();
        if (!activeSession) return;

        const now = await getCurrentTime();
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

        setCompletedSession(sessionData);
        setActiveSession(null);

        localStorage.removeItem('activeSession');
        console.log('Active session stopped and removed from localStorage.');
      };

      const togglePeriod = async (newType: 'play' | 'break' | 'select') => {
        if (!activeSession || currentPeriodType === newType) return;

        const now = await getCurrentTime();
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

        const storedSessionString = localStorage.getItem('activeSession');
        if (storedSessionString) {
          try {
            const storedSession: StoredActiveSession = JSON.parse(storedSessionString);
            localStorage.setItem('activeSession', JSON.stringify({
              ...storedSession,
              periods: newActiveSession.periods || [],
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
