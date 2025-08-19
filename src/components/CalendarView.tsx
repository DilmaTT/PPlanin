import { useMemo } from 'react';
import Calendar from 'react-calendar';
import { useStorage } from '@/hooks/useStorage';
import { differenceInSeconds } from 'date-fns';
import '@/styles/calendar.css';

// Helper to format duration from seconds to H:M format
const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const CalendarView = () => {
  const { sessions } = useStorage();

  // Memoize the calculation of session data per day
  const sessionDays = useMemo(() => {
    const days = new Map<string, { count: number; totalDuration: number }>();

    sessions.forEach(session => {
      const date = new Date(session.overallStartTime).toISOString().split('T')[0];
      const duration = differenceInSeconds(
        new Date(session.overallEndTime),
        new Date(session.overallStartTime)
      );

      const existing = days.get(date) || { count: 0, totalDuration: 0 };
      days.set(date, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + duration,
      });
    });

    return days;
  }, [sessions]);

  // Function to render custom content on each calendar tile
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateString = date.toISOString().split('T')[0];
      const dayData = sessionDays.get(dateString);

      if (dayData) {
        return (
          <div className="flex flex-col items-center justify-center mt-1">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-xs text-muted-foreground mt-1">
              {formatDuration(dayData.totalDuration)}
            </span>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="w-full flex justify-center p-4">
      <div className="w-full max-w-2xl">
        <Calendar
          tileContent={tileContent}
          className="w-full border-none"
        />
      </div>
    </div>
  );
};

export default CalendarView;
