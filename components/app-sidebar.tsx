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
  Wallet,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeft,
  UserCheck,
  Settings,
  CalendarRange,
  ClipboardList,
} from "lucide-react";
import { StudioLogo } from "@/components/studio-logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = { label?: string; items: NavItem[] };

const adminNav: NavGroup[] = [
  { items: [{ title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }] },
  {
    label: "Students",
    items: [
      { title: "Students", href: "/admin/students", icon: Users },
      { title: "Families", href: "/admin/families", icon: UserCircle },
      { title: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
    ],
  },
  {
    label: "Classes",
    items: [
      { title: "Schedule", href: "/admin/schedule", icon: Calendar },
      { title: "Classes", href: "/admin/classes", icon: BookOpen },
      { title: "Class Enrollments", href: "/admin/enrollments", icon: UserCheck },
      { title: "Terms", href: "/admin/terms", icon: CalendarRange },
      { title: "Term Enrollments", href: "/admin/registrations", icon: ClipboardList },
      { title: "Rooms", href: "/admin/rooms", icon: DoorOpen },
    ],
  },
  {
    label: "Teachers",
    items: [
      { title: "Teachers", href: "/admin/teachers", icon: GraduationCap },
      { title: "Teacher Pay", href: "/admin/teacher-pay", icon: Wallet },
    ],
  },
  {
    label: "Billing",
    items: [
      { title: "Invoices", href: "/admin/billing", icon: Receipt },
      { title: "Scholarships & Pricing", href: "/admin/scholarships", icon: Award },
      { title: "Reports", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  { label: "Studio", items: [{ title: "Settings", href: "/admin/settings", icon: Settings }] },
];

/** Shown to an administrator who also has a teacher profile */
const myTeachingNav: NavGroup = {
  label: "My teaching",
  items: [
    { title: "My Classes", href: "/teacher/classes", icon: BookOpen },
    { title: "Take Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
    { title: "My Report", href: "/teacher/report", icon: BarChart3 },
  ],
};

/** Shown to staff who also take classes (they have their own student record) */
const classesITakeNav: NavGroup = {
  label: "Classes I take",
  items: [
    { title: "My Schedule", href: "/student/schedule", icon: Calendar },
    { title: "My Attendance", href: "/student/attendance", icon: UserCheck },
    { title: "My Billing", href: "/student/billing", icon: Receipt },
  ],
};

const teacherNav: NavItem[] = [
  { title: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { title: "My Classes", href: "/teacher/classes", icon: BookOpen },
  { title: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
  { title: "My Report", href: "/teacher/report", icon: BarChart3 },
];

const parentNav: NavItem[] = [
  { title: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  { title: "My Students", href: "/parent/students", icon: Users },
  { title: "Schedule", href: "/parent/schedule", icon: Calendar },
  { title: "Attendance", href: "/parent/attendance", icon: ClipboardCheck },
  { title: "Billing", href: "/parent/billing", icon: Receipt },
];

const studentNav: NavItem[] = [
  { title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { title: "Schedule", href: "/student/schedule", icon: Calendar },
  { title: "Attendance", href: "/student/attendance", icon: ClipboardCheck },
  { title: "Billing", href: "/student/billing", icon: Receipt },
];

function getNavForRole(
  role: string,
  teaches: boolean,
  takesClasses: boolean
): { label: string; groups: NavGroup[] } {
  const own = [...(teaches ? [myTeachingNav] : []), ...(takesClasses ? [classesITakeNav] : [])];
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      // Dashboard first, then their own teaching, then the rest of the studio
      return {
        label: "Administration",
        groups: [adminNav[0], ...own, ...adminNav.slice(1)],
      };
    case "TEACHER":
      return {
        label: "Teacher Portal",
        groups: takesClasses
          ? [{ items: [teacherNav[0]] }, { label: "My teaching", items: teacherNav.slice(1) }, classesITakeNav]
          : [{ items: teacherNav }],
      };
    case "PARENT":
      return { label: "Parent Portal", groups: [{ items: parentNav }] };
    case "STUDENT":
      return { label: "Student Portal", groups: [{ items: studentNav }] };
    default:
      return { label: "Navigation", groups: [] };
  }
}

export function AppSidebar({
  role,
  teaches = false,
  takesClasses = false,
  collapsed,
  onToggle,
}: {
  role: string;
  /** The account has a teacher profile (only changes an administrator's menu) */
  teaches?: boolean;
  /** The account has its own student record (adds Classes I take for staff) */
  takesClasses?: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const nav = getNavForRole(role, teaches, takesClasses);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-14 items-center border-b", collapsed ? "px-2" : "px-4")}>
        <Link href="/" className={cn("flex items-center overflow-hidden", collapsed && "mx-auto")}>
          {collapsed ? (
            <StudioLogo variant="stacked" alt="Boss Dance Studio" className="h-10" priority />
          ) : (
            <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
              <StudioLogo alt="Boss Dance Studio" className="h-9" priority />
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
        <nav aria-label={nav.label} className="px-2">
          {nav.groups.map((group, index) => (
            <div
              key={group.label ?? index}
              role={group.label ? "group" : undefined}
              aria-label={group.label}
              className={cn("space-y-0.5", index > 0 && (collapsed ? "mt-2 border-t pt-2" : "mt-4"))}
            >
              {group.label && !collapsed && (
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
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
            </div>
          ))}
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
