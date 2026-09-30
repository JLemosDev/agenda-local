import { env } from "cloudflare:workers";
import {
  AgendaError,
  defaultDate,
  occupancyMinutes,
  minuteToTime,
  SERVICES,
  PROFESSIONALS,
} from "./agenda-domain.mjs";
type Row = {
  id: string;
  client: string;
  service_id: string;
  professional_id: string;
  date: string;
  start_minute: number;
  end_minute: number;
  status: string;
  notes: string;
};
export function database() {
  if (!env.DB) throw new Error("Agenda database binding unavailable");
  return env.DB;
}
export function appointmentView(row: Row) {
  return {
    id: row.id,
    client: row.client,
    serviceId: row.service_id,
    service:
      SERVICES.find((s) => s.id === row.service_id)?.name ?? row.service_id,
    professionalId: row.professional_id,
    professional:
      PROFESSIONALS.find((p) => p.id === row.professional_id)?.name ??
      row.professional_id,
    date: row.date,
    time: minuteToTime(row.start_minute),
    duration: row.end_minute - row.start_minute,
    status: row.status,
    notes: row.notes,
    price: SERVICES.find((s) => s.id === row.service_id)?.price ?? 0,
  };
}
export async function session(request: Request) {
  const match = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)agenda_demo=([a-f0-9-]{36})(?:;|$)/);
  let id = match?.[1];
  if (!id || !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(id))
    id = crypto.randomUUID();
  const db = database();
  const created = await db
    .prepare("INSERT OR IGNORE INTO demo_spaces (id,created_at) VALUES (?,?)")
    .bind(id, Date.now())
    .run();
  if (created.meta.changes) {
    const date = defaultDate();
    const samples = [
      ["Gabriel Santos", "corte", "ana", 540, 570],
      ["Rafael Oliveira", "combo", "bruno", 630, 690],
      ["Lucas Almeida", "barba", "ana", 840, 870],
    ] as const;
    const statements = [];
    for (const [client, service, professional, start, end] of samples) {
      const aid = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            "INSERT INTO appointments (id,space_id,client,service_id,professional_id,date,start_minute,end_minute,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            aid,
            id,
            client,
            service,
            professional,
            date,
            start,
            end,
            "confirmed",
            "Exemplo fictício",
            Date.now(),
          ),
      );
      for (const minute of occupancyMinutes(start, end))
        statements.push(
          db
            .prepare(
              "INSERT INTO occupied_slots (space_id,professional_id,date,minute,appointment_id) VALUES (?,?,?,?,?)",
            )
            .bind(id, professional, date, minute, aid),
        );
    }
    await db.batch(statements);
  }
  return {
    id,
    cookie:
      "agenda_demo=" +
      id +
      "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000" +
      (new URL(request.url).protocol === "https:" ? "; Secure" : ""),
  };
}
export async function listAppointments(space: string, date: string) {
  const result = await database()
    .prepare(
      "SELECT * FROM appointments WHERE space_id=? AND date=? ORDER BY start_minute,created_at",
    )
    .bind(space, date)
    .all<Row>();
  return result.results.map(appointmentView);
}
export async function occupied(
  space: string,
  date: string,
  professional: string,
) {
  const r = await database()
    .prepare(
      "SELECT minute FROM occupied_slots WHERE space_id=? AND date=? AND professional_id=?",
    )
    .bind(space, date, professional)
    .all<{ minute: number }>();
  return r.results.map((x) => x.minute);
}
export async function insertAppointment(
  space: string,
  data: {
    client: string;
    serviceId: string;
    professionalId: string;
    date: string;
    startMinute: number;
    endMinute: number;
    notes: string;
  },
) {
  const db = database();
  const count = await db
    .prepare("SELECT COUNT(*) AS total FROM appointments WHERE space_id=?")
    .bind(space)
    .first<{ total: number }>();
  if ((count?.total ?? 0) >= 200)
    throw new AgendaError(
      "Esta demonstração atingiu o limite de 200 agendamentos.",
      409,
    );
  const id = crypto.randomUUID(),
    statements = [
      db
        .prepare(
          "INSERT INTO appointments (id,space_id,client,service_id,professional_id,date,start_minute,end_minute,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          space,
          data.client,
          data.serviceId,
          data.professionalId,
          data.date,
          data.startMinute,
          data.endMinute,
          "confirmed",
          data.notes,
          Date.now(),
        ),
    ];
  for (const minute of occupancyMinutes(data.startMinute, data.endMinute))
    statements.push(
      db
        .prepare(
          "INSERT INTO occupied_slots (space_id,professional_id,date,minute,appointment_id) VALUES (?,?,?,?,?)",
        )
        .bind(space, data.professionalId, data.date, minute, id),
    );
  try {
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint"))
      throw new AgendaError(
        "Esse horário acabou de ser ocupado. Escolha outro horário.",
        409,
      );
    throw error;
  }
  const row = await db
    .prepare("SELECT * FROM appointments WHERE id=? AND space_id=?")
    .bind(id, space)
    .first<Row>();
  if (!row) throw new Error("Created appointment missing");
  return appointmentView(row);
}
export async function updateAppointment(
  space: string,
  id: string,
  status: string,
) {
  if (!["cancelled", "completed"].includes(status))
    throw new AgendaError("Status inválido.");
  const db = database(),
    row = await db
      .prepare("SELECT * FROM appointments WHERE id=? AND space_id=?")
      .bind(id, space)
      .first<Row>();
  if (!row) throw new AgendaError("Agendamento não encontrado.", 404);
  if (row.status === status) return appointmentView(row);
  if (row.status !== "confirmed")
    throw new AgendaError("Esse agendamento já foi finalizado.", 409);
  const statements = [
    db
      .prepare(
        "UPDATE appointments SET status=? WHERE id=? AND space_id=? AND status='confirmed'",
      )
      .bind(status, id, space),
  ];
  if (status === "cancelled")
    statements.push(
      db
        .prepare(
          "DELETE FROM occupied_slots WHERE appointment_id=? AND space_id=? AND EXISTS (SELECT 1 FROM appointments WHERE id=? AND space_id=? AND status='cancelled')",
        )
        .bind(id, space, id, space),
    );
  await db.batch(statements);
  const updated = await db
    .prepare("SELECT * FROM appointments WHERE id=? AND space_id=?")
    .bind(id, space)
    .first<Row>();
  if (!updated || updated.status !== status)
    throw new AgendaError(
      "O agendamento foi atualizado por outra solicitação.",
      409,
    );
  return appointmentView(updated);
}
export function enforceWrite(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AgendaError("Envie os dados em JSON.", 415);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new AgendaError("Origem da solicitação não permitida.", 403);
}
export function failure(error: unknown) {
  if (error instanceof AgendaError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error("Agenda request failed", error);
  return Response.json(
    {
      error: "Não foi possível acessar a agenda. Tente novamente em instantes.",
    },
    { status: 503 },
  );
}
