import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelForm } from "@/components/ChannelForm";
import { ChannelList } from "@/components/ChannelList";
import { LocationForm } from "@/components/LocationForm";
import { LocationList } from "@/components/LocationList";
import { TrainingsList } from "@/components/TrainingsList";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const handleChannelAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLocationAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleParse = async () => {
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-channels");

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Парсинг завершён",
          description: `${data.message}. Найдено: ${data.parsed}, добавлено: ${data.added}`,
        });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast({
        title: "Ошибка парсинга",
        description: error instanceof Error ? error.message : "Не удалось запустить парсинг",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Расписание тренировок</h1>
          <Button onClick={handleParse} disabled={isParsing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isParsing ? "animate-spin" : ""}`} />
            {isParsing ? "Парсинг..." : "Обновить расписание"}
          </Button>
        </div>
        
        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">Расписание</TabsTrigger>
            <TabsTrigger value="channels">Каналы</TabsTrigger>
            <TabsTrigger value="locations">Локации</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <TrainingsList refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="channels">
            <Card>
              <CardHeader>
                <CardTitle>Клубы</CardTitle>
                <CardDescription>
                  Добавьте клубы с расписанием тренировок для парсинга
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChannelForm onChannelAdded={handleChannelAdded} />
                <ChannelList refreshTrigger={refreshTrigger} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle>Справочник локаций</CardTitle>
                <CardDescription>
                  Добавьте локации для автоматического распознавания в постах
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <LocationForm onLocationAdded={handleLocationAdded} />
                <LocationList refreshTrigger={refreshTrigger} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;