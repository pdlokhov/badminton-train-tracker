import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RetentionData {
  date: string;
  newVisitors: number;
  retentionD1: number | null;
  retentionD7: number | null;
  retentionD30: number | null;
}

interface RetentionTableProps {
  data: RetentionData[];
}

export function RetentionTable({ data }: RetentionTableProps) {
  const getRetentionColor = (value: number | null) => {
    if (value === null) return "text-muted-foreground";
    if (value >= 30) return "text-green-600 dark:text-green-400";
    if (value >= 15) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatRetention = (value: number | null) => {
    if (value === null) return "-";
    return `${value.toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention Rate</CardTitle>
        <CardDescription>Процент вернувшихся пользователей по когортам</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Когорта</TableHead>
              <TableHead className="text-right">Новых</TableHead>
              <TableHead className="text-right">D1</TableHead>
              <TableHead className="text-right">D7</TableHead>
              <TableHead className="text-right">D30</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.date}>
                  <TableCell className="font-medium">
                    {new Date(row.date).toLocaleDateString('ru', { 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </TableCell>
                  <TableCell className="text-right">{row.newVisitors}</TableCell>
                  <TableCell className={`text-right font-medium ${getRetentionColor(row.retentionD1)}`}>
                    {formatRetention(row.retentionD1)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getRetentionColor(row.retentionD7)}`}>
                    {formatRetention(row.retentionD7)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getRetentionColor(row.retentionD30)}`}>
                    {formatRetention(row.retentionD30)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
