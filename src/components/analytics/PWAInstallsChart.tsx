import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts";
import { Smartphone } from "lucide-react";

interface PWAInstallsChartProps {
  data: Array<{
    date: string;
    installs: number;
    sessions: number;
    bannerViews: number;
  }>;
}

const chartConfig = {
  installs: {
    label: "Установки",
    color: "hsl(var(--chart-1))",
  },
  sessions: {
    label: "PWA сессии",
    color: "hsl(var(--chart-2))",
  },
  bannerViews: {
    label: "Показы баннера",
    color: "hsl(var(--chart-3))",
  },
};

export function PWAInstallsChart({ data }: PWAInstallsChartProps) {
  const hasData = data.some(d => d.installs > 0 || d.sessions > 0 || d.bannerViews > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Динамика PWA
        </CardTitle>
        <CardDescription>Установки, сессии и показы баннера по дням</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Нет данных за выбранный период
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()} ${date.toLocaleString('ru', { month: 'short' })}`;
                }}
              />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="bannerViews"
                stroke={chartConfig.bannerViews.color}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke={chartConfig.sessions.color}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="installs"
                stroke={chartConfig.installs.color}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
