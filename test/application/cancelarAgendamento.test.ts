import { addMinutes } from "date-fns";
import { describe, expect, it } from "vitest";
import { CancelarAgendamentoUseCase } from "../../src/application/cancelarAgendamento.js";
import { AgendaPortFake } from "../fakes/agendaPortFake.js";

const AGORA = new Date(2026, 8, 29, 9, 0, 0, 0);
const TELEFONE = "5519991234567";
const ANTECEDENCIA_MINIMA_HORAS = 2;

describe("CancelarAgendamentoUseCase", () => {
  it("cancela quando há antecedência suficiente", async () => {
    const porta = new AgendaPortFake();
    const inicio = addMinutes(AGORA, 60 * 5);
    const id = porta.semear({ telefone: TELEFONE, servico: "corte", inicio, fim: addMinutes(inicio, 40) });

    const resultado = await new CancelarAgendamentoUseCase(porta).executar({
      idAgendamento: id,
      antecedenciaMinimaHoras: ANTECEDENCIA_MINIMA_HORAS,
      agora: AGORA,
    });

    expect(resultado.ok).toBe(true);
    expect(porta.agendamentos).toHaveLength(0);
  });

  it("recusa cancelar em cima da hora", async () => {
    const porta = new AgendaPortFake();
    const inicio = addMinutes(AGORA, 30); // só 30min à frente — menor que a antecedência mínima
    const id = porta.semear({ telefone: TELEFONE, servico: "corte", inicio, fim: addMinutes(inicio, 40) });

    const resultado = await new CancelarAgendamentoUseCase(porta).executar({
      idAgendamento: id,
      antecedenciaMinimaHoras: ANTECEDENCIA_MINIMA_HORAS,
      agora: AGORA,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("antecedencia_insuficiente");
    expect(porta.agendamentos).toHaveLength(1); // continua existindo
  });

  it("informa que não encontrou quando o id não existe (ex: já foi cancelado antes)", async () => {
    const porta = new AgendaPortFake();

    const resultado = await new CancelarAgendamentoUseCase(porta).executar({
      idAgendamento: "id-inexistente",
      antecedenciaMinimaHoras: ANTECEDENCIA_MINIMA_HORAS,
      agora: AGORA,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("nao_encontrado");
  });
});
