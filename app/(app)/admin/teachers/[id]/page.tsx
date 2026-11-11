"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  teacherProfileFormSchema,
  type TeacherProfileFormData as TeacherFormData,
} from "@/lib/validations/staff";
import { InviteLinkNotice, announceInvite, type InviteResult } from "@/components/invite-link-notice";
import { Modal } from "@/components/modal";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Session {
  id: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  template: { name: string; danceStyle: string };
  room: { name: string };
  enrollments: { id: string }[];
}

interface Teacher {
  id: string;
  bio: string | null;
  specialties: string[];
  phone: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  sessions: Session[];
  /** Classes they are still due to teach. */
  upcomingCount: number;
}

export default function AdminTeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string;

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [others, setOthers] = useState<{ id: string; name: string }[]>([]);
  const [reassignTo, setReassignTo] = useState("");

  async function openRemove() {
    setReassignTo("");
    setRemoving(true);
    if (!teacher || teacher.upcomingCount === 0) return;
    try {
      const res = await fetch("/api/teachers?perPage=100");
      if (!res.ok) throw new Error("Failed");
      const list: { id: string; user: { name: string | null } }[] = (await res.json()).data.teachers;
      setOthers(
        list.filter((t) => t.id !== teacher.id).map((t) => ({ id: t.id, name: t.user.name ?? "Teacher" }))
      );
    } catch {
      toast.error("Failed to load the other teachers");
    }
  }

  async function removeTeacher() {
    if (!teacher) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/teachers/${teacher.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reassignTo: reassignTo || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not remove teacher");
        return;
      }
      const moved: number = json.data.reassigned;
      toast.success(
        `${teacher.user.name ?? "Teacher"} was removed.` +
          (moved > 0 ? ` ${moved} upcoming class${moved === 1 ? " was" : "es were"} reassigned.` : "")
      );
      router.push("/admin/teachers");
    } catch {
      toast.error("Could not remove teacher. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  }
  const [invite, setInvite] = useState<InviteResult | null>(null);

  async function sendSignInLink() {
    if (!teacher) return;
    setSendingLink(true);
    try {
      const res = await fetch(`/api/staff/${teacher.user.id}/invite`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not send the link");
        return;
      }
      const result = {
        name: teacher.user.name ?? "the teacher",
        emailed: json.data.emailed,
        inviteUrl: json.data.inviteUrl,
      };
      announceInvite(result, false);
      setInvite(result);
    } catch {
      toast.error("Could not send the link. Please try again.");
    } finally {
      setSendingLink(false);
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherProfileFormSchema),
  });

  const fetchTeacher = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}`);
      if (!res.ok) throw new Error("Failed to fetch teacher");
      const json = await res.json();
      setTeacher(json.data);
    } catch {
      toast.error("Failed to load teacher details");
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchTeacher();
  }, [fetchTeacher]);

  useEffect(() => {
    if (teacher) {
      reset({
        bio: teacher.bio ?? "",
        specialties: teacher.specialties.join(", "),
        phone: teacher.phone ?? "",
      });
    }
  }, [teacher, reset]);

  const onSubmit = async (data: TeacherFormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to update teacher");

      const json = await res.json();
      setTeacher((prev) => (prev ? { ...prev, ...json.data } : prev));
      setEditing(false);
      toast.success("Teacher profile updated");
    } catch {
      toast.error("Failed to update teacher");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    if (teacher) {
      reset({
        bio: teacher.bio ?? "",
        specialties: teacher.specialties.join(", "),
        phone: teacher.phone ?? "",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading teacher...</p>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/admin/teachers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Teachers
        </Button>
        <p className="text-muted-foreground">Teacher not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.push("/admin/teachers")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Teachers
      </Button>

      <PageHeader title={teacher.user.name ?? "Teacher"}>
        <Button variant="outline" onClick={sendSignInLink} disabled={sendingLink}>
          {sendingLink ? "Sending…" : "Send sign-in link"}
        </Button>
        <Button variant="destructive" onClick={openRemove}>
          Remove teacher
        </Button>
      </PageHeader>

      <Modal
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Remove ${teacher.user.name ?? "this teacher"}?`}
        description="They will no longer be able to sign in and will not appear on the website. Classes they have already taught, and their attendance records, stay on file under their name."
        className="max-w-lg"
      >
        {teacher.upcomingCount > 0 && (
          <div className="space-y-2">
            <Label htmlFor="reassign-to">
              Who takes over their {teacher.upcomingCount} upcoming class
              {teacher.upcomingCount === 1 ? "" : "es"}?
            </Label>
            <select
              id="reassign-to"
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              aria-describedby="reassign-to-hint"
              className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select a teacher</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p id="reassign-to-hint" className="text-sm text-muted-foreground">
              {others.length === 0
                ? "There is no other teacher yet. Add one first, or delete these classes on the Schedule page."
                : "You can change individual classes afterwards on the Schedule page."}
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setRemoving(false)} disabled={isRemoving}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={removeTeacher}
            disabled={isRemoving || (teacher.upcomingCount > 0 && !reassignTo)}
          >
            {isRemoving ? "Removing…" : "Remove teacher"}
          </Button>
        </div>
      </Modal>
      <InviteLinkNotice result={invite} onClose={() => setInvite(null)} />

      {/* Teacher Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile</CardTitle>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p>{teacher.user.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p>{teacher.user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p>{teacher.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Specialties</p>
                {teacher.specialties.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {teacher.specialties.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">—</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Bio</p>
                <p className="whitespace-pre-wrap">{teacher.bio ?? "—"}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialties">Specialties (comma-separated)</Label>
                <Input
                  id="specialties"
                  placeholder="Ballet, Contemporary, Jazz"
                  {...register("specialties")}
                />
                {errors.specialties && (
                  <p className="text-sm text-destructive">
                    {errors.specialties.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="A short biography..."
                  rows={4}
                  {...register("bio")}
                />
                {errors.bio && (
                  <p className="text-sm text-destructive">{errors.bio.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Recent Classes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {teacher.sessions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              No classes found for this teacher.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Dance Style</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacher.sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {session.template.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {session.template.danceStyle}
                        </Badge>
                      </TableCell>
                      <TableCell>{session.room.name}</TableCell>
                      <TableCell>{formatDateTime(session.startTime)}</TableCell>
                      <TableCell>
                        {session.enrollments.length} / {session.maxCapacity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
