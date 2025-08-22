import { useMemo } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { differenceInMilliseconds, format, subDays, isAfter } from 'date-fns';

import { useStorage } from '@/hooks/useStorage';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AnalyticsDashboard = () => {
  const { sessions } = useStorage();

  const { dailyData, timeRatioData } = useMemo(() => {
    if (!sessions || sessions.length === 0) {
      return { dailyData: [], timeRatioData: [] };
    }

    const thirtyDaysAgo = subDays(new Date(), 30);

    // Filter sessions for the last 30 days for the daily chart
    const recentSessions = sessions.filter((session) =>
      isAfter(new Date(session.overallStartTime), thirtyDaysAgo)
    );

    // Process data for daily hours (line chart)
    const dailyHours = recentSessions.reduce((acc, session) => {
      const date = format(new Date(session.overallStartTime), 'yyyy-MM-dd');
      const playDuration = (session.periods || [])
        .filter((p) => p.type === 'play')
        .reduce((sum, p) => {
          const start = new Date(p.startTime);
          const end = new Date(p.endTime);
          return sum + differenceInMilliseconds(end, start);
        }, 0);

      const hours = playDuration / (1000 * 60 * 60);
      acc[date] = (acc[date] || 0) + hours;
      return acc;
    }, {} as Record<string, number>);

    const sortedDailyData = Object.entries(dailyHours)
      .map(([date, hours]) => ({
        date: format(new Date(date), 'MMM d'),
        hours: parseFloat(hours.toFixed(2)),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Process data for time ratio (doughnut chart) using all sessions
    const totalDurations = sessions.reduce(
      (acc, session) => {
        (session.periods || []).forEach((p) => {
          const duration = differenceInMilliseconds(new Date(p.endTime), new Date(p.startTime));
          if (p.type === 'play') {
            acc.play += duration;
          } else if (p.type === 'select') {
            acc.select += duration;
          }
        });
        return acc;
      },
      { play: 0, select: 0 }
    );

    const playHours = parseFloat((totalDurations.play / (1000 * 60 * 60)).toFixed(2));
    const selectHours = parseFloat((totalDurations.select / (1000 * 60 * 60)).toFixed(2));

    const timeRatio = [
      { name: 'Игра', value: playHours, fill: 'hsl(var(--primary))' },
      { name: 'Селект', value: selectHours, fill: 'hsl(var(--muted))' },
    ].filter((d) => d.value > 0);

    return { dailyData: sortedDailyData, timeRatioData: timeRatio };
  }, [sessions]);

  const dailyChartConfig: ChartConfig = {
    hours: {
      label: 'Часы игры',
      color: 'hsl(var(--primary))',
    },
  };

  const timeRatioChartConfig: ChartConfig = {
    'Игра': {
      label: 'Игра',
    },
    'Селект': {
      label: 'Селект',
    },
  };

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-muted/50 rounded-md border">
        <p className="text-muted-foreground">Недостаточно данных для построения графиков.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Ежедневное время игры</CardTitle>
          <CardDescription>Общее количество часов игры за последние 30 дней.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={dailyChartConfig} className="h-[250px] w-full">
            <LineChart
              accessibilityLayer
              data={dailyData}
              margin={{ top: 20, left: 10, right: 10 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tickFormatter={(value: number) => `${value}ч`}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Line
                dataKey="hours"
                type="monotone"
                stroke="var(--color-hours)"
                strokeWidth={2}
                dot={true}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Время игры vs. Время селекта</CardTitle>
          <CardDescription>Соотношение времени, потраченного на игру и на выбор столов.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center pb-0">
          <ChartContainer config={timeRatioChartConfig} className="h-[250px] w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={timeRatioData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={5}
              >
                {timeRatioData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
