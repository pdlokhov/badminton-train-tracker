interface MobileTrainingItemProps {
  timeStart: string | null;
  timeEnd: string | null;
  type: string | null;
  location: string | null;
  clubName: string | null;
  price: number | null;
  spots: number | null;
  onClick?: () => void;
}

export function MobileTrainingItem({
  timeStart,
  timeEnd,
  type,
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

  const title = [type, location].filter(Boolean).join(" •");

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-start justify-between border-b border-border py-4 last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
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
        <p className="mt-1 text-base font-medium text-foreground">
          {title || "Тренировка"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {clubName || "—"}
        </p>
      </div>
    </div>
  );
}
