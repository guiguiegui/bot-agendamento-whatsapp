import { beforeEach, describe, expect, it } from "vitest";
import { abrirBanco } from "../src/db/database.js";
import { ID_NEGOCIO_SEED } from "../src/db/migrations/0002_negocios_multi_tenant.js";
import { NegocioRepository } from "../src/db/negocioRepository.js";
import type Database from "better-sqlite3";

describe("NegocioRepository", () => {
  let db: Database.Database;
  let repo: NegocioRepository;

  beforeEach(() => {
    db = abrirBanco(":memory:");
    repo = new NegocioRepository(db);
  });

  it("lista o negócio seedado como ativo, com o catálogo e horário já convertidos dos tipos certos", () => {
    const ativos = repo.listarAtivos();
    expect(ativos).toHaveLength(1);

    const negocio = ativos[0]!;
    expect(negocio.id).toBe(ID_NEGOCIO_SEED);
    expect(negocio.nome).toBe("Barba & Ofício");
    expect(negocio.ativo).toBe(true);
    expect(Array.isArray(negocio.catalogoServicos)).toBe(true);
    expect(negocio.catalogoServicos[0]).toMatchObject({ id: "corte", duracaoMin: 40 });
    expect(negocio.horarioFuncionamento[2]).toMatchObject({ abreHora: 9, fechaHora: 19 });
    expect(negocio.horarioFuncionamento[0]).toBeNull();
    expect(negocio.antecedenciaMinimaCancelamentoHoras).toBe(2);
    expect(negocio.janelaAgendamentoDias).toBe(14);
  });

  it("busca por id retorna o negócio", () => {
    const negocio = repo.buscarPorId(ID_NEGOCIO_SEED);
    expect(negocio?.id).toBe(ID_NEGOCIO_SEED);
  });

  it("busca por id retorna null quando não existe", () => {
    expect(repo.buscarPorId("id-que-nao-existe")).toBeNull();
  });

  it("não lista negócio inativo", () => {
    db.prepare("UPDATE negocios SET ativo = 0 WHERE id = ?").run(ID_NEGOCIO_SEED);
    expect(repo.listarAtivos()).toHaveLength(0);
    // buscarPorId não filtra por ativo — decisão deliberada, quem chama decide o que fazer com um negócio inativo
    expect(repo.buscarPorId(ID_NEGOCIO_SEED)?.ativo).toBe(false);
  });

  it("faz parse correto de numerosAdmin (CSV) quando preenchido", () => {
    db.prepare("UPDATE negocios SET numeros_admin = ? WHERE id = ?").run(
      "5519991234567, 5511888888888",
      ID_NEGOCIO_SEED,
    );
    const negocio = repo.buscarPorId(ID_NEGOCIO_SEED);
    expect(negocio?.numerosAdmin).toEqual(["5519991234567", "5511888888888"]);
  });

  it("numerosAdmin vazio vira array vazio, não [\"\"]", () => {
    const negocio = repo.buscarPorId(ID_NEGOCIO_SEED);
    expect(negocio?.numerosAdmin).toEqual([]);
  });
});
