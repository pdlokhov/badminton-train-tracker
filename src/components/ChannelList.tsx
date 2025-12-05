import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, ExternalLink, Image, FileText, Pencil, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Channel {
  id: string;
  name: string;
  url: string;
  username: string;
  is_active: boolean;
  parse_images: boolean;
  default_coach: string | null;
  default_location_id: string | null;
  permanent_signup_url?: string | null;
  created_at: string;
}

interface Location {
  id: string;
  name: string;
}

interface ChannelListProps {
  refreshTrigger: number;
}

export function ChannelList({ refreshTrigger }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editName, setEditName] = useState("");
  const [editDefaultCoach, setEditDefaultCoach] = useState("");
  const [editDefaultLocationId, setEditDefaultLocationId] = useState<string | null>(null);
  const [editPermanentSignupUrl, setEditPermanentSignupUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Cast to include permanent_signup_url (column exists but types not yet regenerated)
      setChannels((data || []) as Channel[]);
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список клубов",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchLocations();
  }, [refreshTrigger]);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("channels")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      setChannels((prev) =>
        prev.map((ch) => (ch.id === id ? { ...ch, is_active: isActive } : ch))
      );

      toast({
        title: "Успешно",
        description: isActive ? "Клуб активирован" : "Клуб деактивирован",
      });
    } catch (error) {
      console.error("Error toggling channel:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус клуба",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("channels").delete().eq("id", id);

      if (error) throw error;

      setChannels((prev) => prev.filter((ch) => ch.id !== id));

      toast({
        title: "Успешно",
        description: `Клуб "${name}" удалён`,
      });
    } catch (error) {
      console.error("Error deleting channel:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить клуб",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (channel: Channel) => {
    setEditingChannel(channel);
    setEditName(channel.name);
    setEditDefaultCoach(channel.default_coach || "");
    setEditDefaultLocationId(channel.default_location_id);
    setEditPermanentSignupUrl(channel.permanent_signup_url || "");
  };

  const handleSaveEdit = async () => {
    if (!editingChannel) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("channels")
        .update({
          name: editName.trim(),
          default_coach: editDefaultCoach.trim() || null,
          default_location_id: editDefaultLocationId,
          permanent_signup_url: editPermanentSignupUrl.trim() || null,
        })
        .eq("id", editingChannel.id);

      if (error) throw error;

      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === editingChannel.id
            ? { 
                ...ch, 
                name: editName.trim(), 
                default_coach: editDefaultCoach.trim() || null,
                default_location_id: editDefaultLocationId,
                permanent_signup_url: editPermanentSignupUrl.trim() || null,
              }
            : ch
        )
      );

      toast({
        title: "Успешно",
        description: "Клуб обновлён",
      });

      setEditingChannel(null);
    } catch (error) {
      console.error("Error updating channel:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить клуб",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Нет добавленных клубов. Добавьте первый клуб выше.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Ссылка</TableHead>
              <TableHead>Тренер по умолчанию</TableHead>
              <TableHead className="w-[120px]">Тип парсинга</TableHead>
              <TableHead className="w-[100px]">Активен</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => (
              <TableRow key={channel.id}>
                <TableCell className="font-medium">{channel.name}</TableCell>
                <TableCell>
                  <a
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    @{channel.username}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {channel.default_coach || "—"}
                </TableCell>
                <TableCell>
                  {channel.parse_images ? (
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Image className="h-3 w-3" />
                      Картинки
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <FileText className="h-3 w-3" />
                      Текст
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={channel.is_active}
                    onCheckedChange={(checked) =>
                      handleToggleActive(channel.id, checked)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(channel)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить клуб?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Вы уверены, что хотите удалить клуб "{channel.name}"?
                            Это действие нельзя отменить.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(channel.id, channel.name)}
                          >
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingChannel} onOpenChange={(open) => !open && setEditingChannel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать клуб</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Название клуба</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-coach">Тренер по умолчанию</Label>
              <Input
                id="edit-coach"
                placeholder="Имя тренера (если у клуба один тренер)"
                value={editDefaultCoach}
                onChange={(e) => setEditDefaultCoach(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Если указан, будет использоваться для всех тренировок этого клуба, где тренер не указан
              </p>
            </div>
            <div className="space-y-2">
              <Label>Локация по умолчанию</Label>
              <Select
                value={editDefaultLocationId || "none"}
                onValueChange={(v) => setEditDefaultLocationId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите локацию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не выбрана</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        {loc.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Если указана, будет отображаться для всех тренировок этого клуба
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-permanent-url">Постоянная ссылка для записи</Label>
              <Input
                id="edit-permanent-url"
                placeholder="https://t.me/club_bot или ссылка на форму"
                value={editPermanentSignupUrl}
                onChange={(e) => setEditPermanentSignupUrl(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Если указана, все карточки тренировок клуба будут вести на эту ссылку
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChannel(null)}>
              Отмена
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editName.trim()}>
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}