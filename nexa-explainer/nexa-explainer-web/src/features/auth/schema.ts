import { z } from "zod";

export const accessRequestSchema = z.object({
  email: z.email("Ingresa un email válido"),
  message: z.string().max(500).optional(),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;

export const loginSchema = z.object({
  email: z.email("Ingresa un email válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;
