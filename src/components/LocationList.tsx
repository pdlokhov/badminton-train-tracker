import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Location {
  id: string;
  name: string;
  address: string | null;
  aliases: string[] | null;
  created_at: string;
}

interface LocationListProps {
  refreshTrigger: number;
}

export const LocationList = ({ refreshTrigger }: LocationListProps) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", aliases: "" });
  const { toast } = useToast();

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить локации",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [refreshTrigger]);

  const handleDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Локация удалена",
        description: `${name} удалена из списка`,
      });
      fetchLocations();
    } catch (error) {
      console.error("Error deleting location:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить локацию",
        variant: "destructive",
      });
    }
  };

  const startEdit = (location: Location) => {
    setEditingId(location.id);
    setEditForm({
      name: location.name,
      address: location.address || "",
      aliases: location.aliases?.join(", ") || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", address: "", aliases: "" });
  };

  const saveEdit = async (id: string) => {
    try {
      const aliasesArray = editForm.aliases
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      const { error } = await supabase
        .from("locations")
        .update({
          name: editForm.name.trim(),
          address: editForm.address.trim() || null,
          aliases: aliasesArray,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Локация обновлена",
        description: `${editForm.name} успешно обновлена`,
      });
      
      setEditingId(null);
      fetchLocations();
    } catch (error) {
      console.error("Error updating location:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить локацию",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Загрузка локаций...</div>;
  }

  if (locations.length === 0) {
    return (
      <div className="text-muted-foreground">
        Локации не добавлены. Добавьте первую локацию выше.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Адрес</TableHead>
          <TableHead>Алиасы</TableHead>
          <TableHead className="w-[100px]">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {locations.map((location) => (
          <TableRow key={location.id}>
            <TableCell>
              {editingId === location.id ? (
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="h-8"
                />
              ) : (
                <span className="font-medium">{location.name}</span>
              )}
            </TableCell>
            <TableCell>
              {editingId === location.id ? (
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="h-8"
                />
              ) : (
                location.address || "—"
              )}
            </TableCell>
            <TableCell>
              {editingId === location.id ? (
                <Input
                  value={editForm.aliases}
                  onChange={(e) => setEditForm({ ...editForm, aliases: e.target.value })}
                  placeholder="alias1, alias2"
                  className="h-8"
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {location.aliases?.map((alias, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {alias}
                    </Badge>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell>
              {editingId === location.id ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => saveEdit(location.id)}
                    className="h-8 w-8"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelEdit}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(location)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(location.id, location.name)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
