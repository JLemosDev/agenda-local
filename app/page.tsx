"use client";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Users,
  Scissors,
  Plus,
  Check,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  SERVICES,
  PROFESSIONALS,
  defaultDate,
  type BookingInput,
} from "../lib/agenda-domain.mjs";
type Appointment = {
  id: string;
  client: string;
  service: string;
  serviceId: string;
  professionalId: string;
  professional: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  notes: string;
  price: number;
};
type Agenda = {
  appointments: Appointment[];
  slots: string[];
  dayMessage?: string;
};
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: any) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
async function api<T = Agenda>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}
export default function Home() {
  const [date, setDate] = useState(defaultDate()),
    [service, setService] = useState("corte"),
    [professional, setProfessional] = useState("ana"),
    [filter, setFilter] = useState("all"),
    [client, setClient] = useState(""),
    [notes, setNotes] = useState(""),
    [time, setTime] = useState(""),
    [data, setData] = useState<Agenda | null>(null),
    [error, setError] = useState(""),
    [formError, setFormError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [pendingCancel, setPendingCancel] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const q = new URLSearchParams({
        date,
        serviceId: service,
        professionalId: professional,
      });
      const result = await api("/api/agenda?" + q, { signal });
      setData(result);
      setTime((t) => (result.slots.includes(t) ? t : ""));
      setError("");
      return result as Agenda;
    },
    [date, service, professional],
  );
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    load(abort.signal)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [load]);
  const create = useCallback(
    async (input: BookingInput) => {
      const result = await api<{ appointment: Appointment }>("/api/agenda", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await load();
      setNotice(
        "Agendamento confirmado para " + result.appointment.client + ".",
      );
      return {
        id: result.appointment.id,
        status: result.appointment.status,
        time: result.appointment.time,
      };
    },
    [load],
  );
  const changeStatus = useCallback(
    async (id: string, status: string) => {
      const result = await api<{ appointment: Appointment }>(
        "/api/agenda/" + encodeURIComponent(id),
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      await load();
      setNotice(
        status === "cancelled"
          ? "Agendamento cancelado. O horário foi liberado."
          : "Atendimento marcado como concluído.",
      );
      setPendingCancel("");
      return { id: result.appointment.id, status: result.appointment.status };
    },
    [load],
  );
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) =>
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    register({
      name: "read_agenda",
      description:
        "Consultar a agenda visível e os horários disponíveis da demonstração atual.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => {
        const r = await load();
        return { date, appointments: r.appointments, slots: r.slots };
      },
    });
    register({
      name: "create_appointment",
      description:
        "Criar e confirmar um agendamento com dados fictícios na demonstração atual.",
      inputSchema: {
        type: "object",
        properties: {
          client: { type: "string" },
          serviceId: { type: "string", enum: ["corte", "barba", "combo"] },
          professionalId: { type: "string", enum: ["ana", "bruno"] },
          date: { type: "string" },
          time: { type: "string" },
          notes: { type: "string" },
        },
        required: ["client", "serviceId", "professionalId", "date", "time"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => create(input),
    });
    register({
      name: "cancel_appointment",
      description:
        "Cancelar um agendamento existente na demonstração atual e liberar seu horário.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => {
        if (typeof input?.id !== "string") throw new Error("Informe o ID.");
        return changeStatus(input.id, "cancelled");
      },
    });
    return () => lifecycle.abort();
  }, [create, changeStatus, load, date]);
  const appointments = data?.appointments ?? [],
    active = appointments.filter((a) => a.status !== "cancelled"),
    shown = appointments.filter(
      (a) => filter === "all" || a.professionalId === filter,
    ),
    minutes = active.reduce((n, a) => n + a.duration, 0),
    total = active.reduce((n, a) => n + a.price, 0);
  function moveDay(amount: number) {
    const d = new Date(date + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) return;
    d.setUTCDate(d.getUTCDate() + amount);
    setDate(d.toISOString().slice(0, 10));
    setNotice("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) {
      setFormError("Selecione um horário disponível.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await create({
        client,
        serviceId: service,
        professionalId: professional,
        date,
        time,
        notes,
      });
      setClient("");
      setNotes("");
      setTime("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Não foi possível salvar.");
      await load().catch(() => {});
    } finally {
      setSaving(false);
    }
  }
  async function status(id: string, value: string) {
    setSaving(true);
    try {
      await changeStatus(id, value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <CalendarCheck2 size={27} />
          <span>
            agenda<span className="brand-light">local</span>
          </span>
        </a>
        <div className="business">
          <div className="avatar">EH</div>
          <div>
            <strong>Estúdio Horizonte</strong>
            <span>Negócio de demonstração</span>
          </div>
        </div>
        <nav>
          <a className="nav-active" href="#agenda">
            <CalendarDays size={20} />
            Agenda
          </a>
          <a href="#novo">
            <Plus size={20} />
            Novo agendamento
          </a>
          <a href="#servicos">
            <Scissors size={20} />
            Serviços
          </a>
        </nav>
        <div className="sidebar-bottom">
          <span className="demo-label">PORTFÓLIO • JLEMOSDEV</span>
          <p>Seus testes ficam separados dos outros visitantes.</p>
          <a
            href="https://github.com/JLemosDev/agenda-local"
            target="_blank"
            rel="noreferrer"
          >
            Código no GitHub
          </a>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>ESTÚDIO HORIZONTE</span>
          <span className="demo-pill">Demonstração</span>
        </header>
        <div className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SEU DIA, ORGANIZADO</p>
              <h1>Agenda de atendimentos</h1>
              <p className="muted">Horários e clientes em um só lugar.</p>
            </div>
            <a className="primary" href="#novo">
              <Plus size={18} />
              Novo agendamento
            </a>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}{" "}
              <button
                className="text-button"
                onClick={() => load().catch((e) => setError(e.message))}
              >
                Tentar novamente
              </button>
            </div>
          )}
          <section className="metrics">
            <div>
              <span>
                <CalendarDays size={18} />
                Agendamentos do dia
              </span>
              <strong>{active.length}</strong>
              <small>
                {active.filter((a) => a.status === "confirmed").length}{" "}
                confirmados
              </small>
            </div>
            <div>
              <span>
                <Clock3 size={18} />
                Tempo reservado
              </span>
              <strong>
                {Math.floor(minutes / 60)}h
                {minutes % 60 ? String(minutes % 60).padStart(2, "0") : ""}
              </strong>
              <small>Atendimentos planejados</small>
            </div>
            <div>
              <span>
                <Check size={18} />
                Valor dos atendimentos
              </span>
              <strong>{money(total)}</strong>
              <small>Serviços do dia, sem cobranças</small>
            </div>
          </section>
          <div className="content-grid">
            <section className="panel" id="agenda">
              <div className="panel-heading">
                <div>
                  <h2>Agenda do dia</h2>
                  <p className="muted">Segunda a sábado, das 9h às 18h</p>
                </div>
                <div className="date-nav">
                  <button aria-label="Dia anterior" onClick={() => moveDay(-1)}>
                    <ChevronLeft size={17} />
                  </button>
                  <label className="date-control">
                    Data da agenda
                    <input
                      aria-label="Data da agenda"
                      type="date"
                      value={date}
                      onChange={(e) => {
                        if (e.target.value) setDate(e.target.value);
                      }}
                    />
                  </label>
                  <button aria-label="Próximo dia" onClick={() => moveDay(1)}>
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <label className="filter-control">
                Profissional
                <select
                  aria-label="Filtrar agenda por profissional"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos os profissionais</option>
                  {PROFESSIONALS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="agenda-list" aria-busy={loading}>
                {loading && !data ? (
                  <div className="empty">Carregando sua agenda…</div>
                ) : shown.length ? (
                  shown.map((a) => (
                    <article className="appointment" key={a.id}>
                      <div className="time">
                        <strong>{a.time}</strong>
                        <span>{a.duration} min</span>
                      </div>
                      <div className="appointment-body">
                        <div className="appointment-title">
                          <h3>{a.client}</h3>
                          <span className={"status " + a.status}>
                            {a.status === "confirmed"
                              ? "Confirmado"
                              : a.status === "completed"
                                ? "Concluído"
                                : "Cancelado"}
                          </span>
                        </div>
                        <p>{a.service}</p>
                        <div className="appointment-footer">
                          <span>
                            <Users size={14} />
                            {a.professional}
                          </span>
                          <span>{money(a.price)}</span>
                        </div>
                        {a.notes && (
                          <p className="appointment-notes">{a.notes}</p>
                        )}
                        {a.status === "confirmed" && (
                          <div className="appointment-actions">
                            {pendingCancel === a.id ? (
                              <>
                                <button
                                  className="text-button danger"
                                  disabled={saving}
                                  onClick={() => status(a.id, "cancelled")}
                                >
                                  Confirmar cancelamento
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => setPendingCancel("")}
                                >
                                  Voltar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="text-button"
                                  disabled={saving}
                                  onClick={() => status(a.id, "completed")}
                                >
                                  Concluir atendimento
                                </button>
                                <button
                                  className="text-button danger"
                                  disabled={saving}
                                  onClick={() => setPendingCancel(a.id)}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty">
                    Nenhum agendamento para esta data.
                    <br />
                    <span className="muted">
                      Escolha um horário ao lado para começar.
                    </span>
                  </div>
                )}
              </div>
              <div className="quiet-note">
                <Clock3 size={16} />
                <span>
                  Os horários disponíveis consideram a duração de cada serviço.
                </span>
              </div>
            </section>
            <section className="panel booking-panel" id="novo">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">RESERVE UM HORÁRIO</p>
                  <h2>Novo agendamento</h2>
                </div>
                <CalendarDays size={23} />
              </div>
              <form onSubmit={submit}>
                <label>
                  Nome do cliente
                  <input
                    name="client"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Ex.: Pedro Martins"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Serviço
                  <select
                    name="service"
                    value={service}
                    onChange={(e) => {
                      setService(e.target.value);
                      setTime("");
                    }}
                  >
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} • {s.duration} min
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Profissional
                  <select
                    name="professional"
                    value={professional}
                    onChange={(e) => {
                      setProfessional(e.target.value);
                      setTime("");
                    }}
                  >
                    {PROFESSIONALS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Data do agendamento
                  <input
                    name="date"
                    type="date"
                    value={date}
                    min={defaultDate()}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                      setTime("");
                    }}
                    required
                  />
                </label>
                <fieldset>
                  <legend>Horários disponíveis</legend>
                  {loading ? (
                    <p className="muted">Consultando horários…</p>
                  ) : data?.slots.length ? (
                    <div className="slots">
                      {data.slots.map((t) => (
                        <button
                          aria-pressed={time === t}
                          className={time === t ? "selected" : ""}
                          type="button"
                          onClick={() => setTime(t)}
                          key={t}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">
                      {data?.dayMessage ||
                        "Não há horários livres. Escolha outro profissional ou outra data."}
                    </p>
                  )}
                </fieldset>
                <label className="notes-field">
                  Observação <span className="muted">(opcional)</span>
                  <textarea
                    value={notes}
                    maxLength={250}
                    rows={2}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex.: preferência para o atendimento"
                  />
                </label>
                {formError && (
                  <div className="error" role="alert">
                    {formError}
                  </div>
                )}
                <div className="booking-summary">
                  <span>Total do serviço</span>
                  <strong>
                    {money(SERVICES.find((s) => s.id === service)?.price ?? 0)}
                  </strong>
                </div>
                <button
                  className="primary submit"
                  disabled={saving || loading || !time || !!error}
                  type="submit"
                >
                  <Check size={18} />
                  {saving ? "Salvando…" : "Confirmar agendamento"}
                </button>
                <p className="form-note">
                  Use apenas nomes e informações fictícias.
                  <br />
                  Esta demonstração não envia mensagens nem cobra pagamentos.
                </p>
              </form>
            </section>
          </div>
          <section className="service-strip" id="servicos">
            <h2>Serviços do estúdio</h2>
            <div>
              {SERVICES.map((s) => (
                <article key={s.id}>
                  <Scissors size={20} />
                  <div>
                    <h3>{s.name}</h3>
                    <span>
                      {s.duration} min · {money(s.price)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <footer className="footer">
            Projeto de portfólio desenvolvido com assistência de IA · João Vitor
            Lemos
            <br />
            Os agendamentos desta demonstração ficam vinculados a este
            navegador.
          </footer>
        </div>
      </main>
    </div>
  );
}
