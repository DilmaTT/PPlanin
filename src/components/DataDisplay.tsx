import ListView from './ListView';
import CalendarView from './CalendarView';
import { useStorage } from '@/hooks/useStorage'; // Keep useStorage

const DataDisplay = () => {
  const { settings } = useStorage();

  const renderView = () => {
    switch (settings.view) {
      case 'list':
        return <ListView />;
      case 'calendar':
        return <CalendarView />;
      default: // Handle 'custom' or any other unexpected value by defaulting to list
        return <ListView />;
    }
  };

  return (
    <div className="w-full">
      {renderView()}
    </div>
  );
};

export default DataDisplay;
