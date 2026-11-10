/** Where each role lands after signing in. Safe to import from client components. */
export function portalHome(role: string | undefined): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "/admin/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
    case "PARENT":
      return "/parent/dashboard";
    case "STUDENT":
      return "/student/dashboard";
    default:
      return "/";
  }
}
