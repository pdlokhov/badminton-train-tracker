import { Users, Flame } from "lucide-react";

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
  spotsAvailable?: number | null;
  onClick?: (id: string, clubName: string, type: string | null) => void;
  discountPercent?: number | null;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  discountExpiresAt?: string | null;
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
  spotsAvailable,
  onClick,
  discountPercent,
  originalPrice,
  discountedPrice,
  discountExpiresAt,
}: MobileTrainingItemProps) {
  const hasActiveDiscount = !!(
    discountPercent &&
    discountedPrice != null &&
    discountExpiresAt &&
    new Date(discountExpiresAt) > new Date()
  );
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

  const formatSpots = (total: number | null, available: number | null) => {
    if (available !== null && total !== null) {
      return `${available}/${total}`;
    }
    if (available !== null) {
      return `${available} своб.`;
    }
    if (total !== null) {
      return `${total}`;
    }
    return null;
  };

  const handleClick = () => {
    onClick?.(id, clubName || "", type);
  };

  const spotsDisplay = formatSpots(spots, spotsAvailable);

  return (
    <div
      onClick={handleClick}
      className={`flex cursor-pointer items-start justify-between py-4 last:border-b-0 ${
        hasActiveDiscount
          ? "border-b border-destructive/20 bg-destructive/5 -mx-4 px-4 rounded-lg"
          : "border-b border-border"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-base font-semibold text-foreground">
            {formatTime(timeStart, timeEnd)}
          </span>
          {hasActiveDiscount ? (
            <>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(originalPrice ?? price)}
              </span>
              <span className="text-base font-bold text-destructive">
                {formatPrice(discountedPrice)}
              </span>
            </>
          ) : (
            price !== null && (
              <span className="text-base font-medium text-foreground">
                {formatPrice(price)}
              </span>
            )
          )}
          {spotsDisplay && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {spotsDisplay}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {hasActiveDiscount && (
            <span className="inline-flex items-center gap-1 rounded-md bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
              <Flame className="h-3 w-3" />
              -{discountPercent}%
            </span>
          )}
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
