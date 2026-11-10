import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
// bcrypt only reads the first 72 bytes
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer");

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});

export const resetPasswordFormSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const childSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  dateOfBirth: z
    .string()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
      message: "Enter a valid date",
    })
    .refine((v) => v === "" || new Date(v) <= new Date(), { message: "Date cannot be in the future" }),
});

export const studioSchema = z.object({
  name: z.string().trim().min(1, "Studio name is required").max(120),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), email]),
  website: z.union([z.literal(""), z.string().trim().url("Enter a full URL, starting with https://").max(300)]),
  timezone: z.string().refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Choose a valid timezone" }
  ),
  billingCycleDay: z.number().int().min(1, "Use a day from 1 to 28").max(28, "Use a day from 1 to 28"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;
export type ChildFormData = z.infer<typeof childSchema>;
export type StudioFormData = z.infer<typeof studioSchema>;
