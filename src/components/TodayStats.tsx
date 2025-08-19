import { useMemo } from 'react';
import { useSession } from '@/context/SessionContext';
import { useStorage } from '@/hooks/useStorage';
import { format, startOfDay, differenceInMilliseconds } from 'date-fns'; // Добавлен differenceInMilliseconds

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h} ч ${m} мин`;
  }
  return `${m} мин`;
};

const TodayStats = () => {
  const { activeSession, elapsedTime } = useSession();
  const { sessions, getPlanForDate } = useStorage();

  // Получаем начало текущего дня в локальном времени
  const today = useMemo(() => startOfDay(new Date()), []);
  // Форматируем текущий день в строку YYYY-MM-DD в локальном времени
  const todayString = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  const totalPlayedToday = useMemo(() => {
    const completedToday = sessions.filter(session => {
      // Преобразуем overallStartTime сессии (UTC) в объект Date, затем форматируем его в YYYY-MM-DD в локальном времени
      const sessionDateLocalString = format(new Date(session.overallStartTime), 'yyyy-MM-dd');
      return sessionDateLocalString === todayString;
    }).reduce((sum, session) => {
      // Рассчитываем длительность сессии как разницу между временем окончания и начала
      const durationInSeconds = differenceInMilliseconds(
        new Date(session.overallEndTime),
        new Date(session.overallStartTime)
      ) / 1000;
      return sum + durationInSeconds;
    }, 0);

    return completedToday + (activeSession ? elapsedTime : 0);
  }, [sessions, activeSession, elapsedTime, todayString]);

  const dailyPlan = useMemo(() => {
    // getPlanForDate уже использует startOfDay и форматирует в 'yyyy-MM-dd'
    const plan = getPlanForDate(today);
    return plan ? plan.hours : 0;
  }, [getPlanForDate, today]);

  return (
    <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm w-full max-w-md mx-auto mt-4 text-center">
      <h3 className="text-lg font-semibold mb-2">Статистика за сегодня</h3>
      <p className="text-xl">
        Сыграно сегодня: <b>{formatDuration(totalPlayedToday)}</b> / План: <b>{dailyPlan} ч</b>
      </p>
    </div>
  );
};

export default TodayStats;
