"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { InviteLinkNotice, announceInvite, type InviteResult } from "@/components/invite-link-notice";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { newAdminSchema, type NewAdminFormData } from "@/lib/validations/staff";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

interface Admin {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  hasPassword: boolean;
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);
  return typeof json?.error === "string" ? json.error : fallback;
}

function NewAdminForm({
  onCreated,
  onCancel,
}: {
  onCreated: (result: InviteResult) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState } = useForm<NewAdminFormData>({
    resolver: zodResolver(newAdminSchema),
    defaultValues: { name: "", email: "" },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: NewAdminFormData) {
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Could not add administrator"));
        return;
      }
      const { data } = await res.json();
      onCreated({ name: values.name, emailed: data.emailed, inviteUrl: data.inviteUrl });
    } catch {
      toast.error("Could not add administrator. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <RequiredNote />
      <div className="space-y-2">
        <Label htmlFor="admin-name">Full name<RequiredMark /></Label>
        <Input
          id="admin-name" aria-required="true"
          autoComplete="off"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "admin-name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="admin-name-error" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-email">Email<RequiredMark /></Label>
        <Input
          id="admin-email" aria-required="true"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "admin-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="admin-email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Administrators can see and change everything, including billing and other
        administrators.
      </p>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Adding…" : "Add administrator"}
        </Button>
      </div>
    </form>
  );
}

/** Settings card: who the administrators are, with a way to add one. */
export function AdminTeamCard() {
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Admin | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { data: session } = useSession();
  const myId = session?.user?.id;

  async function removeAdmin() {
    if (!removing) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/admins/${removing.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(await readError(res, "Could not remove administrator"));
      } else {
        toast.success(`${removing.name} is no longer an administrator.`);
        load();
      }
      setRemoving(null);
    } catch {
      toast.error("Could not remove administrator. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admins");
      if (!res.ok) throw new Error("Failed");
      setAdmins((await res.json()).data);
    } catch {
      setAdmins([]);
      toast.error("Failed to load administrators");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendLink(admin: Admin) {
    setSendingTo(admin.id);
    try {
      const res = await fetch(`/api/staff/${admin.id}/invite`, { method: "POST" });
      if (!res.ok) {
        toast.error(await readError(res, "Could not send the link"));
        return;
      }
      const { data } = await res.json();
      const result = { name: admin.name, emailed: data.emailed, inviteUrl: data.inviteUrl };
      announceInvite(result, false);
      setInvite(result);
    } catch {
      toast.error("Could not send the link. Please try again.");
    } finally {
      setSendingTo(null);
    }
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Administrators</CardTitle>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add administrator
        </Button>
      </CardHeader>
      <CardContent>
        {admins === null ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : (
          <ul className="divide-y">
            {admins.map((admin) => (
              <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {admin.name}
                    {admin.role === "SUPER_ADMIN" && <Badge variant="secondary">Owner</Badge>}
                    {!admin.hasPassword && <Badge variant="outline">Invited</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{admin.email}</p>
                </div>
                <div className="flex gap-2">
                  {!admin.hasPassword && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sendingTo === admin.id}
                      onClick={() => sendLink(admin)}
                    >
                      {sendingTo === admin.id ? "Sending…" : "Resend invitation"}
                      <span className="sr-only"> to {admin.name}</span>
                    </Button>
                  )}
                  {admin.id === myId ? (
                    <Badge variant="outline">You</Badge>
                  ) : (
                    admin.role !== "SUPER_ADMIN" && (
                      <Button variant="destructive" size="sm" onClick={() => setRemoving(admin)}>
                        Remove
                        <span className="sr-only"> {admin.name}</span>
                      </Button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Teachers are added on the Teachers page.
        </p>
      </CardContent>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add administrator"
        description="They will get a link to choose their own password."
        className="max-w-md"
      >
        <NewAdminForm
          onCancel={() => setAdding(false)}
          onCreated={(result) => {
            setAdding(false);
            announceInvite(result, true);
            setInvite(result);
            load();
          }}
        />
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? "administrator"}?`}
        description="They will be signed out and will no longer be able to sign in. You can add them again later with the same email address."
        className="max-w-md"
      >
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setRemoving(null)} disabled={isRemoving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={removeAdmin} disabled={isRemoving}>
            {isRemoving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Remove administrator
          </Button>
        </div>
      </Modal>

      <InviteLinkNotice result={invite} onClose={() => setInvite(null)} />
    </Card>
  );
}
