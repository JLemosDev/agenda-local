import {
  SERVICES,
  PROFESSIONALS,
  defaultDate,
  validDate,
  availableSlots,
  validateBooking,
} from "../../../lib/agenda-domain.mjs";
import {
  session,
  listAppointments,
  occupied,
  insertAppointment,
  enforceWrite,
  failure,
} from "../../../lib/agenda-store";
export async function GET(request: Request) {
  try {
    const s = await session(request),
      url = new URL(request.url),
      date = url.searchParams.get("date") || defaultDate();
    validDate(date);
    const serviceId = url.searchParams.get("serviceId") || "corte",
      professionalId = url.searchParams.get("professionalId") || "ana";
    let slots: string[] = [];
    let dayMessage: string | undefined;
    try {
      slots = availableSlots(
        date,
        serviceId,
        professionalId,
        await occupied(s.id, date, professionalId),
      );
    } catch (error) {
      dayMessage =
        error instanceof Error ? error.message : "Não há horários disponíveis.";
    }
    return Response.json(
      {
        appointments: await listAppointments(s.id, date),
        services: SERVICES,
        professionals: PROFESSIONALS,
        slots,
        date,
        defaultDate: defaultDate(),
        dayMessage,
      },
      { headers: { "Set-Cookie": s.cookie, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    enforceWrite(request);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }
    const data = validateBooking(input),
      s = await session(request),
      appointment = await insertAppointment(s.id, data);
    return Response.json(
      { appointment },
      {
        status: 201,
        headers: { "Set-Cookie": s.cookie, "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
