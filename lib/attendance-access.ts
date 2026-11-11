import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkAttendanceAccess } from "@/lib/db/attendance";
import { getStudioInfo } from "@/lib/db/recipients";
import { dayIn, endOfDayIn } from "@/lib/timezone";

/** The last second of today in the studio's timezone. */
export async function endOfStudioToday(): Promise<Date> {
  const { timezone } = await getStudioInfo();
  return endOfDayIn(timezone, dayIn(timezone, new Date()));
}

/**
 * Session + permission check for the attendance routes. Returns the signed-in
 * session, or the response to send back (401, 403 or 404).
 */
export async function requireAttendanceAccess(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const access = await checkAttendanceAccess(session.user, sessionId, await endOfStudioToday());
  if (access === "not-found") {
    return { session: null, response: NextResponse.json({ error: "Class not found" }, { status: 404 }) };
  }
  if (access === "forbidden") {
    return {
      session: null,
      response: NextResponse.json(
        { error: "You can only take attendance for your own classes, up to two weeks back." },
        { status: 403 }
      ),
    };
  }
  return { session, response: null };
}
