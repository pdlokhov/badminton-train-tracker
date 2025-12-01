import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TopSearchesTableProps {
  data: Record<string, number>;
}

export function TopSearchesTable({ data }: TopSearchesTableProps) {
  const searches = Object.entries(data)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Топ поисковых запросов</CardTitle>
      </CardHeader>
      <CardContent>
        {searches.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Нет данных</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запрос</TableHead>
                <TableHead className="text-right w-20">Кол-во</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searches.map(({ query, count }) => (
                <TableRow key={query}>
                  <TableCell className="font-medium">{query}</TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
