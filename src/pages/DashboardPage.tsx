import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function DashboardPage() {
  console.log('DashboardPage rendered'); // Лог для подтверждения рендеринга компонента

  // Dummy data for demonstration
  const dailyStats = [
    { date: '20 августа среда', sessions: 3, profit: 150, duration: '3h 30m' },
    { date: '19 августа вторник', sessions: 2, profit: 80, duration: '2h 15m' },
    { date: '18 августа понедельник', sessions: 4, profit: 200, duration: '4h 00m' },
    { date: '17 августа воскресенье', sessions: 1, profit: 50, duration: '1h 00m' },
  ];

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Daily Statistics</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Sessions</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Profit</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.map((stat, index) => {
                console.log(`Rendering row for date: ${stat.date}`); // Лог для каждой строки
                return (
                  <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-800 flex items-center justify-between">
                      <span>{stat.date}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          {/* Временно изменен вариант кнопки и добавлен явный фон для отладки видимости */}
                          <Button
                            variant="default" // Изменено с "ghost"
                            size="icon"
                            className="bg-blue-500 hover:bg-blue-600 text-white" // Добавлен явный фон для отладки
                          >
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          <DropdownMenuLabel>Здесь будет форма добавления сессии</DropdownMenuLabel>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800">{stat.sessions}</td>
                    <td className="py-3 px-4 text-sm text-gray-800">${stat.profit}</td>
                    <td className="py-3 px-4 text-sm text-gray-800">{stat.duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Placeholder for other dashboard content */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Overall Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700">Total Profit</h3>
            <p className="text-3xl font-bold text-green-600">$12,345</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700">Total Sessions</h3>
            <p className="text-3xl font-bold text-blue-600">120</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-700">Average Profit/Session</h3>
            <p className="text-3xl font-bold text-purple-600">$102.88</p>
          </div>
        </div>
      </section>
    </div>
  );
}
