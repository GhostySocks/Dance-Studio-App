"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/lib/validations/account";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: ForgotPasswordFormData) {
    try {
      const res = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(typeof json?.error === "string" ? json.error : "Something went wrong");
        return;
      }
      setSentTo(values.email);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <p role="status" className="text-center text-sm text-muted-foreground">
          If there is an account for <span className="font-medium text-foreground">{sentTo}</span>,
          we sent a link to reset the password. It expires in 1 hour.
        </p>
        <p className="text-center text-sm">
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we will send you a link to choose a new one."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
