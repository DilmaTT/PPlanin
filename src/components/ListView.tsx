import { useMemo } from 'react';
import { useStorage } from '@/hooks/useStorage';
import { 
  format, 
  differenceInSeconds, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  startOfDay, 
  endOfDay,
  eachDayOfInterval,
  isSameDay,
  min,
  max
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatSeconds, cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, PlusCircle } from 'lucide-react';
import { Session } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SessionDetails = ({ 
  sessions, 
  showHandsPlayed,
  allowManualEditing,
  updateSession,
}: { 
  sessions: Session[], 
  showHandsPlayed: boolean,
  allowManualEditing: boolean,
  updateSession: (sessionId: string, updatedData: Partial<Session>) => void,
}) => (
  <div className="p-4 bg-muted/50">
    <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Детализация сессий</h4>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-10">Начало</TableHead>
          <TableHead className="h-10">Конец</TableHead>
          <TableHead className="h-10 text-right">Длительность</TableHead>
          {showHandsPlayed && <TableHead className="h-10 text-right">Руки</TableHead>}
          <TableHead className="h-10">Заметки</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map(session => {
          const start = new Date(session.overallStartTime);
          const end = new Date(session.overallEndTime);
          const duration = Math.max(0, differenceInSeconds(end, start));

          const handleTimeChange = (field: 'overallStartTime' | 'overallEndTime', value: string) => {
            const originalDate = new Date(session[field]);
            const [hours, minutes, seconds] = value.split(':').map(Number);
            
            if (!isNaN(hours) && !isNaN(minutes)) {
              const newDate = new Date(originalDate);
              newDate.setHours(hours, minutes, seconds || 0);
              updateSession(session.id, { [field]: newDate.toISOString() });
            }
          };

          return (
            <TableRow key={session.id} className="hover:bg-muted/80">
              <TableCell className="py-2">
                {allowManualEditing ? (
                  <Input
                    type="time"
                    step="1"
                    className="h-8 w-28"
                    defaultValue={format(start, 'HH:mm:ss')}
                    onBlur={(e) => handleTimeChange('overallStartTime', e.target.value)}
                  />
                ) : (
                  format(start, 'HH:mm:ss')
                )}
              </TableCell>
              <TableCell className="py-2">
                {allowManualEditing ? (
                  <Input
                    type="time"
                    step="1"
                    className="h-8 w-28"
                    defaultValue={format(end, 'HH:mm:ss')}
                    onBlur={(e) => handleTimeChange('overallEndTime', e.target.value)}
                  />
                ) : (
                  format(end, 'HH:mm:ss')
                )}
              </TableCell>
              <TableCell className="py-2 text-right tabular-nums">{formatSeconds(duration)}</TableCell>
              {showHandsPlayed && (
                <TableCell className="py-2 text-right tabular-nums">
                  {allowManualEditing ? (
                    <Input
                      type="number"
                      className="h-8 w-24 text-right ml-auto"
                      defaultValue={session.handsPlayed}
                      onBlur={(e) => updateSession(session.id, { handsPlayed: Number(e.target.value) || 0 })}
                    />
                  ) : (
                    session.handsPlayed
                  )}
                </TableCell>
              )}
              <TableCell className="py-2 text-sm text-muted-foreground">
                {allowManualEditing ? (
                  <Input
                    type="text"
                    className="h-8"
                    defaultValue={session.notes || ''}
                    onBlur={(e) => updateSession(session.id, { notes: e.target.value })}
                  />
                ) : (
                  session.notes || '–'
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

const ListView = () => {
  const { sessions, settings, updateSession, getPlanForDate, isOffDay } = useStorage();
  const { listViewOptions } = settings;

  const dateInterval = useMemo(() => {
    const now = new Date();
    
    switch (listViewOptions.dateRangeMode) {
      case 'week':
        return { start: startOfWeek(now, { locale: ru, weekStartsOn: 1 }), end: endOfWeek(now, { locale: ru, weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom': {
        const { customStartDate, customEndDate } = listViewOptions;
        if (customStartDate && customEndDate) {
          return {
            start: startOfDay(new Date(customStartDate)),
            end: endOfDay(new Date(customEndDate)),
          };
        }
        return null;
      }
      case 'all': {
        if (sessions.length === 0) {
          return null;
        }
        const allDates = sessions.map(s => new Date(s.overallStartTime));
        return {
          start: startOfDay(min(allDates)),
          end: endOfDay(max(allDates)),
        };
      }
      default:
        return null;
    }
  }, [sessions, listViewOptions]);

  const processedDays = useMemo(() => {
    if (!dateInterval) {
      return [];
    }

    const days = eachDayOfInterval(dateInterval);

    if (listViewOptions.sortOrder === 'desc') {
      days.sort((a, b) => b.getTime() - a.getTime());
    } else {
      days.sort((a, b) => a.getTime() - b.getTime());
    }

    return days.map(day => {
      const sessionsForDay = sessions.filter(session => isSameDay(new Date(session.overallStartTime), day));

      const dayData = sessionsForDay.reduce((acc, session) => {
        const overallStart = new Date(session.overallStartTime);
        const overallEnd = new Date(session.overallEndTime);
        
        acc.totalDuration += Math.max(0, differenceInSeconds(overallEnd, overallStart));
        acc.handsPlayed += session.handsPlayed;

        session.periods?.forEach(period => { // Use optional chaining as `periods` might not exist on type
          const periodStart = new Date(period.startTime);
          const periodEnd = new Date(period.endTime);
          const duration = Math.max(0, differenceInSeconds(periodEnd, periodStart));
          if (period.type === 'play') {
            acc.playDuration += duration;
          } else {
            acc.selectDuration += duration;
          }
        });

        return acc;
      }, {
        totalDuration: 0,
        playDuration: 0,
        selectDuration: 0,
        handsPlayed: 0,
      });

      const totalDurationInHours = dayData.totalDuration / 3600; // Convert total duration to hours
      const playDurationInHours = dayData.playDuration / 3600;
      const handsPerHour = playDurationInHours > 0 ? Math.round(dayData.handsPlayed / playDurationInHours) : 0;

      const dateParts: string[] = [];
      dateParts.push(format(day, 'd', { locale: ru }));
      if (listViewOptions.showMonth) {
        dateParts.push(format(day, 'MMMM', { locale: ru }));
      }
      if (listViewOptions.showDayOfWeek) {
        dateParts.push(format(day, 'EEEE', { locale: ru }));
      }
      if (listViewOptions.showYear) {
        dateParts.push(format(day, 'yyyy', { locale: ru }));
      }
      const formattedDate = dateParts.join(' ');

      const planForDay = getPlanForDate(day);
      const dailyPlanHours = planForDay ? planForDay.hours : 0;
      const dailyPlanHands = planForDay ? planForDay.hands : 0; // Get planned hands
      
      // Calculate daily remaining hours: Plan (hours) - Total duration (hours)
      const calculatedDailyRemainingHours = dailyPlanHours - totalDurationInHours;
      const dailyRemainingHours = Math.max(0, calculatedDailyRemainingHours); // Display 0 if negative or zero
      
      const isDayOff = isOffDay(day);


      return {
        id: format(day, 'yyyy-MM-dd'),
        date: formattedDate,
        totalDuration: formatSeconds(dayData.totalDuration),
        rawTotalDuration: dayData.totalDuration,
        playDuration: formatSeconds(dayData.playDuration),
        rawPlayDuration: dayData.playDuration,
        selectDuration: formatSeconds(dayData.selectDuration),
        rawSelectDuration: dayData.selectDuration,
        handsPlayed: dayData.handsPlayed,
        handsPerHour,
        sessionCount: sessionsForDay.length,
        hasSessions: sessionsForDay.length > 0,
        hasMultipleSessions: sessionsForDay.length > 1,
        sessionsForDay,
        dailyPlanHours,
        dailyPlanHands, // Add to returned object
        dailyRemainingHours, // Updated calculation
        isOffDay: isDayOff,
      };
    });
  }, [dateInterval, sessions, listViewOptions, getPlanForDate, isOffDay]);

  const totals = useMemo(() => {
    if (!listViewOptions.showTotalsRow) {
      return null;
    }

    const result = processedDays.reduce((acc, day) => {
      if (day.hasSessions) {
        acc.totalDuration += day.rawTotalDuration;
        acc.playDuration += day.rawPlayDuration;
        acc.selectDuration += day.rawSelectDuration;
        acc.handsPlayed += day.handsPlayed;
        acc.sessionCount += day.sessionCount;
      }
      // Only sum planned hours and hands for days that are NOT off-days
      if (!day.isOffDay) {
        acc.totalPlannedHours += day.dailyPlanHours; 
        acc.totalPlannedHands += day.dailyPlanHands; // Sum planned hands
      }
      return acc;
    }, {
      totalDuration: 0,
      playDuration: 0,
      selectDuration: 0,
      handsPlayed: 0,
      sessionCount: 0,
      totalPlannedHours: 0,
      totalPlannedHands: 0, // New accumulator for total planned hands
    });

    const totalPlayDurationInHours = result.playDuration / 3600;
    const totalOverallDurationInHours = result.totalDuration / 3600; // Convert total overall duration to hours
    const averageHandsPerHour = totalPlayDurationInHours > 0 
      ? Math.round(result.handsPlayed / totalPlayDurationInHours) 
      : 0;
    
    // Calculate total remaining plan: Sum of all plans - Sum of total overall duration
    const calculatedTotalRemainingPlan = result.totalPlannedHours - totalOverallDurationInHours;
    const totalRemainingPlan = Math.max(0, calculatedTotalRemainingPlan); // Display 0 if negative or zero

    return {
      totalDuration: formatSeconds(result.totalDuration),
      playDuration: formatSeconds(result.playDuration),
      selectDuration: formatSeconds(result.selectDuration),
      handsPlayed: result.handsPlayed,
      sessionCount: result.sessionCount,
      averageHandsPerHour,
      totalPlannedHours: result.totalPlannedHours,
      totalPlannedHands: result.totalPlannedHands, // Add to totals object
      totalRemainingPlan, // Updated calculation
    };
  }, [processedDays, listViewOptions.showTotalsRow]);

  const colSpan = [
    listViewOptions.showSessionCount,
    listViewOptions.showDuration,
    listViewOptions.showTotalPlayTime,
    listViewOptions.showDailyPlan,
    listViewOptions.showDailyPlanRemaining,
    listViewOptions.showDailyPlanHands, // Add to colSpan calculation
    settings.showHandsPlayed,
    listViewOptions.showHandsPerHour,
  ].filter(Boolean).length + 2; // +2 for Date and Select Time

  // Calculate the number of columns that would be rendered if it's not an off-day,
  // to correctly span the "Выходной" cell.
  const dynamicColCount = [
    listViewOptions.showSessionCount,
    listViewOptions.showDuration,
    listViewOptions.showTotalPlayTime,
    true, // Select Time is always visible
    listViewOptions.showDailyPlan,
    listViewOptions.showDailyPlanRemaining,
    listViewOptions.showDailyPlanHands, // Add to dynamicColCount calculation
    settings.showHandsPlayed,
    listViewOptions.showHandsPerHour,
  ].filter(Boolean).length;


  if (processedDays.length === 0) {
    return (
      <div className="text-center text-muted-foreground mt-8 py-16 border-2 border-dashed rounded-lg">
        <p className="text-lg font-medium">Нет сессий за выбранный период</p>
        <p className="text-sm">Измените фильтр или начните новую сессию.</p>
      </div>
    );
  }

  return (
    <div className="w-full border rounded-lg">
      <Table>
        <TableCaption>Список ваших покерных сессий, сгруппированных по дням.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Дата</TableHead>
            {listViewOptions.showSessionCount && <TableHead className="text-right">Сессии</TableHead>}
            {listViewOptions.showDuration && <TableHead className="text-right">Общее время</TableHead>}
            {listViewOptions.showTotalPlayTime && <TableHead className="text-right">Время игры</TableHead>}
            <TableHead className="text-right">Время селекта</TableHead>
            {listViewOptions.showDailyPlan && <TableHead className="text-right">План (часы)</TableHead>}
            {listViewOptions.showDailyPlanHands && <TableHead className="text-right">План(руки)</TableHead>}
            {listViewOptions.showDailyPlanRemaining && <TableHead className="text-right">Осталось по плану </TableHead>}
            {settings.showHandsPlayed && <TableHead className="text-right">Руки</TableHead>}
            {listViewOptions.showHandsPerHour && <TableHead className="text-right">Рук/час</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {processedDays.map((day) => (
            <Collapsible.Root key={day.id} asChild>
              <>
                {day.isOffDay ? (
                  <TableRow className="off-day-row bg-red-100/50 dark:bg-red-900/20 text-muted-foreground">
                    <TableCell className="font-medium">{day.date}</TableCell>
                    <TableCell colSpan={dynamicColCount} className="text-center font-semibold text-lg py-4">
                      Выходной
                    </TableCell>
                  </TableRow>
                ) : (
                  <Collapsible.Trigger asChild disabled={!day.hasMultipleSessions}>
                    <TableRow className={cn(
                      !day.hasSessions && 'text-muted-foreground',
                      day.hasMultipleSessions && 'cursor-pointer data-[state=open]:bg-muted'
                    )}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {day.hasMultipleSessions && (
                            <ChevronDown className="h-4 w-4 mr-2 transition-transform duration-200 flex-shrink-0 data-[state=open]:rotate-180" />
                          )}
                          <span className={cn(!day.hasMultipleSessions && 'ml-6')}>{day.date}</span>
                          {settings.allowManualEditing && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="ml-2 h-6 w-6">
                                    <PlusCircle className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuLabel>Здесь будет форма добавления сессии</DropdownMenuLabel>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {listViewOptions.showSessionCount && <TableCell className="text-right tabular-nums">{day.sessionCount || '-'}</TableCell>}
                      {listViewOptions.showDuration && <TableCell className="text-right tabular-nums">{day.hasSessions ? day.totalDuration : '-'}</TableCell>}
                      {listViewOptions.showTotalPlayTime && <TableCell className="text-right tabular-nums">{day.hasSessions ? day.playDuration : '-'}</TableCell>}
                      <TableCell className="text-right tabular-nums">{day.hasSessions ? day.selectDuration : '-'}</TableCell>
                      {listViewOptions.showDailyPlan && <TableCell className="text-right tabular-nums">{day.dailyPlanHours > 0 ? day.dailyPlanHours.toFixed(1) : '-'}</TableCell>}
                      {listViewOptions.showDailyPlanHands && <TableCell className="text-right tabular-nums">{day.dailyPlanHands > 0 ? day.dailyPlanHands : '-'}</TableCell>}
                      {listViewOptions.showDailyPlanRemaining && <TableCell className="text-right tabular-nums">{day.dailyPlanHours > 0 ? day.dailyRemainingHours.toFixed(1) : '-'}</TableCell>}
                      {settings.showHandsPlayed && <TableCell className="text-right tabular-nums">{day.handsPlayed || '-'}</TableCell>}
                      {listViewOptions.showHandsPerHour && <TableCell className="text-right tabular-nums">{day.handsPerHour || '-'}</TableCell>}
                    </TableRow>
                  </Collapsible.Trigger>
                )}
                {!day.isOffDay && ( // Only show session details if it's not an off-day
                  <Collapsible.Content asChild>
                    <tr>
                      <TableCell colSpan={colSpan} className="p-0">
                        <SessionDetails 
                          sessions={day.sessionsForDay} 
                          showHandsPlayed={settings.showHandsPlayed}
                          allowManualEditing={settings.allowManualEditing}
                          updateSession={updateSession}
                        />
                      </TableCell>
                    </tr>
                  </Collapsible.Content>
                )}
              </>
            </Collapsible.Root>
          ))}
        </TableBody>
        {listViewOptions.showTotalsRow && totals && (
          <TableFooter>
            <TableRow className="font-bold bg-muted/50 hover:bg-muted">
              <TableCell>Итого</TableCell>
              {listViewOptions.showSessionCount && <TableCell className="text-right tabular-nums">{totals.sessionCount}</TableCell>}
              {listViewOptions.showDuration && <TableCell className="text-right tabular-nums">{totals.totalDuration}</TableCell>}
              {listViewOptions.showTotalPlayTime && <TableCell className="text-right tabular-nums">{totals.playDuration}</TableCell>}
              <TableCell className="text-right tabular-nums">{totals.selectDuration}</TableCell>
              {listViewOptions.showDailyPlan && <TableCell className="text-right tabular-nums">{totals.totalPlannedHours.toFixed(1)}</TableCell>}
              {listViewOptions.showDailyPlanHands && <TableCell className="text-right tabular-nums">{totals.totalPlannedHands}</TableCell>}
              {listViewOptions.showDailyPlanRemaining && <TableCell className="text-right tabular-nums">{totals.totalRemainingPlan.toFixed(1)}</TableCell>}
              {settings.showHandsPlayed && <TableCell className="text-right tabular-nums">{totals.handsPlayed}</TableCell>}
              {listViewOptions.showHandsPerHour && <TableCell className="text-right tabular-nums">{totals.averageHandsPerHour}</TableCell>}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
};

export default ListView;
