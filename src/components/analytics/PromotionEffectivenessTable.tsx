import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PromotionStats {
  channelName: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface PromotionEffectivenessTableProps {
  promoStats: PromotionStats[];
  regularCtr: number;
}

export function PromotionEffectivenessTable({ promoStats, regularCtr }: PromotionEffectivenessTableProps) {
  if (promoStats.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Эффективность промо-выделений</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Клуб</TableHead>
              <TableHead className="text-right">Показы</TableHead>
              <TableHead className="text-right">Клики</TableHead>
              <TableHead className="text-right">CTR промо</TableHead>
              <TableHead className="text-right">CTR обычных</TableHead>
              <TableHead className="text-right">Дельта</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promoStats.map((stat) => {
              const delta = stat.ctr - regularCtr;
              return (
                <TableRow key={stat.channelName}>
                  <TableCell className="font-medium">{stat.channelName}</TableCell>
                  <TableCell className="text-right">{stat.impressions}</TableCell>
                  <TableCell className="text-right">{stat.clicks}</TableCell>
                  <TableCell className="text-right">{stat.ctr.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{regularCtr.toFixed(1)}%</TableCell>
                  <TableCell className={`text-right font-medium ${delta > 0 ? "text-green-600" : delta < 0 ? "text-destructive" : ""}`}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
