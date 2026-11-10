"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordFormSchema, type ResetPasswordFormData } from "@/lib/validations/account";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: ResetPasswordFormData) {
    try {
      const res = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(typeof json?.error === "string" ? json.error : "Could not reset password");
        return;
      }
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch {
      toast.error("Could not reset password. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : "password-hint"}
          {...register("password")}
        />
        {errors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : (
          <p id="password-hint" className="text-sm text-muted-foreground">
            At least 8 characters.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isSubmitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
