import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { abrirBanco } from "../src/db/database.js";
import { migracao0001EsquemaInicial } from "../src/db/migrations/0001_esquema_inicial.js";
import { ID_NEGOCIO_SEED, migracao0002NegociosMultiTenant } from "../src/db/migrations/0002_negocios_multi_tenant.js";
import { MIGRACOES } from "../src/db/migrations/index.js";
import { aplicarMigracoes } from "../src/db/migrationRunner.js";

describe("migrações", () => {
  it("abrirBanco aplica todas as migrações numa base nova, na ordem certa", () => {
    const db = abrirBanco(":memory:");
    const aplicadas = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all() as { id: string }[];
    expect(aplicadas.map((a) => a.id)).toEqual(MIGRACOES.map((m) => m.id));
  });

  it("não reaplica uma migração já registrada (idempotente)", () => {
    const db = new Database(":memory:");
    aplicarMigracoes(db, MIGRACOES);
    // se o runner não checasse o que já foi aplicado, isso violaria a PK de schema_migrations
    expect(() => aplicarMigracoes(db, MIGRACOES)).not.toThrow();

    const total = db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get() as { n: number };
    expect(total.n).toBe(MIGRACOES.length);
  });

  it("0002 semeia o negócio único de hoje com o catálogo e horário atuais", () => {
    const db = new Database(":memory:");
    aplicarMigracoes(db, MIGRACOES);

    const negocio = db.prepare("SELECT * FROM negocios WHERE id = ?").get(ID_NEGOCIO_SEED) as
      | { nome: string; ativo: number; catalogo_servicos: string; horario_funcionamento: string }
      | undefined;

    expect(negocio).toBeDefined();
    expect(negocio?.nome).toBe("Barba & Ofício");
    expect(negocio?.ativo).toBe(1);

    const catalogo = JSON.parse(negocio!.catalogo_servicos) as unknown[];
    expect(catalogo).toHaveLength(6);

    const horario = JSON.parse(negocio!.horario_funcionamento) as Record<string, unknown>;
    expect(horario["0"]).toBeNull();
  });

  it("0002 preenche negocio_id retroativamente em clientes/agendamentos já existentes (backfill)", () => {
    const db = new Database(":memory:");
    aplicarMigracoes(db, [migracao0001EsquemaInicial]);

    // dados "legados": criados antes da tabela negocios existir
    db.prepare("INSERT INTO clientes (id, telefone) VALUES (?, ?)").run("cli-1", "5519999999999");
    db.prepare(
      "INSERT INTO agendamentos (id, telefone, servico, inicio, fim) VALUES (?, ?, ?, ?, ?)",
    ).run("ag-1", "5519999999999", "corte", "2026-09-29T10:00:00.000Z", "2026-09-29T10:40:00.000Z");

    aplicarMigracoes(db, [migracao0002NegociosMultiTenant]);

    const cliente = db.prepare("SELECT negocio_id FROM clientes WHERE id = ?").get("cli-1") as {
      negocio_id: string;
    };
    const agendamento = db.prepare("SELECT negocio_id FROM agendamentos WHERE id = ?").get("ag-1") as {
      negocio_id: string;
    };

    expect(cliente.negocio_id).toBe(ID_NEGOCIO_SEED);
    expect(agendamento.negocio_id).toBe(ID_NEGOCIO_SEED);
  });

  it("agendaRepository continua funcionando normalmente depois da migração (sem quebrar o constraint de clientes)", () => {
    const db = abrirBanco(":memory:");
    // simula o garantirCliente do AgendaRepositorySqlite: ON CONFLICT(telefone) só é
    // válido enquanto a constraint UNIQUE(telefone) sozinha continuar existindo.
    expect(() => {
      db.prepare("INSERT INTO clientes (id, telefone) VALUES (?, ?) ON CONFLICT(telefone) DO NOTHING").run(
        "cli-1",
        "5519999999999",
      );
      db.prepare("INSERT INTO clientes (id, telefone) VALUES (?, ?) ON CONFLICT(telefone) DO NOTHING").run(
        "cli-2",
        "5519999999999",
      );
    }).not.toThrow();

    const total = db.prepare("SELECT COUNT(*) AS n FROM clientes").get() as { n: number };
    expect(total.n).toBe(1);
  });
});
