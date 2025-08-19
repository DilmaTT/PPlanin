import React, { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useStorage } from '@/hooks/useStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plan } from '@/types';
import '../styles/calendar.css';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar as ShadcnCalendar } from '@/components/ui/calendar';

type ValuePiece = Date | null;
type CalendarValue = ValuePiece | [ValuePiece, ValuePiece];

type WeeklyScheduleDay = {
  hours: number;
  hands: number;
  isOff: boolean;
};

const PlanningPage = () => {
  const { getPlanForDate, setPlanForDate, isOffDay, setOffDay, applyWeeklySchedule } = useStorage();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [plan, setPlan] = useState<Partial<Plan>>({ hours: 0, hands: 0 });
  // 1. Создаем новое локальное состояние для чекбокса
  const [isOffDayChecked, setIsOffDayChecked] = useState(false);

  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, WeeklyScheduleDay>>({
    1: { hours: 0, hands: 0, isOff: false }, // Monday
    2: { hours: 0, hands: 0, isOff: false }, // Tuesday
    3: { hours: 0, hands: 0, isOff: false }, // Wednesday
    4: { hours: 0, hands: 0, isOff: false }, // Thursday
    5: { hours: 0, hands: 0, isOff: false }, // Friday
    6: { hours: 0, hands: 0, isOff: true },  // Saturday
    0: { hours: 0, hands: 0, isOff: true },  // Sunday
  });
  const [applyStartDate, setApplyStartDate] = useState<Date | undefined>(new Date());
  const [applyEndDate, setApplyEndDate] = useState<Date | undefined>(new Date());

  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

  useEffect(() => {
    const existingPlan = getPlanForDate(selectedDate);
    setPlan({
      hours: existingPlan?.hours || 0,
      hands: existingPlan?.hands || 0,
    });
    // 2. Синхронизируем локальное состояние с глобальным при изменении даты
    setIsOffDayChecked(isOffDay(selectedDate));
  }, [selectedDate, getPlanForDate, isOffDay]);

  const handleDateChange = (value: CalendarValue) => {
    if (value instanceof Date) {
      setSelectedDate(value);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPlan(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleSave = () => {
    const planToSave: Plan = {
      hours: plan.hours || 0,
      hands: plan.hands || 0,
    };
    setPlanForDate(selectedDate, planToSave);
    // Force re-render of calendar tiles by creating a new date object
    setSelectedDate(new Date(selectedDate.getTime()));
  };

  const handleOffDayChange = (checked: boolean | 'indeterminate') => {
    const newIsDayOffState = typeof checked === 'boolean' ? checked : false;
    // 3. Сначала обновляем локальное состояние для мгновенного визуального отклика
    setIsOffDayChecked(newIsDayOffState);
    // Затем обновляем глобальное состояние
    setOffDay(selectedDate, newIsDayOffState);
    // Force re-render of calendar tiles
    setSelectedDate(new Date(selectedDate.getTime()));
  };

  const handleWeeklyScheduleChange = (dayIndex: number, field: keyof WeeklyScheduleDay, value: any) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayIndex]: {
        ...prev[dayIndex],
        [field]: value,
      },
    }));
  };

  const handleApplyWeeklySchedule = () => {
    if (applyStartDate && applyEndDate) {
      applyWeeklySchedule(applyStartDate, applyEndDate, weeklySchedule);
      // Force calendar re-render after applying schedule
      setSelectedDate(new Date(selectedDate.getTime()));
    }
  };

  const tileContent = useCallback(({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dailyPlan = getPlanForDate(date);
      if (dailyPlan && (dailyPlan.hours > 0 || dailyPlan.hands > 0)) {
        return (
          <div className="tile-plan">
            {dailyPlan.hours > 0 && `${dailyPlan.hours}ч`}
            {dailyPlan.hours > 0 && dailyPlan.hands > 0 && ' / '}
            {dailyPlan.hands > 0 && `${dailyPlan.hands}р`}
          </div>
        );
      }
    }
    return null;
  }, [getPlanForDate]);

  const tileClassName = useCallback(({ date, view }: { date: Date; view: string }) => {
    if (view === 'month' && isOffDay(date)) {
      return 'off-day';
    }
    return null;
  }, [isOffDay]);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Планирование</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-2">
              <Calendar
                onChange={handleDateChange}
                value={selectedDate}
                tileContent={tileContent}
                tileClassName={tileClassName}
                locale="ru-RU"
              />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                План на {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset disabled={isOffDayChecked} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hours">Цель (часы)</Label>
                  <Input
                    id="hours"
                    name="hours"
                    type="number"
                    placeholder="0"
                    value={plan.hours || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hands">Цель (руки)</Label>
                  <Input
                    id="hands"
                    name="hands"
                    type="number"
                    placeholder="0"
                    value={plan.hands || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </fieldset>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="off-day-checkbox"
                  checked={isOffDayChecked}
                  onCheckedChange={handleOffDayChange}
                />
                <Label htmlFor="off-day-checkbox">Выходной</Label>
              </div>

              <Button onClick={handleSave} className="w-full" disabled={isOffDayChecked}>
                Сохранить
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Расписание</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {Object.keys(weeklySchedule).sort((a, b) => {
                // Sort days from Monday (1) to Sunday (0)
                const dayA = parseInt(a);
                const dayB = parseInt(b);
                if (dayA === 0) return 1; // Sunday to end
                if (dayB === 0) return -1; // Sunday to end
                return dayA - dayB;
              }).map(dayIndexStr => {
                const dayIndex = parseInt(dayIndexStr);
                const day = weeklySchedule[dayIndex];
                return (
                  <div key={dayIndex} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-2 border rounded-md">
                    <Label className="w-28 font-semibold">{dayNames[dayIndex]}</Label>
                    <div className="flex items-center gap-2 flex-grow">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`hours-${dayIndex}`} className="sr-only">Часы</Label>
                        <Input
                          id={`hours-${dayIndex}`}
                          name="hours"
                          type="number"
                          placeholder="Часы"
                          value={day.hours || ''}
                          onChange={(e) => handleWeeklyScheduleChange(dayIndex, 'hours', Number(e.target.value))}
                          disabled={day.isOff}
                          className="w-full"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`hands-${dayIndex}`} className="sr-only">Руки</Label>
                        <Input
                          id={`hands-${dayIndex}`}
                          name="hands"
                          type="number"
                          placeholder="Руки"
                          value={day.hands || ''}
                          onChange={(e) => handleWeeklyScheduleChange(dayIndex, 'hands', Number(e.target.value))}
                          disabled={day.isOff}
                          className="w-full"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`off-day-${dayIndex}`}
                          checked={day.isOff}
                          onCheckedChange={(checked: boolean) => handleWeeklyScheduleChange(dayIndex, 'isOff', checked)}
                        />
                        <Label htmlFor={`off-day-${dayIndex}`}>Выходной</Label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1 w-full">
                <Label htmlFor="apply-start-date">Применить с</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !applyStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {applyStartDate ? format(applyStartDate, "PPP", { locale: ru }) : <span>Выберите дату</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <ShadcnCalendar
                      mode="single"
                      selected={applyStartDate}
                      onSelect={setApplyStartDate}
                      initialFocus
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1 w-full">
                <Label htmlFor="apply-end-date">Применить по</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !applyEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {applyEndDate ? format(applyEndDate, "PPP", { locale: ru }) : <span>Выберите дату</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <ShadcnCalendar
                      mode="single"
                      selected={applyEndDate}
                      onSelect={setApplyEndDate}
                      initialFocus
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button
              onClick={handleApplyWeeklySchedule}
              className="w-full"
              disabled={!applyStartDate || !applyEndDate}
            >
              Применить расписание
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlanningPage;
