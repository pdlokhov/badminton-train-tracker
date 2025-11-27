import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelForm } from "@/components/ChannelForm";
import { ChannelList } from "@/components/ChannelList";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const handleChannelAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleParse = async () => {
    setIsParsing(true);
    try {
      // TODO: Implement parser edge function call
      toast({
        title: "Парсинг",
        description: "Функция парсинга будет добавлена",
      });
    } catch (error) {
      console.error("Parse error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось запустить парсинг",
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
        
        <Tabs defaultValue="channels" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">Расписание</TabsTrigger>
            <TabsTrigger value="channels">Каналы</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Расписание тренировок</CardTitle>
                <CardDescription>
                  Здесь будет отображаться расписание из добавленных каналов
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Добавьте каналы во вкладке "Каналы" для начала парсинга
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels">
            <Card>
              <CardHeader>
                <CardTitle>Управление каналами</CardTitle>
                <CardDescription>
                  Добавьте Telegram каналы для парсинга расписания тренировок
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ChannelForm onChannelAdded={handleChannelAdded} />
                <ChannelList refreshTrigger={refreshTrigger} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
