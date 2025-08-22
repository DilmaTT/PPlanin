import React, { useState, useMemo, useEffect } from 'react';
import { useStorage } from '@/hooks/useStorage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfDay, addSeconds } from 'date-fns';
import { Session, SessionPeriod } from '@/types';
import { useToast } from '@/hooks/use-toast';

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

// Reusable Time Selector Component
interface TimeSelectorProps {
  value: number; // in seconds
  onChange: (seconds: number) => void;
  disabled?: boolean;
  maxHours?: number;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({ value, onChange, disabled = false, maxHours = 24 }) => {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  const handleHourChange = (h: number) => {
    onChange((h * 3600) + (minutes * 60));
  };

  const handleMinuteChange = (m: number) => {
    onChange((hours * 3600) + (m * 60));
  };

  return (
    <div className="flex gap-2">
      <Select onValueChange={(v) => handleHourChange(Number(v))} value={String(hours)} disabled={disabled}>
        <SelectTrigger className="w-[75px]">
          <SelectValue placeholder="Часы" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {[...Array(maxHours + 1).keys()].map(h => <SelectItem key={h} value={String(h)}>{h} ч</SelectItem>)}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => handleMinuteChange(Number(v))} value={String(minutes)} disabled={disabled}>
        <SelectTrigger className="w-[85px]">
          <SelectValue placeholder="Минуты" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {[...Array(60).keys()].map(m => <SelectItem key={m} value={String(m)}>{m} мин</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
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
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [isExactTimeEnabled, setIsExactTimeEnabled] = useState(false);
  
  const [playDurationSeconds, setPlayDurationSeconds] = useState(0);
  const [selectDurationSeconds, setSelectDurationSeconds] = useState(0);
  
  const [startTimeSeconds, setStartTimeSeconds] = useState(0);
  const [endTimeSeconds, setEndTimeSeconds] = useState(0);

  const [detailedHands, setDetailedHands] = useState('');
  const [detailedNotes, setDetailedNotes] = useState('');

  // --- Memoized Calculations ---
  const exactDurationInSeconds = useMemo(() => {
    if (isSplitEnabled || !isExactTimeEnabled || startTimeSeconds === endTimeSeconds) return 0;
    try {
      const dayStart = startOfDay(day.originalDate);
      let start = addSeconds(dayStart, startTimeSeconds);
      let end = addSeconds(dayStart, endTimeSeconds);
      
      if (end <= start) {
        end = addSeconds(end, 24 * 3600);
      }

      const duration = (end.getTime() - start.getTime()) / 1000;
      
      if (duration > 24 * 3600) return -1;

      return duration;
    } catch {
      return 0;
    }
  }, [isSplitEnabled, isExactTimeEnabled, startTimeSeconds, endTimeSeconds, day.originalDate]);

  // --- Effects for state management ---

  const handleSplitToggle = (checked: boolean) => {
    setIsSplitEnabled(checked);
  };

  const handleExactTimeToggle = (checked: boolean) => {
    setIsExactTimeEnabled(checked);
    if (checked && isSplitEnabled) {
      setStartTimeSeconds(0);
    }
  };

  useEffect(() => {
    if (isSplitEnabled) {
      setTotalDurationSeconds(playDurationSeconds + selectDurationSeconds);
    } else if (isExactTimeEnabled) {
      setTotalDurationSeconds(exactDurationInSeconds >= 0 ? exactDurationInSeconds : 0);
    }
  }, [isSplitEnabled, playDurationSeconds, selectDurationSeconds, isExactTimeEnabled, exactDurationInSeconds]);

  useEffect(() => {
    if (isSplitEnabled && isExactTimeEnabled) {
      setEndTimeSeconds(startTimeSeconds + totalDurationSeconds);
    }
  }, [isSplitEnabled, isExactTimeEnabled, startTimeSeconds, totalDurationSeconds]);


  const handleQuickSave = () => {
    const totalSeconds = timeStringToSeconds(quickDuration);

    if (totalSeconds <= 0) {
      toast({ title: 'Ошибка валидации', description: 'Продолжительность должна быть больше нуля.', variant: 'destructive' });
      return;
    }
    if (totalSeconds > 48 * 3600) {
      toast({ title: 'Ошибка валидации', description: 'Продолжительность не может превышать 48 часов.', variant: 'destructive' });
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
    if (totalDurationSeconds <= 0) {
      toast({ title: 'Ошибка', description: 'Итоговая продолжительность должна быть больше нуля.', variant: 'destructive' });
      return;
    }
    if (totalDurationSeconds > 48 * 3600) {
      toast({ title: 'Ошибка', description: 'Итоговая продолжительность не может превышать 48 часов.', variant: 'destructive' });
      return;
    }

    const dayStart = startOfDay(day.originalDate);
    let sessionStartTime: Date;
    let sessionEndTime: Date;

    if (isExactTimeEnabled) {
      if (!isSplitEnabled && exactDurationInSeconds <= 0) {
        const description = exactDurationInSeconds === -1 
          ? 'Сессия не может длиться более 24 часов.'
          : 'Время окончания должно быть после времени начала.';
        toast({ title: 'Ошибка времени', description, variant: 'destructive' });
        return;
      }
      sessionStartTime = addSeconds(dayStart, startTimeSeconds);
      sessionEndTime = addSeconds(sessionStartTime, totalDurationSeconds);
    } else {
      sessionStartTime = dayStart;
      sessionEndTime = addSeconds(sessionStartTime, totalDurationSeconds);
    }

    const periods: SessionPeriod[] = [];
    if (isSplitEnabled) {
      const playEndTime = addSeconds(sessionStartTime, playDurationSeconds);
      if (playDurationSeconds > 0) {
        periods.push({ type: 'play', startTime: sessionStartTime.toISOString(), endTime: playEndTime.toISOString() });
      }
      if (selectDurationSeconds > 0) {
        periods.push({ type: 'select', startTime: playEndTime.toISOString(), endTime: addSeconds(playEndTime, selectDurationSeconds).toISOString() });
      }
    } else {
      periods.push({ type: 'play', startTime: sessionStartTime.toISOString(), endTime: sessionEndTime.toISOString() });
    }
    
    if (periods.length === 0 && totalDurationSeconds > 0) {
         periods.push({ type: 'play', startTime: sessionStartTime.toISOString(), endTime: sessionEndTime.toISOString() });
    }

    const handsPlayed = Math.max(0, parseInt(detailedHands, 10) || 0);
    const newSession: Omit<Session, 'id'> = {
      overallStartTime: sessionStartTime.toISOString(),
      overallEndTime: sessionEndTime.toISOString(),
      overallDuration: totalDurationSeconds,
      handsPlayed: handsPlayed,
      notes: detailedNotes,
      overallProfit: 0,
      overallHandsPlayed: handsPlayed,
      periods: periods,
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
                <Label htmlFor="duration">Общее время</Label>
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
          <TabsContent value="detailed" className="pt-6">
            <div className="flex flex-col space-y-4">
              {/* Main Controls Grid */}
              <div className="grid grid-cols-[170px_auto_auto_120px] gap-x-6 gap-y-2 items-start">
                {/* --- ROW 1: LABELS --- */}
                <div className="h-7 flex items-center"><Label>Общее время</Label></div>
                <div className="h-7 flex items-center space-x-2">
                  <Checkbox id="split-toggle" checked={isSplitEnabled} onCheckedChange={handleSplitToggle} />
                  <Label htmlFor="split-toggle" className="font-normal select-none">Разбить на игра+селект</Label>
                </div>
                <div className="h-7 flex items-center space-x-2">
                  <Checkbox id="exact-toggle" checked={isExactTimeEnabled} onCheckedChange={handleExactTimeToggle} />
                  <Label htmlFor="exact-toggle" className="font-normal select-none">Точное время сессии</Label>
                </div>
                <div className="h-7 flex items-center"><Label>Руки</Label></div>

                {/* --- ROW 2: INPUTS --- */}
                <div>
                  <TimeSelector value={totalDurationSeconds} onChange={setTotalDurationSeconds} disabled={isSplitEnabled || isExactTimeEnabled} maxHours={48} />
                </div>
                
                <div>
                  {isSplitEnabled && (
                    <div className="flex space-x-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Время игры</Label>
                        <TimeSelector value={playDurationSeconds} onChange={setPlayDurationSeconds} maxHours={48} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Время селекта</Label>
                        <TimeSelector value={selectDurationSeconds} onChange={setSelectDurationSeconds} maxHours={48} />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  {isExactTimeEnabled && (
                    <div className="flex space-x-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Старт</Label>
                        <TimeSelector value={startTimeSeconds} onChange={setStartTimeSeconds} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Конец</Label>
                        <TimeSelector value={endTimeSeconds} onChange={setEndTimeSeconds} disabled={isSplitEnabled && isExactTimeEnabled} />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Input id="detailed-hands" type="number" min={0} value={detailedHands} onChange={(e) => setDetailedHands(e.target.value)} placeholder="(опц.)" />
                </div>
              </div>

              {/* Notes and Buttons Row */}
              <div className="flex items-center gap-4 pt-4">
                <Input id="detailed-notes" value={detailedNotes} onChange={(e) => setDetailedNotes(e.target.value)} placeholder="Заметки (опц.)" className="flex-1" />
                <Button variant="ghost" onClick={onCancel}>Отмена</Button>
                <Button onClick={handleSave}>Сохранить</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AddSessionForm;
