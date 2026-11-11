"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fadeIn } from "@/lib/motion";
import { portalHome } from "@/lib/portal";
import { cn } from "@/lib/utils";
import { registrationSchema, type RegistrationFormData } from "@/lib/validations/registration";

const emptyDancer = { firstName: "", lastName: "", dateOfBirth: "", enroll: true };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function RegisterForm({
  sessionId,
  termChoice,
  className,
}: {
  /** The class date picked on the schedule, if any. */
  sessionId?: string;
  /** Or a whole-term registration picked on the class page. */
  termChoice?: RegistrationFormData["termChoice"];
  className?: string;
}) {
  const hasSelection = !!sessionId || !!termChoice;
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      accountType: "PARENT",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      dateOfBirth: "",
      dancers: [emptyDancer],
      sessionId,
      termChoice,
    },
  });
  const { register, handleSubmit, watch, setValue, control, formState } = form;
  const { errors, isSubmitting } = formState;
  const dancers = useFieldArray({ control, name: "dancers" });
  const accountType = watch("accountType");

  function chooseType(type: RegistrationFormData["accountType"]) {
    setValue("accountType", type);
    if (type === "PARENT" && dancers.fields.length === 0) dancers.append(emptyDancer);
  }

  async function onSubmit(values: RegistrationFormData) {
    setFormError(null);
    const payload =
      values.accountType === "STUDENT" ? { ...values, dancers: [] } : { ...values, dateOfBirth: "" };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof json?.error === "string" ? json.error : "Registration failed";
        setFormError(message);
        toast.error(message);
        return;
      }

      const { enrolled = 0, waitlisted = 0 } = json?.data ?? {};
      toast.success(
        waitlisted > 0 && enrolled === 0
          ? "Account created. The class is full, so you are on the waitlist."
          : enrolled > 0
            ? "Account created and enrollment confirmed."
            : "Account created."
      );

      const signedIn = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      router.push(signedIn?.error ? "/login" : portalHome(values.accountType));
      router.refresh();
    } catch {
      setFormError("Registration failed. Please try again.");
      toast.error("Registration failed. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn("space-y-8", className)}>
      <div>
        <p id="account-type-label" className="text-sm font-medium">
          Who are you registering?
        </p>
        <div
          role="radiogroup"
          aria-labelledby="account-type-label"
          className="mt-2 grid gap-3 sm:grid-cols-2"
        >
          {(
            [
              ["PARENT", "My child or children", "You manage their classes and billing."],
              ["STUDENT", "Myself", "You are an adult taking classes."],
            ] as const
          ).map(([type, title, hint]) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={accountType === type}
              onClick={() => chooseType(type)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                accountType === type
                  ? "border-primary bg-accent"
                  : "border-border bg-white hover:bg-muted"
              )}
            >
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Your details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              autoComplete="given-name"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? "firstName-error" : undefined}
              {...register("firstName")}
            />
            <FieldError id="firstName-error" message={errors.firstName?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              autoComplete="family-name"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? "lastName-error" : undefined}
              {...register("lastName")}
            />
            <FieldError id="lastName-error" message={errors.lastName?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              {...register("phone")}
            />
            <FieldError id="phone-error" message={errors.phone?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : "password-hint"}
              {...register("password")}
            />
            {errors.password ? (
              <FieldError id="password-error" message={errors.password.message} />
            ) : (
              <p id="password-hint" className="text-sm text-muted-foreground">
                At least 8 characters.
              </p>
            )}
          </div>
          {accountType === "STUDENT" && (
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth (optional)</Label>
              <Input
                id="dateOfBirth"
                type="date"
                autoComplete="bday"
                aria-invalid={!!errors.dateOfBirth}
                aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : undefined}
                {...register("dateOfBirth")}
              />
              <FieldError id="dateOfBirth-error" message={errors.dateOfBirth?.message} />
            </div>
          )}
        </div>
      </fieldset>

      {accountType === "PARENT" && (
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold">Dancers</legend>
          <AnimatePresence initial={false}>
            {dancers.fields.map((field, index) => {
              const fieldErrors = errors.dancers?.[index];
              return (
                <motion.div
                  key={field.id}
                  layout={!reduceMotion}
                  variants={fadeIn}
                  initial={reduceMotion ? false : "hidden"}
                  animate="visible"
                  exit={reduceMotion ? undefined : "hidden"}
                  className="rounded-2xl border border-border/60 bg-muted/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Dancer {index + 1}</p>
                    {dancers.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => dancers.remove(index)}
                        aria-label={`Remove dancer ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`dancer-${index}-first`}>First name</Label>
                      <Input
                        id={`dancer-${index}-first`}
                        aria-invalid={!!fieldErrors?.firstName}
                        aria-describedby={fieldErrors?.firstName ? `dancer-${index}-first-error` : undefined}
                        {...register(`dancers.${index}.firstName`)}
                      />
                      <FieldError
                        id={`dancer-${index}-first-error`}
                        message={fieldErrors?.firstName?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`dancer-${index}-last`}>Last name</Label>
                      <Input
                        id={`dancer-${index}-last`}
                        aria-invalid={!!fieldErrors?.lastName}
                        aria-describedby={fieldErrors?.lastName ? `dancer-${index}-last-error` : undefined}
                        {...register(`dancers.${index}.lastName`)}
                      />
                      <FieldError
                        id={`dancer-${index}-last-error`}
                        message={fieldErrors?.lastName?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`dancer-${index}-dob`}>Date of birth (optional)</Label>
                      <Input
                        id={`dancer-${index}-dob`}
                        type="date"
                        aria-invalid={!!fieldErrors?.dateOfBirth}
                        aria-describedby={fieldErrors?.dateOfBirth ? `dancer-${index}-dob-error` : undefined}
                        {...register(`dancers.${index}.dateOfBirth`)}
                      />
                      <FieldError
                        id={`dancer-${index}-dob-error`}
                        message={fieldErrors?.dateOfBirth?.message}
                      />
                    </div>
                  </div>
                  {hasSelection && (
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                        {...register(`dancers.${index}.enroll`)}
                      />
                      {termChoice
                        ? "Register this dancer for the selected term"
                        : "Enroll this dancer in the selected class"}
                    </label>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {typeof errors.dancers?.message === "string" && (
            <p className="text-sm text-destructive">{errors.dancers.message}</p>
          )}
          {dancers.fields.length < 8 && (
            <Button type="button" variant="outline" onClick={() => dancers.append(emptyDancer)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add another dancer
            </Button>
          )}
        </fieldset>
      )}

      {formError && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isSubmitting} className="h-11 px-6 text-base">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Creating account…" : hasSelection ? "Create account and register" : "Create account"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
