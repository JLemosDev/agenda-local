export const SERVICES = Object.freeze([
  { id: "corte", name: "Corte de cabelo", duration: 30, price: 4500 },
  { id: "barba", name: "Barba e acabamento", duration: 30, price: 3500 },
  { id: "combo", name: "Corte + barba", duration: 60, price: 7000 },
]);
export const PROFESSIONALS = Object.freeze([
  { id: "ana", name: "Ana Lima" },
  { id: "bruno", name: "Bruno Costa" },
]);
export class AgendaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function businessNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    date: p.year + "-" + p.month + "-" + p.day,
    minute: Number(p.hour) * 60 + Number(p.minute),
  };
}
export function validDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new AgendaError("Informe uma data válida.");
  const d = new Date(date + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date)
    throw new AgendaError("Informe uma data válida.");
  return d;
}
export function defaultDate(now = new Date()) {
  const b = businessNow(now);
  const d = validDate(b.date);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function timeToMinute(time) {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new AgendaError("Informe um horário válido.");
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
export function minuteToTime(minute) {
  return (
    String(Math.floor(minute / 60)).padStart(2, "0") +
    ":" +
    String(minute % 60).padStart(2, "0")
  );
}
export function getService(id) {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) throw new AgendaError("Serviço não encontrado.");
  return s;
}
export function getProfessional(id) {
  const p = PROFESSIONALS.find((x) => x.id === id);
  if (!p) throw new AgendaError("Profissional não encontrado.");
  return p;
}
export function validateDay(date, now = new Date()) {
  const d = validDate(date),
    b = businessNow(now),
    limit = validDate(b.date);
  limit.setUTCDate(limit.getUTCDate() + 90);
  if (date < b.date || date > limit.toISOString().slice(0, 10))
    throw new AgendaError("Escolha uma data entre hoje e os próximos 90 dias.");
  if (d.getUTCDay() === 0)
    throw new AgendaError("O estúdio não atende aos domingos.");
  return b;
}
export function validateBooking(input, now = new Date()) {
  if (!input || typeof input !== "object")
    throw new AgendaError("Dados de agendamento inválidos.");
  const client = typeof input.client === "string" ? input.client.trim() : "";
  if (client.length < 2 || client.length > 80)
    throw new AgendaError("O nome deve ter entre 2 e 80 caracteres.");
  const service = getService(input.serviceId);
  getProfessional(input.professionalId);
  const b = validateDay(input.date, now),
    start = timeToMinute(input.time);
  if (start % 30 !== 0 || start < 540 || start + service.duration > 1080)
    throw new AgendaError("Escolha um horário de atendimento, das 9h às 18h.");
  if (input.date === b.date && start <= b.minute)
    throw new AgendaError("Escolha um horário futuro.");
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > 250)
    throw new AgendaError("A observação deve ter até 250 caracteres.");
  return {
    client,
    serviceId: service.id,
    professionalId: input.professionalId,
    date: input.date,
    startMinute: start,
    endMinute: start + service.duration,
    notes,
  };
}
export function occupancyMinutes(start, end) {
  const result = [];
  for (let m = start; m < end; m += 5) result.push(m);
  return result;
}
export function availableSlots(
  date,
  serviceId,
  professionalId,
  occupied = [],
  now = new Date(),
) {
  const service = getService(serviceId);
  getProfessional(professionalId);
  const b = validateDay(date, now),
    taken = new Set(occupied);
  const slots = [];
  for (let start = 540; start + service.duration <= 1080; start += 30) {
    if (date === b.date && start <= b.minute) continue;
    if (
      occupancyMinutes(start, start + service.duration).every(
        (m) => !taken.has(m),
      )
    )
      slots.push(minuteToTime(start));
  }
  return slots;
}
