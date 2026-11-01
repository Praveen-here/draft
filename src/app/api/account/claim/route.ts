// POST /api/account/claim { deviceId } → after signing in, move what this device saved before (documents, the
// tutor's memory) into the signed-in account. Needs a session; the device id is the browser's own (learnerId()).

import { auth, authReady } from "@/lib/server/auth";
import { adoptDeviceLearner } from "@/lib/server/learnerStore";

export async function POST(request: Request) {
  await authReady();
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { deviceId?: string } | null;
  const moved = body?.deviceId ? await adoptDeviceLearner(session.user.id, body.deviceId) : null;
  return Response.json({ moved: moved ?? { documents: 0, problems: 0 } });
}
