"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { InviteResult } from "@/components/invite-link-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { newTeacherSchema, type NewTeacherFormData } from "@/lib/validations/staff";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

/** Admin adds a teacher. The teacher sets their own password through an emailed link. */
export function NewTeacherForm({
  onCreated,
  onCancel,
}: {
  onCreated: (result: InviteResult) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState } = useForm<NewTeacherFormData>({
    resolver: zodResolver(newTeacherSchema),
    defaultValues: { name: "", email: "", phone: "", specialties: "", bio: "" },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: NewTeacherFormData) {
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not add teacher");
        return;
      }
      onCreated({ name: values.name, emailed: json.data.emailed, inviteUrl: json.data.inviteUrl });
    } catch {
      toast.error("Could not add teacher. Please try again.");
    }
  }

  const error = (id: string, message?: string) =>
    message ? (
      <p id={`${id}-error`} className="text-sm text-destructive">
        {message}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <RequiredNote />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="teacher-name">Full name<RequiredMark /></Label>
          <Input
            id="teacher-name" aria-required="true"
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "teacher-name-error" : undefined}
            {...register("name")}
          />
          {error("teacher-name", errors.name?.message)}
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-email">Email<RequiredMark /></Label>
          <Input
            id="teacher-email" aria-required="true"
            type="email"
            autoComplete="off"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "teacher-email-error" : "teacher-email-hint"}
            {...register("email")}
          />
          {error("teacher-email", errors.email?.message) ?? (
            <p id="teacher-email-hint" className="text-sm text-muted-foreground">
              They sign in with this address.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-phone">Phone (optional)</Label>
          <Input
            id="teacher-phone"
            type="tel"
            autoComplete="off"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "teacher-phone-error" : undefined}
            {...register("phone")}
          />
          {error("teacher-phone", errors.phone?.message)}
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-specialties">Specialties (optional)</Label>
          <Input
            id="teacher-specialties"
            placeholder="Ballet, Contemporary, Jazz"
            aria-invalid={!!errors.specialties}
            aria-describedby={errors.specialties ? "teacher-specialties-error" : undefined}
            {...register("specialties")}
          />
          {error("teacher-specialties", errors.specialties?.message)}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="teacher-bio">Bio (optional)</Label>
        <Textarea
          id="teacher-bio"
          rows={3}
          placeholder="Shown on the public website"
          aria-invalid={!!errors.bio}
          aria-describedby={errors.bio ? "teacher-bio-error" : undefined}
          {...register("bio")}
        />
        {error("teacher-bio", errors.bio?.message)}
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Adding…" : "Add teacher"}
        </Button>
      </div>
    </form>
  );
}
