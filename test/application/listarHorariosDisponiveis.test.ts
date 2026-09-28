import { addMinutes } from "date-fns";
import { describe, expect, it } from "vitest";
import { ListarHorariosDisponiveisUseCase } from "../../src/application/listarHorariosDisponiveis.js";
import { AgendaPortFake } from "../fakes/agendaPortFake.js";
import { NEGOCIO_TESTE } from "../fakes/negocioFake.js";

// 2026-09-29 09:00 é uma terça-feira, dentro do expediente (09h-19h).
const AGORA = new Date(2026, 8, 29, 9, 0, 0, 0);
const SERVICO = NEGOCIO_TESTE.catalogoServicos[0]!; // corte, 40min

describe("ListarHorariosDisponiveisUseCase", () => {
  it("lista os horários livres do dia, sem agendamento nenhum", async () => {
    const porta = new AgendaPortFake();
    const livres = await new ListarHorariosDisponiveisUseCase(porta).executar({
      negocio: NEGOCIO_TESTE,
      servico: SERVICO,
      data: AGORA,
      agora: AGORA,
    });
    expect(livres.length).toBeGreaterThan(0);
  });

  it("exclui horários que colidem com um agendamento já existente", async () => {
    const porta = new AgendaPortFake();
    porta.semear({ telefone: "5511000000000", servico: SERVICO.id, inicio: AGORA, fim: addMinutes(AGORA, SERVICO.duracaoMin) });

    const livres = await new ListarHorariosDisponiveisUseCase(porta).executar({
      negocio: NEGOCIO_TESTE,
      servico: SERVICO,
      data: AGORA,
      agora: AGORA,
    });

    expect(livres.some((h) => h.getTime() === AGORA.getTime())).toBe(false);
  });

  it("devolve vazio num dia fechado", async () => {
    const porta = new AgendaPortFake();
    const domingo = new Date(2026, 8, 27, 9, 0, 0, 0); // domingo — fechado no NEGOCIO_TESTE
    const livres = await new ListarHorariosDisponiveisUseCase(porta).executar({
      negocio: NEGOCIO_TESTE,
      servico: SERVICO,
      data: domingo,
      agora: domingo,
    });
    expect(livres).toEqual([]);
  });
});
