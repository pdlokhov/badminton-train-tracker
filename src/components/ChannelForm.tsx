import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { channelSchema } from "@/lib/validations";

interface ChannelFormProps {
  onChannelAdded: () => void;
}

const extractUsernameAndTopic = (url: string): { username: string | null; topicId: number | null } => {
  // Формат с топиком: https://t.me/vball_spb_chat/3940
  const topicPattern = /^https?:\/\/t\.me\/([a-zA-Z0-9_]+)\/(\d+)\/?$/;
  const topicMatch = url.trim().match(topicPattern);
  if (topicMatch) {
    return { username: topicMatch[1], topicId: parseInt(topicMatch[2]) };
  }

  // Обычные форматы без топика
  const patterns = [
    /^https?:\/\/t\.me\/([a-zA-Z0-9_]+)\/?$/,
    /^t\.me\/([a-zA-Z0-9_]+)\/?$/,
    /^@?([a-zA-Z0-9_]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return { username: match[1], topicId: null };
    }
  }
  return { username: null, topicId: null };
};

const normalizeUrl = (username: string, topicId: number | null): string => {
  return topicId ? `https://t.me/${username}/${topicId}` : `https://t.me/${username}`;
};

export function ChannelForm({ onChannelAdded }: ChannelFormProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [defaultCoach, setDefaultCoach] = useState("");
  const [parseImages, setParseImages] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [permanentSignupUrlGame, setPermanentSignupUrlGame] = useState("");
  const [permanentSignupUrlGroup, setPermanentSignupUrlGroup] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Автоматически извлекаем topic_id из URL
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    const { topicId: extractedTopicId } = extractUsernameAndTopic(newUrl);
    if (extractedTopicId) {
      setTopicId(extractedTopicId.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate with zod schema
    const validation = channelSchema.safeParse({
      name,
      url,
      defaultCoach,
      parseImages,
      topicId: topicId || undefined,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Ошибка валидации",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    const { username, topicId: urlTopicId } = extractUsernameAndTopic(url);
    if (!username) {
      toast({
        title: "Ошибка",
        description: "Неверный формат ссылки. Используйте: https://t.me/channel или @channel",
        variant: "destructive",
      });
      return;
    }

    // Используем topic_id из поля или извлечённый из URL
    const finalTopicId = topicId ? parseInt(topicId) : urlTopicId;

    setIsLoading(true);

    try {
      const normalizedUrl = normalizeUrl(username, finalTopicId);
      
      const { error } = await supabase.from("channels").insert({
        name: name.trim(),
        url: normalizedUrl,
        username: username,
        parse_images: parseImages,
        default_coach: defaultCoach.trim() || null,
        topic_id: finalTopicId || null,
        permanent_signup_url_game: permanentSignupUrlGame.trim() || null,
        permanent_signup_url_group: permanentSignupUrlGroup.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Ошибка",
            description: "Этот клуб уже добавлен",
            variant: "destructive",
          });
        } else if (error.code === "42501") {
          toast({
            title: "Ошибка доступа",
            description: "У вас нет прав для добавления клубов",
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
      setTopicId("");
      setPermanentSignupUrlGame("");
      setPermanentSignupUrlGroup("");
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Label htmlFor="url">Ссылка на канал</Label>
          <Input
            id="url"
            placeholder="https://t.me/lb_club_badminton"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topicId">ID топика (опционально)</Label>
          <Input
            id="topicId"
            placeholder="3940"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            type="number"
          />
          <p className="text-xs text-muted-foreground">
            Для супергрупп с разделами
          </p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="permanentSignupUrlGame">Ссылка для игровых тренировок</Label>
          <Input
            id="permanentSignupUrlGame"
            placeholder="https://t.me/club_bot (опционально)"
            value={permanentSignupUrlGame}
            onChange={(e) => setPermanentSignupUrlGame(e.target.value)}
            maxLength={500}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="permanentSignupUrlGroup">Ссылка для групповых тренировок</Label>
          <Input
            id="permanentSignupUrlGroup"
            placeholder="https://t.me/club_bot (опционально)"
            value={permanentSignupUrlGroup}
            onChange={(e) => setPermanentSignupUrlGroup(e.target.value)}
            maxLength={500}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Если указаны, карточки тренировок будут вести на соответствующие ссылки
      </p>
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
