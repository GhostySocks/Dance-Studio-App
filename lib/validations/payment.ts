import { z } from "zod";

export const createIntentSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
});

export const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().startsWith("pi_", "Invalid payment intent"),
});

export const billingAccountSchema = z.object({
  accountType: z.enum(["family", "student"]),
  accountId: z.string().min(1, "accountId is required"),
});

export const confirmAutoPaySchema = billingAccountSchema.extend({
  setupIntentId: z.string().startsWith("seti_", "Invalid setup intent"),
});
