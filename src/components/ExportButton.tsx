import { utils, writeFile } from 'xlsx';
import { format, differenceInMilliseconds } from 'date-fns';
import { Download } from 'lucide-react';

import { useStorage } from '@/hooks/useStorage';
import { Button } from '@/components/ui/button';

const ExportButton = () => {
  const { sessions } = useStorage();

  const handleExport = () => {
    if (sessions.length === 0) {
      alert("Нет данных для экспорта.");
      return;
    }

    const dataToExport = sessions.map(session => {
      const totalDurationMs = differenceInMilliseconds(
        new Date(session.overallEndTime),
        new Date(session.overallStartTime)
      );

      const playDurationMs = (session.periods || [])
        .filter(p => p.type === 'play')
        .reduce((sum, p) => sum + differenceInMilliseconds(new Date(p.endTime), new Date(p.startTime)), 0);

      const selectDurationMs = (session.periods || [])
        .filter(p => p.type === 'select')
        .reduce((sum, p) => sum + differenceInMilliseconds(new Date(p.endTime), new Date(p.startTime)), 0);

      const toHours = (ms: number) => parseFloat((ms / (1000 * 60 * 60)).toFixed(2));

      return {
        'Дата': format(new Date(session.overallStartTime), 'yyyy-MM-dd HH:mm:ss'),
        'Общее время (ч)': toHours(totalDurationMs),
        'Время игры (ч)': toHours(playDurationMs),
        'Время селекта (ч)': toHours(selectDurationMs),
        'Количество рук': session.handsPlayed,
        'Заметки': session.notes,
      };
    });

    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Сессии');

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 20 }, // Дата
      { wch: 20 }, // Общее время (ч)
      { wch: 20 }, // Время игры (ч)
      { wch: 22 }, // Время селекта (ч)
      { wch: 18 }, // Количество рук
      { wch: 50 }, // Заметки
    ];

    writeFile(workbook, 'poker_sessions_report.xlsx');
  };

  return (
    <Button onClick={handleExport} disabled={sessions.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      Экспорт в XLSX
    </Button>
  );
};

export default ExportButton;
