import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, ExternalLink } from "lucide-react";
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

interface Channel {
  id: string;
  name: string;
  url: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

interface ChannelListProps {
  refreshTrigger: number;
}

export function ChannelList({ refreshTrigger }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список каналов",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
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
        description: isActive ? "Канал активирован" : "Канал деактивирован",
      });
    } catch (error) {
      console.error("Error toggling channel:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус канала",
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
        description: `Канал "${name}" удалён`,
      });
    } catch (error) {
      console.error("Error deleting channel:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить канал",
        variant: "destructive",
      });
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
        Нет добавленных каналов. Добавьте первый канал выше.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Ссылка</TableHead>
            <TableHead className="w-[100px]">Активен</TableHead>
            <TableHead className="w-[80px]">Действия</TableHead>
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
              <TableCell>
                <Switch
                  checked={channel.is_active}
                  onCheckedChange={(checked) =>
                    handleToggleActive(channel.id, checked)
                  }
                />
              </TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить канал?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Вы уверены, что хотите удалить канал "{channel.name}"?
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
