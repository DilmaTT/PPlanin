import { useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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
import { Calendar
 } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import type { DateRange } from 'react-day-picker';
import { 
  subDays, 
  format, 
  startOfDay, 
  eachDayOfInterval, 
  endOfDay as getEndOfDay,
  startOfWeek, 
  endOfWeek,   
  startOfMonth, 
  endOfMonth    
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useStorage } from '@/hooks/useStorage';
import type { Session, SessionPeriod } from '@/types';

// Define visible columns for the UI and general export structure
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
  const { getPlanForDate, isOffDay } = useStorage();
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
  const [planRemainingFormat, setPlanRemainingFormat] = useState('hms');

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

  const handleExport = async () => {
    // 1. Determine date range
    let startDate = new Date();
    let endDate = new Date();
    const today = new Date();

    if (period === 'week') {
      startDate = startOfWeek(today, { weekStartsOn: 1 }); // Monday of current week
      endDate = endOfWeek(today, { weekStartsOn: 1 });     // Sunday of current week
    } else if (period === 'month') {
      startDate = startOfMonth(today); // First day of current month
      endDate = endOfMonth(today);     // Last day of current month
    } else if (period === 'custom' && date?.from) {
      startDate = date.from;
      endDate = date.to || date.from;
    }
    
    const dateRange = eachDayOfInterval({ start: startOfDay(startDate), end: getEndOfDay(endDate) });

    // 2. Group sessions by day for efficient lookup
    const groupedByDay: Record<string, Session[]> = sessions.reduce((acc, session) => {
      const dayKey = format(new Date(session.overallStartTime), 'yyyy-MM-dd');
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(session);
      return acc;
    }, {} as Record<string, Session[]>);

    // 3. Prepare data for ExcelJS
    const formattedData = dateRange.map(currentDate => {
      const dayKey = format(currentDate, 'yyyy-MM-dd');
      const daySessions = groupedByDay[dayKey] || [];
      const row: Record<string, any> = {}; // Use column IDs as keys for ExcelJS

      const plan = getPlanForDate(currentDate);
      const goalHours = plan?.hours || 0;
      const goalHands = plan?.hands || 0;

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

      const dateColumnFormat = buildDateFormatString();
      const formattedDate = dateColumnFormat ? format(currentDate, dateColumnFormat, { locale: ru }) : format(currentDate, 'yyyy-MM-dd', { locale: ru });

      // Populate data using column IDs as keys
      columns.forEach(col => {
        switch (col.id) {
          case 'date':
            row[col.id] = formattedDate;
            break;
          case 'sessionCount':
            row[col.id] = daySessions.length > 0 ? daySessions.length : '';
            break;
          case 'sessionDateTime': {
            if (daySessions.length === 0) {
              row[col.id] = '';
              break;
            }
            const firstSession = daySessions[0];
            const datePart = format(new Date(firstSession.overallStartTime), 'd MMMM yyyy', { locale: ru });

            if (daySessions.length === 1) {
              const startTime = new Date(firstSession.overallStartTime);
              const endTime = new Date(firstSession.overallEndTime);
              const startTimePart = format(startTime, 'HH:mm');
              const endTimePart = format(endTime, 'HH:mm');
              row[col.id] = `${datePart} ${startTimePart}-${endTimePart}`;
            } else {
              const timeRanges = daySessions.map(session => {
                const startTime = format(new Date(session.overallStartTime), 'HH:mm');
                const endTime = format(new Date(session.overallEndTime), 'HH:mm');
                return `(${startTime}-${endTime})`;
              }).join(' ');
              row[col.id] = `${datePart} ${timeRanges}`;
            }
            break;
          }
          case 'totalTime':
            row[col.id] = daySessions.length > 0 ? formatDuration(totalDurationInSeconds) : '';
            break;
          case 'playTime':
            row[col.id] = daySessions.length > 0 ? formatDuration(totalPlayTimeInSeconds) : '';
            break;
          case 'selectTime':
            row[col.id] = daySessions.length > 0 ? formatDuration(totalSelectTimeInSeconds) : '';
            break;
          case 'planHours':
            row[col.id] = goalHours > 0 ? goalHours : '';
            break;
          case 'planHands':
            row[col.id] = goalHands > 0 ? goalHands : '';
            break;
          case 'planRemaining': {
            if (goalHours > 0) {
              const remainingSeconds = (goalHours * 3600) - totalPlayTimeInSeconds;
              const sign = remainingSeconds < 0 ? '-' : ''; // Show '-' for negative
              const absSeconds = Math.abs(remainingSeconds);

              switch (planRemainingFormat) {
                case 'h': {
                  const h = Math.floor(absSeconds / 3600);
                  row[col.id] = `${sign}${h}ч`;
                  break;
                }
                case 'hm': {
                  const h = Math.floor(absSeconds / 3600);
                  const m = Math.floor((absSeconds % 3600) / 60);
                  row[col.id] = `${sign}${h}ч ${m}мин`;
                  break;
                }
                case 'hms':
                default: {
                  const h = Math.floor(absSeconds / 3600).toString().padStart(2, '0');
                  const m = Math.floor((absSeconds % 3600) / 60).toString().padStart(2, '0');
                  const s = Math.floor(absSeconds % 60).toString().padStart(2, '0');
                  row[col.id] = `${sign}${h}:${m}:${s}`;
                  break;
                }
              }
            } else {
              row[col.id] = '';
            }
            break;
          }
          case 'hands':
            row[col.id] = daySessions.length > 0 ? totalHandsPlayed : '';
            break;
          case 'handsPerHour':
            row[col.id] = totalPlayTimeInHours > 0 ? Math.round(totalHandsPlayed / totalPlayTimeInHours) : (daySessions.length > 0 ? 0 : '');
            break;
          case 'notes':
            row[col.id] = allNotes.join('; ') || (daySessions.length > 0 ? '' : '');
            break;
          default:
            break;
        }
      });

      // Add rawData column (hidden in Excel, used for logic)
      if (isOffDay(currentDate)) {
        row['rawData'] = JSON.stringify([]); // Empty array for off-days
        // For off-days, clear all other visible columns except 'date'
        columns.forEach(col => {
          if (col.id !== 'date') {
            row[col.id] = ''; // Clear other columns
          }
        });
        // Set the 'date' column to "Выходной" for off-days
        row['date'] = 'Выходной';
      } else {
        row['rawData'] = JSON.stringify(daySessions); // Full session data for active days
      }
      
      return row;
    });

    // 4. Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sessions");

    // 5. Define columns for ExcelJS
    const excelColumns = columns.filter(col => selectedColumns[col.id]).map(col => {
      let maxWidth = col.label.length; // Start with header length
      formattedData.forEach(row => {
        const cellValue = row[col.id]; // Access by ID
        if (cellValue) {
          const cellLength = String(cellValue).length;
          if (cellLength > maxWidth) {
            maxWidth = cellLength;
          }
        }
      });
      // Add three spaces padding to each header
      const paddedHeader = `   ${col.label}   `;
      return { header: paddedHeader, key: col.id, width: maxWidth + 2 + 6 }; // +6 for the 6 spaces
    });

    // Add the hidden rawData column for internal use
    excelColumns.push({ header: 'Raw Data', key: 'rawData', width: 10 });
    worksheet.columns = excelColumns;
    worksheet.getColumn('rawData').hidden = true; // Set hidden property after defining columns

    // 6. Add data to worksheet
    worksheet.addRows(formattedData);

    // 7. Apply styles
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      // Apply center alignment to all cells
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Bold headers (first row)
      if (rowNumber === 1) {
        row.font = { bold: true };
      } else {
        // Check for "Выходной" (Day Off) rows using the 'date' column value
        const dateCell = row.getCell('date'); // Access by key 'date'
        if (dateCell && dateCell.value === 'Выходной') {
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFC7CE' } // Light red background
            };
          });

          // Merge cells from the second column (B) to the last visible column
          const allDefinedColumns = worksheet.columns;
          const rawDataColumnIndex = allDefinedColumns.findIndex(col => col.key === 'rawData');
          const lastVisibleColumnIndex = rawDataColumnIndex > -1 ? rawDataColumnIndex - 1 : allDefinedColumns.length - 1;

          // Ensure there are at least two columns to merge from B and a target for merge
          if (allDefinedColumns.length >= 2 && lastVisibleColumnIndex >= 1) { 
            const firstMergeColumnLetter = allDefinedColumns[1].letter; // Column B
            const lastMergeColumnLetter = allDefinedColumns[lastVisibleColumnIndex].letter;

            worksheet.mergeCells(`${firstMergeColumnLetter}${rowNumber}:${lastMergeColumnLetter}${rowNumber}`);
          }
        }
      }
    });

    // 8. Generate and download the file
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'poker-sessions.xlsx');
    } catch (error) {
      console.error("Error exporting Excel file:", error);
      // Optionally, show a user-friendly error message
    }

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
                  {column.id === 'planRemaining' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4">
                        <div className="grid gap-4">
                          <div className="space-y-1">
                            <h4 className="font-medium leading-none">Формат времени</h4>
                            <p className="text-sm text-muted-foreground">
                              Выберите, как отображать оставшееся время.
                            </p>
                          </div>
                          <RadioGroup value={planRemainingFormat} onValueChange={setPlanRemainingFormat} defaultValue="hms">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="h" id="fmt-h" />
                              <Label htmlFor="fmt-h">Часы (например, 6ч)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="hm" id="fmt-hm" />
                              <Label htmlFor="fmt-hm">Часы и минуты (например, 6ч 15мин)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="hms" id="fmt-hms" />
                              <Label htmlFor="fmt-hms">Полный формат (05:00:00)</Label>
                            </div>
                          </RadioGroup>
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
                  weekStartsOn={1}
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
