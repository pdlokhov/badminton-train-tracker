import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ChannelTypeData {
  channel: string;
  types: Record<string, number>;
  total: number;
}

interface ChannelTypesTableProps {
  data: ChannelTypeData[];
}

export function ChannelTypesTable({ data }: ChannelTypesTableProps) {
  const sortedData = [...data]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Get all unique training types
  const allTypes = Array.from(
    new Set(data.flatMap(d => Object.keys(d.types)))
  ).sort();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Типы тренировок по каналам</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedData.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Нет данных</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Канал</TableHead>
                  {allTypes.map(type => (
                    <TableHead key={type} className="text-right min-w-[80px]">
                      {type}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-semibold min-w-[60px]">Всего</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(({ channel, types, total }) => (
                  <TableRow key={channel}>
                    <TableCell className="font-medium">{channel}</TableCell>
                    {allTypes.map(type => (
                      <TableCell key={type} className="text-right text-muted-foreground">
                        {types[type] || 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">{total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
