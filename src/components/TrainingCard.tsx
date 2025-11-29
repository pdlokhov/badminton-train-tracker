import { ExternalLink } from "lucide-react";

interface TrainingCardProps {
  timeStart: string | null;
  timeEnd: string | null;
  type: string | null;
  location: string | null;
  clubName: string | null;
  price: number | null;
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
  telegramUrl,
  onClick,
}: TrainingCardProps) {
const formatTime = (start: string | null, end: string | null) => {
    if (!start) return "—";
    // Remove seconds if present (HH:MM:SS -> HH:MM)
    const formatTimeStr = (t: string) => t.length > 5 ? t.substring(0, 5) : t;
    const s = formatTimeStr(start);
    const e = end ? formatTimeStr(end) : null;
    return e ? `${s} – ${e}` : s;
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return null;
    return `${price} ₽`;
  };

  const title = [type, location].filter(Boolean).join(" • ");

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-foreground">
            {formatTime(timeStart, timeEnd)}
          </p>
          <p className="mt-1 text-base font-medium text-foreground truncate">
            {title || "Тренировка"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground truncate">
            {clubName || "—"}
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-1 shrink-0">
          {price !== null && (
            <span className="text-base font-medium text-foreground">
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
    </div>
  );
}
