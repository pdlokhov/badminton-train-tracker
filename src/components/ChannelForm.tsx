import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Calendar, MessageSquare, Image, Globe } from "lucide-react";
import { channelSchema } from "@/lib/validations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChannelFormProps {
  onChannelAdded: () => void;
}

type ParseMode = 'telegram_text' | 'telegram_images' | 'yclients' | 'external_api';

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
  const [parseMode, setParseMode] = useState<ParseMode>('telegram_text');
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [defaultCoach, setDefaultCoach] = useState("");
  const [useAiTextParsing, setUseAiTextParsing] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [permanentSignupUrlGame, setPermanentSignupUrlGame] = useState("");
  const [permanentSignupUrlGroup, setPermanentSignupUrlGroup] = useState("");
  
  // YClients specific fields
  const [yclientsCompanyId, setYclientsCompanyId] = useState("");
  const [yclientsUserToken, setYclientsUserToken] = useState("");

  // External API specific fields
  const [apiEndpointUrl, setApiEndpointUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiDaysAhead, setApiDaysAhead] = useState("14");
  
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isYClients = parseMode === 'yclients';
  const isExternalApi = parseMode === 'external_api';
  const isTelegram = parseMode === 'telegram_text' || parseMode === 'telegram_images';

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
    
    // Для YClients не нужна стандартная валидация URL
    if (isTelegram) {
      const validation = channelSchema.safeParse({
        name,
        url,
        defaultCoach,
        parseImages: parseMode === 'telegram_images',
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
    }

    // Валидация для YClients
    if (isYClients) {
      if (!name.trim()) {
        toast({
          title: "Ошибка",
          description: "Укажите название клуба",
          variant: "destructive",
        });
        return;
      }
      if (!yclientsCompanyId.trim()) {
        toast({
          title: "Ошибка",
          description: "Укажите Company ID из YClients",
          variant: "destructive",
        });
        return;
      }
      if (!yclientsUserToken.trim()) {
        toast({
          title: "Ошибка",
          description: "Укажите User Token для доступа к API",
          variant: "destructive",
        });
        return;
      }
    }

    // Валидация для External API
    if (isExternalApi) {
      if (!name.trim()) {
        toast({ title: "Ошибка", description: "Укажите название клуба", variant: "destructive" });
        return;
      }
      if (!apiEndpointUrl.trim()) {
        toast({ title: "Ошибка", description: "Укажите URL эндпоинта", variant: "destructive" });
        return;
      }
      if (!apiKey.trim()) {
        toast({ title: "Ошибка", description: "Укажите API-ключ", variant: "destructive" });
        return;
      }
    }

    let username = '';
    let finalTopicId: number | null = null;
    let normalizedUrl = '';

    if (isTelegram) {
      const extracted = extractUsernameAndTopic(url);
      if (!extracted.username) {
        toast({
          title: "Ошибка",
          description: "Неверный формат ссылки. Используйте: https://t.me/channel или @channel",
          variant: "destructive",
        });
        return;
      }
      username = extracted.username;
      finalTopicId = topicId ? parseInt(topicId) : extracted.topicId;
      normalizedUrl = normalizeUrl(username, finalTopicId);
    } else if (isYClients) {
      username = `yclients_${yclientsCompanyId}`;
      normalizedUrl = `https://yclients.com/company/${yclientsCompanyId}`;
    } else if (isExternalApi) {
      username = `extapi_${Date.now()}`;
      normalizedUrl = apiEndpointUrl.trim();
    }

    setIsLoading(true);

    try {
      const channelData: Record<string, any> = {
        name: name.trim(),
        url: normalizedUrl,
        username: username,
        parse_mode: parseMode,
        parse_images: parseMode === 'telegram_images',
        use_ai_text_parsing: parseMode === 'telegram_text' && useAiTextParsing,
        default_coach: defaultCoach.trim() || null,
        topic_id: finalTopicId || null,
        permanent_signup_url_game: permanentSignupUrlGame.trim() || null,
        permanent_signup_url_group: permanentSignupUrlGroup.trim() || null,
      };

      // Добавляем YClients конфигурацию
      if (isYClients) {
        channelData.yclients_config = {
          company_id: yclientsCompanyId.trim(),
          user_token: yclientsUserToken.trim(),
        };
      }

      // Добавляем External API конфигурацию
      if (isExternalApi) {
        channelData.external_api_config = {
          endpoint_url: apiEndpointUrl.trim(),
          api_key: apiKey.trim(),
          days_ahead: parseInt(apiDaysAhead) || 14,
          header_name: 'x-api-key',
        };
      }

      const { error } = await supabase.from("channels").insert([channelData] as any);

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

      // Reset form
      setUrl("");
      setName("");
      setDefaultCoach("");
      setUseAiTextParsing(false);
      setTopicId("");
      setPermanentSignupUrlGame("");
      setPermanentSignupUrlGroup("");
      setYclientsCompanyId("");
      setYclientsUserToken("");
      setApiEndpointUrl("");
      setApiKey("");
      setApiDaysAhead("14");
      setParseMode('telegram_text');
      
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
      {/* Выбор типа источника */}
      <div className="space-y-2">
        <Label>Тип источника расписания</Label>
        <Select value={parseMode} onValueChange={(v) => setParseMode(v as ParseMode)}>
          <SelectTrigger className="w-full md:w-[300px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="telegram_text">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Telegram (текст)
              </span>
            </SelectItem>
            <SelectItem value="telegram_images">
              <span className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Telegram (картинки)
              </span>
            </SelectItem>
            <SelectItem value="yclients">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                YClients API
              </span>
            </SelectItem>
            <SelectItem value="external_api">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Внешний API
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

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

        {/* Telegram-specific fields */}
        {isTelegram && (
          <>
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
          </>
        )}

        {/* YClients-specific fields */}
        {isYClients && (
          <>
            <div className="space-y-2">
              <Label htmlFor="yclientsCompanyId">Company ID</Label>
              <Input
                id="yclientsCompanyId"
                placeholder="123456"
                value={yclientsCompanyId}
                onChange={(e) => setYclientsCompanyId(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                ID компании из URL личного кабинета YClients
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="yclientsUserToken">User Token</Label>
              <Input
                id="yclientsUserToken"
                placeholder="xxxxxxxxxxxxxxxx"
                value={yclientsUserToken}
                onChange={(e) => setYclientsUserToken(e.target.value)}
                type="password"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                API-токен из настроек интеграций YClients
              </p>
            </div>
          </>
        )}

        {/* External API-specific fields */}
        {isExternalApi && (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiEndpointUrl">URL эндпоинта</Label>
              <Input
                id="apiEndpointUrl"
                placeholder="https://example.com/functions/v1/public-trainings"
                value={apiEndpointUrl}
                onChange={(e) => setApiEndpointUrl(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API-ключ</Label>
              <Input
                id="apiKey"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                Значение для заголовка x-api-key
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiDaysAhead">Дней вперёд</Label>
              <Input
                id="apiDaysAhead"
                placeholder="14"
                value={apiDaysAhead}
                onChange={(e) => setApiDaysAhead(e.target.value)}
                type="number"
                min={1}
                max={60}
              />
            </div>
          </>
        )}

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

      {/* Checkbox only for telegram_text */}
      {parseMode === 'telegram_text' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="use_ai_text_parsing"
              checked={useAiTextParsing}
              onCheckedChange={(checked) => setUseAiTextParsing(checked === true)}
            />
            <Label htmlFor="use_ai_text_parsing" className="text-sm font-normal cursor-pointer">
              Использовать AI для парсинга текста (для сложных расписаний с несколькими локациями)
            </Label>
          </div>
        </div>
      )}

      <Button type="submit" disabled={isLoading}>
        <Plus className="mr-2 h-4 w-4" />
        {isLoading ? "Добавление..." : "Добавить клуб"}
      </Button>
    </form>
  );
}