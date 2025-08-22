import { useEffect } from 'react';
import SessionManager from '@/components/SessionManager';
import PostSessionModal from '@/components/PostSessionModal';
import LiveClock from '@/components/LiveClock';
import TodayStats from '@/components/TodayStats';
import { useStorage } from '@/hooks/useStorage';
import { useSession } from '@/context/SessionContext';

const SessionPage = () => {
  const { settings } = useStorage();
  const { completedSession, clearCompletedSession } = useSession();

  useEffect(() => {
    if (completedSession) {
      // Modal will open automatically because completedSession is not null
    }
  }, [completedSession]);

  const handleCloseModal = () => {
    clearCompletedSession();
  };

  return (
    <>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            {settings.showLiveClock && <LiveClock />}
            {settings.showTodayStats && <TodayStats />}
            <SessionManager />
          </div>
        </div>
      </div>
      <PostSessionModal
        isOpen={!!completedSession}
        onClose={handleCloseModal}
        session={completedSession}
      />
    </>
  );
};

export default SessionPage;
