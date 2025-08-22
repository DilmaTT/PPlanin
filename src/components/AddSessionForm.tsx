import React, { useState, useMemo, useEffect } from 'react';
import { useStorage } from '@/hooks/useStorage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { startOfDay, addSeconds } from 'date-fns';
import { Session } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { formatSeconds } from '@/lib/utils';

interface AddSessionFormProps {
  day: {
    id: string;
    originalDate: Date;
  };
  onCancel: () => void;
}

// Helper function to parse time strings like "4:20" or "4 20" into seconds
const timeStringToSeconds = (timeStr: string): number => {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().replace(/\s+/g, ':');
  const parts = normalized.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return (hours * 3600) + (minutes * 60);
};

// Helper function to combine a date with a time string "HH:mm"
const combineDateAndTime = (date: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
};


const AddSessionForm: React.FC<AddSessionFormProps> = ({ day, onCancel }) => {
  const { addSession } = useStorage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('quick');

  // Quick form state
  const [quickDuration, setQuickDuration] = useState('');
  const [quickHands, setQuickHands] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  // Detailed form state
  const [detailedTimeMethod, setDetailedTimeMethod] = useState<'duration' | 'specific'>('duration');
  const [detailedDuration, setDetailedDuration] = useState('');
  const [startTime, setStartTime] = useState(''); // "HH:mm"
  const [endTime, setEndTime] = useState(''); // "HH:mm"

  const [isBreakdownEnabled, setIsBreakdownEnabled] = useState(false);
  const [playTime, setPlayTime] = useState('');
  const [selectTime, setSelectTime] = useState('');

  const [detailedHands, setDetailedHands] = useState('');
  const [detailedNotes, setDetailedNotes] = useState('');

  // Memoized calculation for duration from specific times
  const calculatedDurationInSeconds = useMemo(() => {
    if (detailedTimeMethod !== 'specific' || !startTime || !endTime) {
      return 0;
    }
    try {
      const start = combineDateAndTime(day.originalDate, startTime);
      const end = combineDateAndTime(day.originalDate, endTime);
      if (end <= start) return 0;
      return (end.getTime() - start.getTime()) / 1000;
    } catch {
      return 0;
    }
  }, [startTime, endTime, detailedTimeMethod, day.originalDate]);

  // Memoized calculation for breakdown sum
  const breakdownSumInSeconds = useMemo(() => {
    if (!isBreakdownEnabled) return 0;
    return timeStringToSeconds(playTime) + timeStringToSeconds(selectTime);
  }, [isBreakdownEnabled, playTime, selectTime]);

  // Effect to update detailedDuration when breakdown is used in duration mode
  useEffect(() => {
    if (detailedTimeMethod === 'duration' && isBreakdownEnabled) {
      const totalSeconds = breakdownSumInSeconds;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      setDetailedDuration(`${hours}:${minutes.toString().padStart(2, '0')}`);
    }
  }, [breakdownSumInSeconds, detailedTimeMethod, isBreakdownEnabled]);


  const handleQuickSave = () => {
    const totalSeconds = timeStringToSeconds(quickDuration);

    if (totalSeconds <= 0) {
      toast({
        title: 'Ошибка валидации',
        description: 'Продолжительность должна быть больше нуля.',
        variant: 'destructive',
      });
      return;
    }

    const sessionStartTime = startOfDay(day.originalDate);
    const sessionEndTime = addSeconds(sessionStartTime, totalSeconds);
    const handsPlayed = Math.max(0, parseInt(quickHands, 10) || 0);

    const newSession: Omit<Session, 'id'> = {
      overallStartTime: sessionStartTime.toISOString(),
      overallEndTime: sessionEndTime.toISOString(),
      overallDuration: totalSeconds,
      handsPlayed: handsPlayed,
      notes: quickNotes,
      overallProfit: 0,
      overallHandsPlayed: handsPlayed,
      periods: [{ type: 'play', startTime: sessionStartTime.toISOString(), endTime: sessionEndTime.toISOString() }],
    };

    addSession(newSession);
    toast({ title: 'Сессия добавлена', description: `Сессия за ${day.id} успешно сохранена.` });
    onCancel();
  };

  const handleDetailedSave = () => {
    // Validation for breakdown sum
    if (detailedTimeMethod === 'specific' && isBreakdownEnabled) {
      if (breakdownSumInSeconds !== calculatedDurationInSeconds) {
        toast({
          title: 'Ошибка валидации',
          description: `Сумма времени Игры и Селекта (${formatSeconds(breakdownSumInSeconds)}) не совпадает с общей продолжительностью (${formatSeconds(calculatedDurationInSeconds)}).`,
          variant: 'destructive',
        });
        return;
      }
    }

    let totalSeconds = 0;
    let sessionStartTime: Date;
    let sessionEndTime: Date;

    // Determine Start/End Times and Total Duration
    if (detailedTimeMethod === 'specific') {
      if (calculatedDurationInSeconds <= 0) {
        toast({ title: 'Ошибка', description: 'Время окончания должно быть после времени начала.', variant: 'destructive' });
        return;
      }
      sessionStartTime = combineDateAndTime(day.originalDate, startTime);
      sessionEndTime = combineDateAndTime(day.originalDate, endTime);
      totalSeconds = calculatedDurationInSeconds;
    } else { // 'duration'
      sessionStartTime = startOfDay(day.originalDate);
      if (isBreakdownEnabled) {
        totalSeconds = breakdownSumInSeconds;
      } else {
        totalSeconds = timeStringToSeconds(detailedDuration);
      }
      sessionEndTime = addSeconds(sessionStartTime, totalSeconds);
    }

    if (totalSeconds <= 0) {
      toast({ title: 'Ошибка', description: 'Итоговая продолжительность должна быть больше нуля.', variant: 'destructive' });
      return;
    }

    const handsPlayed = Math.max(0, parseInt(detailedHands, 10) || 0);
    const newSession: Omit<Session, 'id'> = {
      overallStartTime: sessionStartTime.toISOString(),
      overallEndTime: sessionEndTime.toISOString(),
      overallDuration: totalSeconds,
      handsPlayed: handsPlayed,
      notes: detailedNotes,
      overallProfit: 0,
      overallHandsPlayed: handsPlayed,
      periods: [{ type: 'play', startTime: sessionStartTime.toISOString(), endTime: sessionEndTime.toISOString() }],
    };

    addSession(newSession);
    toast({ title: 'Сессия добавлена', description: `Сессия за ${day.id} успешно сохранена.` });
    onCancel();
  };

  const handleSave = () => {
    if (activeTab === 'quick') {
      handleQuickSave();
    } else {
      handleDetailedSave();
    }
  };

  const isBreakdownInvalid = detailedTimeMethod === 'specific' && isBreakdownEnabled && calculatedDurationInSeconds > 0 && breakdownSumInSeconds !== calculatedDurationInSeconds;

  return (
    <Card className="w-full max-w-none my-2 shadow-lg bg-card">
      <CardHeader>
        <CardTitle>Добавить сессию за {day.id}</CardTitle>
        <CardDescription>Выберите быстрый или подробный ввод.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Быстрый ввод</TabsTrigger>
            <TabsTrigger value="detailed">Подробный ввод</TabsTrigger>
          </TabsList>
          <TabsContent value="quick" className="pt-4">
            <div className="flex items-end space-x-4">
              <div className="w-36 space-y-1">
                <Label htmlFor="duration">Продолжительность</Label>
                <Input id="duration" value={quickDuration} onChange={(e) => setQuickDuration(e.target.value)} placeholder="Ч:ММ или Ч ММ" />
              </div>
              <div className="w-28 space-y-1">
                <Label htmlFor="hands">Руки</Label>
                <Input id="hands" type="number" min={0} value={quickHands} onChange={(e) => setQuickHands(e.target.value)} placeholder="(опц.)" />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="notes">Заметки</Label>
                <Input id="notes" value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} placeholder="(опц.)" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={onCancel}>Отмена</Button>
              <Button onClick={handleSave}>Сохранить</Button>
            </div>
          </TabsContent>
          <TabsContent value="detailed" className="pt-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                {/* Time Method Group */}
                <div className="flex flex-col space-y-2">
                    <RadioGroup value={detailedTimeMethod} onValueChange={(v) => setDetailedTimeMethod(v as any)} className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="duration" id="r-duration" />
                            <Label htmlFor="r-duration" className="font-normal">Продолжительность</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="specific" id="r-specific" />
                            <Label htmlFor="r-specific" className="font-normal">Точное время</Label>
                        </div>
                    </RadioGroup>
                </div>

                {/* Time Input Group */}
                {detailedTimeMethod === 'duration' ? (
                    <div className="space-y-1">
                        <Label htmlFor="detailed-duration">Всего</Label>
                        <Input id="detailed-duration" className="w-32" value={detailedDuration} onChange={(e) => setDetailedDuration(e.target.value)} placeholder="Ч:ММ" disabled={isBreakdownEnabled} />
                    </div>
                ) : (
                    <>
                        <div className="space-y-1">
                            <Label htmlFor="start-time">Старт</Label>
                            <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="end-time">Конец</Label>
                            <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </>
                )}

                {/* Breakdown Group */}
                <div className="flex flex-col">
                    <div className="flex items-center space-x-2 h-10">
                        <Checkbox id="breakdown-toggle" checked={isBreakdownEnabled} onCheckedChange={(checked) => setIsBreakdownEnabled(Boolean(checked))} />
                        <Label htmlFor="breakdown-toggle" className="font-normal">Разбить на Игра + Селект</Label>
                    </div>
                </div>

                {isBreakdownEnabled && (
                    <>
                        <div className="space-y-1">
                            <Label htmlFor="play-time">Время игры</Label>
                            <Input id="play-time" className="w-28" value={playTime} onChange={(e) => setPlayTime(e.target.value)} placeholder="Ч:ММ" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="select-time">Время селекта</Label>
                            <Input id="select-time" className="w-28" value={selectTime} onChange={(e) => setSelectTime(e.target.value)} placeholder="Ч:ММ" />
                        </div>
                    </>
                )}

                {/* Hands Group */}
                <div className="w-28 space-y-1">
                    <Label htmlFor="detailed-hands">Руки</Label>
                    <Input id="detailed-hands" type="number" min={0} value={detailedHands} onChange={(e) => setDetailedHands(e.target.value)} placeholder="(опц.)" />
                </div>

                {/* Notes Group */}
                <div className="flex-1 space-y-1 min-w-[150px]">
                    <Label htmlFor="detailed-notes">Заметки</Label>
                    <Input id="detailed-notes" value={detailedNotes} onChange={(e) => setDetailedNotes(e.target.value)} placeholder="(опц.)" />
                </div>
            </div>

            {/* Validation & Info Messages */}
            <div className="mt-2 flex flex-wrap items-start gap-x-6 min-h-[20px]">
                <div className="min-w-[200px]">
                    {detailedTimeMethod === 'specific' && calculatedDurationInSeconds > 0 && (
                        <p className="text-sm text-primary-foreground/80">
                            Продолжительность: <b>{formatSeconds(calculatedDurationInSeconds)}</b>
                        </p>
                    )}
                </div>
                <div className="min-w-[200px]">
                    {isBreakdownInvalid && (
                        <p className="text-sm text-destructive">
                            Сумма не совпадает! ({formatSeconds(breakdownSumInSeconds)} из {formatSeconds(calculatedDurationInSeconds)})
                        </p>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={onCancel}>Отмена</Button>
              <Button onClick={handleSave}>Сохранить</Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AddSessionForm;
