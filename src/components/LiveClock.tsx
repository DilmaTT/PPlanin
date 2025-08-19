import { useState, useEffect } from 'react';

const LiveClock = () => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
    };

    updateClock(); // Set initial time immediately
    const intervalId = setInterval(updateClock, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  return (
    <div className="text-center text-2xl font-bold text-primary mb-4">
      {time}
    </div>
  );
};

export default LiveClock;
