"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  GraduationCap,
  Calendar,
  DoorOpen,
  BookOpen,
  Receipt,
  Award,
  BarChart3,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeft,
  UserCheck,
  Settings,
  CalendarRange,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const adminNav: NavItem[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Students", href: "/admin/students", icon: Users },
  { title: "Families", href: "/admin/families", icon: UserCircle },
  { title: "Teachers", href: "/admin/teachers", icon: GraduationCap },
  { title: "Classes", href: "/admin/classes", icon: BookOpen },
  { title: "Rooms", href: "/admin/rooms", icon: DoorOpen },
  { title: "Terms", href: "/admin/terms", icon: CalendarRange },
  { title: "Enrollments", href: "/admin/enrollments", icon: UserCheck },
  { title: "Registrations", href: "/admin/registrations", icon: ClipboardList },
  { title: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  { title: "Schedule", href: "/admin/schedule", icon: Calendar },
  { title: "Billing", href: "/admin/billing", icon: Receipt },
  { title: "Scholarships", href: "/admin/scholarships", icon: Award },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

const teacherNav: NavItem[] = [
  { title: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { title: "My Classes", href: "/teacher/classes", icon: BookOpen },
  { title: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
];

const parentNav: NavItem[] = [
  { title: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { title: "My Students", href: "/parent/students", icon: Users },
  { title: "Schedule", href: "/parent/schedule", icon: Calendar },
  { title: "Billing", href: "/parent/billing", icon: Receipt },
];

const studentNav: NavItem[] = [
  { title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { title: "Schedule", href: "/student/schedule", icon: Calendar },
  { title: "Billing", href: "/student/billing", icon: Receipt },
];

function getNavForRole(role: string): { label: string; items: NavItem[] } {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return { label: "Administration", items: adminNav };
    case "TEACHER":
      return { label: "Teacher Portal", items: teacherNav };
    case "PARENT":
      return { label: "Parent Portal", items: parentNav };
    case "STUDENT":
      return { label: "Student Portal", items: studentNav };
    default:
      return { label: "Navigation", items: [] };
  }
}

export function AppSidebar({
  role,
  collapsed,
  onToggle,
}: {
  role: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const nav = getNavForRole(role);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm">
            DS
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-semibold text-lg whitespace-nowrap"
            >
              Dance Studio
            </motion.span>
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {!collapsed && (
          <p className="px-4 mb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            {nav.label}
          </p>
        )}
        <nav aria-label={nav.label} className="space-y-0.5 px-2">
          {nav.items.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.title : undefined}
                aria-label={collapsed ? item.title : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center rounded-xl hover:bg-accent"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
