import { describe, expect, it } from "vitest";
import { pareceConfigNegocioValida } from "../src/domain/negocio.js";

const CONFIG_VALIDA = {
  nome: "Salão Teste",
  whatsappAuthDir: "./data/auth-salao-teste",
  numerosAdmin: ["5511999999999"],
  antecedenciaMinimaCancelamentoHoras: 2,
  janelaAgendamentoDias: 14,
  catalogoServicos: [{ id: "corte", nome: "Corte", duracaoMin: 30, precoCentavos: 3000 }],
  horarioFuncionamento: {
    0: null,
    1: { abreHora: 9, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    2: { abreHora: 9, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    3: { abreHora: 9, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    4: { abreHora: 9, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    5: { abreHora: 9, abreMinuto: 0, fechaHora: 18, fechaMinuto: 0 },
    6: null,
  },
};

describe("pareceConfigNegocioValida", () => {
  it("aceita uma config válida e completa", () => {
    expect(pareceConfigNegocioValida(CONFIG_VALIDA)).toBe(true);
  });

  it("aceita numerosAdmin vazio", () => {
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, numerosAdmin: [] })).toBe(true);
  });

  it("rejeita valores que não são objeto", () => {
    expect(pareceConfigNegocioValida(null)).toBe(false);
    expect(pareceConfigNegocioValida("string")).toBe(false);
    expect(pareceConfigNegocioValida(42)).toBe(false);
    expect(pareceConfigNegocioValida([])).toBe(false);
  });

  it("rejeita nome ou whatsappAuthDir ausente ou vazio", () => {
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, nome: "" })).toBe(false);
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, nome: undefined })).toBe(false);
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, whatsappAuthDir: "" })).toBe(false);
  });

  it("rejeita numerosAdmin com valor que não seja só dígitos", () => {
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, numerosAdmin: ["+55 19 99123-4567"] })).toBe(false);
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, numerosAdmin: "5511999999999" })).toBe(false);
  });

  it("rejeita antecedenciaMinimaCancelamentoHoras ou janelaAgendamentoDias inválidos", () => {
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, antecedenciaMinimaCancelamentoHoras: 0 })).toBe(false);
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, antecedenciaMinimaCancelamentoHoras: -1 })).toBe(false);
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, janelaAgendamentoDias: "14" })).toBe(false);
  });

  it("rejeita catalogoServicos vazio ou mal formado", () => {
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, catalogoServicos: [] })).toBe(false);
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, catalogoServicos: [{ id: "corte" }] })).toBe(false);
    expect(
      pareceConfigNegocioValida({
        ...CONFIG_VALIDA,
        catalogoServicos: [{ id: "corte", nome: "Corte", duracaoMin: -5, precoCentavos: 100 }],
      }),
    ).toBe(false);
  });

  it("rejeita horarioFuncionamento faltando algum dia da semana", () => {
    const { 6: _sabado, ...semSabado } = CONFIG_VALIDA.horarioFuncionamento;
    expect(pareceConfigNegocioValida({ ...CONFIG_VALIDA, horarioFuncionamento: semSabado })).toBe(false);
  });

  it("rejeita horarioFuncionamento com faixa mal formada", () => {
    expect(
      pareceConfigNegocioValida({
        ...CONFIG_VALIDA,
        horarioFuncionamento: { ...CONFIG_VALIDA.horarioFuncionamento, 1: { abreHora: 9 } },
      }),
    ).toBe(false);
  });
});
