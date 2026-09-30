import {
  session,
  updateAppointment,
  enforceWrite,
  failure,
} from "../../../../lib/agenda-store";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    enforceWrite(request);
    let input: { status?: string };
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }
    const { id } = await context.params,
      s = await session(request),
      appointment = await updateAppointment(s.id, id, input.status ?? "");
    return Response.json(
      { appointment },
      { headers: { "Set-Cookie": s.cookie, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
