import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

interface ChannelFormProps {
  onChannelAdded: () => void;
}

const extractUsername = (url: string): string | null => {
  // Поддержка форматов: https://t.me/channel, t.me/channel, @channel
  const patterns = [
    /^https?:\/\/t\.me\/([a-zA-Z0-9_]+)\/?$/,
    /^t\.me\/([a-zA-Z0-9_]+)\/?$/,
    /^@?([a-zA-Z0-9_]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

const normalizeUrl = (username: string): string => {
  return `https://t.me/${username}`;
};

export function ChannelForm({ onChannelAdded }: ChannelFormProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [defaultCoach, setDefaultCoach] = useState("");
  const [parseImages, setParseImages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const username = extractUsername(url);
    if (!username) {
      toast({
        title: "Ошибка",
        description: "Неверный формат ссылки. Используйте: https://t.me/channel или @channel",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название клуба",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const normalizedUrl = normalizeUrl(username);
      
      const { error } = await supabase.from("channels").insert({
        name: name.trim(),
        url: normalizedUrl,
        username: username,
        parse_images: parseImages,
        default_coach: defaultCoach.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Ошибка",
            description: "Этот клуб уже добавлен",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Успешно",
        description: `Клуб "${name}" добавлен`,
      });

      setUrl("");
      setName("");
      setDefaultCoach("");
      setParseImages(false);
      onChannelAdded();
    } catch (error) {
      console.error("Error adding channel:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить клуб",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Название клуба</Label>
          <Input
            id="name"
            placeholder="LB Club Badminton"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">Ссылка на клуб</Label>
          <Input
            id="url"
            placeholder="https://t.me/lb_club_badminton"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultCoach">Тренер по умолчанию</Label>
          <Input
            id="defaultCoach"
            placeholder="Имя тренера (опционально)"
            value={defaultCoach}
            onChange={(e) => setDefaultCoach(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="parse_images"
          checked={parseImages}
          onCheckedChange={(checked) => setParseImages(checked === true)}
        />
        <Label htmlFor="parse_images" className="text-sm font-normal cursor-pointer">
          Искать расписание в картинках (вместо текстовых сообщений)
        </Label>
      </div>
      <Button type="submit" disabled={isLoading}>
        <Plus className="mr-2 h-4 w-4" />
        {isLoading ? "Добавление..." : "Добавить клуб"}
      </Button>
    </form>
  );
}
