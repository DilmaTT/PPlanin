import { useState, useEffect } from 'react';
import { useStorage } from '@/hooks/useStorage';
import type { Session } from '@/types';
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
  session: Session | null;
}

const PostSessionModal = ({ isOpen, onClose, session }: PostSessionModalProps) => {
  const { settings, updateSession } = useStorage();
  const [notes, setNotes] = useState('');
  const [handsPlayed, setHandsPlayed] = useState('');

  useEffect(() => {
    if (session) {
      setNotes(session.notes || '');
      setHandsPlayed(session.handsPlayed > 0 ? String(session.handsPlayed) : '');
    }
  }, [session]);

  const handleSave = () => {
    if (!session) return;

    const handsPlayedNumber = parseInt(handsPlayed, 10);
    
    updateSession(session.id, {
      notes,
      handsPlayed: isNaN(handsPlayedNumber) ? 0 : handsPlayedNumber,
    });

    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  if (!session) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Сессия завершена</DialogTitle>
          <DialogDescription>
            Добавьте детали к вашей сессии. Нажмите 'Сохранить', когда закончите.
          </DialogDescription>
        </DialogHeader>
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
