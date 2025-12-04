import { z } from "zod";

export const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Введите название клуба")
    .max(100, "Название не должно превышать 100 символов"),
  url: z
    .string()
    .trim()
    .min(1, "Введите ссылку на канал")
    .max(255, "Ссылка не должна превышать 255 символов"),
  defaultCoach: z
    .string()
    .trim()
    .max(100, "Имя тренера не должно превышать 100 символов")
    .optional(),
  parseImages: z.boolean().default(false),
  topicId: z.coerce
    .number()
    .int("ID топика должен быть целым числом")
    .positive("ID топика должен быть положительным")
    .optional()
    .or(z.literal("")),
});

export const locationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Введите название локации")
    .max(100, "Название не должно превышать 100 символов"),
  address: z
    .string()
    .trim()
    .max(255, "Адрес не должен превышать 255 символов")
    .optional(),
  aliases: z
    .string()
    .trim()
    .max(500, "Алиасы не должны превышать 500 символов")
    .optional(),
});

export const trainingSchema = z.object({
  channel_id: z.string().uuid("Выберите клуб"),
  date: z.date({ required_error: "Выберите дату" }),
  time_start: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Формат времени: ЧЧ:ММ")
    .min(1, "Введите время начала"),
  time_end: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Формат времени: ЧЧ:ММ")
    .optional()
    .or(z.literal("")),
  title: z
    .string()
    .trim()
    .max(200, "Название не должно превышать 200 символов")
    .optional()
    .or(z.literal("")),
  type: z
    .string()
    .trim()
    .max(100, "Тип не должен превышать 100 символов")
    .optional()
    .or(z.literal("")),
  level: z
    .string()
    .trim()
    .max(50, "Уровень не должен превышать 50 символов")
    .optional()
    .or(z.literal("")),
  coach: z
    .string()
    .trim()
    .max(100, "Имя тренера не должно превышать 100 символов")
    .optional()
    .or(z.literal("")),
  location_id: z.string().uuid().optional().or(z.literal("")),
  spots: z.coerce
    .number()
    .int("Количество мест должно быть целым числом")
    .min(0, "Количество мест не может быть отрицательным")
    .optional()
    .or(z.literal("")),
  price: z.coerce
    .number()
    .min(0, "Цена не может быть отрицательной")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .max(1000, "Описание не должно превышать 1000 символов")
    .optional()
    .or(z.literal("")),
  signup_url: z
    .string()
    .trim()
    .url("Введите корректный URL")
    .max(500, "URL не должен превышать 500 символов")
    .optional()
    .or(z.literal("")),
  is_recurring: z.boolean().default(false),
  recurring_until: z.date().optional(),
}).refine(
  (data) => {
    // If is_recurring is true, recurring_until must be set
    if (data.is_recurring && !data.recurring_until) {
      return false;
    }
    return true;
  },
  {
    message: "Выберите дату окончания для регулярных тренировок",
    path: ["recurring_until"],
  }
);

export type ChannelFormData = z.infer<typeof channelSchema>;
export type LocationFormData = z.infer<typeof locationSchema>;
export type TrainingFormData = z.infer<typeof trainingSchema>;
