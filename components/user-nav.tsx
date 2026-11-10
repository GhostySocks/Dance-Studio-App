"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserNavProps {
  user: {
    name: string;
    email: string;
    role: string;
    image?: string | null;
  };
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "destructive" as const;
    case "ADMIN":
      return "default" as const;
    case "TEACHER":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function formatRole(role: string): string {
  return role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function UserNav({ user }: UserNavProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            <Badge
              variant={getRoleBadgeVariant(user.role)}
              className="mt-1 w-fit text-xs"
            >
              {formatRole(user.role)}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
