import { Users } from "lucide-react";

interface TrainingCardProps {
  timeStart: string | null;
  timeEnd: string | null;
  type: string | null;
  level: string | null;
  location: string | null;
  clubName: string | null;
  price: number | null;
  spots: number | null;
  telegramUrl?: string;
}

export function TrainingCard({
  timeStart,
  timeEnd,
  type,
  level,
  location,
  clubName,
  price,
  spots,
  telegramUrl,
}: TrainingCardProps) {
  const formatTime = (start: string | null, end: string | null) => {
    if (!start) return "—";
    const formatTimeStr = (t: string) => t.length > 5 ? t.substring(0, 5) : t;
    const s = formatTimeStr(start);
    const e = end ? formatTimeStr(end) : null;
    return e ? `${s} – ${e}` : s;
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return `${price} ₽`;
  };

  const handleClick = () => {
    if (telegramUrl) {
      window.open(telegramUrl, "_blank");
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Header: time + price */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold text-foreground">
          {formatTime(timeStart, timeEnd)}
        </p>
        {price !== null && (
          <span className="text-base font-semibold text-foreground">
            {formatPrice(price)}
          </span>
        )}
      </div>

      {/* Type badge + level badge + spots */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {type && (
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
            {type}
          </span>
        )}
        {level && (
          <span className="inline-flex items-center rounded-md bg-orange-500/10 px-2 py-0.5 text-sm font-medium text-orange-600 dark:text-orange-400">
            {level}
          </span>
        )}
        {spots !== null && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {spots} мест
          </span>
        )}
      </div>

      {/* Location + club */}
      <div className="mt-2 space-y-0.5">
        {location && (
          <p className="text-sm text-foreground truncate">{location}</p>
        )}
        <p className="text-sm text-muted-foreground truncate">
          {clubName || "—"}
        </p>
      </div>
    </div>
  );
}
