"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { teacherMessageFormSchema, type TeacherMessageFormData } from "@/lib/validations/teacher-message";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

function MessageForm({
  teacherId,
  teacherName,
  className,
  onDone,
}: {
  teacherId: string;
  teacherName: string;
  className: string;
  onDone: () => void;
}) {
  const { register, handleSubmit, formState } = useForm<TeacherMessageFormData>({
    resolver: zodResolver(teacherMessageFormSchema),
    defaultValues: { subject: `Question about ${className}`, message: "" },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: TeacherMessageFormData) {
    try {
      const res = await fetch("/api/portal/teacher-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, ...values }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(typeof json?.error === "string" ? json.error : "Could not send your message");
        return;
      }
      toast.success(`Your message was sent to ${teacherName}.`);
      onDone();
    } catch {
      toast.error("Could not send your message. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <RequiredNote />
      <div className="space-y-2">
        <Label htmlFor="teacher-message-subject">Subject<RequiredMark /></Label>
        <Input
          id="teacher-message-subject" aria-required="true"
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? "teacher-message-subject-error" : undefined}
          {...register("subject")}
        />
        {errors.subject && (
          <p id="teacher-message-subject-error" className="text-sm text-destructive">
            {errors.subject.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="teacher-message-body">Message<RequiredMark /></Label>
        <Textarea
          id="teacher-message-body" aria-required="true"
          rows={6}
          autoFocus
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "teacher-message-body-error" : "teacher-message-body-hint"}
          {...register("message")}
        />
        {errors.message ? (
          <p id="teacher-message-body-error" className="text-sm text-destructive">
            {errors.message.message}
          </p>
        ) : (
          <p id="teacher-message-body-hint" className="text-sm text-muted-foreground">
            {teacherName} will see your name and email address and can reply to you directly.
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}

/**
 * "Email your teacher": opens a short form and sends the message through the
 * studio, so the teacher's own email address is never shown.
 */
export function EmailTeacherButton({
  teacherId,
  teacherName,
  className,
}: {
  teacherId: string;
  teacherName: string;
  /** The class the button sits next to; used for the default subject. */
  className: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Mail className="h-3.5 w-3.5" aria-hidden />
        Email your teacher
        <span className="sr-only">
          , {teacherName}, about {className}
        </span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Email ${teacherName}`}
        description={`About ${className}`}
        className="max-w-lg"
      >
        <MessageForm
          teacherId={teacherId}
          teacherName={teacherName}
          className={className}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
