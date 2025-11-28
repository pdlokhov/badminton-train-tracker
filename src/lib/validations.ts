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

export type ChannelFormData = z.infer<typeof channelSchema>;
export type LocationFormData = z.infer<typeof locationSchema>;
