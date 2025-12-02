import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserActivity {
  visitor_id: string;
  total_signups: number;
  active_days: number;
  unique_trainings: number;
  avg_signups_per_day: number;
}

interface UserActivityTableProps {
  data: UserActivity[];
}

export function UserActivityTable({ data }: UserActivityTableProps) {
  const sortedData = [...data].sort((a, b) => b.total_signups - a.total_signups).slice(0, 50);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Активность пользователей</CardTitle>
        <CardDescription>Топ-50 пользователей по количеству переходов для записи</CardDescription>
        <Alert className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            ⚠️ Это количество переходов в Telegram для записи, а не подтверждённые посещения тренировок
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Посетитель</TableHead>
              <TableHead className="text-right">Переходов</TableHead>
              <TableHead className="text-right">Активных дней</TableHead>
              <TableHead className="text-right">Уник. тренировок</TableHead>
              <TableHead className="text-right">Ср. переходов/день</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((user) => (
              <TableRow key={user.visitor_id}>
                <TableCell className="font-mono text-xs">
                  {user.visitor_id.slice(0, 8)}...
                </TableCell>
                <TableCell className="text-right font-semibold">{user.total_signups}</TableCell>
                <TableCell className="text-right">{user.active_days}</TableCell>
                <TableCell className="text-right">{user.unique_trainings}</TableCell>
                <TableCell className="text-right">{user.avg_signups_per_day.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
