"use client";

import type { z } from "zod";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatCurrency } from "@/lib/utils";
import { StyledSelect } from "@/components/styled-select";

import {
  classTemplateSchema,
  type ClassTemplateFormData,
} from "@/lib/validations/class";

interface ClassTemplate {
  id: string;
  name: string;
  description: string | null;
  danceStyle: string | null;
  skillLevel: string | null;
  defaultDurationMins: number;
  basePriceCents: number;
  _count?: { sessions: number };
}

const DANCE_STYLES = [
  "Ballet",
  "Hip Hop",
  "Jazz",
  "Contemporary",
  "Tap",
  "Modern",
  "Lyrical",
  "Other",
];

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "All Levels"];


export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassTemplate[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<ClassTemplateFormData, unknown, z.output<typeof classTemplateSchema>>({
    resolver: zodResolver(classTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      danceStyle: "",
      skillLevel: "",
      defaultDurationMins: 60,
      basePriceCents: 0,
    },
  });

  const fetchClasses = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "10",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/classes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch classes");
      const json = await res.json();
      setClasses(json.data.templates ?? []);
      setTotalPages(json.data.totalPages ?? 1);
    } catch {
      toast.error("Failed to load classes");
    }
  }, [page, search]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  function openAddDialog() {
    setEditingClass(null);
    form.reset({
      name: "",
      description: "",
      danceStyle: "",
      skillLevel: "",
      defaultDurationMins: 60,
      basePriceCents: 0,
    });
    setDialogOpen(true);
  }

  function openEditDialog(cls: ClassTemplate) {
    setEditingClass(cls);
    form.reset({
      name: cls.name,
      description: cls.description ?? "",
      danceStyle: cls.danceStyle ?? "",
      skillLevel: cls.skillLevel ?? "",
      defaultDurationMins: cls.defaultDurationMins,
      basePriceCents: cls.basePriceCents,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: Record<string, unknown>) {
    setIsSubmitting(true);
    try {
      const url = editingClass
        ? `/api/classes/${editingClass.id}`
        : "/api/classes";
      const method = editingClass ? "PUT" : "POST";

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
        editingClass
          ? "Class updated successfully"
          : "Class created successfully"
      );
      setDialogOpen(false);
      fetchClasses();
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
      const res = await fetch(`/api/classes/${deleteConfirmId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete class");
      toast.success("Class deleted successfully");
      setDeleteConfirmId(null);
      fetchClasses();
    } catch {
      toast.error("Failed to delete class");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: ColumnDef<ClassTemplate>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "danceStyle",
        header: "Dance Style",
        cell: ({ row }) =>
          row.original.danceStyle ? (
            <Badge variant="secondary">{row.original.danceStyle}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "skillLevel",
        header: "Skill Level",
        cell: ({ row }) => (
          <span>{row.original.skillLevel || "-"}</span>
        ),
      },
      {
        accessorKey: "defaultDurationMins",
        header: "Duration (mins)",
        cell: ({ row }) => <span>{row.original.defaultDurationMins}</span>,
      },
      {
        accessorKey: "basePriceCents",
        header: "Price",
        cell: ({ row }) => (
          <span>{formatCurrency(row.original.basePriceCents)}</span>
        ),
      },
      {
        accessorKey: "sessions",
        header: "Upcoming Sessions",
        cell: ({ row }) => (
          <span>{row.original._count?.sessions ?? 0}</span>
        ),
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
    []
  );

  return (
    <div>
      <PageHeader
        title="Class Templates"
        description="Manage class templates for scheduling"
      >
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Class
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 mb-4">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search classes..."
        />
      </div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={classes}
            pageCount={totalPages}
            page={page}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Add / Edit Class Modal */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingClass ? "Edit Class" : "Add Class"}
        description={
          editingClass
            ? "Update the class template information."
            : "Fill in the details to create a new class template."
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Class description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="danceStyle">Dance Style</Label>
              <StyledSelect
                value={form.watch("danceStyle") ?? ""}
                onChange={(val) => form.setValue("danceStyle", val)}
                options={DANCE_STYLES.map((style) => ({
                  value: style,
                  label: style,
                }))}
                placeholder="Select style"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="skillLevel">Skill Level</Label>
              <StyledSelect
                value={form.watch("skillLevel") ?? ""}
                onChange={(val) => form.setValue("skillLevel", val)}
                options={SKILL_LEVELS.map((level) => ({
                  value: level,
                  label: level,
                }))}
                placeholder="Select level"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="defaultDurationMins">Duration (minutes)</Label>
              <Input
                id="defaultDurationMins"
                type="number"
                min={1}
                {...form.register("defaultDurationMins")}
                aria-invalid={!!form.formState.errors.defaultDurationMins}
              />
              {form.formState.errors.defaultDurationMins && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.defaultDurationMins.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="basePriceCents">Price ($)</Label>
              <Input
                id="basePriceCents"
                type="number"
                min={0}
                step="0.01"
                value={(Number(form.watch("basePriceCents") ?? 0) / 100).toFixed(2)}
                onChange={(e) => form.setValue("basePriceCents", Math.round(Number(e.target.value) * 100))}
                aria-invalid={!!form.formState.errors.basePriceCents}
              />
              {form.formState.errors.basePriceCents && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.basePriceCents.message}
                </p>
              )}
            </div>
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
              {editingClass ? "Save Changes" : "Create Class"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Class"
        description="Are you sure you want to delete this class template? This action cannot be undone."
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
