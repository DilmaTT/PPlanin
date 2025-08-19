import { useState } from 'react';
import * as XLSX from 'xlsx';
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
import type { DateRange } from 'react-day-picker';
import { subDays, subMonths, format, isWithinInterval } from 'date-fns';
import type { Session, SessionPeriod } from '@/types';

const columns = [
  { id: 'date', label: 'Дата' },
  { id: 'sessionCount', label: 'Кол-во сессий' },
  { id: 'totalTime', label: 'Общее время' },
  { id: 'playTime', label: 'Время игры' },
  { id: 'selectTime', label: 'Время селекта' },
  { id: 'planHours', label: 'План (часы)' },
  { id: 'planHands', label: 'План (руки)' },
  { id: 'planRemaining', label: 'Осталось по плану' },
  { id: 'hands', label: 'Руки' },
  { id: 'handsPerHour', label: 'Рук/час' },
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

  const handleColumnChange = (columnId: string, checked: boolean) => {
    setSelectedColumns((prev) => ({ ...prev, [columnId]: checked }));
  };

  const handleExport = () => {
    console.log('Шаг 1: Получено сессий:', sessions);

    // Step 1: Define the date range for filtering
    let startDate: Date | undefined;
    let endDate: Date | undefined = new Date();

    if (period === 'week') {
      startDate = subDays(new Date(), 7);
    } else if (period === 'month') {
      startDate = subMonths(new Date(), 1);
    } else if (period === 'custom' && date?.from) {
      startDate = date.from;
      endDate = date.to || date.from; // Use 'to' if available, otherwise it's a single day
    }

    // Step 2: Filter sessions based on the date range
    const filteredSessions = sessions.filter(session => {
      if (!startDate || !endDate) return true; // If no range, include all
      const sessionDate = new Date(session.overallStartTime);
      // Set time to end of day for endDate to include all sessions on that day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      return isWithinInterval(sessionDate, { start: startDate, end: endOfDay });
    });
    console.log('Шаг 2: Отфильтрованные сессии:', filteredSessions);

    // Step 3: Format data for export based on selected columns
    const activeColumns = columns.filter(col => selectedColumns[col.id]);

    const formattedData = filteredSessions.map(session => {
      const row: Record<string, any> = {};
      
      const calculateTimeForType = (type: SessionPeriod['type']) => {
        return session.periods?.filter(p => p.type === type).reduce((acc, p) => {
            if (p.startTime && p.endTime) {
                return acc + (new Date(p.endTime).getTime() - new Date(p.startTime).getTime());
            }
            return acc;
        }, 0) ?? 0;
      };

      activeColumns.forEach(col => {
        switch (col.id) {
          case 'date':
            row[col.label] = format(new Date(session.overallStartTime), 'yyyy-MM-dd HH:mm');
            break;
          case 'sessionCount':
            row[col.label] = 1;
            break;
          case 'totalTime':
            row[col.label] = formatDuration(session.overallDuration);
            break;
          case 'playTime':
            row[col.label] = formatDuration(calculateTimeForType('play') / 1000);
            break;
          case 'selectTime':
             row[col.label] = formatDuration(calculateTimeForType('select') / 1000);
            break;
          case 'planHours':
            row[col.label] = 'N/A';
            break;
          case 'planHands':
            row[col.label] = 'N/A';
            break;
          case 'planRemaining':
            row[col.label] = 'N/A';
            break;
          case 'hands':
            row[col.label] = session.overallHandsPlayed;
            break;
          case 'handsPerHour':
            const playTimeMs = calculateTimeForType('play');
            const playTimeHours = playTimeMs / (1000 * 60 * 60);
            row[col.label] = playTimeHours > 0 ? Math.round(session.overallHandsPlayed / playTimeHours) : 0;
            break;
          default:
            row[col.label] = '';
        }
      });
      return row;
    });

    console.log('Шаг 3: Данные для экспорта:', formattedData);

    if (formattedData.length === 0) {
        console.log("Нет данных для экспорта за выбранный период.");
        onClose();
        return;
    }

    // Step 4: Create and download the Excel file
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sessions");

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });

    // Create a temporary link and trigger download
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
          <DialogTitle>Настройки экспорта сессий</DialogTitle>
          <DialogDescription>
            Выберите колонки и период для формирования отчета.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <h4 className="font-medium mb-4 text-foreground">Выбор колонок</h4>
            <div className="grid grid-cols-2 gap-4">
              {columns.map((column) => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.id}
                    checked={selectedColumns[column.id]}
                    onCheckedChange={(checked) => handleColumnChange(column.id, !!checked)}
                  />
                  <label
                    htmlFor={column.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-4 text-foreground">Период экспорта</h4>
            <RadioGroup defaultValue="week" value={period} onValueChange={setPeriod}>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="week" id="r1" />
                <label htmlFor="r1" className="cursor-pointer">За неделю</label>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="month" id="r2" />
                <label htmlFor="r2" className="cursor-pointer">За месяц</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="r3" />
                <label htmlFor="r3" className="cursor-pointer">Свой вариант</label>
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
