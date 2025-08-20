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
import { subDays, subMonths, format, isWithinInterval } from 'date-fns';
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
    if (dateFormat.showYear) formatParts.push('yyyy');
    if (dateFormat.showMonth) formatParts.push('MM');
    formatParts.push('dd');

    let dateString = formatParts.join('-');
    if (dateFormat.showDayOfWeek) {
      dateString = `E, ${dateString}`;
    }
    return `${dateString} HH:mm`;
  };

  const handleExport = () => {
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
    
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const filteredSessions = sessions.filter(session => {
      const sessionDate = new Date(session.overallStartTime);
      return isWithinInterval(sessionDate, { start: startDate, end: endOfDay });
    });
    
    const activeColumns = columns.filter(col => selectedColumns[col.id]);
    const headers = activeColumns.map(col => col.label);

    const formattedData = filteredSessions.map(session => {
      const row: Record<string, any> = {};
      
      const calculateDurationInSeconds = (type: SessionPeriod['type']) => {
        return (session.periods?.filter(p => p.type === type)
          .reduce((acc, p) => acc + (new Date(p.endTime).getTime() - new Date(p.startTime).getTime()), 0) ?? 0) / 1000;
      };
      
      const totalDurationInSeconds = (new Date(session.overallEndTime).getTime() - new Date(session.overallStartTime).getTime()) / 1000;
      const playTimeInSeconds = calculateDurationInSeconds('play');
      const playTimeInHours = playTimeInSeconds / 3600;

      activeColumns.forEach(col => {
        switch (col.id) {
          case 'date':
            row[col.label] = format(new Date(session.overallStartTime), buildDateFormatString(), { locale: ru });
            break;
          case 'sessionDateTime': {
            const startTime = new Date(session.overallStartTime);
            const endTime = new Date(session.overallEndTime);
            const datePart = format(startTime, 'd MMMM yyyy', { locale: ru });
            const startTimePart = format(startTime, 'HH:mm');
            const endTimePart = format(endTime, 'HH:mm');
            row[col.label] = `${datePart} ${startTimePart}-${endTimePart}`;
            break;
          }
          case 'totalTime':
            row[col.label] = formatDuration(totalDurationInSeconds);
            break;
          case 'playTime':
            row[col.label] = formatDuration(playTimeInSeconds);
            break;
          case 'selectTime':
            row[col.label] = formatDuration(calculateDurationInSeconds('select'));
            break;
          case 'hands':
            row[col.label] = session.handsPlayed;
            break;
          case 'handsPerHour':
            row[col.label] = playTimeInHours > 0 ? Math.round((session.handsPlayed || 0) / playTimeInHours) : 0;
            break;
          case 'notes':
            row[col.label] = session.notes;
            break;
          default:
            // You can add logic for other columns like plans here if needed
            break;
        }
      });
      return row;
    });

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
