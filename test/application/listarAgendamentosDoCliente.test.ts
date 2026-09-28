import { addMinutes } from "date-fns";
import { describe, expect, it } from "vitest";
import { ListarAgendamentosDoClienteUseCase } from "../../src/application/listarAgendamentosDoCliente.js";
import { AgendaPortFake } from "../fakes/agendaPortFake.js";

const AGORA = new Date(2026, 8, 29, 9, 0, 0, 0);
const TELEFONE = "5519991234567";

describe("ListarAgendamentosDoClienteUseCase", () => {
  it("devolve vazio quando o cliente não tem agendamento futuro", async () => {
    const porta = new AgendaPortFake();
    const resultado = await new ListarAgendamentosDoClienteUseCase(porta).executar({ telefone: TELEFONE, agora: AGORA });
    expect(resultado).toEqual([]);
  });

  it("devolve só os agendamentos futuros do telefone informado", async () => {
    const porta = new AgendaPortFake();
    const inicio = addMinutes(AGORA, 60);
    porta.semear({ telefone: TELEFONE, servico: "corte", inicio, fim: addMinutes(inicio, 40) });
    porta.semear({ telefone: "5511000000000", servico: "corte", inicio, fim: addMinutes(inicio, 40) });
    porta.semear({ telefone: TELEFONE, servico: "barba", inicio: addMinutes(AGORA, -60), fim: addMinutes(AGORA, -20) });

    const resultado = await new ListarAgendamentosDoClienteUseCase(porta).executar({ telefone: TELEFONE, agora: AGORA });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.servico).toBe("corte");
  });
});
