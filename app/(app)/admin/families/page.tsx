"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { Toaster } from "@/components/ui/sonner";
import {
  familyGroupSchema,
  type FamilyGroupFormData,
} from "@/lib/validations/family";

interface Guardian {
  guardian: {
    user: {
      name: string | null;
      email: string;
    };
  };
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

interface Family {
  id: string;
  name: string;
  students: Student[];
  guardians: Guardian[];
}

export default function FamiliesPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Family[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFamily, setDeletingFamily] = useState<Family | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FamilyGroupFormData>({
    resolver: zodResolver(familyGroupSchema),
  });

  const fetchFamilies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "10",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/families?${params}`);
      const json = await res.json();
      if (res.ok) {
        setFamilies(json.data.families);
        setTotalPages(json.data.totalPages);
      } else {
        toast.error("Failed to load families");
      }
    } catch {
      toast.error("Failed to load families");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  function openAddDialog() {
    setEditingFamily(null);
    reset({ name: "" });
    setDialogOpen(true);
  }

  function openEditDialog(family: Family) {
    setEditingFamily(family);
    reset({ name: family.name });
    setDialogOpen(true);
  }

  function openDeleteDialog(family: Family) {
    setDeletingFamily(family);
    setDeleteDialogOpen(true);
  }

  async function onSubmit(data: FamilyGroupFormData) {
    try {
      if (editingFamily) {
        const res = await fetch(`/api/families/${editingFamily.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        toast.success("Family updated");
      } else {
        const res = await fetch("/api/families", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        toast.success("Family created");
      }
      setDialogOpen(false);
      fetchFamilies();
    } catch {
      toast.error(editingFamily ? "Failed to update family" : "Failed to create family");
    }
  }

  async function onDelete() {
    if (!deletingFamily) return;
    try {
      const res = await fetch(`/api/families/${deletingFamily.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Family deleted");
      setDeleteDialogOpen(false);
      setDeletingFamily(null);
      fetchFamilies();
    } catch {
      toast.error("Failed to delete family");
    }
  }

  const columns: ColumnDef<Family>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Family Name",
      },
      {
        id: "students",
        header: "Students",
        cell: ({ row }) => {
          const students = row.original.students;
          if (!students || students.length === 0) return "None";
          if (students.length <= 3) {
            return students
              .map((s) => `${s.firstName} ${s.lastName}`)
              .join(", ");
          }
          return `${students.length} students`;
        },
      },
      {
        id: "guardians",
        header: "Guardians",
        cell: ({ row }) => {
          const guardians = row.original.guardians;
          if (!guardians || guardians.length === 0) return "None";
          return guardians
            .map((g) => g.guardian.user.name || g.guardian.user.email)
            .join(", ");
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const family = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => router.push(`/admin/families/${family.id}`)}
                title="View"
              >
                <Eye />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEditDialog(family)}
                title="Edit"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openDeleteDialog(family)}
                title="Delete"
              >
                <Trash2 />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router]
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Families" description="Manage family groups">
        <Button onClick={openAddDialog}>
          <Plus data-icon="inline-start" />
          Add Family
        </Button>
      </PageHeader>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search families..."
      />

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={families}
            pageCount={totalPages}
            page={page}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFamily ? "Edit Family" : "Add Family"}
            </DialogTitle>
            <DialogDescription>
              {editingFamily
                ? "Update the family group name."
                : "Create a new family group."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="family-name">Family Name</Label>
              <Input
                id="family-name"
                placeholder="e.g. The Smith Family"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingFamily
                    ? "Update"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Family</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deletingFamily?.name}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
