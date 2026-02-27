import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChannelPromotionFormProps {
  channelId: string;
  channelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Promotion {
  id: string;
  highlight_color: string;
  label: string | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
}

const colorOptions = [
  { value: "blue", label: "Синий" },
  { value: "green", label: "Зелёный" },
  { value: "purple", label: "Фиолетовый" },
  { value: "gold", label: "Золотой" },
];

export function ChannelPromotionForm({
  channelId,
  channelName,
  open,
  onOpenChange,
}: ChannelPromotionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promotion, setPromotion] = useState<Promotion | null>(null);

  // Form state
  const [color, setColor] = useState("blue");
  const [label, setLabel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (open) {
      fetchPromotion();
    }
  }, [open, channelId]);

  const fetchPromotion = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("channel_promotions")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(1) as { data: Promotion[] | null };

    if (data && data.length > 0) {
      const p = data[0];
      setPromotion(p);
      setColor(p.highlight_color);
      setLabel(p.label || "");
      setIsActive(p.is_active);
      setExpiresAt(p.expires_at ? p.expires_at.split("T")[0] : "");
    } else {
      setPromotion(null);
      setColor("blue");
      setLabel("");
      setIsActive(true);
      setExpiresAt("");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        channel_id: channelId,
        highlight_color: color,
        label: label.trim() || null,
        is_active: isActive,
        expires_at: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
      };

      if (promotion) {
        const { error } = await supabase
          .from("channel_promotions")
          .update(payload)
          .eq("id", promotion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("channel_promotions")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Промо сохранено", description: `Настройки промо для "${channelName}" обновлены` });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving promotion:", error);
      toast({ title: "Ошибка", description: "Не удалось сохранить промо", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!promotion) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("channel_promotions")
        .delete()
        .eq("id", promotion.id);
      if (error) throw error;

      toast({ title: "Промо удалено" });
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting promotion:", error);
      toast({ title: "Ошибка", description: "Не удалось удалить промо", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Промо-выделение: {channelName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label>Активно</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="space-y-2">
              <Label>Цвет выделения</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: `hsl(var(--promo-${opt.value}))` }}
                        />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-label">Текст бейджа (опционально)</Label>
              <Input
                id="promo-label"
                placeholder="Например: Партнёр, Рекомендуем"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-expires">Дата окончания (опционально)</Label>
              <Input
                id="promo-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Если не указана, промо будет активно бессрочно
              </p>
            </div>
          </div>
        )}
        <DialogFooter className="flex gap-2">
          {promotion && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              Удалить
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
