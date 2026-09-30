import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const demoSpaces = sqliteTable("demo_spaces", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    spaceId: text("space_id")
      .notNull()
      .references(() => demoSpaces.id, { onDelete: "cascade" }),
    client: text("client").notNull(),
    serviceId: text("service_id").notNull(),
    professionalId: text("professional_id").notNull(),
    date: text("date").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    status: text("status").notNull().default("confirmed"),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_appointments_space_date").on(t.spaceId, t.date)],
);
export const occupiedSlots = sqliteTable(
  "occupied_slots",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => demoSpaces.id, { onDelete: "cascade" }),
    professionalId: text("professional_id").notNull(),
    date: text("date").notNull(),
    minute: integer("minute").notNull(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.professionalId, t.date, t.minute] }),
    index("idx_slots_appointment").on(t.appointmentId),
  ],
);
