"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { NewTeacherForm } from "@/components/forms/new-teacher-form";
import { InviteLinkNotice, announceInvite, type InviteResult } from "@/components/invite-link-notice";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  sessions: { id: string }[];
}

const columns: ColumnDef<Teacher, unknown>[] = [
  {
    accessorKey: "user.name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.user.name ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "user.email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.user.email}</span>
    ),
  },
  {
    accessorKey: "specialties",
    header: "Specialties",
    cell: ({ row }) => {
      const specialties = row.original.specialties;
      if (!specialties || specialties.length === 0) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {specialties.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    id: "upcomingClasses",
    header: "Upcoming Classes",
    cell: ({ row }) => row.original.sessions.length,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Link href={`/admin/teachers/${row.original.id}`}>
        <Button variant="ghost" size="sm">
          <Eye className="mr-1 h-4 w-4" />
          View
        </Button>
      </Link>
    ),
  },
];

export default function AdminTeachersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        page: String(page),
        perPage: "10",
      });
      const res = await fetch(`/api/teachers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch teachers");
      const json = await res.json();
      setTeachers(json.data.teachers);
      setTotalPages(json.data.totalPages);
    } catch {
      setTeachers([]);
      toast.error("Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        description="Manage your studio's teaching staff"
      >
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add teacher
        </Button>
      </PageHeader>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add teacher"
        description="They will get a link to choose their own password."
      >
        <NewTeacherForm
          onCancel={() => setAdding(false)}
          onCreated={(result) => {
            setAdding(false);
            announceInvite(result, true);
            setInvite(result);
            fetchTeachers();
          }}
        />
      </Modal>
      <InviteLinkNotice result={invite} onClose={() => setInvite(null)} />

      <SearchInput
        value={search}
        onChange={handleSearch}
        placeholder="Search teachers by name or email..."
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading teachers...</p>
        </div>
      ) : (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={teachers}
              pageCount={totalPages}
              page={page}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
