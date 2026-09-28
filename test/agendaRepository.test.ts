import type { Database } from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { AgendaRepositorySqlite } from "../src/db/agendaRepository.js";
import { abrirBanco } from "../src/db/database.js";
import { ID_NEGOCIO_SEED } from "../src/db/migrations/0002_negocios_multi_tenant.js";

// Integração de verdade com SQLite (em memória) — não é fake, é o adaptador real.
describe("AgendaRepositorySqlite (integração com SQLite)", () => {
  let repo: AgendaRepositorySqlite;

  beforeEach(() => {
    const db = abrirBanco(":memory:");
    repo = new AgendaRepositorySqlite(db, ID_NEGOCIO_SEED);
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

describe("AgendaRepositorySqlite — isolamento entre negócios", () => {
  const OUTRO_NEGOCIO_ID = "outro-negocio";
  let db: Database;
  let repoA: AgendaRepositorySqlite;
  let repoB: AgendaRepositorySqlite;

  beforeEach(() => {
    db = abrirBanco(":memory:");
    db.prepare(
      "INSERT INTO negocios (id, nome, whatsapp_auth_dir, catalogo_servicos, horario_funcionamento) VALUES (?, ?, ?, ?, ?)",
    ).run(OUTRO_NEGOCIO_ID, "Outro Negócio", "./data/auth-outro", "[]", "{}");

    repoA = new AgendaRepositorySqlite(db, ID_NEGOCIO_SEED);
    repoB = new AgendaRepositorySqlite(db, OUTRO_NEGOCIO_ID);
  });

  it("o mesmo telefone pode ser cliente dos dois negócios ao mesmo tempo", async () => {
    const telefone = "5519999999999";
    const inicio = new Date(2026, 8, 29, 10, 0);
    const fim = new Date(2026, 8, 29, 10, 40);

    await expect(repoA.criarAgendamento({ telefone, servico: "corte", inicio, fim })).resolves.toBeDefined();
    await expect(repoB.criarAgendamento({ telefone, servico: "corte", inicio, fim })).resolves.toBeDefined();

    const clientes = db.prepare("SELECT negocio_id FROM clientes WHERE telefone = ?").all(telefone) as {
      negocio_id: string;
    }[];
    expect(clientes.map((c) => c.negocio_id).sort()).toEqual([ID_NEGOCIO_SEED, OUTRO_NEGOCIO_ID].sort());
  });

  it("listarAgendamentosDoDia de um negócio nunca inclui agendamentos do outro", async () => {
    const inicio = new Date(2026, 8, 29, 10, 0);
    const fim = new Date(2026, 8, 29, 10, 40);
    await repoA.criarAgendamento({ telefone: "5519999999999", servico: "corte", inicio, fim });
    await repoB.criarAgendamento({ telefone: "5519999999999", servico: "corte", inicio, fim });

    expect(await repoA.listarAgendamentosDoDia(inicio)).toHaveLength(1);
    expect(await repoB.listarAgendamentosDoDia(inicio)).toHaveLength(1);
  });

  it("listarAgendamentosFuturosDoCliente de um negócio nunca inclui agendamentos do outro, mesmo com o mesmo telefone", async () => {
    const telefone = "5519999999999";
    const agora = new Date(2026, 8, 29, 9, 0);
    await repoA.criarAgendamento({ telefone, servico: "corte", inicio: new Date(2026, 8, 29, 10, 0), fim: new Date(2026, 8, 29, 10, 40) });
    await repoB.criarAgendamento({ telefone, servico: "barba", inicio: new Date(2026, 8, 29, 11, 0), fim: new Date(2026, 8, 29, 11, 30) });

    const futurosA = await repoA.listarAgendamentosFuturosDoCliente(telefone, agora);
    const futurosB = await repoB.listarAgendamentosFuturosDoCliente(telefone, agora);
    expect(futurosA).toHaveLength(1);
    expect(futurosA[0]?.servico).toBe("corte");
    expect(futurosB).toHaveLength(1);
    expect(futurosB[0]?.servico).toBe("barba");
  });

  it("buscarAgendamentoPorId não encontra um agendamento de outro negócio", async () => {
    const { id } = await repoA.criarAgendamento({
      telefone: "5519999999999",
      servico: "corte",
      inicio: new Date(2026, 8, 29, 10, 0),
      fim: new Date(2026, 8, 29, 10, 40),
    });

    expect(await repoA.buscarAgendamentoPorId(id)).not.toBeNull();
    expect(await repoB.buscarAgendamentoPorId(id)).toBeNull();
  });

  it("cancelarAgendamento não cancela um agendamento de outro negócio", async () => {
    const { id } = await repoA.criarAgendamento({
      telefone: "5519999999999",
      servico: "corte",
      inicio: new Date(2026, 8, 29, 10, 0),
      fim: new Date(2026, 8, 29, 10, 40),
    });

    await repoB.cancelarAgendamento(id);

    expect(await repoA.buscarAgendamentoPorId(id)).not.toBeNull();
  });

  it("listarResumoDoDia de um negócio nunca inclui agendamentos do outro", async () => {
    await repoA.criarAgendamento({
      telefone: "5519999999999",
      servico: "corte",
      inicio: new Date(2026, 8, 29, 10, 0),
      fim: new Date(2026, 8, 29, 10, 40),
    });
    await repoB.criarAgendamento({
      telefone: "5511888888888",
      servico: "barba",
      inicio: new Date(2026, 8, 29, 11, 0),
      fim: new Date(2026, 8, 29, 11, 30),
    });

    expect(await repoA.listarResumoDoDia(new Date(2026, 8, 29))).toHaveLength(1);
    expect(await repoB.listarResumoDoDia(new Date(2026, 8, 29))).toHaveLength(1);
  });
});
