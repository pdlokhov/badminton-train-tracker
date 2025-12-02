import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trainingSchema, type TrainingFormData } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManualTrainingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingTraining?: {
    id: string;
    channel_id: string;
    date: string;
    time_start: string;
    time_end: string | null;
    title: string | null;
    type: string | null;
    level: string | null;
    coach: string | null;
    location_id: string | null;
    spots: number | null;
    price: number | null;
    description: string | null;
    signup_url: string | null;
  } | null;
}

export function ManualTrainingForm({
  open,
  onOpenChange,
  onSuccess,
  editingTraining,
}: ManualTrainingFormProps) {
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<TrainingFormData>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      channel_id: "",
      date: undefined,
      time_start: "",
      time_end: "",
      title: "",
      type: "",
      level: "",
      coach: "",
      location_id: "",
      spots: "" as any,
      price: "" as any,
      description: "",
      signup_url: "",
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      const [channelsRes, locationsRes] = await Promise.all([
        supabase.from("channels").select("id, name").eq("is_active", true).order("name"),
        supabase.from("locations").select("id, name").order("name"),
      ]);

      if (channelsRes.data) setChannels(channelsRes.data);
      if (locationsRes.data) setLocations(locationsRes.data);
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (editingTraining && open) {
      form.reset({
        channel_id: editingTraining.channel_id,
        date: new Date(editingTraining.date),
        time_start: editingTraining.time_start,
        time_end: editingTraining.time_end || "",
        title: editingTraining.title || "",
        type: editingTraining.type || "",
        level: editingTraining.level || "",
        coach: editingTraining.coach || "",
        location_id: editingTraining.location_id || "",
        spots: (editingTraining.spots ?? "") as any,
        price: (editingTraining.price ?? "") as any,
        description: editingTraining.description || "",
        signup_url: editingTraining.signup_url || "",
      });
    } else if (!editingTraining && open) {
      form.reset({
        channel_id: "",
        date: undefined,
        time_start: "",
        time_end: "",
        title: "",
        type: "",
        level: "",
        coach: "",
        location_id: "",
        spots: "" as any,
        price: "" as any,
        description: "",
        signup_url: "",
      });
    }
  }, [editingTraining, open, form]);

  const onSubmit = async (data: TrainingFormData) => {
    setIsSubmitting(true);
    try {
      const trainingData = {
        channel_id: data.channel_id,
        date: format(data.date, "yyyy-MM-dd"),
        time_start: data.time_start,
        time_end: data.time_end || null,
        title: data.title || null,
        type: data.type || null,
        level: data.level || null,
        coach: data.coach || null,
        location_id: data.location_id || null,
        spots: data.spots ? Number(data.spots) : null,
        price: data.price ? Number(data.price) : null,
        description: data.description || null,
        signup_url: data.signup_url || null,
        message_id: editingTraining?.id ? editingTraining.id.split("_")[0] : `manual_${Date.now()}`,
        raw_text: "Создано вручную",
      };

      if (editingTraining) {
        const { error } = await supabase
          .from("trainings")
          .update(trainingData)
          .eq("id", editingTraining.id);

        if (error) throw error;

        toast({
          title: "Тренировка обновлена",
          description: "Изменения успешно сохранены",
        });
      } else {
        const { error } = await supabase.from("trainings").insert(trainingData);

        if (error) throw error;

        toast({
          title: "Тренировка создана",
          description: "Тренировка успешно добавлена в расписание",
        });
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving training:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось сохранить тренировку",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTraining ? "Редактировать тренировку" : "Добавить тренировку"}
          </DialogTitle>
          <DialogDescription>
            Заполните параметры тренировки для добавления в расписание
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="channel_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Клуб *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите клуб" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Дата *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "d MMMM yyyy", { locale: ru })
                            ) : (
                              <span>Выберите дату</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Время начала *</FormLabel>
                    <FormControl>
                      <Input placeholder="20:00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="time_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Время окончания</FormLabel>
                    <FormControl>
                      <Input placeholder="22:00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип</FormLabel>
                    <FormControl>
                      <Input placeholder="Групповая, игровая и т.д." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название тренировки" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Уровень</FormLabel>
                    <FormControl>
                      <Input placeholder="C-D, D-E, F+ и т.д." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="coach"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тренер</FormLabel>
                    <FormControl>
                      <Input placeholder="Имя тренера" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Локация (необязательно)</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите локацию или оставьте пустым" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="spots"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Количество мест</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена (₽)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="signup_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ссылка на запись (Telegram)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://t.me/username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Дополнительная информация о тренировке"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Сохранение..."
                  : editingTraining
                  ? "Сохранить"
                  : "Добавить"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
