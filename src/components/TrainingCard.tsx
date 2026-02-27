import { useEffect, useRef } from "react";
import { Users, Flame, Star } from "lucide-react";
import { openExternalUrl } from "@/lib/openExternalUrl";

export interface PromotionInfo {
  id: string;
  channel_id: string;
  highlight_color: string;
  label: string | null;
}

interface TrainingCardProps {
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
  telegramUrl?: string;
  onTelegramClick?: (id: string, clubName: string, type: string | null) => void;
  discountPercent?: number | null;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  discountExpiresAt?: string | null;
  promotion?: PromotionInfo | null;
  onPromotionImpression?: (promotionId: string, channelId: string, trainingId: string) => void;
  onPromotionClick?: (promotionId: string, channelId: string, trainingId: string) => void;
}

const promoColorMap: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  blue: {
    border: "border-[hsl(var(--promo-blue))]",
    bg: "bg-[hsl(var(--promo-blue-bg))]",
    text: "text-[hsl(var(--promo-blue))]",
    badge: "bg-[hsl(var(--promo-blue)/0.15)] text-[hsl(var(--promo-blue))]",
  },
  green: {
    border: "border-[hsl(var(--promo-green))]",
    bg: "bg-[hsl(var(--promo-green-bg))]",
    text: "text-[hsl(var(--promo-green))]",
    badge: "bg-[hsl(var(--promo-green)/0.15)] text-[hsl(var(--promo-green))]",
  },
  purple: {
    border: "border-[hsl(var(--promo-purple))]",
    bg: "bg-[hsl(var(--promo-purple-bg))]",
    text: "text-[hsl(var(--promo-purple))]",
    badge: "bg-[hsl(var(--promo-purple)/0.15)] text-[hsl(var(--promo-purple))]",
  },
  gold: {
    border: "border-[hsl(var(--promo-gold))]",
    bg: "bg-[hsl(var(--promo-gold-bg))]",
    text: "text-[hsl(var(--promo-gold))]",
    badge: "bg-[hsl(var(--promo-gold)/0.15)] text-[hsl(var(--promo-gold))]",
  },
};

export function TrainingCard({
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
  telegramUrl,
  onTelegramClick,
  discountPercent,
  originalPrice,
  discountedPrice,
  discountExpiresAt,
  promotion,
  onPromotionImpression,
  onPromotionClick,
}: TrainingCardProps) {
  const impressionTracked = useRef(false);

  useEffect(() => {
    if (promotion && onPromotionImpression && !impressionTracked.current) {
      impressionTracked.current = true;
      onPromotionImpression(promotion.id, promotion.channel_id, id);
    }
  }, [promotion, onPromotionImpression, id]);

  const hasActiveDiscount = !!(
    discountPercent &&
    discountedPrice != null &&
    discountExpiresAt &&
    new Date(discountExpiresAt) > new Date()
  );
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

  const formatSpots = (total: number | null, available: number | null) => {
    if (available !== null && total !== null) return `${available}/${total}`;
    if (available !== null) return `${available} своб.`;
    if (total !== null) return `${total}`;
    return null;
  };

  const handleClick = () => {
    if (telegramUrl) {
      if (promotion && onPromotionClick) {
        onPromotionClick(promotion.id, promotion.channel_id, id);
      }
      onTelegramClick?.(id, clubName || "", type);
      openExternalUrl(telegramUrl);
    }
  };

  const spotsDisplay = formatSpots(spots, spotsAvailable);
  const promoColors = promotion ? promoColorMap[promotion.highlight_color] || promoColorMap.blue : null;

  return (
    <div
      onClick={handleClick}
      className={`group flex cursor-pointer flex-col rounded-xl border p-4 transition-all hover:shadow-md ${
        promoColors
          ? `${promoColors.border} ${promoColors.bg} border-l-4`
          : hasActiveDiscount
            ? "border-destructive/40 shadow-sm shadow-destructive/10 bg-card"
            : "border-border hover:border-primary/30 bg-card"
      }`}
    >
      {/* Promo badge */}
      {promotion?.label && promoColors && (
        <div className="mb-2">
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${promoColors.badge}`}>
            <Star className="h-3 w-3" />
            {promotion.label}
          </span>
        </div>
      )}

      {/* Header: time + price */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold text-foreground">
          {formatTime(timeStart, timeEnd)}
        </p>
        {hasActiveDiscount ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(originalPrice ?? price)}
            </span>
            <span className="text-base font-bold text-destructive">
              {formatPrice(discountedPrice)}
            </span>
          </div>
        ) : (
          price !== null && (
            <span className="text-base font-semibold text-foreground">
              {formatPrice(price)}
            </span>
          )
        )}
      </div>

      {/* Type badge + level badge + spots + discount badge */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {hasActiveDiscount && (
          <span className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 text-sm font-bold text-destructive-foreground">
            <Flame className="h-3.5 w-3.5" />
            -{discountPercent}%
          </span>
        )}
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
        {spotsDisplay && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {spotsDisplay}
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
