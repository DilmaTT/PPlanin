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
    import { Calendar } from '@/components/ui/calendar';
    import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
    import { Label } from '@/components/ui/label';
    import { Switch } from '@/components/ui/switch';
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
      { id: 'sessionDateTime', label: 'Дата сессий' },
      { id: 'sessionCount', label: 'Кол-во сессий' },
      { id: 'totalTime', label: 'Общее время' },
      { id: 'planHours', label: 'План (часы)' },
      { id: 'planRemaining', label: 'Осталось по плану' },
      { id: 'playTime', label: 'Время игры' },
      { id: 'selectTime', label: 'Время селекта' },
      { id: 'hands', label: 'Руки' },
      { id: 'planHands', label: 'План (руки)' },
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

    // Helper function to format seconds into Xч Yмин
    const formatSecondsToHM = (seconds: number) => {
      if (isNaN(seconds) || seconds === 0) {
        return '0ч 0мин';
      }
      const sign = seconds < 0 ? '-' : '';
      const absSeconds = Math.abs(seconds);
      const h = Math.floor(absSeconds / 3600);
      const m = Math.floor((absSeconds % 3600) / 60);
      return `${sign}${h}ч ${m}мин`;
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
      const [planRemainingFormat, setPlanRemainingFormat] = useState('hm');
      const [showTotals, setShowTotals] = useState(true);

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
          startDate = startOfWeek(today, { weekStartsOn: 1 });
          endDate = endOfWeek(today, { weekStartsOn: 1 });
        } else if (period === 'month') {
          startDate = startOfMonth(today);
          endDate = endOfMonth(today);
        } else if (period === 'custom' && date?.from) {
          startDate = date.from;
          endDate = date.to || date.from;
        }

        const dateRange = eachDayOfInterval({ start: startOfDay(startDate), end: getEndOfDay(endDate) });

        // 2. Group sessions by day
        const groupedByDay: Record<string, Session[]> = sessions.reduce((acc, session) => {
          const dayKey = format(new Date(session.overallStartTime), 'yyyy-MM-dd');
          if (!acc[dayKey]) acc[dayKey] = [];
          acc[dayKey].push(session);
          return acc;
        }, {} as Record<string, Session[]>);

        // 3. Prepare data for ExcelJS, including raw data for calculations
        const formattedData = dateRange.map(currentDate => {
          const dayKey = format(currentDate, 'yyyy-MM-dd');
          const daySessions = groupedByDay[dayKey] || [];
          const row: Record<string, any> = {};

          const plan = getPlanForDate(currentDate);
          const goalHours = plan?.hours || 0;
          const goalHands = plan?.hands || 0;

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

          // Populate formatted data for display
          columns.forEach(col => {
            // ... (switch case for each column)
            switch (col.id) {
              case 'date': row[col.id] = formattedDate; break;
              case 'sessionCount': row[col.id] = daySessions.length > 0 ? daySessions.length : ''; break;
              case 'sessionDateTime': {
                if (daySessions.length === 0) { row[col.id] = ''; break; }
                const firstSession = daySessions[0];
                const datePart = format(new Date(firstSession.overallStartTime), 'd MMMM yyyy', { locale: ru });
                if (daySessions.length === 1) {
                  const startTime = format(new Date(firstSession.overallStartTime), 'HH:mm');
                  const endTime = format(new Date(firstSession.overallEndTime), 'HH:mm');
                  row[col.id] = `${datePart} ${startTime}-${endTime}`;
                } else {
                  const timeRanges = daySessions.map(s => `(${format(new Date(s.overallStartTime), 'HH:mm')}-${format(new Date(s.overallEndTime), 'HH:mm')})`).join(' ');
                  row[col.id] = `${datePart} ${timeRanges}`;
                }
                break;
              }
              case 'totalTime': row[col.id] = daySessions.length > 0 ? formatDuration(totalDurationInSeconds) : ''; break;
              case 'playTime': row[col.id] = daySessions.length > 0 ? formatDuration(totalPlayTimeInSeconds) : ''; break;
              case 'selectTime': row[col.id] = daySessions.length > 0 ? formatDuration(totalSelectTimeInSeconds) : ''; break;
              case 'planHours': row[col.id] = goalHours > 0 ? goalHours : ''; break;
              case 'planHands': row[col.id] = goalHands > 0 ? goalHands : ''; break;
              case 'planRemaining': {
                if (goalHours > 0) {
                  const remainingSeconds = (goalHours * 3600) - totalPlayTimeInSeconds;
                  const sign = remainingSeconds < 0 ? '-' : '';
                  const absSeconds = Math.abs(remainingSeconds);
                  switch (planRemainingFormat) {
                    case 'h': row[col.id] = `${sign}${Math.floor(absSeconds / 3600)}ч`; break;
                    case 'hm': row[col.id] = `${sign}${Math.floor(absSeconds / 3600)}ч ${Math.floor((absSeconds % 3600) / 60)}мин`; break;
                    case 'hms': default: row[col.id] = `${sign}${formatDuration(absSeconds)}`; break;
                  }
                } else { row[col.id] = ''; }
                break;
              }
              case 'hands': row[col.id] = daySessions.length > 0 ? totalHandsPlayed : ''; break;
              case 'handsPerHour': row[col.id] = totalPlayTimeInHours > 0 ? Math.round(totalHandsPlayed / totalPlayTimeInHours) : (daySessions.length > 0 ? 0 : ''); break;
              case 'notes': row[col.id] = allNotes.join('; ') || (daySessions.length > 0 ? '' : ''); break;
            }
          });

          // Attach raw data for totals calculation
          row._raw = {
            isOffDay: isOffDay(currentDate),
            sessionCount: daySessions.length,
            totalDurationInSeconds,
            totalPlayTimeInSeconds,
            totalSelectTimeInSeconds,
            goalHours,
            goalHands,
            remainingSeconds: goalHours > 0 ? (goalHours * 3600) - totalPlayTimeInSeconds : 0,
            totalHandsPlayed,
            handsPerHour: totalPlayTimeInHours > 0 ? (totalHandsPlayed / totalPlayTimeInHours) : 0,
          };

          if (row._raw.isOffDay) {
            row['rawData'] = 'IS_OFF_DAY';
            let isSecondColumn = true;
            columns.forEach(col => {
              if (col.id !== 'date') {
                row[col.id] = isSecondColumn ? 'Выходной' : '';
                isSecondColumn = false;
              }
            });
          } else {
            row['rawData'] = JSON.stringify(daySessions);
          }

          return row;
        });

        // 4. Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sessions");

        // 5. Define columns for ExcelJS, calculating width dynamically
        const excelColumns = columns.filter(col => selectedColumns[col.id]).map(col => {
          let maxWidth = col.label.length; // Start with header length
          formattedData.forEach(row => {
            const cellValue = row[col.id];
            if (cellValue) {
              const cellLength = String(cellValue).length;
              if (cellLength > maxWidth) maxWidth = cellLength;
            }
          });
          return { header: `  ${col.label}  `, key: col.id, width: maxWidth + 2 };
        });

        excelColumns.push({ header: 'Raw Data', key: 'rawData', width: 10 });
        worksheet.columns = excelColumns;
        worksheet.getColumn('rawData').hidden = true;

        // 6. Add data to worksheet
        worksheet.addRows(formattedData);

        // 7. Calculate and add totals if enabled
        if (showTotals) {
          const playingDaysData = formattedData.filter(row => !row._raw.isOffDay);
          const playingDaysCount = playingDaysData.length;

          if (playingDaysCount > 0) {
            const totals = playingDaysData.reduce((acc, row) => {
              acc.sessionCount += row._raw.sessionCount;
              acc.totalTime += row._raw.totalDurationInSeconds;
              acc.planHours += row._raw.goalHours;
              acc.planRemaining += row._raw.remainingSeconds;
              acc.playTime += row._raw.totalPlayTimeInSeconds;
              acc.selectTime += row._raw.totalSelectTimeInSeconds;
              acc.hands += row._raw.totalHandsPlayed;
              acc.planHands += row._raw.goalHands;
              // Only sum hands/hr for days with actual play time to avoid skewing the average
              if (row._raw.totalPlayTimeInSeconds > 0) {
                acc.handsPerHourSum += row._raw.handsPerHour;
                acc.daysWithPlayTime++;
              }
              return acc;
            }, {
              sessionCount: 0, totalTime: 0, planHours: 0, planRemaining: 0, playTime: 0,
              selectTime: 0, hands: 0, planHands: 0, handsPerHourSum: 0, daysWithPlayTime: 0
            });

            const avgHandsPerHour = totals.daysWithPlayTime > 0 ? Math.round(totals.handsPerHourSum / totals.daysWithPlayTime) : 0;

            const totalsRowData = {
              date: playingDaysCount,
              sessionCount: totals.sessionCount,
              totalTime: formatSecondsToHM(totals.totalTime),
              planHours: totals.planHours > 0 ? totals.planHours : '',
              planRemaining: formatSecondsToHM(totals.planRemaining),
              playTime: formatSecondsToHM(totals.playTime),
              selectTime: formatSecondsToHM(totals.selectTime),
              hands: totals.hands,
              planHands: totals.planHands > 0 ? totals.planHands : '',
              handsPerHour: avgHandsPerHour,
            };

            const descriptionRowData = {
              date: 'Кол-во игровых дней',
              sessionCount: 'Общ. кол-во сессий',
              totalTime: 'общее время',
              planHours: 'часов по плану',
              planRemaining: 'осталось по плану',
              playTime: 'Общ. время игры',
              selectTime: 'Общ. время селекта',
              hands: 'Всего рук',
              planHands: 'Кол-во рук по плану',
              handsPerHour: 'среднее рук/час',
            };

            worksheet.addRow([]); // Spacer row
            const totalsRow = worksheet.addRow(totalsRowData);
            totalsRow.font = { bold: true };
            totalsRow.eachCell({ includeEmpty: true }, cell => cell.alignment = { vertical: 'middle', horizontal: 'center' });

            const descriptionRow = worksheet.addRow(descriptionRowData);
            descriptionRow.font = { italic: true, color: { argb: 'FF666666' } };
            descriptionRow.eachCell({ includeEmpty: true }, cell => cell.alignment = { vertical: 'middle', horizontal: 'center' });
          }
        }

        // 8. Apply styles to data rows
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          if (rowNumber > worksheet.rowCount - (showTotals ? 3 : 0)) return; // Skip total rows

          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          });

          if (rowNumber === 1) {
            row.font = { bold: true };
          } else {
            const rawDataCell = row.getCell('rawData');
            if (rawDataCell && rawDataCell.value === 'IS_OFF_DAY') {
              const visibleColumns = worksheet.columns.filter(c => !c.hidden);
              for (let i = 2; i <= visibleColumns.length; i++) {
                const cell = row.getCell(i);
                if (cell) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ffe3ea' } };
                }
              }
              if (visibleColumns.length > 1) {
                worksheet.mergeCells(`${visibleColumns[1].letter}${rowNumber}:${visibleColumns[visibleColumns.length - 1].letter}${rowNumber}`);
              }
            }
          }
        });

        // 9. Generate and download the file
        try {
          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          saveAs(blob, 'poker-sessions.xlsx');
        } catch (error) {
          console.error("Error exporting Excel file:", error);
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
                                  <Checkbox id="showDayNumber" checked={dateFormat.showDayNumber} onCheckedChange={(c) => handleDateFormatChange('showDayNumber', !!c)} />
                                  <Label htmlFor="showDayNumber">Показывать число</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="showDayOfWeek" checked={dateFormat.showDayOfWeek} onCheckedChange={(c) => handleDateFormatChange('showDayOfWeek', !!c)} />
                                  <Label htmlFor="showDayOfWeek">Показывать день недели</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="showMonth" checked={dateFormat.showMonth} onCheckedChange={(c) => handleDateFormatChange('showMonth', !!c)} />
                                  <Label htmlFor="showMonth">Показывать месяц</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="showYear" checked={dateFormat.showYear} onCheckedChange={(c) => handleDateFormatChange('showYear', !!c)} />
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
                              <RadioGroup value={planRemainingFormat} onValueChange={setPlanRemainingFormat} defaultValue="hm">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="h" id="fmt-h" />
                                  <Label htmlFor="fmt-h" className="cursor-pointer">Часы (например, 6ч)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="hm" id="fmt-hm" />
                                  <Label htmlFor="fmt-hm" className="cursor-pointer">Часы и минуты (например, 6ч 15мин)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="hms" id="fmt-hms" />
                                  <Label htmlFor="fmt-hms" className="cursor-pointer">Полный формат (05:00:00)</Label>
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
              <div className="border-t pt-6">
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
              <div className="flex items-center space-x-2 pt-6 border-t">
                <Switch id="show-totals" checked={showTotals} onCheckedChange={setShowTotals} />
                <Label htmlFor="show-totals">Показывать общие данные</Label>
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
