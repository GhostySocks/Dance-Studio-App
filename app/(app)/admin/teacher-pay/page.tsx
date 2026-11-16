import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { TeacherPayReport } from "@/components/reports/teacher-pay-report";
import { authOptions } from "@/lib/auth";
import { getTeacherOptions } from "@/lib/db/teachers";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function TeacherPayPage() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) redirect("/unauthorized");

  return <TeacherPayReport teachers={await getTeacherOptions()} />;
}
