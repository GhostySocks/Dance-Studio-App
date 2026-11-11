"use client";

import type { z } from "zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/styled-select";

import { studentSchema, type StudentFormData } from "@/lib/validations/student";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  medicalNotes: string | null;
  notes: string | null;
  guardianId: string | null;
  familyGroupId: string | null;
  familyGroup: { id: string; name: string } | null;
  guardian: {
    id: string;
    user: { name: string | null; email: string };
  } | null;
  enrollments: { id: string }[];
}

interface Family {
  id: string;
  name: string;
  guardians: {
    guardian: {
      id: string;
      user: { name: string | null; email: string };
    };
  }[];
}

interface Guardian {
  id: string;
  name: string;
  email: string;
}

export default function StudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [families, setFamilies] = useState<Family[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<StudentFormData, unknown, z.output<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      medicalNotes: "",
      notes: "",
      guardianId: "",
      familyGroupId: "",
    },
  });

  const fetchStudents = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "10",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/students?${params}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      const json = await res.json();
      setStudents(json.data.students);
      setTotalPages(json.data.totalPages);
    } catch {
      toast.error("Failed to load students");
    }
  }, [page, search]);

  const fetchFamiliesAndGuardians = useCallback(async () => {
    try {
      const res = await fetch("/api/families?perPage=100");
      if (!res.ok) throw new Error("Failed to fetch families");
      const json = await res.json();
      const fams: Family[] = json.data.families;
      setFamilies(fams);

      const guardianMap = new Map<string, Guardian>();
      for (const fam of fams) {
        for (const fg of fam.guardians) {
          const g = fg.guardian;
          if (!guardianMap.has(g.id)) {
            guardianMap.set(g.id, {
              id: g.id,
              name: g.user.name || g.user.email,
              email: g.user.email,
            });
          }
        }
      }
      setGuardians(Array.from(guardianMap.values()));
    } catch {
      toast.error("Failed to load families");
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchFamiliesAndGuardians();
  }, [fetchFamiliesAndGuardians]);

  function openAddDialog() {
    setEditingStudent(null);
    form.reset({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      medicalNotes: "",
      notes: "",
      guardianId: "",
      familyGroupId: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(student: Student) {
    setEditingStudent(student);
    form.reset({
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth
        ? new Date(student.dateOfBirth).toISOString().split("T")[0]
        : "",
      email: student.email ?? "",
      phone: student.phone ?? "",
      medicalNotes: student.medicalNotes ?? "",
      notes: student.notes ?? "",
      guardianId: student.guardianId ?? "",
      familyGroupId: student.familyGroupId ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: Record<string, unknown>) {
    setIsSubmitting(true);
    try {
      const url = editingStudent
        ? `/api/students/${editingStudent.id}`
        : "/api/students";
      const method = editingStudent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.toString() || "Request failed");
      }

      toast.success(
        editingStudent
          ? "Student updated successfully"
          : "Student created successfully"
      );
      setDialogOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/students/${deleteConfirmId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete student");
      toast.success("Student deleted successfully");
      setDeleteConfirmId(null);
      fetchStudents();
    } catch {
      toast.error("Failed to delete student");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: ColumnDef<Student>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <button
            className="font-medium text-left hover:underline"
            onClick={() =>
              router.push(`/admin/students/${row.original.id}`)
            }
          >
            {row.original.firstName} {row.original.lastName}
          </button>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.email || "-"}
          </span>
        ),
      },
      {
        accessorKey: "familyGroup",
        header: "Family Group",
        cell: ({ row }) =>
          row.original.familyGroup ? (
            <Badge variant="secondary">
              {row.original.familyGroup.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "guardian",
        header: "Guardian",
        cell: ({ row }) =>
          row.original.guardian ? (
            <span>
              {row.original.guardian.user.name ||
                row.original.guardian.user.email}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "enrollments",
        header: "Active Classes",
        cell: ({ row }) => <span>{row.original.enrollments.length}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(row.original)}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirmId(row.original.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router]
  );

  return (
    <div>
      <PageHeader title="Students" description="Manage student records">
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 mb-4">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search students..."
        />
      </div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={students}
            pageCount={totalPages}
            page={page}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Add / Edit Student Modal */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingStudent ? "Edit Student" : "Add Student"}
        description={
          editingStudent
            ? "Update the student's information."
            : "Fill in the details to create a new student."
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <RequiredNote />
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name<RequiredMark /></Label>
              <Input
                id="firstName" aria-required="true"
                {...form.register("firstName")}
                aria-invalid={!!form.formState.errors.firstName}
              />
              {form.formState.errors.firstName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name<RequiredMark /></Label>
              <Input
                id="lastName" aria-required="true"
                {...form.register("lastName")}
                aria-invalid={!!form.formState.errors.lastName}
              />
              {form.formState.errors.lastName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              {...form.register("dateOfBirth")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="guardianId">Guardian</Label>
            <StyledSelect
              value={form.watch("guardianId") ?? ""}
              onChange={(val) => form.setValue("guardianId", val)}
              options={[
                { value: "", label: "None" },
                ...guardians.map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="familyGroupId">Family Group</Label>
            <StyledSelect
              value={form.watch("familyGroupId") ?? ""}
              onChange={(val) => form.setValue("familyGroupId", val)}
              options={[
                { value: "", label: "None" },
                ...families.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="medicalNotes">Medical Notes</Label>
            <Textarea
              id="medicalNotes"
              {...form.register("medicalNotes")}
              placeholder="Any medical conditions or allergies..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingStudent ? "Save Changes" : "Create Student"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Student"
        description="Are you sure you want to delete this student? This action cannot be undone."
        className="max-w-sm"
      >
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setDeleteConfirmId(null)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
