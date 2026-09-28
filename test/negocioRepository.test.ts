import { beforeEach, describe, expect, it } from "vitest";
import { abrirBanco } from "../src/db/database.js";
import { ID_NEGOCIO_SEED } from "../src/db/migrations/0002_negocios_multi_tenant.js";
import { NegocioRepository } from "../src/db/negocioRepository.js";
import type { ConfigNegocio } from "../src/domain/negocio.js";
import type Database from "better-sqlite3";

const CONFIG_TESTE: ConfigNegocio = {
  nome: "Salão Teste",
  whatsappAuthDir: "./data/auth-salao-teste",
  numerosAdmin: ["5511999999999"],
  antecedenciaMinimaCancelamentoHoras: 3,
  janelaAgendamentoDias: 7,
  catalogoServicos: [{ id: "escova", nome: "Escova", duracaoMin: 30, precoCentavos: 3000 }],
  horarioFuncionamento: {
    0: null,
    1: { abreHora: 10, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    2: { abreHora: 10, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    3: { abreHora: 10, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    4: { abreHora: 10, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    5: { abreHora: 10, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    6: null,
  },
};

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

  it("cria um negócio novo e ele é lido de volta com catálogo/horário intactos", () => {
    repo.criar("salao-teste", CONFIG_TESTE);

    const negocio = repo.buscarPorId("salao-teste");
    expect(negocio).not.toBeNull();
    expect(negocio?.ativo).toBe(true);
    expect(negocio?.nome).toBe("Salão Teste");
    expect(negocio?.numerosAdmin).toEqual(["5511999999999"]);
    expect(negocio?.antecedenciaMinimaCancelamentoHoras).toBe(3);
    expect(negocio?.catalogoServicos).toEqual(CONFIG_TESTE.catalogoServicos);
    expect(negocio?.horarioFuncionamento[1]).toMatchObject({ abreHora: 10, fechaHora: 18 });
    expect(negocio?.horarioFuncionamento[0]).toBeNull();
  });

  it("negócio criado aparece em listarAtivos e em listarTodos", () => {
    repo.criar("salao-teste", CONFIG_TESTE);
    expect(repo.listarAtivos().map((n) => n.id)).toContain("salao-teste");
    expect(repo.listarTodos().map((n) => n.id)).toContain("salao-teste");
  });

  it("desativar um negócio faz ele sumir de listarAtivos mas continuar em listarTodos/buscarPorId", () => {
    repo.criar("salao-teste", CONFIG_TESTE);
    repo.desativar("salao-teste");

    expect(repo.listarAtivos().map((n) => n.id)).not.toContain("salao-teste");
    expect(repo.listarTodos().map((n) => n.id)).toContain("salao-teste");
    expect(repo.buscarPorId("salao-teste")?.ativo).toBe(false);
  });

  it("listarTodos inclui negócios ativos e inativos", () => {
    repo.criar("salao-teste", CONFIG_TESTE);
    repo.desativar(ID_NEGOCIO_SEED);

    const todos = repo.listarTodos().map((n) => n.id).sort();
    expect(todos).toEqual([ID_NEGOCIO_SEED, "salao-teste"].sort());
  });
});
