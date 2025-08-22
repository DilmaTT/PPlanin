import { useStorage } from '@/hooks/useStorage';
import { useSession } from '@/context/SessionContext';
import { Button } from './ui/button';
import { Play, Square, Hand, BrainCircuit } from 'lucide-react';

interface SessionManagerProps {
  // No props needed as SessionContext handles completion
}

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const SessionManager = ({}: SessionManagerProps) => {
  const { settings } = useStorage();
  const {
    activeSession,
    elapsedTime,
    currentPeriodType,
    startSession,
    stopSession,
    togglePeriod,
  } = useSession();

  const handleStart = () => {
    startSession();
  };

  const handleStop = () => {
    console.log('Шаг 1: Кнопка "Остановить" нажата');
    stopSession();
  };

  const handleTogglePeriod = (newType: 'play' | 'select') => {
    togglePeriod(newType);
  };

  return (
    <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Трекер сессий</h2>
      <div className="text-6xl font-mono text-center mb-6 tabular-nums">
        {formatTime(elapsedTime)}
      </div>
      <div className="flex flex-col gap-4">
        {!activeSession ? (
          <Button onClick={handleStart} size="lg" className="w-full">
            <Play className="mr-2 h-5 w-5" /> Начать сессию
          </Button>
        ) : (
          <>
            {settings.splitPeriods && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleTogglePeriod('select')}
                  variant={currentPeriodType === 'select' ? 'secondary' : 'outline'}
                >
                  <BrainCircuit className="mr-2 h-4 w-4" /> Селект
                </Button>
                <Button
                  onClick={() => handleTogglePeriod('play')}
                  variant={currentPeriodType === 'play' ? 'secondary' : 'outline'}
                >
                  <Hand className="mr-2 h-4 w-4" /> Игра
                </Button>
              </div>
            )}
            <Button onClick={handleStop} variant="destructive" size="lg" className="w-full">
              <Square className="mr-2 h-5 w-5" /> Остановить сессию
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionManager;
