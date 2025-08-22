import { useState } from 'react';
import { utils, write } from 'xlsx';
import { format, differenceInMilliseconds } from 'date-fns';
import { saveExportFile } from '@/lib/tauriApi';
import { useToast } from '@/hooks/use-toast';
import { Session } from '@/types';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExportSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
}

export const ExportSessionsModal = ({ isOpen, onClose, sessions }: ExportSessionsModalProps) => {
  const { toast } = useToast();
  const [fileName, setFileName] = useState(`poker_sessions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

  const handleExport = async () => {
    if (sessions.length === 0) {
      toast({
        title: 'Нет данных для экспорта',
        description: 'Не создано ни одной сессии.',
        variant: 'destructive',
      });
      return;
    }

    try {
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

        const toHours = (ms: number) => parseFloat((ms / (1000 * 60 * 60)).toFixed(3));

        return {
          'Дата': format(new Date(session.overallStartTime), 'yyyy-MM-dd HH:mm:ss'),
          'Общее время (ч)': toHours(totalDurationMs),
          'Время игры (ч)': toHours(playDurationMs),
          'Время селекта (ч)': toHours(selectDurationMs),
          'Количество рук': session.handsPlayed,
          'Заметки': session.notes,
          'Raw Data': JSON.stringify([session]), // Store raw data for re-import
        };
      });

      const worksheet = utils.json_to_sheet(dataToExport);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, 'Сессии');

      worksheet['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 22 },
        { wch: 18 }, { wch: 50 }, { wch: 50 },
      ];

      const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Uint8Array(excelBuffer);

      const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
      await saveExportFile(data, finalFileName);

      toast({
        title: 'Экспорт успешен!',
        description: `Данные сессий сохранены в файл ${finalFileName}.`,
      });
      onClose();
    } catch (error) {
      console.error('Failed to export sessions:', error);
      toast({
        title: 'Ошибка экспорта',
        description: 'Не удалось сохранить файл. Попробуйте еще раз.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Экспорт сессий в XLSX</DialogTitle>
          <DialogDescription>
            Введите имя файла для сохранения отчета.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filename" className="text-right">
              Имя файла
            </Label>
            <Input
              id="filename"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleExport}>Экспортировать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
