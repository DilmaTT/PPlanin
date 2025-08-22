import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useStorage } from '@/hooks/useStorage';
import { Session, Period } from '@/types';
import { getCurrentTime } from '@/lib/tauriApi';

type PeriodType = 'play' | 'select';

interface SessionContextType {
  activeSession: boolean;
  elapsedTime: number;
  currentPeriodType: PeriodType;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  togglePeriod: (newType: PeriodType) => Promise<void>;
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
  };

  const stopSession = async () => {
    if (!sessionStartTime || !currentPeriodStartTime) return;

    console.log('Шаг 2: Вызов stopSession в контексте');
    const endTime = await getCurrentTime();

    const finalPeriods: Period[] = [
      ...periods,
      {
        type: currentPeriodType,
        startTime: currentPeriodStartTime,
        endTime: endTime,
      },
    ];
    
    console.log('Шаг 3: Финальные периоды перед сохранением:', finalPeriods);

    const newSession: Omit<Session, 'id'> = {
      overallStartTime: sessionStartTime,
      overallEndTime: endTime,
      notes: '',
      handsPlayed: 0,
      periods: settings.splitPeriods ? finalPeriods : [],
    };

    console.log('Шаг 4: Новая сессия для сохранения:', newSession);
    addSession(newSession);

    setActiveSession(false);
    setSessionStartTime(null);
    setCurrentPeriodStartTime(null);
    setPeriods([]);
    setElapsedTime(0);
    console.log('Шаг 5: Состояние сброшено');
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

  const value = {
    activeSession,
    elapsedTime,
    currentPeriodType,
    startSession,
    stopSession,
    togglePeriod,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
