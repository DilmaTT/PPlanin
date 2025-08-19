import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import DataDisplay from '@/components/DataDisplay';
import ExportButton from '@/components/ExportButton';
import { Separator } from '@/components/ui/separator';

const MainPage = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col gap-8">
        <div className="w-full">
          <div className="flex justify-end mb-4">
            <ExportButton />
          </div>
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
