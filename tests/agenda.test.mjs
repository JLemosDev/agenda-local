import test from "node:test";
import assert from "node:assert/strict";
import {
  validateBooking,
  availableSlots,
  occupancyMinutes,
  businessNow,
} from "../lib/agenda-domain.mjs";
const now = new Date("2026-09-30T12:00:00Z"),
  base = {
    client: "Cliente fictício",
    serviceId: "corte",
    professionalId: "ana",
    date: "2026-10-01",
    time: "10:00",
  };
test("usa o horário de Brasília sem depender do fuso da máquina", () =>
  assert.deepEqual(businessNow(now), { date: "2026-09-30", minute: 540 }));
test("normaliza nome e calcula a duração do serviço no servidor", () => {
  const b = validateBooking(
    { ...base, client: "  Cliente fictício  ", serviceId: "combo" },
    now,
  );
  assert.equal(b.client, "Cliente fictício");
  assert.equal(b.endMinute, 660);
});
test("rejeita datas inexistentes", () =>
  assert.throws(
    () => validateBooking({ ...base, date: "2026-09-31" }, now),
    /data válida/,
  ));
test("não aceita horários passados nem o instante atual", () =>
  assert.throws(
    () => validateBooking({ ...base, date: "2026-09-30", time: "09:00" }, now),
    /futuro/,
  ));
test("não aceita domingo", () =>
  assert.throws(
    () => validateBooking({ ...base, date: "2026-10-04" }, now),
    /domingos/,
  ));
test("não aceita atendimento depois do fechamento", () =>
  assert.throws(
    () => validateBooking({ ...base, serviceId: "combo", time: "17:30" }, now),
    /18h/,
  ));
test("não aceita horário fora da grade", () =>
  assert.throws(
    () => validateBooking({ ...base, time: "10:15" }, now),
    /atendimento/,
  ));
test("não aceita profissional inexistente", () =>
  assert.throws(
    () => validateBooking({ ...base, professionalId: "outro" }, now),
    /Profissional/,
  ));
test("bloqueia sobreposição considerando toda a duração", () => {
  const slots = availableSlots(
    base.date,
    "combo",
    "ana",
    occupancyMinutes(600, 630),
    now,
  );
  assert(!slots.includes("09:30"));
  assert(!slots.includes("10:00"));
  assert(slots.includes("10:30"));
});
test("limites permitem atendimentos consecutivos", () => {
  assert(!occupancyMinutes(540, 570).includes(570));
  const slots = availableSlots(
    base.date,
    "corte",
    "ana",
    occupancyMinutes(540, 570),
    now,
  );
  assert(slots.includes("09:30"));
});
test("rejeita observações longas", () =>
  assert.throws(
    () => validateBooking({ ...base, notes: "x".repeat(251) }, now),
    /250/,
  ));
test("não aceita datas além de 90 dias", () =>
  assert.throws(
    () => validateBooking({ ...base, date: "2027-03-01" }, now),
    /90 dias/,
  ));
