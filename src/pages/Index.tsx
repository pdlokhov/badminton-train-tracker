import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelForm } from "@/components/ChannelForm";
import { ChannelList } from "@/components/ChannelList";
import { LocationForm } from "@/components/LocationForm";
import { LocationList } from "@/components/LocationList";
import { TrainingsList } from "@/components/TrainingsList";
import { Header } from "@/components/Header";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("schedule");
  const { toast } = useToast();
  const { isAdmin, isLoading } = useAuth();
  const isMobile = useIsMobile();

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onMenuClick={() => setAdminMenuOpen(true)} />
      
      <main className="flex-1 px-4 pb-24 md:px-6 md:pb-8">
        <div className="mx-auto max-w-6xl">
          {/* Hero Section */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground md:text-4xl">
              Тренировки сегодня в СПБ
            </h1>
            <p className="mt-1 text-muted-foreground">
              Собираем расписание из Telegram-каналов и площадок.
            </p>
          </div>
          
          {isAdmin ? (
            <Tabs defaultValue="schedule" className="space-y-4">
              <TabsList className="bg-muted">
                <TabsTrigger value="schedule">Расписание</TabsTrigger>
                <TabsTrigger value="channels">Каналы</TabsTrigger>
                <TabsTrigger value="locations">Локации</TabsTrigger>
                <TabsTrigger value="analytics">Аналитика</TabsTrigger>
              </TabsList>

              <TabsContent value="schedule">
                <TrainingsList refreshTrigger={refreshTrigger} isAdmin={true} />
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

              <TabsContent value="analytics">
                <Card>
                  <CardHeader>
                    <CardTitle>Аналитика</CardTitle>
                    <CardDescription>
                      Статистика посещений и поведения пользователей
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AnalyticsDashboard />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <TrainingsList refreshTrigger={refreshTrigger} />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && !isAdmin && (
        <MobileBottomNav activeTab={mobileTab} onTabChange={setMobileTab} />
      )}

      {/* Admin Sheet Menu */}
      {isAdmin && (
        <Sheet open={adminMenuOpen} onOpenChange={setAdminMenuOpen}>
          <SheetContent className="bg-background">
            <SheetHeader>
              <SheetTitle>Меню администратора</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <Button
                onClick={() => {
                  handleParse();
                  setAdminMenuOpen(false);
                }}
                disabled={isParsing}
                className="w-full"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isParsing ? "animate-spin" : ""}`} />
                {isParsing ? "Парсинг..." : "Обновить расписание"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {!isMobile && <Footer />}

      {/* Cookie Consent Banner */}
      <CookieConsent />
    </div>
  );
};

export default Index;
