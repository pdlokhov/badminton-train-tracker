interface MobileTrainingItemProps {
  id: string;
  timeStart: string | null;
  timeEnd: string | null;
  type: string | null;
  level: string | null;
  location: string | null;
  clubName: string | null;
  price: number | null;
  spots: number | null;
  onClick?: (id: string, clubName: string, type: string | null) => void;
}

export function MobileTrainingItem({
  id,
  timeStart,
  timeEnd,
  type,
  level,
  location,
  clubName,
  price,
  spots,
  onClick,
}: MobileTrainingItemProps) {
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

  const formatSpots = (spots: number | null) => {
    if (spots === null) return null;
    return `${spots} мест`;
  };

  const handleClick = () => {
    onClick?.(id, clubName || "", type);
  };

  return (
    <div
      onClick={handleClick}
      className="flex cursor-pointer items-start justify-between border-b border-border py-4 last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-base font-semibold text-foreground">
            {formatTime(timeStart, timeEnd)}
          </span>
          {price !== null && (
            <span className="text-base font-medium text-foreground">
              {formatPrice(price)}
            </span>
          )}
          {spots !== null && (
            <span className="text-sm text-muted-foreground">
              {formatSpots(spots)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {type && (
            <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {type}
            </span>
          )}
          {level && (
            <span className="inline-flex items-center rounded-md bg-orange-500/10 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
              {level}
            </span>
          )}
          {location && (
            <span className="text-sm text-foreground truncate">
              {location}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground truncate">
          {clubName || "—"}
        </p>
      </div>
    </div>
  );
}
