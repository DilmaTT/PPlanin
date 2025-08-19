import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import DataDisplay from '@/components/DataDisplay';
import { Separator } from '@/components/ui/separator';

const MainPage = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col gap-8">
        <div className="w-full">
          <DataDisplay />
        </div>

        <Separator />

        <div className="w-full">
          <AnalyticsDashboard />
        </div>
      </div>
    </div>
  );
};

export default MainPage;
