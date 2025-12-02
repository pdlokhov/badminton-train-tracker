import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface DailyVisitorsChartProps {
  data: Array<{
    date: string;
    total: number;
    new: number;
    returning: number;
  }>;
}

const chartConfig = {
  total: {
    label: "Всего",
    color: "hsl(var(--chart-1))",
  },
  new: {
    label: "Новые",
    color: "hsl(var(--chart-2))",
  },
  returning: {
    label: "Вернувшиеся",
    color: "hsl(var(--chart-3))",
  },
};

export function DailyVisitorsChart({ data }: DailyVisitorsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Посетители по дням</CardTitle>
        <CardDescription>Динамика новых и вернувшихся пользователей</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data}>
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
            <Area
              type="monotone"
              dataKey="returning"
              stackId="1"
              stroke={chartConfig.returning.color}
              fill={chartConfig.returning.color}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="new"
              stackId="1"
              stroke={chartConfig.new.color}
              fill={chartConfig.new.color}
              fillOpacity={0.6}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
