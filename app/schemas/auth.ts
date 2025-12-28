import { z } from "zod";

export const emailSchema = z
  .string()
  .email()
  .max(254);

// NIST SP 800-63B: minimum length >= 12 for new credentials
export const passwordSchema = z
  .string()
  .min(12)
  .max(128);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  encryptedVaultKey: z.string(),
  salt: z.string(),
  kdfParams: z.record(z.unknown()),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(2048).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
