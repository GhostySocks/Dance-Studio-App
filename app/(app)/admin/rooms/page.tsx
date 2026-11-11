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
import { Card, CardContent } from "@/components/ui/card";

import { roomSchema, type RoomFormData } from "@/lib/validations/room";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

interface Room {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<RoomFormData, unknown, z.output<typeof roomSchema>>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: "",
      description: "",
      capacity: 1,
    },
  });

  const fetchRooms = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "10",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/rooms?${params}`);
      if (!res.ok) throw new Error("Failed to fetch rooms");
      const json = await res.json();
      setRooms(json.data.rooms);
      setTotalPages(json.data.totalPages);
    } catch {
      toast.error("Failed to load rooms");
    }
  }, [page, search]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  function openAddDialog() {
    setEditingRoom(null);
    form.reset({
      name: "",
      description: "",
      capacity: 1,
    });
    setDialogOpen(true);
  }

  function openEditDialog(room: Room) {
    setEditingRoom(room);
    form.reset({
      name: room.name,
      description: room.description ?? "",
      capacity: room.capacity,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: Record<string, unknown>) {
    setIsSubmitting(true);
    try {
      const url = editingRoom
        ? `/api/rooms/${editingRoom.id}`
        : "/api/rooms";
      const method = editingRoom ? "PUT" : "POST";

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
        editingRoom
          ? "Room updated successfully"
          : "Room created successfully"
      );
      setDialogOpen(false);
      fetchRooms();
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
      const res = await fetch(`/api/rooms/${deleteConfirmId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete room");
      toast.success("Room deleted successfully");
      setDeleteConfirmId(null);
      fetchRooms();
    } catch {
      toast.error("Failed to delete room");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: ColumnDef<Room>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        accessorKey: "capacity",
        header: "Capacity",
        cell: ({ row }) => <span>{row.original.capacity}</span>,
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
      <PageHeader title="Rooms" description="Manage studio rooms">
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 mb-4">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search rooms..."
        />
      </div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={rooms}
            pageCount={totalPages}
            page={page}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Add / Edit Room Modal */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingRoom ? "Edit Room" : "Add Room"}
        description={
          editingRoom
            ? "Update the room's information."
            : "Fill in the details to create a new room."
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <RequiredNote />
          <div className="grid gap-2">
            <Label htmlFor="name">Name<RequiredMark /></Label>
            <Input
              id="name" aria-required="true"
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
              placeholder="Room description..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="capacity">Capacity<RequiredMark /></Label>
            <Input
              id="capacity" aria-required="true"
              type="number"
              min={1}
              {...form.register("capacity")}
              aria-invalid={!!form.formState.errors.capacity}
            />
            {form.formState.errors.capacity && (
              <p className="text-xs text-destructive">
                {form.formState.errors.capacity.message}
              </p>
            )}
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
              {editingRoom ? "Save Changes" : "Create Room"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Room"
        description="Are you sure you want to delete this room? This action cannot be undone."
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
