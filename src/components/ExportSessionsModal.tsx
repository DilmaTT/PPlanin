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

  const handleExport = () => {
    // 1. Gather settings
    const activeColumns = columns.filter(col => selectedColumns[col.id]);
    // Add the rawData column internally for export, it will be hidden later
    const allExportColumns = [...activeColumns, { id: 'rawData', label: 'Raw Data' }];
    const headers = allExportColumns.map(col => col.label);

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

      // Populate visible columns
      activeColumns.forEach(col => {
        switch (col.id) {
          case 'date':
            row[col.label] = formattedDate;
            break;
          case 'sessionCount':
            row[col.label] = daySessions.length;
            break;
          case 'sessionDateTime': {
            if (daySessions.length === 0) {
              row[col.label] = '-';
              break;
            }
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
            row[col.label] = daySessions.length > 0 ? formatDuration(totalDurationInSeconds) : '-';
            break;
          case 'playTime':
            row[col.label] = daySessions.length > 0 ? formatDuration(totalPlayTimeInSeconds) : '-';
            break;
          case 'selectTime':
            row[col.label] = daySessions.length > 0 ? formatDuration(totalSelectTimeInSeconds) : '-';
            break;
          case 'planHours':
            row[col.label] = goalHours > 0 ? goalHours : '-';
            break;
          case 'planHands':
            row[col.label] = goalHands > 0 ? goalHands : '-';
            break;
          case 'planRemaining': {
            if (goalHours > 0) {
              const remainingSeconds = (goalHours * 3600) - totalPlayTimeInSeconds;
              const sign = remainingSeconds < 0 ? '-' : '';
              const absSeconds = Math.abs(remainingSeconds);

              switch (planRemainingFormat) {
                case 'h': {
                  const h = Math.floor(absSeconds / 3600);
                  row[col.label] = `${sign}${h}ч`;
                  break;
                }
                case 'hm': {
                  const h = Math.floor(absSeconds / 3600);
                  const m = Math.floor((absSeconds % 3600) / 60);
                  row[col.label] = `${sign}${h}ч ${m}мин`;
                  break;
                }
                case 'hms':
                default: {
                  const h = Math.floor(absSeconds / 3600).toString().padStart(2, '0');
                  const m = Math.floor((absSeconds % 3600) / 60).toString().padStart(2, '0');
                  const s = Math.floor(absSeconds % 60).toString().padStart(2, '0');
                  row[col.label] = `${sign}${h}:${m}:${s}`;
                  break;
                }
              }
            } else {
              row[col.label] = '-';
            }
            break;
          }
          case 'hands':
            row[col.label] = daySessions.length > 0 ? totalHandsPlayed : '-';
            break;
          case 'handsPerHour':
            row[col.label] = totalPlayTimeInHours > 0 ? Math.round(totalHandsPlayed / totalPlayTimeInHours) : (daySessions.length > 0 ? 0 : '-');
            break;
          case 'notes':
            row[col.label] = allNotes.join('; ') || (daySessions.length > 0 ? '' : '-');
            break;
          default:
            break;
        }
      });

      // Add rawData column
      if (isOffDay(currentDate)) {
        row['Raw Data'] = JSON.stringify([]); // Empty array for off-days
        // For off-days, clear all other visible columns except 'Дата'
        activeColumns.forEach(col => {
          if (col.id !== 'date') {
            row[col.label] = ''; // Clear other columns, will be merged and overwritten by "Выходной"
          }
        });
      } else {
        row['Raw Data'] = JSON.stringify(daySessions); // Full session data for active days
      }
      
      return row;
    });

    // 5. Create XLSX-sheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData, { header: headers });

    // 6. Format XLSX-sheet
    // Auto-fit column widths for ALL columns (including rawData)
    const colWidths = allExportColumns.map(col => {
      let maxWidth = col.label.length; // Start with header length
      formattedData.forEach(row => {
        const cellValue = row[col.label];
        if (cellValue) {
          const cellLength = String(cellValue).length;
          if (cellLength > maxWidth) {
            maxWidth = cellLength;
          }
        }
      });

      // Create the base object with the wch property.
      const colDef: { wch: number; hidden?: boolean } = { wch: maxWidth + 2 };

      // Conditionally add the hidden property for the rawData column.
      if (col.id === 'rawData') {
        colDef.hidden = true;
      }

      return colDef;
    });

    worksheet['!cols'] = colWidths;

    // Styling and Merging for Off Days
    const range = XLSX.utils.decode_range(worksheet['!ref'] as string);
    worksheet['!merges'] = worksheet['!merges'] || [];

    const offDayStyle = {
      fill: { fgColor: { rgb: "FFC7CE" } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const regularStyle = {
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const headerStyle = {
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    // Style Header
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: range.s.r });
        const cell = worksheet[cell_ref];
        if (cell) {
            cell.s = headerStyle;
        }
    }

    // Style Data Rows
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const currentDate = dateRange[R - 1];

      if (isOffDay(currentDate)) {
        // Merge all visible cells from the second column to the last visible column
        // The first column is 'Дата' (index 0). The second visible column is index 1.
        // The last visible column is at index `activeColumns.length - 1`.
        if (activeColumns.length > 1) { // Ensure there's at least one column to merge after 'Дата'
            worksheet['!merges'].push({ s: { r: R, c: 1 }, e: { r: R, c: activeColumns.length - 1 } });
        }

        for (let C = range.s.c; C <= range.e.c; ++C) { // Iterate through all columns in the sheet
          const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
          const cell = worksheet[cell_ref] || (worksheet[cell_ref] = {});
          cell.s = offDayStyle;

          if (C === 1) { // This is the start of the merged block for visible columns
            cell.v = 'Выходной';
            cell.t = 's';
          } else if (C > 1 && C <= activeColumns.length - 1) { // Other cells within the visible merged range
            delete cell.v; // Clear content
          } else if (C === allExportColumns.findIndex(col => col.id === 'rawData')) {
            // This is the rawData column, its content is already set, and it will be hidden.
            // No need to modify its value or type here.
          } else if (C === 0) { // This is the 'Дата' column
            // Its value is already set in formattedData, just apply style
          }
        }
      } else {
        // Apply regular style to all visible cells and the rawData column
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
          const cell = worksheet[cell_ref];
          if (cell) {
            cell.s = regularStyle;
          }
        }
      }
    }

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
