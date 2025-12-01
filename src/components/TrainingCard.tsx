import { ExternalLink, Users } from "lucide-react";

interface TrainingCardProps {
  timeStart: string | null;
  timeEnd: string | null;
  type: string | null;
  location: string | null;
  clubName: string | null;
  price: number | null;
  spots: number | null;
  telegramUrl?: string;
  onClick?: () => void;
}

export function TrainingCard({
  timeStart,
  timeEnd,
  type,
  location,
  clubName,
  price,
  spots,
  telegramUrl,
  onClick,
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

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Header: time + price */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold text-foreground">
          {formatTime(timeStart, timeEnd)}
        </p>
        <div className="flex items-center gap-2">
          {price !== null && (
            <span className="text-base font-semibold text-foreground">
              {formatPrice(price)}
            </span>
          )}
          {telegramUrl && (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Type badge + spots */}
      <div className="mt-2 flex items-center gap-2">
        {type && (
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
            {type}
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
