"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { childSchema, type ChildFormData } from "@/lib/validations/account";

/** Lets a parent add another child to their own family. */
export function AddChildForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const { register, handleSubmit, formState } = useForm<ChildFormData>({
    resolver: zodResolver(childSchema),
    defaultValues: { firstName: "", lastName: "", dateOfBirth: "" },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: ChildFormData) {
    try {
      const res = await fetch("/api/parent/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not add child");
        return;
      }
      toast.success(`${values.firstName} was added.`);
      onAdded();
    } catch {
      toast.error("Could not add child. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="child-first">First name</Label>
          <Input
            id="child-first"
            autoFocus
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "child-first-error" : undefined}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p id="child-first-error" className="text-sm text-destructive">
              {errors.firstName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="child-last">Last name</Label>
          <Input
            id="child-last"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "child-last-error" : undefined}
            {...register("lastName")}
          />
          {errors.lastName && (
            <p id="child-last-error" className="text-sm text-destructive">
              {errors.lastName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="child-dob">Date of birth (optional)</Label>
          <Input
            id="child-dob"
            type="date"
            aria-invalid={!!errors.dateOfBirth}
            aria-describedby={errors.dateOfBirth ? "child-dob-error" : undefined}
            {...register("dateOfBirth")}
          />
          {errors.dateOfBirth && (
            <p id="child-dob-error" className="text-sm text-destructive">
              {errors.dateOfBirth.message}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Adding…" : "Add child"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
