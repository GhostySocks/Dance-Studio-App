import { z } from "zod";

const dateString = z
  .string()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
    message: "Enter a valid date",
  })
  .refine((v) => v === "" || new Date(v) <= new Date(), { message: "Date cannot be in the future" });

export const dancerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  dateOfBirth: dateString,
  /** Enroll this dancer in the class chosen on the way in, if there is one. */
  enroll: z.boolean(),
});

export const registrationSchema = z
  .object({
    /** PARENT registers children; STUDENT is an adult registering themself. */
    accountType: z.enum(["PARENT", "STUDENT"]),
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
    // bcrypt only reads the first 72 bytes
    password: z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer"),
    phone: z.string().trim().max(20, "Phone number is too long"),
    dateOfBirth: dateString,
    dancers: z.array(dancerSchema).max(8, "You can add up to 8 dancers"),
    sessionId: z.string().max(64).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === "PARENT" && data.dancers.length === 0) {
      ctx.addIssue({ code: "custom", path: ["dancers"], message: "Add at least one dancer" });
    }
  });

export type RegistrationFormData = z.infer<typeof registrationSchema>;

export const portalEnrollSchema = z.object({
  studentIds: z.array(z.string().min(1).max(64)).min(1, "Choose at least one dancer").max(8),
  sessionId: z.string().min(1).max(64),
});
