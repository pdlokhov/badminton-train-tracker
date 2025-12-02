import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Training {
  id: string;
  channel_id: string;
  message_id: string;
  title: string | null;
  type: string | null;
  date: string | null;
  time_start: string | null;
  time_end: string | null;
  coach: string | null;
  level: string | null;
  price: number | null;
  location: string | null;
  spots: number | null;
  signup_url?: string | null;
  is_recurring?: boolean;
  recurring_template_id?: string | null;
  channels?: {
    name: string;
    default_coach: string | null;
    username: string;
  };
  locationDisplay?: string | null;
}

interface AdminTrainingsTableProps {
  trainings: Training[];
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  onEdit: (training: Training) => void;
  onDelete: (trainingId: string) => void;
}

const getLevelBadgeClass = (level: string | null) => {
  if (!level) return "";
  const l = level.toLowerCase();
  if (l.includes("f") || l.includes("начин")) return "bg-red-500/10 text-red-600 dark:text-red-400";
  if (l.includes("d-e") || l.includes("d/e")) return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
  if (l.includes("c-d") || l.includes("c/d")) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
  if (l.includes("b-c") || l.includes("b/c")) return "bg-green-500/10 text-green-600 dark:text-green-400";
  if (l.includes("1.0") || l.includes("2.0")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (l.includes("все") || l.includes("all") || l.includes("любой")) return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
  return "bg-muted text-muted-foreground";
};

export function AdminTrainingsTable({
  trainings,
  sortColumn,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}: AdminTrainingsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formatTime = (start: string | null, end: string | null) => {
    if (!start) return "—";
    const s = start.substring(0, 5);
    const e = end ? end.substring(0, 5) : null;
    return e ? `${s} - ${e}` : s;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: ru });
    } catch {
      return dateStr;
    }
  };

  const getTelegramUrl = (training: Training) => {
    // Priority: signup_url (manual), then auto-parsed message URL
    if (training.signup_url) {
      return training.signup_url;
    }
    if (training.channels?.username && training.message_id) {
      return `https://t.me/${training.channels.username}/${training.message_id}`;
    }
    return undefined;
  };

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${
            sortColumn === column ? "text-foreground" : "text-muted-foreground/50"
          }`}
        />
      </div>
    </TableHead>
  );

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <SortableHeader column="date">Дата</SortableHeader>
            <SortableHeader column="time">Время</SortableHeader>
            <SortableHeader column="type">Тип</SortableHeader>
            <SortableHeader column="coach">Тренер</SortableHeader>
            <SortableHeader column="level">Уровень</SortableHeader>
            <SortableHeader column="price">Цена</SortableHeader>
            <TableHead>Место</TableHead>
            <SortableHeader column="club">Клуб</SortableHeader>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trainings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                Нет данных о тренировках
              </TableCell>
            </TableRow>
          ) : (
            trainings.map((training) => (
              <TableRow key={training.id} className="hover:bg-muted/20">
                <TableCell className="font-medium whitespace-nowrap">
                  {formatDate(training.date)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatTime(training.time_start, training.time_end)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {training.type && (
                      <Badge variant="secondary" className="w-fit">
                        {training.type}
                      </Badge>
                    )}
                    {training.is_recurring && (
                      <Badge variant="outline" className="w-fit border-blue-500/30 text-blue-600 dark:text-blue-400">
                        Регулярная
                      </Badge>
                    )}
                    {training.spots !== null && (
                      <span className="text-xs text-muted-foreground">
                        {training.spots} мест
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {training.coach || training.channels?.default_coach || "—"}
                </TableCell>
                <TableCell>
                  {training.level ? (
                    <Badge className={`${getLevelBadgeClass(training.level)} border-0`}>
                      {training.level}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {training.price !== null ? `${training.price} ₽` : "—"}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <span className="text-sm line-clamp-2">
                    {training.locationDisplay || "—"}
                  </span>
                </TableCell>
                <TableCell>{training.channels?.name || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {getTelegramUrl(training) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="gap-1.5 h-8 px-2"
                      >
                        <a
                          href={getTelegramUrl(training)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(training)}
                      className="h-8 px-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(training.id)}
                      className="h-8 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тренировку?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Тренировка будет удалена из расписания.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) {
                  onDelete(deletingId);
                  setDeletingId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
