import { beforeEach, describe, expect, it } from "vitest";
import { AgendaRepositorySqlite } from "../src/db/agendaRepository.js";
import { abrirBanco } from "../src/db/database.js";

// Integração de verdade com SQLite (em memória) — não é fake, é o adaptador real.
describe("AgendaRepositorySqlite (integração com SQLite)", () => {
  let repo: AgendaRepositorySqlite;

  beforeEach(() => {
    const db = abrirBanco(":memory:");
    repo = new AgendaRepositorySqlite(db);
  });

  it("cria e lista agendamentos do dia", async () => {
    const inicio = new Date(2026, 8, 29, 10, 0);
    const fim = new Date(2026, 8, 29, 10, 40);
    await repo.criarAgendamento({ telefone: "5519999999999", servico: "corte", inicio, fim });

    const doDia = await repo.listarAgendamentosDoDia(inicio);
    expect(doDia).toHaveLength(1);
    expect(doDia[0]?.inicio.toISOString()).toBe(inicio.toISOString());
  });

  it("cria o cliente automaticamente e não duplica em agendamentos seguintes", async () => {
    const telefone = "5519999999999";
    await repo.criarAgendamento({
      telefone,
      servico: "corte",
      inicio: new Date(2026, 8, 29, 10, 0),
      fim: new Date(2026, 8, 29, 10, 40),
    });
    await repo.criarAgendamento({
      telefone,
      servico: "barba",
      inicio: new Date(2026, 8, 29, 11, 0),
      fim: new Date(2026, 8, 29, 11, 30),
    });

    const futuros = await repo.listarAgendamentosFuturosDoCliente(telefone, new Date(2026, 8, 29, 9, 0));
    expect(futuros).toHaveLength(2);
  });

  it("cancelamento muda o status e o agendamento some das listagens", async () => {
    const telefone = "5519999999999";
    const { id } = await repo.criarAgendamento({
      telefone,
      servico: "corte",
      inicio: new Date(2026, 8, 29, 10, 0),
      fim: new Date(2026, 8, 29, 10, 40),
    });

    await repo.cancelarAgendamento(id);

    expect(await repo.listarAgendamentosFuturosDoCliente(telefone, new Date(2026, 8, 29, 9, 0))).toHaveLength(0);
    expect(await repo.buscarAgendamentoPorId(id)).toBeNull();
  });

  it("resumo do dia inclui agendamentos de todos os clientes", async () => {
    await repo.criarAgendamento({
      telefone: "5519999999999",
      servico: "corte",
      inicio: new Date(2026, 8, 29, 10, 0),
      fim: new Date(2026, 8, 29, 10, 40),
    });
    await repo.criarAgendamento({
      telefone: "5511888888888",
      servico: "barba",
      inicio: new Date(2026, 8, 29, 11, 0),
      fim: new Date(2026, 8, 29, 11, 30),
    });

    expect(await repo.listarResumoDoDia(new Date(2026, 8, 29))).toHaveLength(2);
  });
});
