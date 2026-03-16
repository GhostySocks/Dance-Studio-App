"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { teacherSchema, type TeacherFormData } from "@/lib/validations/teacher";
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
}

export default function AdminTeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string;

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
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
        specialties: teacher.specialties,
        phone: teacher.phone ?? "",
      });
    }
  }, [teacher, reset]);

  const onSubmit = async (data: TeacherFormData) => {
    setSaving(true);
    try {
      // Split specialties from comma-separated string if it comes as a string
      const specialties =
        typeof data.specialties === "string"
          ? (data.specialties as unknown as string)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : data.specialties;

      const res = await fetch(`/api/teachers/${teacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: data.bio || null,
          specialties,
          phone: data.phone || null,
        }),
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
        specialties: teacher.specialties,
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

      <PageHeader title={teacher.user.name ?? "Teacher"} />

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
                  defaultValue={teacher.specialties.join(", ")}
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
