import { describe, expect, it } from "vitest";
import { EstadoConversa, pareceSessaoValida } from "../src/conversation/states.js";

describe("pareceSessaoValida", () => {
  it("aceita o contexto inicial", () => {
    expect(pareceSessaoValida({ estado: EstadoConversa.MENU })).toBe(true);
  });

  it("aceita um contexto completo, com os campos opcionais preenchidos", () => {
    expect(
      pareceSessaoValida({
        estado: EstadoConversa.AGENDAR_HORARIO,
        servicoSelecionado: "corte",
        horariosOferecidos: ["2026-09-29T09:00:00.000Z"],
        agendamentosOferecidos: ["abc-123"],
      }),
    ).toBe(true);
  });

  it("rejeita valores que não são objeto", () => {
    expect(pareceSessaoValida(null)).toBe(false);
    expect(pareceSessaoValida(undefined)).toBe(false);
    expect(pareceSessaoValida("MENU")).toBe(false);
    expect(pareceSessaoValida(42)).toBe(false);
    expect(pareceSessaoValida([])).toBe(false);
  });

  it("rejeita estado ausente ou desconhecido", () => {
    expect(pareceSessaoValida({})).toBe(false);
    expect(pareceSessaoValida({ estado: "ESTADO_QUE_NAO_EXISTE" })).toBe(false);
  });

  it("rejeita campos opcionais com o tipo errado", () => {
    expect(pareceSessaoValida({ estado: EstadoConversa.MENU, servicoSelecionado: 123 })).toBe(false);
    expect(pareceSessaoValida({ estado: EstadoConversa.MENU, horariosOferecidos: "não é array" })).toBe(false);
    expect(pareceSessaoValida({ estado: EstadoConversa.MENU, horariosOferecidos: [1, 2, 3] })).toBe(false);
    expect(pareceSessaoValida({ estado: EstadoConversa.MENU, agendamentosOferecidos: [{ id: "1" }] })).toBe(false);
  });
});
