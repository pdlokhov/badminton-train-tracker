import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { locationSchema } from "@/lib/validations";

interface LocationFormProps {
  onLocationAdded: () => void;
}

export const LocationForm = ({ onLocationAdded }: LocationFormProps) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [aliases, setAliases] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate with zod schema
    const validation = locationSchema.safeParse({
      name,
      address,
      aliases,
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

    setIsSubmitting(true);
    try {
      const aliasesArray = aliases
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      const { error } = await supabase.from("locations").insert({
        name: name.trim(),
        address: address.trim() || null,
        aliases: aliasesArray.length > 0 ? aliasesArray : [],
      });

      if (error) {
        if (error.code === "42501") {
          toast({
            title: "Ошибка доступа",
            description: "У вас нет прав для добавления локаций",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Локация добавлена",
        description: `${name} успешно добавлена`,
      });

      setName("");
      setAddress("");
      setAliases("");
      onLocationAdded();
    } catch (error) {
      console.error("Error adding location:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить локацию",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="name">Название</Label>
          <Input
            id="name"
            placeholder="Цех №1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Адрес</Label>
          <Input
            id="address"
            placeholder="Оптиков 4"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aliases">Алиасы (через запятую)</Label>
          <Input
            id="aliases"
            placeholder="Цех, Цех1"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            maxLength={500}
          />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        <Plus className="mr-2 h-4 w-4" />
        {isSubmitting ? "Добавление..." : "Добавить локацию"}
      </Button>
    </form>
  );
};
