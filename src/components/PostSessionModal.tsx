import { useState, useEffect, useMemo } from 'react';
import { useStorage } from '@/hooks/useStorage';
import type { Session } from '@/types';
import { formatSeconds } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

interface PostSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Omit<Session, 'id' | 'notes' | 'handsPlayed'> | null;
}

const PostSessionModal = ({ isOpen, onClose, session }: PostSessionModalProps) => {
  const { settings, addSession } = useStorage();
  const [notes, setNotes] = useState('');
  const [handsPlayed, setHandsPlayed] = useState('');

  useEffect(() => {
    // Reset form fields when the modal becomes visible
    if (isOpen) {
      setNotes('');
      setHandsPlayed('');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!session) return;

    const handsPlayedNumber = parseInt(handsPlayed, 10);

    const finalSession: Omit<Session, 'id'> = {
      ...session,
      notes: notes,
      handsPlayed: isNaN(handsPlayedNumber) ? 0 : handsPlayedNumber,
    };

    addSession(finalSession);
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const sessionStats = useMemo(() => {
    if (!session) return null;

    const totalTime = session.overallDuration || 0;
    let playingTime = 0;
    let selectTime = 0;

    if (settings.splitPeriods && session.periods) {
      session.periods.forEach(p => {
        const duration = (new Date(p.endTime).getTime() - new Date(p.startTime).getTime()) / 1000;
        if (p.type === 'play') {
          playingTime += duration;
        } else if (p.type === 'select') {
          selectTime += duration;
        }
      });
    }

    return {
      totalTime,
      playingTime,
      selectTime,
    };
  }, [session, settings.splitPeriods]);

  if (!session || !sessionStats) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Сессия завершена</DialogTitle>
          <DialogDescription>
            Добавьте детали к вашей сессии. Нажмите 'Сохранить', когда закончите.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4 border-b">
          <h4 className="font-medium text-sm text-muted-foreground">Статистика сессии</h4>
          <div className="flex justify-between items-center">
            <p>Общее время:</p>
            <p className="font-semibold">{formatSeconds(sessionStats.totalTime)}</p>
          </div>
          {settings.splitPeriods && (
            <>
              <div className="flex justify-between items-center">
                <p>Время игры:</p>
                <p className="font-semibold">{formatSeconds(sessionStats.playingTime)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p>Время селекта:</p>
                <p className="font-semibold">{formatSeconds(sessionStats.selectTime)}</p>
              </div>
            </>
          )}
        </div>

        <div className="grid gap-4 py-4">
          {settings.showNotes && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Заметки
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="col-span-3"
                placeholder="Какие-либо мысли о сессии?"
              />
            </div>
          )}
          {settings.showHandsPlayed && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="hands" className="text-right">
                Сыграно рук
              </Label>
              <Input
                id="hands"
                type="number"
                value={handsPlayed}
                onChange={(e) => setHandsPlayed(e.target.value)}
                className="col-span-3"
                placeholder="например, 150"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
          <Button type="submit" onClick={handleSave}>Сохранить сессию</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PostSessionModal;
