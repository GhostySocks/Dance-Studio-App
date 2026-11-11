import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getTeacherMessageContext, recordTeacherMessage } from "@/lib/db/teacher-messages";
import { sendTeacherMessage } from "@/lib/email";
import { hasRole } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { teacherMessageSchema } from "@/lib/validations/teacher-message";

/**
 * A parent or adult student emails one of their own teachers. The teacher's
 * address is never sent to the browser: the server looks it up and sends the mail,
 * with replies going to the sender.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasRole(session, "PARENT", "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = teacherMessageSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid message" },
        { status: 400 }
      );
    }
    const { teacherId, subject, message } = parsed.data;

    // Only teachers of the sender's own current classes
    const context = await getTeacherMessageContext(session.user.id, teacherId);
    if (!context) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    if (!rateLimit(`teacher-message:${session.user.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "You have sent several messages in the last hour. Please try again later." },
        { status: 429 }
      );
    }

    const result = await sendTeacherMessage(context, subject, message);
    if (!result.sent) {
      return NextResponse.json(
        {
          error:
            "Your message could not be sent because email is not available right now. Please contact the studio directly.",
        },
        { status: 503 }
      );
    }

    await recordTeacherMessage(session.user.id, teacherId);
    return NextResponse.json({ data: { sent: true } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/portal/teacher-messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
