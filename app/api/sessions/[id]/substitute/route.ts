import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { assignSubstitute, removeSubstitute, SubstituteError } from "@/lib/db/substitutes";
import { substituteSchema } from "@/lib/validations/substitute";

function fail(error: unknown, label: string) {
  if (error instanceof SubstituteError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(`${label} /api/sessions/[id]/substitute error:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Puts a substitute teacher in charge of this class date. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = substituteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const result = await assignSubstitute({
      sessionId: params.id,
      substituteTeacherId: parsed.data.teacherId,
      reason: parsed.data.reason,
      actorId: session.user.id,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return fail(error, "POST");
  }
}

/** Hands this class date back to its regular teacher. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const result = await removeSubstitute({ sessionId: params.id, actorId: session.user.id });
    return NextResponse.json({ data: result });
  } catch (error) {
    return fail(error, "DELETE");
  }
}
