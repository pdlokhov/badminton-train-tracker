import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Download, Eye, Apple, MonitorSmartphone } from "lucide-react";

interface PWAMetrics {
  totalInstalls: number;
  bannerViews: number;
  bannerDismisses: number;
  iosInstructions: number;
  pwaSessions: number;
  activePwaUsers: number;
  conversionRate: number;
  platformBreakdown: {
    ios: number;
    android: number;
    desktop: number;
  };
}

interface PWAMetricsCardProps {
  data: PWAMetrics;
}

export function PWAMetricsCard({ data }: PWAMetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          PWA Метрики
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Installations */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Download className="h-4 w-4" />
              Установки
            </div>
            <div className="text-2xl font-bold">{data.totalInstalls}</div>
          </div>

          {/* Active PWA users */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <MonitorSmartphone className="h-4 w-4" />
              PWA сессии
            </div>
            <div className="text-2xl font-bold">{data.pwaSessions}</div>
          </div>

          {/* Banner views */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Eye className="h-4 w-4" />
              Показы баннера
            </div>
            <div className="text-2xl font-bold">{data.bannerViews}</div>
          </div>

          {/* Conversion rate */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Download className="h-4 w-4" />
              Конверсия
            </div>
            <div className="text-2xl font-bold">
              {data.conversionRate.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">По платформам (PWA сессии)</h4>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Apple className="h-4 w-4" />
              <span className="text-sm">iOS: <strong>{data.platformBreakdown.ios}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="text-sm">Android: <strong>{data.platformBreakdown.android}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4" />
              <span className="text-sm">Desktop: <strong>{data.platformBreakdown.desktop}</strong></span>
            </div>
          </div>
        </div>

        {/* Additional stats */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Закрытия баннера:</span>
            <span className="ml-2 font-medium">{data.bannerDismisses}</span>
          </div>
          <div>
            <span className="text-muted-foreground">iOS инструкции:</span>
            <span className="ml-2 font-medium">{data.iosInstructions}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Уникальных PWA юзеров:</span>
            <span className="ml-2 font-medium">{data.activePwaUsers}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
