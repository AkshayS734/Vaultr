import { z } from "zod";

export const emailSchema = z
  .string()
  .email()
  .max(254);

export const passwordSchema = z
  .string()
  .min(8)
  .max(128);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(2048).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
