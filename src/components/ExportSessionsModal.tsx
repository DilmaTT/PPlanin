import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import type { DateRange } from 'react-day-picker';
import { subDays, subMonths, format, startOfDay, eachDayOfInterval, endOfDay as getEndOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Session, SessionPeriod } from '@/types';

const columns = [
  { id: 'date', label: 'Дата' },
  { id: 'sessionCount', label: 'Кол-во сессий' },
  { id: 'sessionDateTime', label: 'Дата сессий' },
  { id: 'totalTime', label: 'Общее время' },
  { id: 'playTime', label: 'Время игры' },
  { id: 'selectTime', label: 'Время селекта' },
  { id: 'planHours', label: 'План (часы)' },
  { id: 'planHands', label: 'План (руки)' },
  { id: 'planRemaining', label: 'Осталось по плану' },
  { id: 'hands', label: 'Руки' },
  { id: 'handsPerHour', label: 'Рук/час' },
  { id: 'notes', label: 'Заметки' },
];

// Helper function to format seconds into HH:MM:SS
const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00:00';
  }
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

interface ExportSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
}

export const ExportSessionsModal = ({ isOpen, onClose, sessions }: ExportSessionsModalProps) => {
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(
    columns.reduce((acc, col) => ({ ...acc, [col.id]: true }), {})
  );
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [dateFormat, setDateFormat] = useState({
    showDayNumber: true,
    showDayOfWeek: false,
    showMonth: true,
    showYear: true,
  });

  const handleColumnChange = (columnId: string, checked: boolean) => {
    setSelectedColumns((prev) => ({ ...prev, [columnId]: checked }));
  };

  const handleDateFormatChange = (key: keyof typeof dateFormat, checked: boolean) => {
    setDateFormat((prev) => ({ ...prev, [key]: checked }));
  };

  const buildDateFormatString = () => {
    const formatParts: string[] = [];
    if (dateFormat.showDayNumber) formatParts.push('d');
    if (dateFormat.showMonth) formatParts.push('MMMM');
    if (dateFormat.showYear) formatParts.push('yyyy');
    
    let dateString = formatParts.join(' ').trim();
    
    if (dateFormat.showDayOfWeek) {
      // EEE for short day name, EEEE for full
      dateString = `EEE, ${dateString}`;
    }
    return dateString;
  };

  const handleExport = () => {
    // 1. Gather settings
    const activeColumns = columns.filter(col => selectedColumns[col.id]);
    const headers = activeColumns.map(col => col.label);

    // 2. Determine date range
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'week') {
      startDate = subDays(new Date(), 7);
    } else if (period === 'month') {
      startDate = subMonths(new Date(), 1);
    } else if (period === 'custom' && date?.from) {
      startDate = date.from;
      endDate = date.to || date.from;
    }
    
    const dateRange = eachDayOfInterval({ start: startOfDay(startDate), end: getEndOfDay(endDate) });

    // 3. Group sessions by day for efficient lookup
    const groupedByDay: Record<string, Session[]> = sessions.reduce((acc, session) => {
      const dayKey = format(new Date(session.overallStartTime), 'yyyy-MM-dd');
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(session);
      return acc;
    }, {} as Record<string, Session[]>);

    // 4. Iterate through the date range and build data
    const formattedData = dateRange.map(currentDate => {
      const dayKey = format(currentDate, 'yyyy-MM-dd');
      const daySessions = groupedByDay[dayKey] || [];
      const row: Record<string, any> = {};

      const dateColumnFormat = buildDateFormatString();
      const formattedDate = dateColumnFormat ? format(currentDate, dateColumnFormat, { locale: ru }) : format(currentDate, 'yyyy-MM-dd', { locale: ru });

      if (daySessions.length === 0) {
        // Handle empty day
        if (selectedColumns.date) {
          row[columns.find(c => c.id === 'date')!.label] = formattedDate;
        }
        return row;
      }

      // Aggregate data for the day
      daySessions.sort((a, b) => new Date(a.overallStartTime).getTime() - new Date(b.overallStartTime).getTime());
      
      let totalDurationInSeconds = 0;
      let totalPlayTimeInSeconds = 0;
      let totalSelectTimeInSeconds = 0;
      let totalHandsPlayed = 0;
      const allNotes: string[] = [];

      daySessions.forEach(session => {
        totalDurationInSeconds += (new Date(session.overallEndTime).getTime() - new Date(session.overallStartTime).getTime()) / 1000;
        const calculateDurationInSeconds = (type: SessionPeriod['type']) => 
          (session.periods?.filter(p => p.type === type)
            .reduce((acc, p) => acc + (new Date(p.endTime).getTime() - new Date(p.startTime).getTime()), 0) ?? 0) / 1000;
        totalPlayTimeInSeconds += calculateDurationInSeconds('play');
        totalSelectTimeInSeconds += calculateDurationInSeconds('select');
        totalHandsPlayed += session.handsPlayed || 0;
        if (session.notes) allNotes.push(session.notes);
      });

      const totalPlayTimeInHours = totalPlayTimeInSeconds / 3600;

      // 5. Format columns based on active selection
      activeColumns.forEach(col => {
        switch (col.id) {
          case 'date':
            row[col.label] = formattedDate;
            break;
          case 'sessionCount':
            row[col.label] = daySessions.length;
            break;
          case 'sessionDateTime': {
            const firstSession = daySessions[0];
            const datePart = format(new Date(firstSession.overallStartTime), 'd MMMM yyyy', { locale: ru });

            if (daySessions.length === 1) {
              const startTime = new Date(firstSession.overallStartTime);
              const endTime = new Date(firstSession.overallEndTime);
              const startTimePart = format(startTime, 'HH:mm');
              const endTimePart = format(endTime, 'HH:mm');
              row[col.label] = `${datePart} ${startTimePart}-${endTimePart}`;
            } else {
              const timeRanges = daySessions.map(session => {
                const startTime = format(new Date(session.overallStartTime), 'HH:mm');
                const endTime = format(new Date(session.overallEndTime), 'HH:mm');
                return `(${startTime}-${endTime})`;
              }).join(' ');
              row[col.label] = `${datePart} ${timeRanges}`;
            }
            break;
          }
          case 'totalTime':
            row[col.label] = formatDuration(totalDurationInSeconds);
            break;
          case 'playTime':
            row[col.label] = formatDuration(totalPlayTimeInSeconds);
            break;
          case 'selectTime':
            row[col.label] = formatDuration(totalSelectTimeInSeconds);
            break;
          case 'hands':
            row[col.label] = totalHandsPlayed;
            break;
          case 'handsPerHour':
            row[col.label] = totalPlayTimeInHours > 0 ? Math.round(totalHandsPlayed / totalPlayTimeInHours) : 0;
            break;
          case 'notes':
            row[col.label] = allNotes.join('; ');
            break;
          default:
            break;
        }
      });
      return row;
    });

    // 6. Generate and download XLSX file
    const worksheet = XLSX.utils.json_to_sheet(formattedData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sessions");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });

    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'poker-sessions.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Настройки экспорта данных</DialogTitle>
          <DialogDescription>
            Выберите колонки и период для формирования отчета.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <h4 className="font-medium mb-4 text-foreground">Выбор колонок</h4>
            <div className="grid grid-cols-2 gap-4">
              {columns.map((column) => (
                <div key={column.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={selectedColumns[column.id]}
                      onCheckedChange={(checked) => handleColumnChange(column.id, !!checked)}
                    />
                    <Label
                      htmlFor={column.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {column.label}
                    </Label>
                  </div>
                  {column.id === 'date' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4">
                        <div className="grid gap-4">
                          <div className="space-y-1">
                            <h4 className="font-medium leading-none">Формат даты</h4>
                            <p className="text-sm text-muted-foreground">
                              Настройте вид даты в отчете.
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="showDayNumber"
                                checked={dateFormat.showDayNumber}
                                onCheckedChange={(checked) => handleDateFormatChange('showDayNumber', !!checked)}
                              />
                              <Label htmlFor="showDayNumber">Показывать число</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="showDayOfWeek"
                                checked={dateFormat.showDayOfWeek}
                                onCheckedChange={(checked) => handleDateFormatChange('showDayOfWeek', !!checked)}
                              />
                              <Label htmlFor="showDayOfWeek">Показывать день недели</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="showMonth"
                                checked={dateFormat.showMonth}
                                onCheckedChange={(checked) => handleDateFormatChange('showMonth', !!checked)}
                              />
                              <Label htmlFor="showMonth">Показывать месяц</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="showYear"
                                checked={dateFormat.showYear}
                                onCheckedChange={(checked) => handleDateFormatChange('showYear', !!checked)}
                              />
                              <Label htmlFor="showYear">Показывать год</Label>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-4 text-foreground">Период экспорта</h4>
            <RadioGroup defaultValue="week" value={period} onValueChange={setPeriod}>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="week" id="r1" />
                <Label htmlFor="r1" className="cursor-pointer">За неделю</Label>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="month" id="r2" />
                <Label htmlFor="r2" className="cursor-pointer">За месяц</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="r3" />
                <Label htmlFor="r3" className="cursor-pointer">Свой вариант</Label>
              </div>
            </RadioGroup>
            {period === 'custom' && (
              <div className="pt-4 flex justify-center rounded-md border mt-4">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
          <Button type="button" onClick={handleExport}>Сформировать отчет</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
