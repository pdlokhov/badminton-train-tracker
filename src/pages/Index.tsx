import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelForm } from "@/components/ChannelForm";
import { ChannelList } from "@/components/ChannelList";

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleChannelAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold">Расписание тренировок</h1>
        
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
