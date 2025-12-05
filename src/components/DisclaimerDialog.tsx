import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const VISITOR_ID_KEY = "disclaimer_visitor_id";
const ACKNOWLEDGED_KEY = "disclaimer_acknowledged";

const generateVisitorId = (): string => {
  return "visitor_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const getOrCreateVisitorId = (): string => {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
};

export function DisclaimerDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkDisclaimerStatus();
  }, []);

  const checkDisclaimerStatus = async () => {
    try {
      // Priority 1: Check localStorage (for PWA and offline)
      const localAcknowledged = localStorage.getItem(ACKNOWLEDGED_KEY);
      if (localAcknowledged === "true") {
        setIsLoading(false);
        return;
      }

      // Priority 2: Check database
      const visitorId = getOrCreateVisitorId();
      const { data: hasAcknowledged } = await supabase
        .rpc("check_disclaimer", { p_visitor_id: visitorId });

      if (hasAcknowledged) {
        // Sync localStorage with database
        localStorage.setItem(ACKNOWLEDGED_KEY, "true");
      } else {
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error checking disclaimer status:", error);
      // On network error, show dialog only if no local acknowledgment
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      const visitorId = getOrCreateVisitorId();
      
      await supabase
        .from("disclaimer_acknowledgments")
        .insert({ visitor_id: visitorId });

      // Save locally for PWA
      localStorage.setItem(ACKNOWLEDGED_KEY, "true");
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving disclaimer acknowledgment:", error);
      // Even on error, save locally to not annoy the user
      localStorage.setItem(ACKNOWLEDGED_KEY, "true");
      setIsOpen(false);
    }
  };

  if (isLoading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md mx-4 p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center mb-4">
            Привет, дорогой друг!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Это приложение я написал в свободное время, чтобы упростить поиск и запись на тренировки по бадминтону и популяризировать мой любимый вид спорта.
          </p>
          
          <p>
            Я не связан с клубами и залами, но постарался собрать полное расписание в одном месте.
          </p>
          
          <p>
            Приложение не идеальное, но выполняет основную задачу — помогает найти удобную тренировку по бадминтону.
          </p>
          
          <p>
            Если вы нашли ошибку или знаете как сделать приложение еще лучше — напишите мне. Я буду рад любой обратной связи.
          </p>
        </div>

        <Button 
          onClick={handleAcknowledge} 
          className="w-full mt-6"
          size="lg"
        >
          OK
        </Button>
      </DialogContent>
    </Dialog>
  );
}
