import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useStorage } from '@/hooks/useStorage';
import { Session, Period } from '@/types';
import { getCurrentTime } from '@/lib/tauriApi';
import { differenceInMilliseconds } from 'date-fns';

type PeriodType = 'play' | 'select';

interface SessionContextType {
  activeSession: boolean;
  elapsedTime: number;
  currentPeriodType: PeriodType;
  completedSession: Session | null;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  togglePeriod: (newType: PeriodType) => Promise<void>;
  clearCompletedSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const { addSession, settings } = useStorage();
  const [activeSession, setActiveSession] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentPeriodType, setCurrentPeriodType] = useState<PeriodType>('play');
  const [completedSession, setCompletedSession] = useState<Session | null>(null);

  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [currentPeriodStartTime, setCurrentPeriodStartTime] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (activeSession) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const startSession = async () => {
    const startTime = await getCurrentTime();
    setSessionStartTime(startTime);
    setActiveSession(true);
    setElapsedTime(0);
    
    const initialType = settings.splitPeriods ? 'select' : 'play';
    setCurrentPeriodType(initialType);
    setCurrentPeriodStartTime(startTime);
    setPeriods([]);
    setCompletedSession(null);
  };

  const stopSession = async () => {
    if (!sessionStartTime || !currentPeriodStartTime) return;

    const endTime = await getCurrentTime();

    const finalPeriods: Period[] = [
      ...periods,
      {
        type: currentPeriodType,
        startTime: currentPeriodStartTime,
        endTime: endTime,
      },
    ];
    
    const newSession: Omit<Session, 'id'> = {
      overallStartTime: sessionStartTime,
      overallEndTime: endTime,
      overallDuration: differenceInMilliseconds(new Date(endTime), new Date(sessionStartTime)),
      overallProfit: 0, // Default value, can be edited in PostSessionModal
      overallHandsPlayed: 0, // Default value, can be edited in PostSessionModal
      notes: '',
      handsPlayed: 0, // This will be updated in PostSessionModal
      periods: settings.splitPeriods ? finalPeriods : [],
    };

    const savedSession = addSession(newSession);
    setCompletedSession(savedSession);

    setActiveSession(false);
    setSessionStartTime(null);
    setCurrentPeriodStartTime(null);
    setPeriods([]);
    setElapsedTime(0);
  };

  const togglePeriod = async (newType: PeriodType) => {
    if (!settings.splitPeriods || newType === currentPeriodType || !currentPeriodStartTime) return;

    const toggleTime = await getCurrentTime();

    const newPeriod: Period = {
      type: currentPeriodType,
      startTime: currentPeriodStartTime,
      endTime: toggleTime,
    };

    setPeriods(prev => [...prev, newPeriod]);
    setCurrentPeriodType(newType);
    setCurrentPeriodStartTime(toggleTime);
  };

  const clearCompletedSession = () => {
    setCompletedSession(null);
  };

  const value = {
    activeSession,
    elapsedTime,
    currentPeriodType,
    completedSession,
    startSession,
    stopSession,
    togglePeriod,
    clearCompletedSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
